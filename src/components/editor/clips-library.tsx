'use client';

import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Film, Plus, Loader2, Image as ImageIcon } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { Button } from '@/components/ui/button';
import { cn, formatTime, formatBytes } from '@/lib/utils';
import { decodeMedia } from '@/lib/ai/extract-frames';
import type { MediaClip } from '@/types';
import { toast } from 'sonner';

export function ClipsLibrary() {
  const userClips = useEditorStore((s) => s.userClips);
  const addUserClip = useEditorStore((s) => s.addUserClip);
  const removeUserClip = useEditorStore((s) => s.removeUserClip);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<number>(0);
  const [dragOver, setDragOver] = useState(false);

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    setUploading(arr.length);
    for (let i = 0; i < arr.length; i++) {
      const file = arr[i];
      try {
        const decoded = await decodeMedia(file, { fps: 1, withAudio: false, maxSize: 240 });
        // Generate thumbnail
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
          id: `user_${Date.now()}_${i}`,
          name: file.name || `Clip ${userClips.length + i + 1}`,
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
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) handleFiles(files);
  }

  return (
    <div className="rounded-3xl border border-border/60 bg-card apple-shadow overflow-hidden">
      <div className="p-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Your clips</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {userClips.length} clip{userClips.length === 1 ? '' : 's'} loaded
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => fileInputRef.current?.click()}
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      <div
        className={cn(
          'p-3 min-h-[140px] transition-colors',
          dragOver && 'bg-muted/30',
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {userClips.length === 0 && uploading === 0 ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-32 rounded-2xl border-2 border-dashed border-border/60 hover:border-foreground/30 hover:bg-muted/20 transition-colors flex flex-col items-center justify-center text-muted-foreground"
          >
            <Upload className="h-5 w-5 mb-2" />
            <span className="text-sm">Drop clips or click to upload</span>
            <span className="text-xs mt-1">MP4, MOV, WebM</span>
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {uploading > 0 && (
              <div className="aspect-[9/16] rounded-2xl border border-border/60 bg-muted/40 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                  <span className="text-[10px] text-muted-foreground">Loading {uploading}…</span>
                </div>
              </div>
            )}
            <AnimatePresence>
              {userClips.map((clip) => (
                <motion.div
                  key={clip.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="group relative aspect-[9/16] rounded-2xl overflow-hidden border border-border/60 bg-muted/40 apple-shadow"
                >
                  {clip.thumbnail ? (
                    <img src={clip.thumbnail} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-2">
                    <div className="text-[10px] text-white/90 font-mono tabular-nums">
                      {formatTime(clip.duration)}
                    </div>
                    <div className="text-[10px] text-white/70 truncate">
                      {clip.name}
                    </div>
                  </div>
                  <button
                    onClick={() => removeUserClip(clip.id)}
                    className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
