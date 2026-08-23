'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Link2,
  Upload,
  ArrowRight,
  Music2,
  Scissors,
  Wand2,
  Download,
  Play,
  Loader2,
  AlertCircle,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEditorStore } from '@/store/editor-store';
import { fetchTikTok } from '@/lib/tiktok/downloader';
import { decodeMedia } from '@/lib/ai/extract-frames';
import { analyzeVideoStyle } from '@/lib/ai/style';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { toast } from 'sonner';
import type { MediaClip, StyleSignature } from '@/types';
import Link from 'next/link';

const FEATURES = [
  {
    icon: Music2,
    title: 'Beat-sync cuts',
    desc: 'Detects BPM and slices on every drop, automatically.',
  },
  {
    icon: Scissors,
    title: 'Style transfer',
    desc: 'Paste any TikTok URL. We copy its rhythm, color, and motion.',
  },
  {
    icon: Wand2,
    title: 'Viral presets',
    desc: 'One-tap color grades, zoom punches, kinetic captions.',
  },
  {
    icon: Download,
    title: 'Export to MP4',
    desc: 'Renders entirely in your browser. No upload, no watermark.',
  },
];

const STEPS = [
  { n: '01', title: 'Paste a TikTok URL', desc: 'Or drop in your own reference clip.' },
  { n: '02', title: 'AI analyzes the style', desc: 'Beats, color, motion, cut rhythm.' },
  { n: '03', title: 'Upload your clips', desc: 'The AI edits them in the same style.' },
  { n: '04', title: 'Tweak & export', desc: 'Fine-tune on the timeline, then save as MP4.' },
];

export function LandingPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'idle' | 'downloading' | 'analyzing'>('idle');
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [urlFocused, setUrlFocused] = useState(false);

  const setReferenceClip = useEditorStore((s) => s.setReferenceClip);
  const setReferenceThumbnail = useEditorStore((s) => s.setReferenceThumbnail);
  const setStyleSignature = useEditorStore((s) => s.setStyleSignature);
  const setRefBeats = useEditorStore((s) => s.setRefBeats);
  const setRefVisuals = useEditorStore((s) => s.setRefVisuals);
  const setAnalyzing = useEditorStore((s) => s.setAnalyzing);
  const setAnalysisProgress = useEditorStore((s) => s.setAnalysisProgress);
  const userClips = useEditorStore((s) => s.userClips);

  async function handleAnalyzeClip(blob: Blob, name: string, type: 'tiktok' | 'upload') {
    try {
      setIsLoading(true);
      setError(null);
      setStep('analyzing');
      setAnalyzing(true);
      setAnalysisProgress('Decoding video…');

      const decoded = await decodeMedia(blob, {
        onProgress: (p) => setAnalysisProgress(`Decoding… ${Math.round(p * 100)}%`),
      });

      // Generate thumbnail from first frame
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 320;
      thumbCanvas.height = 320;
      const aspect = decoded.width / decoded.height;
      if (aspect > 1) {
        thumbCanvas.width = 320;
        thumbCanvas.height = Math.round(320 / aspect);
      } else {
        thumbCanvas.height = 320;
        thumbCanvas.width = Math.round(320 * aspect);
      }
      const tctx = thumbCanvas.getContext('2d')!;
      tctx.drawImage(decoded.video, 0, 0, thumbCanvas.width, thumbCanvas.height);
      const thumb = thumbCanvas.toDataURL('image/jpeg', 0.7);

      const clip: MediaClip = {
        id: `ref_${Date.now()}`,
        name,
        url: URL.createObjectURL(blob),
        blob,
        duration: decoded.duration,
        width: decoded.width,
        height: decoded.height,
        size: blob.size,
        type: blob.type,
        thumbnail: thumb,
      };
      setReferenceClip(clip);
      if (type === 'tiktok') setReferenceThumbnail(thumb);

      setAnalysisProgress('Analyzing style…');
      const { style, beats, visuals } = await analyzeVideoStyle(
        decoded.frames,
        decoded.audio,
        type === 'tiktok' ? 'tiktok' : 'reference',
        {
          onProgress: (s, p) => setAnalysisProgress(s),
        }
      );
      setStyleSignature(style);
      setRefBeats(beats);
      setRefVisuals(visuals);

      toast.success('Style analyzed!', {
        description: `${style.bpm} BPM • ${style.cutsPerMinute.toFixed(0)} cuts/min • ${style.colorPalette.length} colors`,
      });
      setAnalyzing(false);
      setAnalysisProgress('');

      // Navigate to editor
      router.push('/editor');
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
      toast.error('Analysis failed', { description: (err as Error).message });
    } finally {
      setIsLoading(false);
      setStep('idle');
      setAnalyzing(false);
    }
  }

  async function handleTikTok() {
    if (!url.trim()) return;
    try {
      setIsLoading(true);
      setError(null);
      setStep('downloading');
      setProgressMsg('Downloading from TikTok…');
      const tt = await fetchTikTok(url.trim());
      setProgressMsg('Fetching video file…');
      const res = await fetch(tt.url);
      if (!res.ok) throw new Error('Failed to fetch video file');
      const blob = await res.blob();
      const title = tt.title || 'TikTok reference';
      await handleAnalyzeClip(blob, title, 'tiktok');
    } catch (err) {
      setError((err as Error).message);
      toast.error('Could not download', { description: (err as Error).message });
      setIsLoading(false);
      setStep('idle');
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    handleAnalyzeClip(file, file.name, 'upload');
  }

  function goToEditor() {
    router.push('/editor');
  }

  const isWorking = isLoading;

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 grid-pattern" />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/90 to-background" />
        <motion.div
          className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-purple-500/20 blur-3xl"
          animate={{ x: [0, 100, 0], y: [0, 50, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full bg-pink-500/20 blur-3xl"
          animate={{ x: [0, -100, 0], y: [0, -50, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      {/* Top nav */}
      <header className="sticky top-0 z-50 glass-strong">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg gradient-viral flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold tracking-tight">Viral AI</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {userClips.length > 0 && (
              <Button size="sm" variant="ghost" onClick={goToEditor}>
                Open editor
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container pt-24 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs text-muted-foreground mb-6">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            100% free · runs in your browser · no upload
          </div>
          <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-balance">
            Edit videos like{' '}
            <span className="bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 bg-clip-text text-transparent">
              viral TikToks.
            </span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground text-pretty max-w-2xl mx-auto">
            Paste a TikTok URL or drop in a reference. Our AI learns the style —
            beat, color, motion — and edits your clips the same way.
          </p>
        </motion.div>

        {/* Input card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-12 max-w-2xl"
        >
          <div
            className={`relative rounded-3xl glass apple-shadow-lg p-2 transition-all ${
              urlFocused ? 'ring-2 ring-foreground/20' : ''
            }`}
          >
            <AnimatePresence mode="wait">
              {isWorking ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="p-8 text-center"
                >
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                  <p className="font-medium">{step === 'downloading' ? 'Downloading…' : 'Analyzing style…'}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {progressMsg || 'Decoding video, detecting beats, finding cuts…'}
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="input"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="p-6 md:p-8 space-y-5"
                >
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      TikTok URL
                    </label>
                    <div className="mt-2 relative">
                      <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onFocus={() => setUrlFocused(true)}
                        onBlur={() => setUrlFocused(false)}
                        placeholder="https://www.tiktok.com/@user/video/..."
                        className="pl-11 h-12 text-base"
                        onKeyDown={(e) => e.key === 'Enter' && handleTikTok()}
                        disabled={isWorking}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Upload a reference video
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Button
                      variant="secondary"
                      size="lg"
                      className="mt-2 w-full h-12"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isWorking}
                    >
                      <Upload className="h-4 w-4" />
                      Choose video file
                    </Button>
                  </div>
                  {error && (
                    <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
                      <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      <p className="text-destructive/90">{error}</p>
                    </div>
                  )}
                  <Button
                    variant="primary"
                    size="xl"
                    className="w-full"
                    onClick={handleTikTok}
                    disabled={!url.trim() || isWorking}
                  >
                    <Sparkles className="h-4 w-4" />
                    Analyze & Edit
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Tip: works best with 5–60 second videos that have music
          </p>
        </motion.div>
      </section>

      {/* Features */}
      <section className="container py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-balance">
            Everything you need to make{' '}
            <span className="bg-gradient-to-br from-foreground to-foreground/50 bg-clip-text text-transparent">
              bangers.
            </span>
          </h2>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="rounded-3xl border border-border/60 bg-card p-6 apple-shadow hover:apple-shadow-lg transition-shadow"
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-muted mb-4">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="container py-24 border-t border-border/40">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">How it works</h2>
        </motion.div>
        <div className="mx-auto max-w-4xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="rounded-3xl border border-border/60 bg-card p-6"
            >
              <div className="text-xs font-mono text-muted-foreground mb-3">{s.n}</div>
              <h3 className="font-semibold tracking-tight mb-1.5">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl rounded-3xl glass apple-shadow-lg p-12 text-center"
        >
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-balance">
            Ready to make your first viral?
          </h2>
          <p className="mt-4 text-muted-foreground text-pretty">
            Free, in your browser, no signup. Just paste and go.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button
              variant="primary"
              size="xl"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <Play className="h-4 w-4" />
              Get started
            </Button>
            <Link
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              View on GitHub →
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded gradient-viral" />
            <span>Viral AI Editor</span>
            <span className="opacity-50">·</span>
            <span>MIT</span>
          </div>
          <div className="flex items-center gap-6">
            <span>Built with Next.js + FFmpeg.wasm</span>
            <span className="opacity-50">·</span>
            <span>100% client-side</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
