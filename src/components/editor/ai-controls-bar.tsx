'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Download, Loader2, RefreshCw, Wand2, Zap, Music } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { generateAutoEdit } from '@/lib/ai/auto-edit';
import { exportProject } from '@/lib/ffmpeg/ffmpeg-client';
import { toast } from 'sonner';

export function AIControlsBar() {
  const userClips = useEditorStore((s) => s.userClips);
  const styleSignature = useEditorStore((s) => s.styleSignature);
  const refBeats = useEditorStore((s) => s.refBeats);
  const refVisuals = useEditorStore((s) => s.refVisuals);
  const setSegments = useEditorStore((s) => s.setSegments);
  const setTimelineDuration = useEditorStore((s) => s.setTimelineDuration);
  const segments = useEditorStore((s) => s.segments);
  const colorPreset = useEditorStore((s) => s.colorPreset);
  const enableCaptions = useEditorStore((s) => s.enableCaptions);
  const zoomPunches = useEditorStore((s) => s.zoomPunches);
  const beatSync = useEditorStore((s) => s.beatSync);
  const isExporting = useEditorStore((s) => s.isExporting);
  const setIsExporting = useEditorStore((s) => s.setIsExporting);
  const setExportProgress = useEditorStore((s) => s.setExportProgress);
  const exportProgress = useEditorStore((s) => s.exportProgress);

  const [generating, setGenerating] = useState(false);
  const [autoGenTried, setAutoGenTried] = useState(false);

  async function handleGenerate() {
    if (userClips.length === 0) {
      toast.error('Upload at least one clip first');
      return;
    }
    if (!styleSignature) {
      toast.error('Analyze a reference first');
      return;
    }
    setGenerating(true);
    try {
      const captions = {
        words: styleSignature.beats.map((t, i) => ({
          text: i % 4 === 0 ? 'Viral' : '·',
          start: t,
          end: t + 0.5,
          highlight: true,
        })),
        rawTranscript: '',
        source: 'energy' as const,
      };
      const newSegments = generateAutoEdit({
        userClips,
        style: styleSignature,
        beats: refBeats,
        visuals: refVisuals,
        captions: enableCaptions ? captions : null,
        options: {
          enableZoomPunches: zoomPunches,
          enableBeatSync: beatSync,
        },
      });
      if (colorPreset !== 'none') {
        for (const seg of newSegments) seg.colorFilter = colorPreset;
      }
      setSegments(newSegments);
      const dur = newSegments.reduce((a, b) => Math.max(a, b.timelineEnd), 0);
      setTimelineDuration(dur);
      toast.success(`Generated ${newSegments.length} segments`, {
        description: `Timeline: ${dur.toFixed(1)}s · ${styleSignature.bpm || '—'} BPM`,
      });
    } catch (err) {
      toast.error('Generation failed', { description: (err as Error).message });
    } finally {
      setGenerating(false);
    }
  }

  // Auto-generate on mount if reference + clips present
  useEffect(() => {
    if (
      !autoGenTried &&
      segments.length === 0 &&
      userClips.length > 0 &&
      styleSignature &&
      !generating
    ) {
      setAutoGenTried(true);
      setTimeout(() => handleGenerate(), 400);
    }
  }, [userClips.length, styleSignature]);

  async function handleExport() {
    if (segments.length === 0) {
      toast.error('Generate an edit first');
      return;
    }
    setIsExporting(true);
    setExportProgress(0);
    try {
      const blob = await exportProject(
        segments,
        userClips,
        '',
        720,
        1280,
        undefined,
        (p) => setExportProgress(p),
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `viral-edit-${Date.now()}.mp4`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('Exported!', { description: `${(blob.size / 1024 / 1024).toFixed(1)} MB` });
    } catch (err) {
      console.error(err);
      toast.error('Export failed', { description: (err as Error).message });
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  }

  return (
    <div className="h-14 shrink-0 border-t border-white/5 bg-black/40 backdrop-blur-xl flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Wand2 className="h-3.5 w-3.5" />
          <span>AI</span>
        </div>
        <div className="h-4 w-px bg-white/10" />
        <Button
          size="sm"
          variant="ghost"
          onClick={handleGenerate}
          disabled={generating || userClips.length === 0 || !styleSignature}
          className="text-xs h-8"
        >
          {generating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {generating ? 'Generating…' : segments.length > 0 ? 'Re-generate' : 'Generate Edit'}
        </Button>
        {segments.length > 0 && (
          <div className="text-[11px] text-muted-foreground font-mono tabular-nums">
            {segments.length} segments
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {isExporting && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Exporting {Math.round(exportProgress * 100)}%</span>
          </div>
        )}
        <Button
          size="sm"
          variant="default"
          onClick={handleExport}
          disabled={isExporting || segments.length === 0}
          className="bg-white text-black hover:bg-white/90 text-xs h-8 rounded-full px-4"
        >
          {isExporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          Export
        </Button>
      </div>
    </div>
  );
}
