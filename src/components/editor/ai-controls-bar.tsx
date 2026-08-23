'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Download,
  Loader2,
  RefreshCw,
  Wand2,
  Send,
  X,
  ChevronUp,
  Check,
  AlertCircle,
} from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { generateAutoEdit } from '@/lib/ai/auto-edit';
import { exportProject } from '@/lib/ffmpeg/ffmpeg-client';
import { toast } from 'sonner';
import {
  parseInstruction,
  applyInstructionToEdit,
  summarizeInstruction,
  type ParsedInstruction,
} from '@/lib/ai/instructions';

export function AIControlsBar() {
  const userClips = useEditorStore((s) => s.userClips);
  const referenceClip = useEditorStore((s) => s.referenceClip);
  const styleSignature = useEditorStore((s) => s.styleSignature);
  const refBeats = useEditorStore((s) => s.refBeats);
  const refVisuals = useEditorStore((s) => s.refVisuals);
  const setSegments = useEditorStore((s) => s.setSegments);
  const setTimelineDuration = useEditorStore((s) => s.setTimelineDuration);
  const segments = useEditorStore((s) => s.segments);
  const colorPreset = useEditorStore((s) => s.colorPreset);
  const setColorPreset = useEditorStore((s) => s.setColorPreset);
  const enableCaptions = useEditorStore((s) => s.enableCaptions);
  const setEnableCaptions = useEditorStore((s) => s.setEnableCaptions);
  const captionStyle = useEditorStore((s) => s.captionStyle);
  const setCaptionStyle = useEditorStore((s) => s.setCaptionStyle);
  const zoomPunches = useEditorStore((s) => s.zoomPunches);
  const setZoomPunches = useEditorStore((s) => s.setZoomPunches);
  const beatSync = useEditorStore((s) => s.beatSync);
  const setBeatSync = useEditorStore((s) => s.setBeatSync);
  const includeReferenceInRemix = useEditorStore((s) => s.includeReferenceInRemix);
  const isExporting = useEditorStore((s) => s.isExporting);
  const setIsExporting = useEditorStore((s) => s.setIsExporting);
  const setExportProgress = useEditorStore((s) => s.setExportProgress);
  const exportProgress = useEditorStore((s) => s.exportProgress);

  const [generating, setGenerating] = useState(false);
  const [autoGenTried, setAutoGenTried] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [showInstruction, setShowInstruction] = useState(false);
  const [lastParsed, setLastParsed] = useState<ParsedInstruction | null>(null);

  // Live parse the instruction as user types
  useEffect(() => {
    if (!instruction.trim()) {
      setLastParsed(null);
      return;
    }
    setLastParsed(parseInstruction(instruction));
  }, [instruction]);

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
      const sourceClips = includeReferenceInRemix
        ? userClips
        : userClips.filter((c) => c.id !== referenceClip?.id);
      if (sourceClips.length === 0) {
        toast.error('Add at least one clip besides the reference, or enable "Include reference in remix"');
        setGenerating(false);
        return;
      }

      // Parse instructions first to know how to configure generation
      const instr = instruction.trim() ? parseInstruction(instruction) : null;

      const newSegments = generateAutoEdit({
        userClips: sourceClips,
        style: styleSignature,
        beats: refBeats,
        visuals: refVisuals,
        captions: enableCaptions && !instr?.noCaptions ? captions : null,
        options: {
          enableZoomPunches: zoomPunches && !instr?.noZoomPunches,
          enableBeatSync: beatSync && !instr?.noBeatSync,
        },
      });

      // Apply instruction transforms to each segment
      const finalSegments = instr
        ? newSegments.map((s) => ({
            ...applyInstructionToEdit(s, instr),
            colorFilter: s.colorFilter,
            id: s.id,
            sourceClipId: s.sourceClipId,
            position: s.position,
            rotation: s.rotation,
            captionText: s.captionText,
            captionWords: s.captionWords,
          }))
        : newSegments;

      // Apply color preset (instruction takes priority)
      if (instr?.colorHint) {
        setColorPreset(instr.colorHint as any);
        for (const seg of finalSegments) seg.colorFilter = instr.colorHint;
      } else if (colorPreset !== 'none') {
        for (const seg of finalSegments) seg.colorFilter = colorPreset;
      }

      // Apply caption style from instruction
      if (instr?.captionStyle) {
        setCaptionStyle(instr.captionStyle);
      }
      if (instr?.noCaptions) {
        setEnableCaptions(false);
      }

      setSegments(finalSegments as any);
      const dur = finalSegments.reduce((a, b) => Math.max(a, b.timelineEnd), 0);
      setTimelineDuration(dur);

      // Show what was understood
      const summary = instr ? summarizeInstruction(instr) : null;
      toast.success(
        `Generated ${finalSegments.length} segments`,
        summary ? { description: summary } : undefined,
      );
    } catch (err) {
      toast.error('Generation failed', { description: (err as Error).message });
    } finally {
      setGenerating(false);
    }
  }

  // Auto-generate on mount
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

  const EXAMPLES = [
    'Make it faster, no zooms, just cuts',
    'Add MrBeast captions, more cuts',
    'Slo-mo 0.5x, big zoom, cinematic color',
    'Vintage film look, fade transitions',
  ];

  return (
    <div className="border-t border-white/5 bg-black/40 backdrop-blur-xl">
      {/* Instruction panel - collapsible */}
      <AnimatePresence>
        {showInstruction && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-white/5"
          >
            <div className="p-4 max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium">Custom instructions</span>
                </div>
                <button
                  onClick={() => {
                    setShowInstruction(false);
                    setInstruction('');
                    setLastParsed(null);
                  }}
                  className="h-6 w-6 rounded hover:bg-white/5 flex items-center justify-center text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="relative">
                <textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="e.g. make it faster, no zooms, just cuts, MrBeast captions, cinematic color, fade transitions..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20"
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleGenerate();
                    }
                  }}
                />
              </div>
              {/* Live preview of what was understood */}
              {lastParsed && instruction.trim() && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 flex items-start gap-2 text-[11px]"
                >
                  {lastParsed.text && lastParsed.warnings.length === 0 ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400 mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">
                        <span className="text-foreground/80">Will apply:</span>{' '}
                        {summarizeInstruction(lastParsed)}
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3 w-3 text-amber-400 mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">Couldn't fully understand — will try what I can.</span>
                    </>
                  )}
                </motion.div>
              )}
              {/* Quick examples */}
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-muted-foreground">Try:</span>
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setInstruction(ex)}
                    className="text-[10px] text-foreground/70 hover:text-foreground transition-colors bg-white/5 hover:bg-white/10 rounded-full px-2 py-0.5"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom bar */}
      <div className="h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInstruction(!showInstruction)}
            className={`h-8 px-3 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors ${
              showInstruction || instruction
                ? 'bg-white text-black'
                : 'bg-white/5 hover:bg-white/10 text-foreground border border-white/10'
            }`}
            title="Custom instructions"
          >
            <Wand2 className="h-3.5 w-3.5" />
            {instruction ? 'Editing' : 'Customize'}
          </button>
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
            {generating ? 'Generating…' : segments.length > 0 ? 'Re-generate' : 'Generate'}
          </Button>
          {segments.length > 0 && (
            <div className="text-[11px] text-muted-foreground font-mono tabular-nums">
              {segments.length} segments
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
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
    </div>
  );
}
