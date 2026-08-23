/**
 * Beat detection from audio.
 *
 * Algorithm:
 *  1. Compute energy envelope (RMS over short windows).
 *  2. Compute spectral flux onset signal (positive differences in magnitude spectrum).
 *  3. Find peaks in the combined signal above a moving threshold.
 *  4. Autocorrelate to estimate global tempo (BPM).
 *  5. Anchor beat times to the detected peaks.
 *
 * All in-browser, free, no model downloads.
 */

import type { ExtractedAudio } from './extract-frames';

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
const PEAK_THRESHOLD = 1.4; // multiplier of local mean
const MIN_PEAK_DIST = 0.18; // seconds between peaks

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
    for (let j = 0; j < FRAME_SIZE; j++) {
      const s = channel[start + j] || 0;
      sum += s * s;
    }
    rms[i] = Math.sqrt(sum / FRAME_SIZE);
    times[i] = (start + FRAME_SIZE / 2) / sampleRate;
  }
  return { rms, times };
}

/**
 * Approximate onset detection via spectral flux (simple version).
 * Since we don't have FFT here, we use a high-passed energy difference as proxy.
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
  // Moving average for adaptive threshold
  const windowSize = 20;
  const peaks: number[] = [];
  let lastPeakTime = -minDist;
  for (let i = windowSize; i < N - windowSize; i++) {
    // Local mean
    let sum = 0;
    for (let j = -windowSize; j <= windowSize; j++) sum += signal[i + j];
    const mean = sum / (windowSize * 2 + 1);
    if (signal[i] > mean * PEAK_THRESHOLD && signal[i] > 0.05) {
      const t = times[i];
      if (t - lastPeakTime >= minDist) {
        peaks.push(t);
        lastPeakTime = t;
      }
    }
  }
  return peaks;
}

function estimateBPM(peaks: number[]): { bpm: number; confidence: number } {
  if (peaks.length < 4) return { bpm: 120, confidence: 0 };
  // Inter-onset intervals
  const iois: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    const ioi = peaks[i] - peaks[i - 1];
    if (ioi > 0.2 && ioi < 2) iois.push(ioi);
  }
  if (iois.length === 0) return { bpm: 120, confidence: 0 };

  // Histogram of IOIs in BPM space
  const minBpm = MIN_BPM;
  const maxBpm = MAX_BPM;
  const bins = 200;
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
  const bpm = minBpm + (bestBin / bins) * (maxBpm - minBpm);
  const total = iois.length;
  const confidence = total > 0 ? bestVal / total : 0;
  return { bpm: Math.round(bpm), confidence: Math.min(1, confidence * 2) };
}

export async function analyzeBeats(audio: ExtractedAudio | null): Promise<BeatAnalysis | null> {
  if (!audio) return null;
  const { rms, times } = rmsEnvelopes(audio);
  const flux = computeOnsetSignal(rms);
  const peaks = findPeaks(flux, times, MIN_PEAK_DIST);
  const { bpm, confidence } = estimateBPM(peaks);

  // Synthesize a beat grid at the detected tempo (in addition to detected peaks)
  // This makes cuts fall on every beat even if the audio had weak transients.
  const duration = audio.buffer.duration;
  const beatGrid: number[] = [];
  if (bpm > 0) {
    const period = 60 / bpm;
    // Offset so the first beat aligns near the first detected peak
    const offset = peaks.length > 0 ? peaks[0] : 0;
    for (let t = offset; t < duration; t += period) {
      beatGrid.push(t);
    }
  }
  // Combine detected onsets + the regular beat grid
  const combined = Array.from(new Set([...peaks, ...beatGrid].map((t) => Math.round(t * 100) / 100))).sort(
    (a, b) => a - b
  );

  return {
    bpm,
    beats: combined,
    energyEnvelope: rms,
    energyTimes: times,
    onsets: peaks,
    tempoConfidence: confidence,
  };
}
