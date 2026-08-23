/**
 * Color presets for the editor. Each preset is a set of CSS filter values
 * that FFmpeg can re-apply via the `eq`/`colorchannelmixer`/`curves` filters,
 * or we can apply at composite time.
 */

export interface ColorPreset {
  id: string;
  label: string;
  description: string;
  // CSS-style filter values for canvas rendering / preview
  css: string;
  // FFmpeg filter chain (applied to each source clip)
  ffmpeg: string;
  // Visual swatches
  swatch: string;
}

export const COLOR_PRESETS: Record<string, ColorPreset> = {
  none: {
    id: 'none',
    label: 'Original',
    description: 'No color grading',
    css: 'none',
    ffmpeg: '',
    swatch: 'linear-gradient(135deg, #888 0%, #aaa 100%)',
  },
  cinematic: {
    id: 'cinematic',
    label: 'Cinematic',
    description: 'Teal shadows, warm highlights',
    css: 'contrast(1.1) saturate(1.1) hue-rotate(-5deg) brightness(0.95)',
    ffmpeg: 'eq=contrast=1.1:saturation=1.1:brightness=-0.05,colorbalance=bs=0.1:bm=0.05:gh=-0.05',
    swatch: 'linear-gradient(135deg, #1a3a52 0%, #d4a574 100%)',
  },
  'teal-orange': {
    id: 'teal-orange',
    label: 'Teal & Orange',
    description: 'Blockbuster blockbuster look',
    css: 'contrast(1.15) saturate(1.25) hue-rotate(180deg) sepia(0.2)',
    ffmpeg: 'eq=contrast=1.15:saturation=1.25,colorbalance=bs=0.15:bm=0.1:gh=0.05:bh=-0.05',
    swatch: 'linear-gradient(135deg, #0d4f5c 0%, #ff8c42 100%)',
  },
  film: {
    id: 'film',
    label: 'Film',
    description: 'Kodak Portra 400 emulation',
    css: 'contrast(1.05) saturate(0.85) sepia(0.1) brightness(1.02)',
    ffmpeg: 'eq=contrast=1.05:saturation=0.85:gamma=1.05,colorbalance=rh=0.05:bh=-0.05',
    swatch: 'linear-gradient(135deg, #c9a87c 0%, #5d6d7e 100%)',
  },
  y2k: {
    id: 'y2k',
    label: 'Y2K',
    description: 'Magenta + cyan, saturated',
    css: 'saturate(1.4) contrast(1.1) hue-rotate(280deg)',
    ffmpeg: 'eq=contrast=1.1:saturation=1.4,colorbalance=bs=0.2:bm=0.15',
    swatch: 'linear-gradient(135deg, #ff006e 0%, #00f5ff 100%)',
  },
  vintage: {
    id: 'vintage',
    label: 'Vintage',
    description: 'Faded, warm, low-contrast',
    css: 'sepia(0.4) saturate(0.8) contrast(0.9) brightness(1.05)',
    ffmpeg: 'eq=contrast=0.9:saturation=0.8:brightness=0.05,colorbalance=rh=0.08:gh=0.05:bh=-0.05',
    swatch: 'linear-gradient(135deg, #c9a96e 0%, #6e4c2e 100%)',
  },
  bw: {
    id: 'bw',
    label: 'Mono',
    description: 'Black & white, high contrast',
    css: 'grayscale(1) contrast(1.2)',
    ffmpeg: 'hue=s=0,eq=contrast=1.2',
    swatch: 'linear-gradient(135deg, #000 0%, #fff 100%)',
  },
};
