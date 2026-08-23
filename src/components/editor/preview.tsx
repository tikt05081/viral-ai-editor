'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize2 } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn, formatTime } from '@/lib/utils';
import { COLOR_PRESETS } from '@/lib/ai/color-presets';
import { CAPTION_PRESETS } from '@/lib/ai/captions';
import type { EditSegment, MediaClip } from '@/types';

interface PreviewProps {
  className?: string;
  onRequestFullscreen?: () => void;
}

/**
 * The live preview canvas.
 *
 * For each frame, it finds the active segment at the current time,
 * draws the corresponding source video frame to a canvas with the
 * appropriate scale / position / color filter, and overlays captions.
 */
export function Preview({ className }: PreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoElsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const segments = useEditorStore((s) => s.segments);
  const userClips = useEditorStore((s) => s.userClips);
  const currentTime = useEditorStore((s) => s.currentTime);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying);
  const timelineDuration = useEditorStore((s) => s.timelineDuration);
  const enableCaptions = useEditorStore((s) => s.enableCaptions);
  const captionStyle = useEditorStore((s) => s.captionStyle);

  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);

  const aspectRatio = '9 / 16';

  // Get the active segment at a given time
  function getActiveSegment(time: number): EditSegment | null {
    for (const seg of segments) {
      if (time >= seg.timelineStart && time < seg.timelineEnd) return seg;
    }
    return null;
  }

  // Ensure we have a hidden <video> for each source clip
  useEffect(() => {
    const map = videoElsRef.current;
    const currentIds = new Set(userClips.map((c) => c.id));
    // Remove videos no longer needed
    for (const [id, el] of map.entries()) {
      if (!currentIds.has(id)) {
        el.pause();
        el.src = '';
        map.delete(id);
      }
    }
    // Add new
    for (const clip of userClips) {
      if (!map.has(clip.id)) {
        const v = document.createElement('video');
        v.src = clip.url;
        v.muted = true;
        v.playsInline = true;
        v.preload = 'auto';
        v.crossOrigin = 'anonymous';
        v.load();
        map.set(clip.id, v);
      }
    }
  }, [userClips]);

  // Update volume / mute
  useEffect(() => {
    for (const v of videoElsRef.current.values()) {
      v.muted = muted;
      v.volume = volume;
    }
  }, [muted, volume]);

  // Playback
  useEffect(() => {
    if (segments.length === 0) return;
    if (isPlaying) {
      lastTimeRef.current = performance.now();
      const tick = () => {
        const now = performance.now();
        const dt = (now - lastTimeRef.current) / 1000;
        lastTimeRef.current = now;
        const t = useEditorStore.getState().currentTime + dt;
        if (t >= timelineDuration) {
          setIsPlaying(false);
          setCurrentTime(timelineDuration);
          return;
        }
        setCurrentTime(t);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, timelineDuration, setCurrentTime, setIsPlaying, segments.length]);

  // Sync videos to the right time
  useEffect(() => {
    const seg = getActiveSegment(currentTime);
    if (!seg) return;
    const v = videoElsRef.current.get(seg.sourceClipId);
    if (!v) return;
    const localTime = seg.sourceStart + (currentTime - seg.timelineStart) * (seg.speed || 1);
    if (Math.abs(v.currentTime - localTime) > 0.15) {
      try {
        v.currentTime = Math.max(0, Math.min(localTime, v.duration - 0.05));
      } catch {}
    }
    if (isPlaying && v.paused) {
      v.play().catch(() => {});
    } else if (!isPlaying && !v.paused) {
      v.pause();
    }
  }, [currentTime, isPlaying, segments]);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (segments.length === 0) {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Empty state
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '500 18px -apple-system, SF Pro Display, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Add clips to start editing', canvas.width / 2, canvas.height / 2);
      return;
    }
    const seg = getActiveSegment(currentTime);
    if (!seg) return;
    const v = videoElsRef.current.get(seg.sourceClipId);
    if (!v || v.readyState < 2) {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    // Compute scale keyframe at current time
    const scale = computeScale(seg, currentTime);
    const W = canvas.width;
    const H = canvas.height;
    // Fit source to canvas with scale (zoom-punch)
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    const baseScale = Math.max(W / vw, H / vh);
    const finalScale = baseScale * scale;
    const dw = vw * finalScale;
    const dh = vh * finalScale;
    const dx = (W - dw) / 2 + (seg.position?.x || 0) * 2;
    const dy = (H - dh) / 2 + (seg.position?.y || 0) * 2;

    ctx.save();
    // Apply CSS filter for color preset
    const preset = COLOR_PRESETS[seg.colorFilter || 'none'] || COLOR_PRESETS.none;
    if (preset && preset.css !== 'none') {
      ctx.filter = preset.css;
    }
    ctx.drawImage(v, dx, dy, dw, dh);
    ctx.restore();

    // Captions
    if (enableCaptions && captionStyle !== 'none' && seg.captionWords) {
      const localT = currentTime - seg.timelineStart;
      const word = seg.captionWords.find((w) => localT >= w.start && localT < w.end);
      if (word && word.text && word.text !== '…') {
        drawCaption(ctx, canvas, word.text, captionStyle);
      } else if (word && word.text === '…' && seg.captionWords) {
        // Energy-based placeholder — show generic line
        drawCaption(ctx, canvas, '·  ·  ·', captionStyle);
      }
    }
  }, [currentTime, segments, enableCaptions, captionStyle]);

  function computeScale(seg: EditSegment, t: number): number {
    if (!seg.scaleAt || seg.scaleAt.length === 0) return seg.scale || 1;
    // Find the two surrounding keyframes
    const ks = seg.scaleAt;
    if (t <= ks[0].time) return ks[0].scale;
    if (t >= ks[ks.length - 1].time) return ks[ks.length - 1].scale;
    for (let i = 0; i < ks.length - 1; i++) {
      if (t >= ks[i].time && t < ks[i + 1].time) {
        const ratio = (t - ks[i].time) / (ks[i + 1].time - ks[i].time);
        return ks[i].scale + (ks[i + 1].scale - ks[i].scale) * ratio;
      }
    }
    return seg.scale || 1;
  }

  function drawCaption(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, text: string, style: string) {
    const preset = CAPTION_PRESETS[style as keyof typeof CAPTION_PRESETS];
    if (!preset) return;
    const fontSize = Math.round(canvas.height * preset.fontSize);
    ctx.save();
    ctx.font = `${preset.fontWeight} ${fontSize}px -apple-system, SF Pro Display, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const x = canvas.width / 2;
    let y = canvas.height / 2;
    if (preset.position === 'bottom') y = canvas.height - fontSize * 1.5;
    // Wrap text
    const maxWidth = canvas.width * 0.9;
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth) {
        if (line) lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);

    // Draw each line
    const lineH = fontSize * 1.15;
    const totalH = lines.length * lineH;
    const startY = y - totalH / 2 + lineH / 2;
    lines.forEach((l, i) => {
      const ly = startY + i * lineH;
      if (preset.stroke > 0) {
        ctx.lineWidth = preset.stroke;
        ctx.strokeStyle = preset.background === 'transparent' ? '#000' : preset.background;
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeText(l, x, ly);
      }
      if (preset.background && preset.background !== 'transparent') {
        const w = ctx.measureText(l).width;
        const padX = fontSize * 0.35;
        const padY = fontSize * 0.18;
        const bx = x - w / 2 - padX;
        const by = ly - fontSize / 2 - padY;
        const bh = fontSize + padY * 2;
        ctx.fillStyle = preset.background;
        const r = fontSize * 0.18;
        roundRect(ctx, bx, by, w + padX * 2, bh, r);
        ctx.fill();
      }
      ctx.fillStyle = preset.color;
      ctx.fillText(l, x, ly);
    });
    ctx.restore();
  }

  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function handleSeekClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    setCurrentTime(ratio * timelineDuration);
  }

  return (
    <div className={cn('flex flex-col h-full min-h-0', className)}>
      <div className="flex-1 flex items-center justify-center p-4 min-h-0 overflow-hidden">
        <div
          className="relative rounded-3xl overflow-hidden apple-shadow-lg bg-black"
          style={{ aspectRatio, height: '100%', maxHeight: '100%', maxWidth: '100%' }}
        >
          <canvas
            ref={canvasRef}
            width={720}
            height={1280}
            className="w-full h-full object-contain"
          />
          {segments.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-white/60 px-6">
                <p className="text-base font-medium mb-1">Ready when you are</p>
                <p className="text-xs opacity-70">Click "Generate Edit" to start</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transport controls */}
      <div className="border-t border-border/40 bg-background/80 backdrop-blur-xl px-6 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setCurrentTime(0);
              setIsPlaying(false);
            }}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="default"
            size="icon"
            onClick={() => {
              if (segments.length === 0) return;
              setIsPlaying(!isPlaying);
            }}
            disabled={segments.length === 0}
            className="rounded-full"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </Button>
          <div className="font-mono text-xs text-muted-foreground tabular-nums w-24">
            {formatTime(currentTime, true)} / {formatTime(timelineDuration)}
          </div>
          <div
            className="flex-1 h-1.5 rounded-full bg-muted cursor-pointer overflow-hidden"
            onClick={handleSeekClick}
          >
            <div
              className="h-full bg-foreground transition-all"
              style={{ width: `${timelineDuration > 0 ? (currentTime / timelineDuration) * 100 : 0}%` }}
            />
          </div>
          <Button variant="ghost" size="icon-sm" onClick={() => setMuted(!muted)}>
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <div className="w-20">
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[volume]}
              onValueChange={([v]) => setVolume(v)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
