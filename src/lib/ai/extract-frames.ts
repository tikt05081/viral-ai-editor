/**
 * Decode a video file into raw frames and PCM audio data.
 * Uses the browser's native <video> + Web Audio APIs — no server, no upload.
 */

export interface ExtractedFrame {
  time: number; // seconds
  imageData: ImageData;
  bitmap?: ImageBitmap;
}

export interface ExtractedAudio {
  buffer: AudioBuffer;
  sampleRate: number;
}

export interface DecodedMedia {
  video: HTMLVideoElement;
  duration: number;
  width: number;
  height: number;
  frames: ExtractedFrame[];
  audio: ExtractedAudio | null;
  fps: number;
}

const DEFAULT_FPS = 4; // 4 frames/sec is plenty for style analysis
const AUDIO_SAMPLE_RATE = 22050;

/**
 * Load a video Blob into a hidden <video> element and resolve when metadata is ready.
 */
export function loadVideo(blob: Blob): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';

    const url = URL.createObjectURL(blob);
    video.src = url;

    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onReady);
      video.removeEventListener('error', onError);
    };
    const onReady = () => {
      cleanup();
      resolve(video);
    };
    const onError = () => {
      cleanup();
      reject(new Error('Failed to load video'));
    };

    video.addEventListener('loadedmetadata', onReady);
    video.addEventListener('error', onError);
  });
}

/**
 * Seek the video to a specific time and resolve when the new frame is rendered.
 */
function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    // Clamp time within duration
    const safe = Math.max(0, Math.min(time, video.duration - 0.05));
    if (Math.abs(video.currentTime - safe) < 0.01) {
      // Already at the right spot, force a frame draw
      requestAnimationFrame(() => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      });
    } else {
      video.currentTime = safe;
    }
  });
}

/**
 * Extract N frames evenly distributed across the video.
 */
export async function extractFrames(
  video: HTMLVideoElement,
  fps: number = DEFAULT_FPS,
  onProgress?: (p: number) => void,
  maxSize: number = 320
): Promise<ExtractedFrame[]> {
  const duration = video.duration;
  const totalFrames = Math.max(2, Math.ceil(duration * fps));
  const interval = duration / totalFrames;

  // Set up a canvas for downsampling
  const aspect = video.videoWidth / video.videoHeight;
  const w = aspect >= 1 ? maxSize : Math.round(maxSize * aspect);
  const h = aspect >= 1 ? Math.round(maxSize / aspect) : maxSize;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  const frames: ExtractedFrame[] = [];
  for (let i = 0; i < totalFrames; i++) {
    const time = i * interval;
    await seek(video, time);
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    frames.push({ time, imageData });
    onProgress?.((i + 1) / totalFrames);
    // Yield to the event loop
    await new Promise((r) => setTimeout(r, 0));
  }
  return frames;
}

/**
 * Decode the audio track of a video file into an AudioBuffer.
 * Skips the video element — reads the file directly via OfflineAudioContext.
 */
export async function extractAudio(blob: Blob): Promise<ExtractedAudio | null> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    // Use a regular AudioContext for decoding
    const AudioCtor: typeof AudioContext =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtor();
    const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    ctx.close();
    return { buffer, sampleRate: buffer.sampleRate };
  } catch (err) {
    console.warn('No audio track or decode failed', err);
    return null;
  }
}

/**
 * One-shot: load video, extract frames + audio.
 */
export async function decodeMedia(
  blob: Blob,
  options: { fps?: number; withAudio?: boolean; onProgress?: (p: number) => void; maxSize?: number } = {}
): Promise<DecodedMedia> {
  const { fps = DEFAULT_FPS, withAudio = true, onProgress, maxSize = 320 } = options;
  const video = await loadVideo(blob);
  const frames = await extractFrames(video, fps, (p) => onProgress?.(p * 0.7), maxSize);
  let audio: ExtractedAudio | null = null;
  if (withAudio) {
    audio = await extractAudio(blob);
    onProgress?.(0.95);
  }
  onProgress?.(1);
  return {
    video,
    duration: video.duration,
    width: video.videoWidth,
    height: video.videoHeight,
    frames,
    audio,
    fps,
  };
}
