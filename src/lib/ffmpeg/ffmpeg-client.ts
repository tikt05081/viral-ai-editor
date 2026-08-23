/**
 * FFmpeg.wasm wrapper.
 *
 * Loaded lazily on first use. Uses the multi-threaded build for speed.
 * For each clip, we re-encode the segments and concatenate.
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { COLOR_PRESETS } from '@/lib/ai/color-presets';
import type { EditSegment, MediaClip } from '@/types';

let ffmpeg: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

const BASE_URL = 'https://unpkg.com/@ffmpeg/[email protected]/dist/umd';

export async function getFFmpeg(
  onLog?: (msg: string) => void
): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const inst = new FFmpeg();
    if (onLog) {
      inst.on('log', ({ message }) => onLog(message));
    }
    inst.on('progress', ({ progress }) => {
      if (onLog) onLog(`Progress: ${(progress * 100).toFixed(0)}%`);
    });
    await inst.load({
      coreURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    ffmpeg = inst;
    return inst;
  })();
  return loadPromise;
}

/**
 * Apply a basic color preset to a video using FFmpeg's eq filter.
 */
export async function applyColorPreset(
  input: Blob,
  filter: string,
  onLog?: (m: string) => void
): Promise<Blob> {
  const ff = await getFFmpeg(onLog);
  await ff.writeFile('in.mp4', await fetchFile(input));
  const args = ['-i', 'in.mp4'];
  if (filter) args.push('-vf', filter);
  args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', 'out.mp4');
  await ff.exec(args);
  const data = (await ff.readFile('out.mp4')) as Uint8Array;
  return new Blob([data.buffer as ArrayBuffer], { type: 'video/mp4' });
}

/**
 * Cut a clip to the given [start, end] range and apply optional color filter.
 */
export async function cutAndFilter(
  input: Blob,
  start: number,
  end: number,
  colorFilter: string = '',
  onLog?: (m: string) => void
): Promise<Blob> {
  const ff = await getFFmpeg(onLog);
  await ff.writeFile('in.mp4', await fetchFile(input));
  const dur = end - start;
  const args = ['-ss', String(start), '-i', 'in.mp4', '-t', String(dur)];
  if (colorFilter) args.push('-vf', colorFilter);
  args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', 'out.mp4');
  await ff.exec(args);
  const data = (await ff.readFile('out.mp4')) as Uint8Array;
  return new Blob([data.buffer as ArrayBuffer], { type: 'video/mp4' });
}

/**
 * Concatenate multiple MP4 clips (already encoded) into one.
 */
export async function concatClips(
  blobs: Blob[],
  onLog?: (m: string) => void
): Promise<Blob> {
  const ff = await getFFmpeg(onLog);
  // Write each input
  for (let i = 0; i < blobs.length; i++) {
    await ff.writeFile(`part${i}.mp4`, await fetchFile(blobs[i]));
  }
  // Concat demuxer
  const list = blobs.map((_, i) => `file part${i}.mp4`).join('\n');
  await ff.writeFile('list.txt', new TextEncoder().encode(list));
  await ff.exec([
    '-f', 'concat',
    '-safe', '0',
    '-i', 'list.txt',
    '-c', 'copy',
    'out.mp4',
  ]);
  const data = (await ff.readFile('out.mp4')) as Uint8Array;
  return new Blob([data.buffer as ArrayBuffer], { type: 'video/mp4' });
}

/**
 * Full export: given user clips + segments, produce a single MP4.
 * Strategy: for each segment, cut the source clip, apply color + scale.
 * Then concatenate. For simplicity we use the same color filter on every
 * segment and the scale via the `scale` and `crop` filters.
 */
export async function exportProject(
  segments: EditSegment[],
  userClips: MediaClip[],
  colorPresetFilter: string,
  outputW: number,
  outputH: number,
  onLog?: (m: string) => void,
  onProgress?: (p: number) => void
): Promise<Blob> {
  const ff = await getFFmpeg(onLog);
  const clipMap = new Map(userClips.map((c) => [c.id, c]));

  // Phase 1: cut + color each segment
  const partFiles: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const clip = clipMap.get(seg.sourceClipId);
    if (!clip) continue;
    const inName = `src${i}.mp4`;
    const outName = `part${i}.mp4`;
    await ff.writeFile(inName, await fetchFile(clip.blob));

    const dur = seg.sourceEnd - seg.sourceStart;
    // Build filter: scale to output, then crop, with color
    const scale = seg.scale || 1;
    const sw = Math.round(outputW / scale / 2) * 2;
    const sh = Math.round(outputH / scale / 2) * 2;
    const filters: string[] = [];
    filters.push(`scale=${sw}:${sh}`);
    filters.push(`crop=${outputW}:${outputH}:(iw-${outputW})/2:(ih-${outputH})/2`);
    if (seg.colorFilter) {
      const presetFilter = getPresetFilter(seg.colorFilter);
      if (presetFilter) filters.push(presetFilter);
    }
    const speed = seg.speed || 1;
    if (Math.abs(speed - 1) > 0.01) {
      filters.push(`setpts=PTS/${speed}`);
    }
    const vf = filters.join(',');

    await ff.exec([
      '-ss', String(seg.sourceStart),
      '-i', inName,
      '-t', String(dur),
      '-vf', vf,
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k',
      '-r', '30',
      outName,
    ]);
    partFiles.push(outName);
    onProgress?.(((i + 1) / segments.length) * 0.7);
  }

  if (partFiles.length === 0) throw new Error('No segments to export');

  // Phase 2: concat
  const list = partFiles.map((f) => `file ${f}`).join('\n');
  await ff.writeFile('list.txt', new TextEncoder().encode(list));
  await ff.exec([
    '-f', 'concat',
    '-safe', '0',
    '-i', 'list.txt',
    '-c', 'copy',
    'final.mp4',
  ]);
  onProgress?.(0.95);
  const data = (await ff.readFile('final.mp4')) as Uint8Array;
  onProgress?.(1);

  // Cleanup
  for (const f of ['list.txt', ...partFiles, ...segments.map((_, i) => `src${i}.mp4`), 'final.mp4']) {
    try { await ff.deleteFile(f); } catch {}
  }
  return new Blob([data.buffer as ArrayBuffer], { type: 'video/mp4' });
}

function getPresetFilter(id: string): string {
  return COLOR_PRESETS[id]?.ffmpeg || '';
}
