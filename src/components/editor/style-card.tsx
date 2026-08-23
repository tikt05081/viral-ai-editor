'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Palette, Activity, Clock, X, Image as ImageIcon } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function StyleCard() {
  const referenceClip = useEditorStore((s) => s.referenceClip);
  const referenceThumbnail = useEditorStore((s) => s.referenceThumbnail);
  const styleSignature = useEditorStore((s) => s.styleSignature);
  const refBeats = useEditorStore((s) => s.refBeats);
  const reset = useEditorStore((s) => s.reset);
  const [expanded, setExpanded] = useState(true);

  if (!styleSignature) return null;

  return (
    <div className="rounded-3xl border border-border/60 bg-card apple-shadow overflow-hidden">
      <div className="p-4 flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl overflow-hidden bg-muted shrink-0">
          {referenceThumbnail ? (
            <img src={referenceThumbnail} alt="" className="w-full h-full object-cover" />
          ) : referenceClip?.thumbnail ? (
            <img src={referenceClip.thumbnail} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted-foreground">Reference style</div>
          <div className="font-medium truncate text-sm">
            {referenceClip?.name || 'Untitled'}
          </div>
        </div>
        <button
          onClick={reset}
          className="h-7 w-7 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border/40"
          >
            <div className="p-4 space-y-3">
              {/* Color palette */}
              <div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                  <Palette className="h-3 w-3" />
                  Palette
                </div>
                <div className="flex gap-1.5">
                  {styleSignature.colorPalette.map((c, i) => (
                    <div
                      key={i}
                      className="h-7 flex-1 rounded-lg ring-1 ring-black/5"
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2">
                <Stat
                  icon={<Music className="h-3 w-3" />}
                  label="BPM"
                  value={styleSignature.bpm > 0 ? String(styleSignature.bpm) : '—'}
                />
                <Stat
                  icon={<Activity className="h-3 w-3" />}
                  label="Motion"
                  value={`${Math.round(styleSignature.motionIntensity * 100)}%`}
                />
                <Stat
                  icon={<Clock className="h-3 w-3" />}
                  label="Shot"
                  value={`${styleSignature.avgShotLength.toFixed(1)}s`}
                />
                <Stat
                  icon={<Activity className="h-3 w-3" />}
                  label="Cuts/min"
                  value={styleSignature.cutsPerMinute.toFixed(0)}
                />
              </div>
              {/* Brightness / contrast bars */}
              <div className="space-y-1.5">
                <Bar label="Brightness" value={styleSignature.avgBrightness} />
                <Bar label="Contrast" value={styleSignature.contrast * 3} />
                <Bar label="Saturation" value={styleSignature.saturation} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/40 p-2.5">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
        <span>{label}</span>
        <span className="font-mono tabular-nums">{Math.round(pct)}%</span>
      </div>
      <div className="h-1 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-foreground/80 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
