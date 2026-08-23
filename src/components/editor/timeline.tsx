'use client';

import { useRef, useState, useEffect } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { cn, formatTime } from '@/lib/utils';

const TIMELINE_HEIGHT = 80;

export function Timeline() {
  const segments = useEditorStore((s) => s.segments);
  const timelineDuration = useEditorStore((s) => s.timelineDuration);
  const currentTime = useEditorStore((s) => s.currentTime);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const selectedSegmentId = useEditorStore((s) => s.selectedSegmentId);
  const setSelectedSegmentId = useEditorStore((s) => s.setSelectedSegmentId);
  const styleSignature = useEditorStore((s) => s.styleSignature);
  const refBeats = useEditorStore((s) => s.refBeats);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(80); // pixels per second

  // Auto-fit
  useEffect(() => {
    if (!containerRef.current) return;
    const w = containerRef.current.clientWidth - 32;
    if (timelineDuration > 0) {
      const ideal = w / timelineDuration;
      setZoom(Math.max(20, Math.min(400, ideal)));
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
    const px = e.clientX - rect.left + scrollLeft;
    setCurrentTime(pixelToTime(px));
  }

  // Ruler marks
  const tickStep = chooseTickStep(zoom);
  const tickCount = Math.ceil(timelineDuration / tickStep) + 1;

  return (
    <div className="border-t border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="px-6 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Timeline</h3>
          <div className="text-xs text-muted-foreground font-mono tabular-nums">
            {segments.length} segments · {formatTime(timelineDuration)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.max(20, z - 20))}
            className="h-6 w-6 rounded-full hover:bg-muted text-xs text-muted-foreground"
          >
            −
          </button>
          <div className="text-xs text-muted-foreground font-mono w-12 text-center">{Math.round(zoom)}px/s</div>
          <button
            onClick={() => setZoom((z) => Math.min(400, z + 20))}
            className="h-6 w-6 rounded-full hover:bg-muted text-xs text-muted-foreground"
          >
            +
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="overflow-x-auto overflow-y-hidden timeline-scroll px-4 pb-4"
      >
        <div
          className="relative cursor-crosshair"
          style={{ width: totalWidth, height: TIMELINE_HEIGHT }}
          onClick={handleTimelineClick}
        >
          {/* Ruler */}
          <div className="absolute top-0 left-0 right-0 h-6 border-b border-border/40">
            {Array.from({ length: tickCount }, (_, i) => {
              const t = i * tickStep;
              const x = t * zoom;
              return (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 border-l border-border/40 text-[10px] text-muted-foreground font-mono pl-1"
                  style={{ left: x }}
                >
                  {formatTime(t)}
                </div>
              );
            })}
          </div>

          {/* Beat grid */}
          {refBeats && (
            <div className="absolute top-6 left-0 right-0 h-3">
              {refBeats.beats.map((b: number, i: number) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 w-px bg-purple-500/40"
                  style={{ left: b * zoom }}
                />
              ))}
            </div>
          )}

          {/* Track */}
          <div className="absolute top-9 left-0 right-0 bottom-0">
            {segments.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                No segments yet. Upload clips and click "Generate Edit".
              </div>
            ) : (
              segments.map((seg, i) => {
                const left = seg.timelineStart * zoom;
                const width = (seg.timelineEnd - seg.timelineStart) * zoom;
                const isSelected = seg.id === selectedSegmentId;
                return (
                  <div
                    key={seg.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSegmentId(seg.id);
                    }}
                    className={cn(
                      'absolute top-0 bottom-0 rounded-xl border transition-all cursor-pointer overflow-hidden',
                      isSelected
                        ? 'border-foreground ring-2 ring-foreground/30'
                        : 'border-border/60 hover:border-foreground/30',
                    )}
                    style={{ left, width: Math.max(20, width - 2) }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20" />
                    <div className="relative h-full p-2 flex flex-col justify-between">
                      <div className="text-[10px] font-mono text-foreground/80 truncate">
                        #{i + 1}
                      </div>
                      <div className="text-[10px] font-mono text-foreground/60 tabular-nums">
                        {formatTime(seg.timelineStart)} → {formatTime(seg.timelineEnd)}
                      </div>
                    </div>
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
                              const y = 100 - (k.scale - 1) * 500;
                              return `${x},${Math.max(0, Math.min(100, y))}`;
                            })
                            .join(' ')}
                          fill="none"
                          stroke="rgba(255,255,255,0.4)"
                          strokeWidth="1"
                        />
                      </svg>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-px bg-foreground pointer-events-none z-10"
            style={{ left: currentTime * zoom }}
          >
            <div className="absolute -top-1 -left-1.5 w-3 h-3 rounded-full bg-foreground" />
          </div>
        </div>
      </div>
    </div>
  );
}

function chooseTickStep(pxPerSec: number): number {
  // Choose tick step in seconds so ticks are ~80px apart
  const target = 80 / pxPerSec;
  const candidates = [0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60];
  for (const c of candidates) {
    if (c >= target) return c;
  }
  return 60;
}
