'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Sparkles, Download, Settings, Wand2 } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { Preview } from '@/components/editor/preview';
import { Timeline } from '@/components/editor/timeline';
import { MediaLibrary } from '@/components/editor/media-library';
import { Inspector } from '@/components/editor/inspector';
import { AIControlsBar } from '@/components/editor/ai-controls-bar';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { toast } from 'sonner';

export default function EditorPage() {
  const styleSignature = useEditorStore((s) => s.styleSignature);
  const userClips = useEditorStore((s) => s.userClips);
  const segments = useEditorStore((s) => s.segments);
  const isExporting = useEditorStore((s) => s.isExporting);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0b] text-foreground overflow-hidden">
      {/* Top bar — minimal, like Palmier */}
      <header className="h-12 shrink-0 border-b border-white/5 bg-black/40 backdrop-blur-xl flex items-center justify-between px-4 z-10">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="h-7 w-7 rounded-md hover:bg-white/5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded gradient-viral flex items-center justify-center">
              <Sparkles className="h-2.5 w-2.5 text-white" />
            </div>
            <span className="font-medium text-sm tracking-tight">Viral AI</span>
            {mounted && styleSignature && (
              <>
                <span className="text-white/20">/</span>
                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                  {styleSignature.bpm || '—'} BPM · {styleSignature.cutsPerMinute.toFixed(0)} cuts/min
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
        </div>
      </header>

      {/* Main 3-column layout: media | preview+timeline | inspector */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Media library (collapsible) */}
        <MediaLibrary />

        {/* Center: Preview + Timeline */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#0a0a0b]">
          <Preview className="flex-1 min-h-0" />
          <Timeline />
        </main>

        {/* Right: Inspector */}
        <Inspector />
      </div>

      {/* Bottom AI bar — Palmier-style "agents help with the first pass" */}
      <AIControlsBar />
    </div>
  );
}
