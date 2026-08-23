'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { Preview } from '@/components/editor/preview';
import { Timeline } from '@/components/editor/timeline';
import { AIControls } from '@/components/editor/ai-controls';
import { StyleCard } from '@/components/editor/style-card';
import { ClipsLibrary } from '@/components/editor/clips-library';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export default function EditorPage() {
  const styleSignature = useEditorStore((s) => s.styleSignature);
  const userClips = useEditorStore((s) => s.userClips);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top bar */}
      <header className="h-14 shrink-0 border-b border-border/40 glass-strong flex items-center justify-between px-4 z-10">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md gradient-viral flex items-center justify-center">
              <Sparkles className="h-3 w-3 text-white" />
            </div>
            <span className="font-semibold text-sm tracking-tight">Viral AI Editor</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mounted && styleSignature && (
            <div className="text-xs text-muted-foreground hidden md:flex items-center gap-3">
              <span><b className="text-foreground">{styleSignature.bpm || '—'}</b> BPM</span>
              <span className="opacity-50">·</span>
              <span><b className="text-foreground">{userClips.length}</b> clips</span>
            </div>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Left panel */}
        <aside className="w-80 shrink-0 border-r border-border/40 flex flex-col p-4 gap-3 overflow-y-auto">
          {mounted && styleSignature ? (
            <>
              <StyleCard />
              <ClipsLibrary />
            </>
          ) : (
            <EmptyLeftState />
          )}
        </aside>

        {/* Center: Preview + Timeline */}
        <main className="flex-1 flex flex-col min-w-0">
          <Preview className="flex-1" />
          <Timeline />
        </main>

        {/* Right panel: AI controls */}
        <aside className="w-80 shrink-0 border-l border-border/40 p-4 overflow-y-auto">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 px-1">
            AI Editor
          </h3>
          <AIControls />
        </aside>
      </div>
    </div>
  );
}

function EmptyLeftState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
      <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
        <Sparkles className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="font-semibold mb-1">No reference yet</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Go back and paste a TikTok URL or upload a reference video.
      </p>
      <Link
        href="/"
        className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
      >
        ← Back to home
      </Link>
    </div>
  );
}
