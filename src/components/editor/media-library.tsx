'use client';

import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Plus, Image as ImageIcon, Sparkles, Film } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { Button } from '@/components/ui/button';
import { decodeMedia } from '@/lib/ai/extract-frames';
import { toast } from 'sonner';
import type { MediaClip } from '@/types';
import { formatTime, cn } from '@/lib/utils';

export function MediaLibrary() {
  const userClips = useEditorStore((s) => s.userClips);
  const referenceClip = useEditorStore((s) => s.referenceClip);
  const styleSignature = useEditorStore((s) => s.styleSignature);
  const addUserClip = useEditorStore((s) => s.addUserClip);
  const removeUserClip = useEditorStore((s) => s.removeUserClip);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    for (const file of arr) {
      try {
        const decoded = await decodeMedia(file, { fps: 1, withAudio: false, maxSize: 240 });
        const thumbCanvas = document.createElement('canvas');
        const aspect = decoded.width / decoded.height;
        if (aspect > 1) {
          thumbCanvas.width = 240;
          thumbCanvas.height = Math.round(240 / aspect);
        } else {
          thumbCanvas.height = 240;
          thumbCanvas.width = Math.round(240 * aspect);
        }
        const tctx = thumbCanvas.getContext('2d')!;
        tctx.drawImage(decoded.video, 0, 0, thumbCanvas.width, thumbCanvas.height);
        const thumb = thumbCanvas.toDataURL('image/jpeg', 0.7);
        const clip: MediaClip = {
          id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: file.name || `Clip ${userClips.length + 1}`,
          url: URL.createObjectURL(file),
          blob: file,
          duration: decoded.duration,
          width: decoded.width,
          height: decoded.height,
          size: file.size,
          type: file.type,
          thumbnail: thumb,
        };
        addUserClip(clip);
      } catch (err) {
        toast.error('Failed to load clip', { description: (err as Error).message });
      }
    }
  }

  return (
    <aside className="w-72 shrink-0 border-r border-white/5 flex flex-col bg-black/20">
      {/* Reference info */}
      {styleSignature && (
        <div className="p-3 border-b border-white/5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            <Sparkles className="h-3 w-3" />
            Reference
          </div>
          {referenceClip?.thumbnail ? (
            <div className="relative aspect-video rounded-lg overflow-hidden bg-muted/40 mb-2">
              <img src={referenceClip.thumbnail} alt="" className="w-full h-full object-cover" />
            </div>
          ) : null}
          <div className="text-xs font-medium truncate">{referenceClip?.name || 'Untitled'}</div>
          <div className="grid grid-cols-3 gap-1 mt-2 text-[10px]">
            <Stat label="BPM" value={styleSignature.bpm > 0 ? String(styleSignature.bpm) : '—'} />
            <Stat label="Cuts/m" value={styleSignature.cutsPerMinute.toFixed(0)} />
            <Stat label="Motion" value={`${Math.round(styleSignature.motionIntensity * 100)}%`} />
          </div>
        </div>
      )}

      {/* Media library */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Media</div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="h-6 w-6 rounded-md hover:bg-white/5 flex items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </div>

        {userClips.length === 0 ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
            }}
            className={cn(
              'w-full h-32 rounded-xl border-2 border-dashed transition-colors flex flex-col items-center justify-center text-muted-foreground text-xs',
              dragOver ? 'border-white/40 bg-white/5' : 'border-white/10 hover:border-white/20'
            )}
          >
            <Upload className="h-4 w-4 mb-1.5" />
            <span>Drop clips or click</span>
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {userClips.map((clip) => {
              const isRef = referenceClip?.id === clip.id;
              return (
                <div
                  key={clip.id}
                  className="group relative aspect-video rounded-md overflow-hidden border border-white/10 bg-muted/40"
                  title={clip.name}
                >
                  {clip.thumbnail ? (
                    <img src={clip.thumbnail} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  {isRef && (
                    <div className="absolute top-1 left-1 inline-flex items-center gap-0.5 bg-white text-black text-[8px] font-semibold uppercase tracking-wider rounded px-1 py-0.5">
                      <Sparkles className="h-2 w-2" />
                      Ref
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                    <div className="text-[9px] text-white/90 font-mono tabular-nums">
                      {formatTime(clip.duration)}
                    </div>
                  </div>
                  <button
                    onClick={() => removeUserClip(clip.id)}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              );
            })}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="aspect-video rounded-md border-2 border-dashed border-white/10 hover:border-white/20 flex flex-col items-center justify-center text-muted-foreground text-[10px]"
            >
              <Plus className="h-3.5 w-3.5 mb-0.5" />
              Add
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/5 px-1.5 py-1 text-center">
      <div className="text-[8px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-xs font-semibold tabular-nums">{value}</div>
    </div>
  );
}
