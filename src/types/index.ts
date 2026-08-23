export interface MediaClip {
  id: string;
  name: string;
  url: string;
  blob: Blob;
  duration: number;
  width: number;
  height: number;
  size: number;
  type: string;
  thumbnail?: string;
}

export interface StyleSignature {
  // Beat / tempo
  bpm: number;
  beats: number[]; // timestamps in seconds
  // Visual style
  colorPalette: string[]; // hex strings
  avgBrightness: number; // 0-1
  contrast: number; // 0-1
  saturation: number; // 0-1
  warmth: number; // -1 cool to +1 warm
  // Editing rhythm
  avgShotLength: number; // seconds
  cutsPerMinute: number;
  // Motion
  motionIntensity: number; // 0-1
  // Caption style
  hasCaptions: boolean;
  // Derived metadata
  sourceType: 'tiktok' | 'upload' | 'reference';
  referenceClipId?: string;
}

export interface EditSegment {
  id: string;
  sourceClipId: string;
  sourceStart: number;
  sourceEnd: number;
  timelineStart: number;
  timelineEnd: number;
  // Effects
  scale: number; // 1 = no zoom, 1.2 = punch-in
  scaleAt?: { time: number; scale: number }[]; // keyframes
  position: { x: number; y: number };
  rotation: number;
  speed: number;
  // Style
  colorFilter?: string;
  // Captions
  captionText?: string;
  captionWords?: CaptionWord[];
}

export interface CaptionWord {
  text: string;
  start: number;
  end: number;
  highlight?: boolean; // for kinetic style (current word bigger/colored)
}

export interface EditorState {
  // Source
  referenceClip: MediaClip | null;
  styleSignature: StyleSignature | null;
  userClips: MediaClip[];
  // Edit
  segments: EditSegment[];
  timelineDuration: number;
  // UI
  currentTime: number;
  isPlaying: boolean;
  selectedSegmentId: string | null;
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
}

export interface TikTokAnalysisResult {
  videoUrl: string;
  thumbnail: string;
  style: StyleSignature;
  title?: string;
  author?: string;
}
