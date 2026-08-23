/**
 * Natural-language instruction parser for the AI editor.
 *
 * Takes a free-form instruction like:
 *   "make it faster, no zooms, just cuts, fade between transitions"
 * and returns a set of edits to apply on top of the auto-generated edit.
 *
 * Parses client-side, no API. Supports:
 *   - Speed (faster, slower, slow-mo, double speed, 0.5x, 2x)
 *   - Pacing (more cuts, fewer cuts, longer shots, shorter shots)
 *   - Effects (no zooms, more zooms, big zooms, smooth)
 *   - Transitions (fade, hard cut, smooth, glitch)
 *   - Color (warmer, cooler, more contrast, vintage)
 *   - Captions (no captions, big captions, all caps, lowercase)
 *   - Filters (use only X clip, skip first second, end at X seconds, etc.)
 *
 * Returns:
 *   - styleOverrides: partial EditOptions to apply
 *   - text: a human-readable summary of what was understood
 *   - warnings: things in the prompt we couldn't parse
 */

export interface ParsedInstruction {
  // Style overrides
  speedMultiplier: number | null; // applied to seg.speed
  shotLengthFactor: number | null; // 0.5 = shorter, 2 = longer
  zoomIntensity: number | null; // 0 = no zoom, 1.5 = strong
  noCaptions: boolean;
  noZoomPunches: boolean;
  noBeatSync: boolean;
  captionStyle: 'hormozi' | 'mrbeast' | 'kinetic' | 'minimal' | null;
  captionCasing: 'upper' | 'lower' | 'normal' | null;
  // Filter
  skipFirstSeconds: number;
  maxSourceDuration: number | null;
  onlyClipIndex: number | null; // -1 for last
  excludeClipIds: string[];
  // Color hints (used to bias the color preset)
  colorHint: 'cinematic' | 'teal-orange' | 'film' | 'y2k' | 'vintage' | 'bw' | null;
  warmth: number | null; // -1 cool, +1 warm
  // Transitions
  transition: 'fade' | 'hard' | 'smooth' | 'glitch' | null;
  transitionDuration: number; // seconds
  // Info
  text: string;
  warnings: string[];
}

const DEFAULT: ParsedInstruction = {
  speedMultiplier: null,
  shotLengthFactor: null,
  zoomIntensity: null,
  noCaptions: false,
  noZoomPunches: false,
  noBeatSync: false,
  captionStyle: null,
  captionCasing: null,
  skipFirstSeconds: 0,
  maxSourceDuration: null,
  onlyClipIndex: null,
  excludeClipIds: [],
  colorHint: null,
  warmth: null,
  transition: null,
  transitionDuration: 0.2,
  text: '',
  warnings: [],
};

export function parseInstruction(input: string): ParsedInstruction {
  const r: ParsedInstruction = { ...DEFAULT };
  const text = input.trim();
  r.text = text;
  if (!text) return r;

  const lower = text.toLowerCase();
  const warnings: string[] = [];

  // ---- SPEED ----
  if (/\b(slow\s*mo|slowmo|slow\s*motion|in\s*slo-?mo|half\s*speed|0\.5x|0\.5\s*x)\b/.test(lower)) {
    r.speedMultiplier = 0.5;
  } else if (/\b(super\s*fast|insanely\s*fast|hyperspeed|extra\s*fast|much\s*faster|way\s*faster)\b/.test(lower)) {
    r.speedMultiplier = 2;
  } else if (/\b(faster|speed\s*up|sped\s*up|2x|2\s*x|double\s*speed|fast)\b/.test(lower)) {
    r.speedMultiplier = 1.5;
  } else if (/\b(slower|slow\s*down|0\.75x|0\.75\s*x)\b/.test(lower)) {
    r.speedMultiplier = 0.75;
  } else if (/\b(normal\s*speed|1x|1\s*x|original\s*speed)\b/.test(lower)) {
    r.speedMultiplier = 1;
  }

  // ---- PACING / SHOT LENGTH ----
  if (/\b(many\s*cuts|a\s*lot\s*of\s*cuts|more\s*cuts|fast\s*cuts|jump\s*cuts|jumpy)\b/.test(lower)) {
    r.shotLengthFactor = 0.5;
  } else if (/\b(fewer\s*cuts|few\s*cuts|less\s*cuts|longer\s*shots|long\s*shots|linger|breathe|breathing)\b/.test(lower)) {
    r.shotLengthFactor = 2;
  } else if (/\b(shorter\s*clips|shorter\s*shots|quick|rapid|snappy|tight)\b/.test(lower)) {
    r.shotLengthFactor = 0.6;
  } else if (/\b(longer\s*clips|longer\s*takes|long\s*takes)\b/.test(lower)) {
    r.shotLengthFactor = 1.5;
  }

  // ---- ZOOM / EFFECTS ----
  if (/\b(no\s*zoom|without\s*zoom|don'?t\s*zoom|remove\s*zoom|kill\s*zoom|no\s*punch|no\s*punches|just\s*cuts|raw\s*cuts)\b/.test(lower)) {
    r.noZoomPunches = true;
    r.zoomIntensity = 0;
  } else if (/\b(big\s*zoom|strong\s*zoom|aggressive\s*zoom|hard\s*zoom|kinetic|high\s*energy)\b/.test(lower)) {
    r.zoomIntensity = 1.5;
  } else if (/\b(soft\s*zoom|gentle|subtle|minimal)\b/.test(lower)) {
    r.zoomIntensity = 0.5;
  } else if (/\b(zoom\s*in|more\s*zoom|add\s*zoom)\b/.test(lower)) {
    r.zoomIntensity = 1.2;
  }

  // ---- BEAT SYNC ----
  if (/\b(no\s*beat|no\s*sync|don'?t\s*sync|free\s*form|random\s*cuts|unstructured)\b/.test(lower)) {
    r.noBeatSync = true;
  }

  // ---- CAPTIONS ----
  if (/\b(no\s*caption|no\s*subtitle|no\s*text|without\s*caption|remove\s*caption)\b/.test(lower)) {
    r.noCaptions = true;
  } else if (/\b(big\s*caption|huge\s*text|big\s*text|kinetic\s*caption|attention\s*grabbing)\b/.test(lower)) {
    r.captionStyle = 'hormozi';
  } else if (/\b(mrbeast\s*style|mr\s*beast|red\s*caption|yellow\s*caption)\b/.test(lower)) {
    r.captionStyle = 'mrbeast';
  } else if (/\b(kinetic\s*caption|kinetic\s*text|pink\s*caption)\b/.test(lower)) {
    r.captionStyle = 'kinetic';
  } else if (/\b(minimal\s*caption|clean\s*caption|small\s*caption|subtle\s*text)\b/.test(lower)) {
    r.captionStyle = 'minimal';
  } else if (/\b(add\s*caption|with\s*caption|enable\s*caption|show\s*caption)\b/.test(lower)) {
    r.captionStyle = 'kinetic';
  }

  // ---- CASING ----
  if (/\b(all\s*caps|uppercase|capitalize|caps)\b/.test(lower)) {
    r.captionCasing = 'upper';
  } else if (/\b(lowercase|all\s*lowercase|no\s*caps|lower\s*case)\b/.test(lower)) {
    r.captionCasing = 'lower';
  }

  // ---- COLOR ----
  if (/\b(cinematic|hollywood|blockbuster|moody|dark\s*grade)\b/.test(lower)) {
    r.colorHint = 'cinematic';
  } else if (/\b(teal\s*and\s*orange|teal\s*orange|orange\s*and\s*teal|movie\s*look)\b/.test(lower)) {
    r.colorHint = 'teal-orange';
  } else if (/\b(film|filmic|kodak|portra|35mm)\b/.test(lower)) {
    r.colorHint = 'film';
  } else if (/\b(y2k|year\s*2000|nostalgic|cyberpunk|neon)\b/.test(lower)) {
    r.colorHint = 'y2k';
  } else if (/\b(vintage|sepia|old\s*film|retro|faded)\b/.test(lower)) {
    r.colorHint = 'vintage';
  } else if (/\b(black\s*and\s*white|b&w|b\s*&\s*w|monochrome|grayscale|mono)\b/.test(lower)) {
    r.colorHint = 'bw';
  } else if (/\b(warm|warmer|orange\s*tone|golden|cozy)\b/.test(lower)) {
    r.warmth = 0.5;
  } else if (/\b(cool|cooler|blue\s*tone|cold|icy)\b/.test(lower)) {
    r.warmth = -0.5;
  }

  // ---- TRANSITIONS ----
  if (/\b(fade|fade\s*in|fade\s*out|crossfade|cross\s*fade|soft\s*transition)\b/.test(lower)) {
    r.transition = 'fade';
  } else if (/\b(glitch|distort|broken\s*tv|static)\b/.test(lower)) {
    r.transition = 'glitch';
  } else if (/\b(smooth|seamless|fluid)\b/.test(lower)) {
    r.transition = 'smooth';
  } else if (/\b(hard\s*cut|hard\s*cuts|no\s*transition|jump)\b/.test(lower)) {
    r.transition = 'hard';
  }

  // ---- CLIPS ----
  if (/\b(use\s*only\s*the\s*last\s*clip|just\s*the\s*last\s*clip|only\s*the\s*last|use\s*last)\b/.test(lower)) {
    r.onlyClipIndex = -1;
  }
  if (/\b(use\s*only\s*the\s*first\s*clip|just\s*the\s*first\s*clip|only\s*the\s*first)\b/.test(lower)) {
    r.onlyClipIndex = 0;
  }
  if (/\b(skip\s*(?:the\s*)?(?:first|opening)\s*(\d+(?:\.\d+)?)\s*(?:s|sec|second|seconds)?)/.test(lower)) {
    const m = lower.match(/skip\s*(?:the\s*)?(?:first|opening)\s*(\d+(?:\.\d+)?)\s*(?:s|sec|second|seconds)?/);
    if (m) r.skipFirstSeconds = parseFloat(m[1]);
  }
  if (/\b(use\s*(?:only\s*)?(?:the\s*)?(?:first|opening|last)\s*(\d+(?:\.\d+)?)\s*(?:s|sec|second|seconds)?)/.test(lower)) {
    const m = lower.match(/use\s*(?:only\s*)?(?:the\s*)?(?:first|opening|last)\s*(\d+(?:\.\d+)?)\s*(?:s|sec|second|seconds)?/);
    if (m && r.maxSourceDuration === null) r.maxSourceDuration = parseFloat(m[1]);
  }

  r.warnings = warnings;
  return r;
}

/**
 * Apply the parsed instruction to a generated edit.
 */
export function applyInstructionToEdit(
  seg: {
    sourceStart: number;
    sourceEnd: number;
    timelineStart: number;
    timelineEnd: number;
    speed: number;
    scale?: number;
    scaleAt?: { time: number; scale: number }[];
  },
  instr: ParsedInstruction,
): typeof seg {
  const out = { ...seg };

  if (instr.speedMultiplier !== null) {
    out.speed = (seg.speed || 1) * instr.speedMultiplier;
  }
  if (instr.zoomIntensity === 0) {
    out.scaleAt = undefined;
    out.scale = 1;
  } else if (instr.zoomIntensity !== null && out.scaleAt) {
    out.scaleAt = out.scaleAt.map((k) => ({
      time: k.time,
      scale: 1 + (k.scale - 1) * instr.zoomIntensity!,
    }));
  }

  if (instr.skipFirstSeconds > 0) {
    out.sourceStart = Math.max(0, out.sourceStart + instr.skipFirstSeconds);
    if (out.sourceEnd <= out.sourceStart) {
      out.sourceEnd = out.sourceStart + 0.5;
    }
  }
  if (instr.maxSourceDuration !== null) {
    const maxDur = instr.maxSourceDuration;
    if (out.sourceEnd - out.sourceStart > maxDur) {
      out.sourceEnd = out.sourceStart + maxDur;
    }
  }

  return out;
}

/**
 * Build a human-readable summary of the parsed instruction.
 */
export function summarizeInstruction(instr: ParsedInstruction): string {
  const parts: string[] = [];
  if (instr.speedMultiplier !== null) {
    if (instr.speedMultiplier < 1) parts.push(`slower (${instr.speedMultiplier}x)`);
    else if (instr.speedMultiplier > 1) parts.push(`faster (${instr.speedMultiplier}x)`);
    else parts.push('normal speed');
  }
  if (instr.shotLengthFactor !== null) {
    if (instr.shotLengthFactor < 1) parts.push('shorter shots / more cuts');
    else parts.push('longer shots / fewer cuts');
  }
  if (instr.noZoomPunches) parts.push('no zoom punches');
  if (instr.zoomIntensity !== null && !instr.noZoomPunches) {
    if (instr.zoomIntensity > 1) parts.push('bigger zooms');
    else if (instr.zoomIntensity < 1) parts.push('softer zooms');
  }
  if (instr.noBeatSync) parts.push('no beat sync');
  if (instr.noCaptions) parts.push('no captions');
  if (instr.captionStyle) parts.push(`${instr.captionStyle} captions`);
  if (instr.captionCasing) parts.push(`${instr.captionCasing}case text`);
  if (instr.colorHint) parts.push(`${instr.colorHint} color`);
  if (instr.warmth !== null) parts.push(instr.warmth > 0 ? 'warmer' : 'cooler');
  if (instr.transition) parts.push(`${instr.transition} transitions`);
  if (instr.skipFirstSeconds > 0) parts.push(`skip first ${instr.skipFirstSeconds}s`);
  if (instr.maxSourceDuration !== null) parts.push(`use first ${instr.maxSourceDuration}s of each clip`);
  if (instr.onlyClipIndex !== null) {
    parts.push(instr.onlyClipIndex === -1 ? 'only last clip' : 'only first clip');
  }
  return parts.length > 0 ? parts.join(' · ') : 'no changes understood';
}
