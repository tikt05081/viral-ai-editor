/**
 * Automatic edit generator.
 *
 * Given a reference StyleSignature and a list of user clips, produce an
 * EditSegment[] timeline that mimics the reference's style.
 *
 * Strategy:
 *  - Pick segments from user clips to fit each "shot" in the reference's
 *    cut rhythm.
 *  - On every beat, apply a small zoom punch (scale 1.0 -> 1.08 -> 1.0).
 *  - On every motion peak, apply a stronger zoom punch.
 *  - Apply the reference's color preset.
 *  - Cycle through user clips so the whole timeline is filled.
 */

import type {
  MediaClip,
  StyleSignature,
  EditSegment,
} from '@/types';
import type { VisualAnalysis } from './motion';
import type { BeatAnalysis } from './beats';
import type { CaptionTrack } from './captions';
import { COLOR_PRESETS, type ColorPreset } from './color-presets';

export interface AutoEditInput {
  userClips: MediaClip[];
  style: StyleSignature;
  beats?: BeatAnalysis | null;
  visuals?: VisualAnalysis | null;
  captions?: CaptionTrack | null;
  options?: {
    enableZoomPunches?: boolean;
    enableBeatSync?: boolean;
    targetDuration?: number; // seconds; 0 = use sum of user clips
    aspect?: '9:16' | '16:9' | '1:1';
  };
}

export function generateAutoEdit({
  userClips,
  style,
  beats,
  visuals,
  captions,
  options = {},
}: AutoEditInput): EditSegment[] {
  const {
    enableZoomPunches = true,
    enableBeatSync = true,
    targetDuration = 0,
    aspect = '9:16',
  } = options;

  if (userClips.length === 0) return [];

  // Build the cut grid: timestamps at which we want a cut.
  // Priority: detected scene boundaries > beat onsets > evenly spaced.
  let cutTimes: number[] = [];
  if (visuals && visuals.sceneBoundaries.length >= 2) {
    cutTimes = visuals.sceneBoundaries.map((b) => b.time);
  } else if (beats && beats.onsets.length >= 2) {
    cutTimes = beats.onsets;
  } else if (style.beats.length > 0) {
    cutTimes = style.beats;
  } else {
    // Even spacing
    const dur = targetDuration > 0 ? targetDuration : userClips.reduce((a, c) => a + c.duration, 0);
    const segDur = style.avgShotLength > 0 ? style.avgShotLength : 1.5;
    for (let t = 0; t < dur; t += segDur) cutTimes.push(t);
  }
  if (cutTimes.length === 0) cutTimes = [0];

  // Determine target total duration
  const totalUserDur = userClips.reduce((a, c) => a + c.duration, 0);
  const targetDur = targetDuration > 0 ? targetDuration : totalUserDur;
  cutTimes = cutTimes.filter((t) => t < targetDur);
  if (cutTimes[cutTimes.length - 1] !== targetDur) cutTimes.push(targetDur);

  // Build segments
  const segments: EditSegment[] = [];
  // Each segment pulls from a user clip, cycling through them.
  // We allocate "shot length" pieces of source from each clip sequentially.
  const sourceCursors: { clipId: string; pos: number }[] = userClips.map((c) => ({
    clipId: c.id,
    pos: 0,
  }));
  let sourceIdx = 0;

  for (let i = 0; i < cutTimes.length - 1; i++) {
    const shotDur = cutTimes[i + 1] - cutTimes[i];
    if (shotDur <= 0.05) continue;

    // Pick a source: cycle, but advance the cursor
    let attempts = 0;
    let chosen = sourceCursors[sourceIdx % sourceCursors.length];
    while (attempts < sourceCursors.length) {
      const clip = userClips.find((c) => c.id === chosen.clipId)!;
      if (chosen.pos + shotDur <= clip.duration + 0.1) break;
      // Wrap this clip
      chosen.pos = 0;
      sourceIdx++;
      chosen = sourceCursors[sourceIdx % sourceCursors.length];
      attempts++;
    }
    // Apply
    const sourceStart = chosen.pos;
    const sourceEnd = Math.min(chosen.pos + shotDur, userClips.find((c) => c.id === chosen.clipId)!.duration);
    chosen.pos = sourceEnd;
    sourceIdx++;

    const segment: EditSegment = {
      id: `seg_${Date.now()}_${i}`,
      sourceClipId: chosen.clipId,
      sourceStart,
      sourceEnd,
      timelineStart: cutTimes[i],
      timelineEnd: cutTimes[i + 1],
      scale: 1,
      position: { x: 0, y: 0 },
      rotation: 0,
      speed: 1,
    };

    // Zoom punches
    if (enableZoomPunches) {
      const scaleAt: { time: number; scale: number }[] = [{ time: segment.timelineStart, scale: 1 }];
      // Find beats inside this segment
      const inBeats = enableBeatSync && style.beats
        ? style.beats.filter((b: number) => b > segment.timelineStart + 0.1 && b < segment.timelineEnd - 0.1)
        : [];
      // For each beat, do a small punch
      for (const b of inBeats) {
        scaleAt.push({ time: b, scale: 1.06 });
        scaleAt.push({ time: b + 0.1, scale: 1 });
      }
      // Find a strong motion peak inside the segment for a bigger punch
      if (visuals) {
        const peaks = visuals.motionPeaks.filter(
          (p: { time: number; intensity: number }) => p.time > segment.timelineStart + 0.1 && p.time < segment.timelineEnd - 0.1
        );
        if (peaks[0]) {
          scaleAt.push({ time: peaks[0].time, scale: 1.14 });
          scaleAt.push({ time: peaks[0].time + 0.18, scale: 1 });
        }
      }
      if (scaleAt.length > 1) {
        segment.scaleAt = scaleAt;
        segment.scale = scaleAt[scaleAt.length - 1].scale;
      }
    }

    // Captions (if any)
    if (captions && captions.words.length > 0) {
      const inWords = captions.words.filter(
        (w: { start: number; end: number }) => w.end > segment.timelineStart && w.start < segment.timelineEnd
      );
      if (inWords.length > 0) {
        segment.captionWords = inWords.map((w: { text: string; start: number; end: number; highlight?: boolean }) => ({
          ...w,
          start: w.start - segment.timelineStart,
          end: w.end - segment.timelineStart,
        }));
        segment.captionText = inWords.map((w: { text: string }) => w.text).join(' ');
      }
    }

    segments.push(segment);
  }

  // Apply reference color preset to every segment
  const preset: ColorPreset | null = pickColorPreset(style);
  if (preset) {
    for (const s of segments) s.colorFilter = preset.id;
  }

  return segments;
}

function pickColorPreset(style: StyleSignature): ColorPreset | null {
  // Heuristic mapping
  if (style.contrast > 0.22 && style.saturation < 0.35) return COLOR_PRESETS.cinematic;
  if (style.warmth && style.warmth < 0) return COLOR_PRESETS['teal-orange'];
  if (style.contrast > 0.18) return COLOR_PRESETS.film;
  if (style.saturation > 0.55) return COLOR_PRESETS.y2k;
  if (style.avgBrightness < 0.25) return COLOR_PRESETS.vintage;
  return COLOR_PRESETS.cinematic;
}
