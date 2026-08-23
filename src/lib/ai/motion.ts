/**
 * Visual analysis: motion, scene detection, brightness, contrast, saturation.
 */

import type { ExtractedFrame } from './extract-frames';

export interface MotionFrame {
  time: number;
  intensity: number; // 0-1
}

export interface SceneBoundary {
  time: number; // seconds
  strength: number; // 0-1
}

export interface VisualAnalysis {
  motionFrames: MotionFrame[];
  avgMotion: number; // 0-1
  motionPeaks: { time: number; intensity: number }[]; // high-motion moments
  sceneBoundaries: SceneBoundary[]; // hard cuts
  avgBrightness: number; // 0-1
  contrast: number; // 0-1
  saturation: number; // 0-1
}

function lumaHistogram(imageData: ImageData, samples = 32): { mean: number; std: number } {
  const data = imageData.data;
  const totalPixels = data.length / 4;
  const step = Math.max(1, Math.floor(totalPixels / samples / samples));
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4 * step) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    // Rec. 709 luma
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sum += l;
    sumSq += l * l;
    count++;
  }
  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  return { mean, std: Math.sqrt(Math.max(0, variance)) };
}

function frameDifference(a: ImageData, b: ImageData): number {
  const da = a.data;
  const db = b.data;
  const n = Math.min(da.length, db.length);
  let sum = 0;
  let count = 0;
  const step = 16; // sample every 4 pixels
  for (let i = 0; i < n; i += 4 * step) {
    const dr = (da[i] - db[i]) / 255;
    const dg = (da[i + 1] - db[i + 1]) / 255;
    const dbi = (da[i + 2] - db[i + 2]) / 255;
    sum += Math.sqrt(dr * dr + dg * dg + dbi * dbi);
    count++;
  }
  return count > 0 ? sum / count : 0;
}

function saturationOf(imageData: ImageData): number {
  const data = imageData.data;
  let total = 0;
  let count = 0;
  const step = 16;
  for (let i = 0; i < data.length; i += 4 * step) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    total += sat;
    count++;
  }
  return count > 0 ? total / count : 0;
}

export function analyzeVisuals(frames: ExtractedFrame[]): VisualAnalysis {
  if (frames.length === 0) {
    return {
      motionFrames: [],
      avgMotion: 0,
      motionPeaks: [],
      sceneBoundaries: [],
      avgBrightness: 0,
      contrast: 0,
      saturation: 0,
    };
  }

  // Brightness / contrast / saturation (whole video)
  let brightSum = 0;
  let brightSqSum = 0;
  let satSum = 0;
  for (const f of frames) {
    const { mean, std } = lumaHistogram(f.imageData);
    brightSum += mean;
    brightSqSum += mean * mean;
    satSum += saturationOf(f.imageData);
  }
  const avgBrightness = brightSum / frames.length;
  const variance = brightSqSum / frames.length - avgBrightness * avgBrightness;
  const contrast = Math.sqrt(Math.max(0, variance));
  const saturation = satSum / frames.length;

  // Motion & scenes
  const motionFrames: MotionFrame[] = [];
  const sceneBoundaries: SceneBoundary[] = [];
  let prev = frames[0].imageData;
  for (let i = 1; i < frames.length; i++) {
    const diff = frameDifference(prev, frames[i].imageData);
    motionFrames.push({ time: frames[i].time, intensity: Math.min(1, diff * 2) });
    // Scene boundary if difference is very large
    if (diff > 0.4) {
      sceneBoundaries.push({ time: frames[i].time, strength: Math.min(1, diff) });
    }
    prev = frames[i].imageData;
  }

  // Average motion
  const avgMotion = motionFrames.reduce((a, b) => a + b.intensity, 0) / Math.max(1, motionFrames.length);

  // Motion peaks: local maxima above threshold
  const threshold = Math.max(0.25, avgMotion * 1.4);
  const motionPeaks: { time: number; intensity: number }[] = [];
  for (let i = 2; i < motionFrames.length - 2; i++) {
    const m = motionFrames[i];
    if (
      m.intensity > threshold &&
      m.intensity > motionFrames[i - 1].intensity &&
      m.intensity > motionFrames[i + 1].intensity
    ) {
      motionPeaks.push({ time: m.time, intensity: m.intensity });
    }
  }

  return {
    motionFrames,
    avgMotion,
    motionPeaks,
    sceneBoundaries,
    avgBrightness,
    contrast,
    saturation,
  };
}
