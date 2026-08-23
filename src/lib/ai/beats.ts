/**
 * Beat detection from audio.
 *
 * Algorithm (improved):
 *  1. Compute energy envelope (RMS over short windows).
 *  2. Compute high-passed onset signal (positive differences in energy).
 *  3. Adaptive-threshold peak picking with minimum peak distance.
 *  4. Autocorrelation of inter-onset intervals to estimate global tempo (BPM).
 *  5. Synthesize a beat grid anchored to the first detected peak.
 *  6. FALLBACK: if audio decoding fails or too few peaks, infer BPM
 *     from the cut rhythm of the visuals.
 *
 * All in-browser, free, no model downloads.
 */

import type { ExtractedAudio } from './extract-frames';
import type { ExtractedFrame } from './extract-frames';

export interface BeatAnalysis {
  bpm: number;
  beats: number[]; // seconds
  energyEnvelope: Float32Array;
  energyTimes: Float32Array;
  onsets: number[]; // seconds — strong transient positions
  tempoConfidence: number; // 0-1
}

const FRAME_SIZE = 1024;
const HOP_SIZE = 512;
const MIN_BPM = 60;
const MAX_BPM = 200;
const PEAK_THRESHOLD = 1.35; // multiplier of local mean
const MIN_PEAK_DIST = 0.2; // seconds between peaks

function rmsEnvelopes(audio: ExtractedAudio): {
  rms: Float32Array;
  times: Float32Array;
} {
  const { buffer, sampleRate } = audio;
  const channel = buffer.getChannelData(0);
  const numFrames = Math.max(1, Math.floor((channel.length - FRAME_SIZE) / HOP_SIZE) + 1);
  const rms = new Float32Array(numFrames);
  const times = new Float32Array(numFrames);

  for (let i = 0; i < numFrames; i++) {
    let sum = 0;
    const start = i * HOP_SIZE;
    const end = Math.min(start + FRAME_SIZE, channel.length);
    for (let j = start; j < end; j++) {
      const s = channel[j] || 0;
      sum += s * s;
    }
    rms[i] = Math.sqrt(sum / (end - start));
    times[i] = (start + FRAME_SIZE / 2) / sampleRate;
  }
  return { rms, times };
}

/**
 * Onset detection via high-passed energy difference (proxy for spectral flux).
 * Also applies a local-normalization to make peaks pop above quiet sections.
 */
function computeOnsetSignal(rms: Float32Array): Float32Array {
  const N = rms.length;
  const flux = new Float32Array(N);
  for (let i = 1; i < N; i++) {
    const diff = rms[i] - rms[i - 1];
    flux[i] = diff > 0 ? diff : 0;
  }
  // Normalize
  let max = 0;
  for (let i = 0; i < N; i++) if (flux[i] > max) max = flux[i];
  if (max > 0) for (let i = 0; i < N; i++) flux[i] /= max;
  return flux;
}

function findPeaks(
  signal: Float32Array,
  times: Float32Array,
  minDist: number
): number[] {
  const N = signal.length;
  // Larger moving window for adaptive threshold
  const windowSize = 30;
  const peaks: number[] = [];
  let lastPeakTime = -minDist;
  for (let i = windowSize; i < N - windowSize; i++) {
    // Local mean
    let sum = 0;
    for (let j = -windowSize; j <= windowSize; j++) sum += signal[i + j];
    const mean = sum / (windowSize * 2 + 1);
    // Adaptive threshold: must exceed mean by factor AND absolute minimum
    if (signal[i] > mean * PEAK_THRESHOLD && signal[i] > 0.04) {
      // Must be a local maximum
      if (signal[i] >= signal[i - 1] && signal[i] >= signal[i + 1]) {
        const t = times[i];
        if (t - lastPeakTime >= minDist) {
          peaks.push(t);
          lastPeakTime = t;
        }
      }
    }
  }
  return peaks;
}

function estimateBPM(peaks: number[]): { bpm: number; confidence: number } {
  if (peaks.length < 4) return { bpm: 0, confidence: 0 };
  // Inter-onset intervals
  const iois: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    const ioi = peaks[i] - peaks[i - 1];
    if (ioi > 0.25 && ioi < 2) iois.push(ioi);
  }
  if (iois.length < 3) return { bpm: 0, confidence: 0 };

  // Histogram of IOIs in BPM space
  const minBpm = MIN_BPM;
  const maxBpm = MAX_BPM;
  const bins = 280;
  const hist = new Float32Array(bins);
  for (const ioi of iois) {
    const bpm = 60 / ioi;
    if (bpm >= minBpm && bpm <= maxBpm) {
      const idx = Math.floor(((bpm - minBpm) / (maxBpm - minBpm)) * bins);
      hist[Math.min(bins - 1, Math.max(0, idx))] += 1;
    }
  }
  let bestBin = 0;
  let bestVal = 0;
  for (let i = 0; i < bins; i++) {
    if (hist[i] > bestVal) {
      bestVal = hist[i];
      bestBin = i;
    }
  }
  // Also check half-time and double-time
  const candidates = [
    minBpm + (bestBin / bins) * (maxBpm - minBpm),
    (minBpm + (bestBin / bins) * (maxBpm - minBpm)) / 2,
    (minBpm + (bestBin / bins) * (maxBpm - minBpm)) * 2,
  ];
  // Score each: prefer ones in 90-160 range
  const scored = candidates
    .filter((b) => b >= 70 && b <= 180)
    .map((b) => ({ bpm: b, score: bestVal * (b >= 90 && b <= 150 ? 1.5 : 1) }))
    .sort((a, b) => b.score - a.score);
  const bpm = scored.length > 0 ? scored[0].bpm : candidates[0];
  const total = iois.length;
  const confidence = total > 0 ? bestVal / total : 0;
  return { bpm: Math.round(bpm), confidence: Math.min(1, confidence * 2) };
}

/**
 * Infer BPM from the cut rhythm of a video.
 * Counts frame-to-frame differences and looks for periodic patterns.
 */
function inferBPMFromCuts(frames: ExtractedFrame[]): number {
  if (frames.length < 5) return 120;
  // Find scene boundaries (large frame differences)
  const cuts: number[] = [];
  for (let i = 1; i < frames.length; i++) {
    const diff = quickFrameDiff(frames[i - 1].imageData, frames[i].imageData);
    if (diff > 0.35) cuts.push(frames[i].time);
  }
  if (cuts.length < 3) {
    // No clear cuts, just assume common music tempo
    return 120;
  }
  // Compute intervals between cuts
  const iois: number[] = [];
  for (let i = 1; i < cuts.length; i++) {
    const ioi = cuts[i] - cuts[i - 1];
    if (ioi > 0.25 && ioi < 3) iois.push(ioi);
  }
  if (iois.length === 0) return 120;
  // Median IOI
  iois.sort((a, b) => a - b);
  const median = iois[Math.floor(iois.length / 2)];
  const bpm = 60 / median;
  // Snap to common tempos
  const common = [80, 90, 100, 110, 120, 128, 140, 160];
  let closest = common[0];
  let bestDist = Math.abs(bpm - closest);
  for (const c of common) {
    const d = Math.abs(bpm - c);
    if (d < bestDist) {
      bestDist = d;
      closest = c;
    }
  }
  return closest;
}

function quickFrameDiff(a: ImageData, b: ImageData): number {
  const da = a.data;
  const db = b.data;
  const len = Math.min(da.length, db.length);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < len; i += 32) {
    const dr = (da[i] - db[i]) / 255;
    const dg = (da[i + 1] - db[i + 1]) / 255;
    const dbi = (da[i + 2] - db[i + 2]) / 255;
    sum += Math.sqrt(dr * dr + dg * dg + dbi * dbi);
    count++;
  }
  return count > 0 ? sum / count : 0;
}

export async function analyzeBeats(
  audio: ExtractedAudio | null,
  frames?: ExtractedFrame[]
): Promise<BeatAnalysis> {
  // Default fallback
  const fallback = (bpm: number): BeatAnalysis => ({
    bpm,
    beats: [],
    energyEnvelope: new Float32Array(0),
    energyTimes: new Float32Array(0),
    onsets: [],
    tempoConfidence: 0,
  });

  if (!audio) {
    // No audio: infer from visual cuts
    const bpm = frames ? inferBPMFromCuts(frames) : 120;
    return fallback(bpm);
  }
  try {
    const { rms, times } = rmsEnvelopes(audio);
    if (rms.length < 10) {
      const bpm = frames ? inferBPMFromCuts(frames) : 120;
      return fallback(bpm);
    }
    const flux = computeOnsetSignal(rms);
    const peaks = findPeaks(flux, times, MIN_PEAK_DIST);
    const { bpm, confidence } = estimateBPM(peaks);

    // If audio-based detection failed, fall back to visual
    let finalBpm = bpm;
    if (finalBpm < 60) {
      finalBpm = frames ? inferBPMFromCuts(frames) : 120;
    }

    const duration = audio.buffer.duration;
    const beatGrid: number[] = [];
    if (finalBpm > 0) {
      const period = 60 / finalBpm;
      const offset = peaks.length > 0 ? peaks[0] : 0;
      for (let t = offset; t < duration; t += period) {
        beatGrid.push(t);
      }
    }
    const combined = Array.from(
      new Set([...peaks, ...beatGrid].map((t) => Math.round(t * 100) / 100))
    ).sort((a, b) => a - b);

    return {
      bpm: finalBpm,
      beats: combined,
      energyEnvelope: rms,
      energyTimes: times,
      onsets: peaks,
      tempoConfidence: confidence,
    };
  } catch (err) {
    console.warn('Beat analysis failed', err);
    const bpm = frames ? inferBPMFromCuts(frames) : 120;
    return fallback(bpm);
  }
}
