'use client';

import { create } from 'zustand';
import type {
  MediaClip,
  StyleSignature,
  EditSegment,
  CaptionWord,
} from '@/types';
import type { VisualAnalysis } from '@/lib/ai/motion';
import type { BeatAnalysis } from '@/lib/ai/beats';

interface EditorStore {
  // Reference
  referenceClip: MediaClip | null;
  referenceThumbnail: string | null;
  styleSignature: StyleSignature | null;
  refBeats: BeatAnalysis | null;
  refVisuals: VisualAnalysis | null;

  // User clips
  userClips: MediaClip[];

  // Edit
  segments: EditSegment[];
  timelineDuration: number;

  // UI
  currentTime: number;
  isPlaying: boolean;
  selectedSegmentId: string | null;
  analyzing: boolean;
  analysisProgress: string;

  // Settings
  enableCaptions: boolean;
  captionStyle: 'hormozi' | 'mrbeast' | 'kinetic' | 'minimal' | 'none';
  colorPreset: 'none' | 'cinematic' | 'teal-orange' | 'film' | 'y2k' | 'vintage' | 'bw';
  zoomPunches: boolean;
  beatSync: boolean;
  silenceRemoval: boolean;

  // Render
  isExporting: boolean;
  exportProgress: number;

  // Setters
  setReferenceClip: (c: MediaClip | null) => void;
  setReferenceThumbnail: (url: string | null) => void;
  setStyleSignature: (s: StyleSignature | null) => void;
  setRefBeats: (b: BeatAnalysis | null) => void;
  setRefVisuals: (v: VisualAnalysis | null) => void;
  addUserClip: (c: MediaClip) => void;
  removeUserClip: (id: string) => void;
  setSegments: (s: EditSegment[]) => void;
  setTimelineDuration: (d: number) => void;
  setCurrentTime: (t: number) => void;
  setIsPlaying: (p: boolean) => void;
  setSelectedSegmentId: (id: string | null) => void;
  setAnalyzing: (a: boolean) => void;
  setAnalysisProgress: (s: string) => void;
  setEnableCaptions: (b: boolean) => void;
  setCaptionStyle: (s: 'hormozi' | 'mrbeast' | 'kinetic' | 'minimal' | 'none') => void;
  setColorPreset: (p: 'none' | 'cinematic' | 'teal-orange' | 'film' | 'y2k' | 'vintage' | 'bw') => void;
  setZoomPunches: (b: boolean) => void;
  setBeatSync: (b: boolean) => void;
  setSilenceRemoval: (b: boolean) => void;
  setIsExporting: (b: boolean) => void;
  setExportProgress: (p: number) => void;
  reset: () => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  referenceClip: null,
  referenceThumbnail: null,
  styleSignature: null,
  refBeats: null,
  refVisuals: null,
  userClips: [],
  segments: [],
  timelineDuration: 0,
  currentTime: 0,
  isPlaying: false,
  selectedSegmentId: null,
  analyzing: false,
  analysisProgress: '',
  enableCaptions: true,
  captionStyle: 'kinetic',
  colorPreset: 'cinematic',
  zoomPunches: true,
  beatSync: true,
  silenceRemoval: false,
  isExporting: false,
  exportProgress: 0,

  setReferenceClip: (c) => set({ referenceClip: c }),
  setReferenceThumbnail: (url) => set({ referenceThumbnail: url }),
  setStyleSignature: (s) => set({ styleSignature: s }),
  setRefBeats: (b) => set({ refBeats: b }),
  setRefVisuals: (v) => set({ refVisuals: v }),
  addUserClip: (c) => set((state) => ({ userClips: [...state.userClips, c] })),
  removeUserClip: (id) =>
    set((state) => ({
      userClips: state.userClips.filter((c) => c.id !== id),
    })),
  setSegments: (s) => set({ segments: s }),
  setTimelineDuration: (d) => set({ timelineDuration: d }),
  setCurrentTime: (t) => set({ currentTime: t }),
  setIsPlaying: (p) => set({ isPlaying: p }),
  setSelectedSegmentId: (id) => set({ selectedSegmentId: id }),
  setAnalyzing: (a) => set({ analyzing: a }),
  setAnalysisProgress: (s) => set({ analysisProgress: s }),
  setEnableCaptions: (b) => set({ enableCaptions: b }),
  setCaptionStyle: (s) => set({ captionStyle: s }),
  setColorPreset: (p) => set({ colorPreset: p }),
  setZoomPunches: (b) => set({ zoomPunches: b }),
  setBeatSync: (b) => set({ beatSync: b }),
  setSilenceRemoval: (b) => set({ silenceRemoval: b }),
  setIsExporting: (b) => set({ isExporting: b }),
  setExportProgress: (p) => set({ exportProgress: p }),
  reset: () =>
    set({
      referenceClip: null,
      referenceThumbnail: null,
      styleSignature: null,
      refBeats: null,
      refVisuals: null,
      userClips: [],
      segments: [],
      timelineDuration: 0,
      currentTime: 0,
      isPlaying: false,
      selectedSegmentId: null,
      analyzing: false,
      analysisProgress: '',
    }),
}));
