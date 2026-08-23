/**
 * Extract the dominant color palette from sampled frames.
 * Uses a simple k-means clustering (k=5) over a quantized RGB color space.
 */

import type { ExtractedFrame } from './extract-frames';

export interface ColorPalette {
  colors: string[]; // hex
  weights: number[]; // 0-1
  warmth: number; // -1 cool to +1 warm
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Tiny k-means in RGB space.
 */
function kmeans(pixels: number[][], k: number, iters = 8): { centers: number[][]; counts: number[] } {
  if (pixels.length === 0) return { centers: [], counts: [] };
  if (pixels.length <= k) {
    return {
      centers: pixels.slice(),
      counts: pixels.map(() => 1),
    };
  }
  // Init: k-means++ style
  const centers: number[][] = [];
  centers.push(pixels[Math.floor(Math.random() * pixels.length)]);
  while (centers.length < k) {
    const dists = pixels.map((p) => {
      let min = Infinity;
      for (const c of centers) {
        const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (d < min) min = d;
      }
      return min;
    });
    const total = dists.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < dists.length; idx++) {
      r -= dists[idx];
      if (r <= 0) break;
    }
    centers.push(pixels[Math.min(idx, pixels.length - 1)]);
  }

  const counts = new Array(k).fill(0);
  for (let it = 0; it < iters; it++) {
    const sums = centers.map(() => [0, 0, 0]);
    counts.fill(0);
    for (const p of pixels) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = (p[0] - centers[c][0]) ** 2 + (p[1] - centers[c][1]) ** 2 + (p[2] - centers[c][2]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      sums[best][0] += p[0];
      sums[best][1] += p[1];
      sums[best][2] += p[2];
      counts[best]++;
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) {
        centers[c] = [sums[c][0] / counts[c], sums[c][1] / counts[c], sums[c][2] / counts[c]];
      }
    }
  }
  return { centers, counts };
}

export function extractPalette(frames: ExtractedFrame[], k = 5): ColorPalette {
  if (frames.length === 0) return { colors: [], weights: [], warmth: 0 };

  // Sample pixels from all frames, downsample to speed up
  const pixels: number[][] = [];
  for (const f of frames) {
    const d = f.imageData.data;
    // Take ~1000 pixels per frame
    const step = Math.max(4, Math.floor(d.length / 4 / 1000) * 4);
    for (let i = 0; i < d.length; i += step) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      // Skip near-black and near-white (boring)
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max < 8 || min > 248) continue;
      // Skip extreme saturation outliers a bit
      pixels.push([r, g, b]);
    }
  }

  const { centers, counts } = kmeans(pixels, k);
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const weights = counts.map((c) => c / total);

  // Sort by weight
  const indices = weights.map((_, i) => i).sort((a, b) => weights[b] - weights[a]);
  const colors = indices.map((i) => rgbToHex(centers[i][0], centers[i][1], centers[i][2]));
  const ws = indices.map((i) => weights[i]);

  // Warmth: average of (R - B) over weighted palette
  let warmth = 0;
  for (let i = 0; i < centers.length; i++) {
    const [r, g, b] = centers[i];
    warmth += ((r - b) / 255) * weights[i];
  }

  return { colors, weights: ws, warmth: Math.max(-1, Math.min(1, warmth)) };
}
