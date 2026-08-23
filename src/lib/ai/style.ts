/**
 * Combine beat + visual + color analysis into a single StyleSignature
 * that can be used to drive automatic edits on user clips.
 */

import type { ExtractedFrame, ExtractedAudio } from './extract-frames';
import { analyzeBeats, type BeatAnalysis } from './beats';
import { analyzeVisuals, type VisualAnalysis } from './motion';
import { extractPalette, type ColorPalette } from './color';
import type { StyleSignature } from '@/types';

export interface FullAnalysis {
  style: StyleSignature;
  beats: BeatAnalysis | null;
  visuals: VisualAnalysis;
  palette: ColorPalette;
}

export interface AnalysisCallbacks {
  onProgress?: (stage: string, p: number) => void;
}

export async function analyzeVideoStyle(
  frames: ExtractedFrame[],
  audio: ExtractedAudio | null,
  sourceType: 'tiktok' | 'upload' | 'reference' = 'reference',
  callbacks: AnalysisCallbacks = {}
): Promise<FullAnalysis> {
  callbacks.onProgress?.('Detecting beats…', 0.1);
  const beats = await analyzeBeats(audio);

  callbacks.onProgress?.('Analyzing motion…', 0.35);
  const visuals = analyzeVisuals(frames);

  callbacks.onProgress?.('Extracting color palette…', 0.6);
  const palette = extractPalette(frames);

  callbacks.onProgress?.('Computing style signature…', 0.9);

  // Estimate cut rhythm: prefer detected scene boundaries; fall back to beat onsets.
  const totalDuration = frames.length > 0 ? frames[frames.length - 1].time : 0;
  const cuts =
    visuals.sceneBoundaries.length > 0
      ? visuals.sceneBoundaries
      : beats
        ? beats.onsets.map((t) => ({ time: t, strength: 0.5 }))
        : [];
  const avgShotLength = cuts.length > 0 ? totalDuration / cuts.length : totalDuration || 0;
  const cutsPerMinute = totalDuration > 0 ? (cuts.length / totalDuration) * 60 : 0;

  const style: StyleSignature = {
    bpm: beats?.bpm ?? 0,
    beats: beats?.beats ?? [],
    colorPalette: palette.colors,
    avgBrightness: visuals.avgBrightness,
    contrast: visuals.contrast,
    saturation: visuals.saturation,
    warmth: palette.warmth,
    avgShotLength,
    cutsPerMinute,
    motionIntensity: visuals.avgMotion,
    hasCaptions: false,
    sourceType,
  };

  callbacks.onProgress?.('Done!', 1);
  return { style, beats, visuals, palette };
}
