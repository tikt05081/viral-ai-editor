'use client';

import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useEditorStore } from '@/store/editor-store';
import { cn, formatTime } from '@/lib/utils';
import { Plus, Minus } from 'lucide-react';

const TRACK_HEADER_WIDTH = 140;
const TIMELINE_HEIGHT = 200;

export function Timeline() {
  const segments = useEditorStore((s) => s.segments);
  const timelineDuration = useEditorStore((s) => s.timelineDuration);
  const currentTime = useEditorStore((s) => s.currentTime);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const selectedSegmentId = useEditorStore((s) => s.selectedSegmentId);
  const setSelectedSegmentId = useEditorStore((s) => s.setSelectedSegmentId);
  const userClips = useEditorStore((s) => s.userClips);
  const styleSignature = useEditorStore((s) => s.styleSignature);
  const refBeats = useEditorStore((s) => s.refBeats);
  const refVisuals = useEditorStore((s) => s.refVisuals);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(60);

  // Auto-fit zoom
  useEffect(() => {
    if (!containerRef.current || timelineDuration === 0) return;
    const w = containerRef.current.clientWidth - TRACK_HEADER_WIDTH - 32;
    if (w > 0) {
      const ideal = w / timelineDuration;
      setZoom(Math.max(20, Math.min(300, ideal)));
    }
  }, [timelineDuration]);

  const totalWidth = Math.max(800, timelineDuration * zoom);

  function pixelToTime(px: number) {
    return Math.max(0, Math.min(timelineDuration, px / zoom));
  }

  function handleTimelineClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scrollLeft = containerRef.current.scrollLeft;
    const px = e.clientX - rect.left + scrollLeft - TRACK_HEADER_WIDTH;
    if (px < 0) return;
    setCurrentTime(pixelToTime(px));
  }

  const tickStep = chooseTickStep(zoom);
  const tickCount = Math.ceil(timelineDuration / tickStep) + 1;

  return (
    <div className="border-t border-white/5 bg-[#0a0a0b] flex flex-col">
      <div className="h-7 flex items-center justify-between px-2 border-b border-white/5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Timeline</div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.max(20, z - 15))}
            className="h-5 w-5 rounded hover:bg-white/5 flex items-center justify-center text-muted-foreground"
          >
            <Minus className="h-3 w-3" />
          </button>
          <div className="text-[10px] text-muted-foreground font-mono tabular-nums w-12 text-center">
            {Math.round(zoom)}px/s
          </div>
          <button
            onClick={() => setZoom((z) => Math.min(300, z + 15))}
            className="h-5 w-5 rounded hover:bg-white/5 flex items-center justify-center text-muted-foreground"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="overflow-x-auto overflow-y-hidden flex-1 timeline-scroll"
      >
        <div className="relative" style={{ width: totalWidth + TRACK_HEADER_WIDTH, height: TIMELINE_HEIGHT }}>
          {/* Track headers column */}
          <div
            className="absolute left-0 top-0 bottom-0 z-20 bg-[#0a0a0b] border-r border-white/5"
            style={{ width: TRACK_HEADER_WIDTH }}
          >
            <div className="h-6 border-b border-white/5" />
            <TrackHeader label="V1" sub="Video" />
            <TrackHeader label="AI" sub="Beat grid" />
            <TrackHeader label="V2" sub="Overlay" sub2="(empty)" />
            <div className="h-6" />
          </div>

          {/* Ruler */}
          <div
            className="absolute top-0 h-6 border-b border-white/5 cursor-pointer"
            style={{ left: TRACK_HEADER_WIDTH, width: totalWidth }}
            onClick={handleTimelineClick}
          >
            {Array.from({ length: tickCount }, (_, i) => {
              const t = i * tickStep;
              const x = t * zoom;
              return (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 border-l border-white/10 text-[9px] text-muted-foreground font-mono pl-1 pt-0.5"
                  style={{ left: x }}
                >
                  {formatTime(t)}
                </div>
              );
            })}
          </div>

          {/* V1 - Video track */}
          <div
            className="absolute h-12 top-6"
            style={{ left: TRACK_HEADER_WIDTH, width: totalWidth }}
            onClick={handleTimelineClick}
          >
            {segments.map((seg, i) => {
              const left = seg.timelineStart * zoom;
              const width = Math.max(20, (seg.timelineEnd - seg.timelineStart) * zoom - 2);
              const isSelected = seg.id === selectedSegmentId;
              const clip = userClips.find((c) => c.id === seg.sourceClipId);
              return (
                <motion.div
                  key={seg.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSegmentId(seg.id);
                  }}
                  className={cn(
                    'absolute top-0.5 bottom-0.5 rounded-md overflow-hidden border transition-all cursor-pointer',
                    isSelected
                      ? 'border-white ring-1 ring-white/30 z-10'
                      : 'border-white/10 hover:border-white/30',
                  )}
                  style={{ left, width }}
                >
                  {clip?.thumbnail ? (
                    <img
                      src={clip.thumbnail}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover opacity-50"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/40 to-pink-500/40" />
                  <div className="relative h-full px-1.5 flex flex-col justify-between py-0.5">
                    <div className="text-[9px] font-mono text-white/90 truncate">
                      {i + 1}
                    </div>
                    <div className="text-[8px] font-mono text-white/70 tabular-nums truncate">
                      {formatTime(seg.timelineEnd - seg.timelineStart)}
                    </div>
                  </div>
                  {/* Zoom keyframe waveform */}
                  {seg.scaleAt && seg.scaleAt.length > 1 && (
                    <svg
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      <polyline
                        points={seg.scaleAt
                          .map((k) => {
                            const x = ((k.time - seg.timelineStart) / (seg.timelineEnd - seg.timelineStart)) * 100;
                            const y = 100 - (k.scale - 1) * 400;
                            return `${x},${Math.max(5, Math.min(95, y))}`;
                          })
                          .join(' ')}
                        fill="none"
                        stroke="rgba(255,255,255,0.6)"
                        strokeWidth="1.5"
                      />
                    </svg>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* AI - Beat grid track */}
          <div
            className="absolute h-8 top-[3.75rem]"
            style={{ left: TRACK_HEADER_WIDTH, width: totalWidth }}
            onClick={handleTimelineClick}
          >
            {/* Beat grid ticks */}
            {refBeats?.beats.map((b, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 w-px bg-purple-400/50"
                style={{ left: b * zoom }}
              />
            ))}
            {/* Motion intensity waveform */}
            {refVisuals?.motionFrames.map((m, i) => (
              <div
                key={i}
                className="absolute bottom-0 w-0.5 bg-pink-400/30"
                style={{
                  left: m.time * zoom,
                  height: `${m.intensity * 100}%`,
                }}
              />
            ))}
            {/* Scene boundaries */}
            {refVisuals?.sceneBoundaries.map((b, i) => (
              <div
                key={`sc-${i}`}
                className="absolute top-0 bottom-0 w-px bg-orange-400/70"
                style={{ left: b.time * zoom }}
              />
            ))}
            {refBeats?.beats.length === 0 && !refVisuals && (
              <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">
                No AI analysis yet
              </div>
            )}
          </div>

          {/* V2 - Empty overlay track */}
          <div
            className="absolute h-12 top-[6.5rem]"
            style={{ left: TRACK_HEADER_WIDTH, width: totalWidth }}
            onClick={handleTimelineClick}
          >
            <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground/50">
              Drag clips here
            </div>
          </div>

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-px bg-white pointer-events-none z-30"
            style={{ left: TRACK_HEADER_WIDTH + currentTime * zoom }}
          >
            <div className="absolute -top-0 -left-1.5 w-3 h-3 rounded-full bg-white" />
          </div>
        </div>
      </div>
    </div>
  );
}

function TrackHeader({ label, sub, sub2 }: { label: string; sub: string; sub2?: string }) {
  return (
    <div className="h-12 px-3 flex items-center justify-between border-b border-white/5">
      <div className="flex items-center gap-2">
        <div className="text-xs font-mono font-semibold">{label}</div>
        <div>
          <div className="text-[10px] text-muted-foreground">{sub}</div>
          {sub2 && <div className="text-[9px] text-muted-foreground/60">{sub2}</div>}
        </div>
      </div>
    </div>
  );
}

function chooseTickStep(pxPerSec: number): number {
  const target = 80 / pxPerSec;
  const candidates = [0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60];
  for (const c of candidates) {
    if (c >= target) return c;
  }
  return 60;
}
