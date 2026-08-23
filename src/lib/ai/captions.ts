/**
 * Captions.
 *
 * Two free strategies:
 *  1) Web Speech API (browser-native, free, real-time) — great for live recording.
 *  2) Heuristic "energy-based" caption hints from the audio envelope — works
 *     for any clip without an API call. The user can edit / type their own.
 *
 * No paid APIs.
 */

import type { ExtractedAudio } from './extract-frames';
import type { CaptionWord } from '@/types';

export interface CaptionTrack {
  words: CaptionWord[];
  rawTranscript: string;
  source: 'webspeech' | 'energy' | 'manual' | 'none';
}

/**
 * Energy-based caption generator. We don't have transcription, so we emit
 * placeholder word chunks at moments of high energy / onsets so the user
 * can see where their captions should land. This is a free, no-API fallback.
 */
export function generateEnergyCaptions(
  audio: ExtractedAudio,
  beats: number[] | null,
  totalDuration: number
): CaptionTrack {
  const words: CaptionWord[] = [];
  const times: number[] = beats && beats.length > 0 ? beats : [];
  if (times.length === 0) {
    // Even spacing fallback
    const step = 1.5;
    for (let t = 0; t < totalDuration; t += step) times.push(t);
  }
  // Each beat is a "word" with placeholder text
  for (let i = 0; i < times.length; i++) {
    const start = times[i];
    const end = i + 1 < times.length ? times[i + 1] : start + 0.6;
    if (end <= start) continue;
    words.push({
      text: '…',
      start,
      end,
      highlight: true,
    });
  }
  return {
    words,
    rawTranscript: '',
    source: 'energy',
  };
}

/**
 * Web Speech API real-time transcription (browser-native, free).
 * Used when the user records inside the app.
 */
export class LiveTranscriber {
  private recognition: any | null = null;
  private active = false;
  private onWord: (w: CaptionWord) => void = () => {};

  static isSupported(): boolean {
    return typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  start(onWord: (w: CaptionWord) => void, lang = 'en-US') {
    if (!LiveTranscriber.isSupported()) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.recognition = new SR();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = lang;
    this.onWord = onWord;
    const startTime = performance.now();
    this.recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript.trim();
        if (!text) continue;
        const t = (performance.now() - startTime) / 1000;
        const words = text.split(/\s+/);
        const wordDur = 0.4;
        words.forEach((w: string, j: number) => {
          this.onWord({
            text: w,
            start: t + j * wordDur,
            end: t + (j + 1) * wordDur,
            highlight: true,
          });
        });
      }
    };
    this.recognition.onend = () => {
      if (this.active) {
        try { this.recognition.start(); } catch {}
      }
    };
    this.recognition.start();
    this.active = true;
  }

  stop() {
    this.active = false;
    if (this.recognition) {
      try { this.recognition.stop(); } catch {}
      this.recognition = null;
    }
  }
}

export const CAPTION_PRESETS = {
  hormozi: {
    label: 'Hormozi',
    fontWeight: 800,
    fontSize: 0.07, // fraction of video height
    color: '#ffffff',
    background: '#000000',
    highlight: '#FFD700',
    stroke: 4,
    position: 'center',
  },
  mrbeast: {
    label: 'MrBeast',
    fontWeight: 900,
    fontSize: 0.08,
    color: '#ffffff',
    background: '#FF0033',
    highlight: '#FFFF00',
    stroke: 6,
    position: 'center',
  },
  kinetic: {
    label: 'Kinetic',
    fontWeight: 800,
    fontSize: 0.06,
    color: '#ffffff',
    background: 'transparent',
    highlight: '#FF006E',
    stroke: 3,
    position: 'bottom',
  },
  minimal: {
    label: 'Minimal',
    fontWeight: 500,
    fontSize: 0.045,
    color: '#ffffff',
    background: 'rgba(0,0,0,0.4)',
    highlight: '#ffffff',
    stroke: 0,
    position: 'bottom',
  },
} as const;
