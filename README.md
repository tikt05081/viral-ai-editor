# Viral AI Editor 🎬✨

An AI-powered video editor that analyzes viral TikToks and recreates their style on your own clips. Built with a slick Apple-inspired UI, runs 100% in your browser — no paid APIs, no servers, no watermarks.

![Viral AI Editor](public/og.png)

## ✨ Features

- 🎵 **Beat-sync auto-edits** — Detects BPM and slices your clip on every drop
- 🎨 **Style transfer** — Paste a TikTok URL, the AI extracts its color palette, cut rhythm, zooms, and motion patterns
- ✂️ **Smart cuts** — Scene detection, jump-cuts, and silence removal
- 🔍 **Zoom punches** — Auto zooms on motion peaks for that kinetic TikTok feel
- 💬 **Captions** — Whisper-style word-level captions with viral presets (Hormozi, MrBeast, kinetic)
- 🌈 **Color presets** — One-tap grades: Cinematic, Teal & Orange, Film, Y2K, Vintage
- ⚡ **Speed ramps** — Slow-mo on the beat, fast on the action
- 📤 **Export** — Render to MP4 in the browser via FFmpeg.wasm
- 🌓 **Light & dark mode** with frosted-glass Apple aesthetic

## 🧠 How the AI works (all local, free)

| Stage | Tech |
|---|---|
| Beat detection | Web Audio API energy peaks → tempo autocorrelation |
| Scene detection | Pixel-difference histogram across frames |
| Motion peaks | Frame-difference analysis |
| Color palette | K-means clustering of sampled frames |
| Speech → captions | Web Speech API (browser-native, free) |
| Rendering | FFmpeg.wasm (in-browser, no upload) |
| TikTok fetch | Public no-watermark proxy (Cobalt API) |

## 🚀 Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000 and start creating.

## 🛠 Tech stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** + **Radix UI** for the Apple-style components
- **Framer Motion** for buttery animations
- **FFmpeg.wasm** for in-browser video processing
- **Zustand** for state
- **Wavesurfer.js** for the waveform

## 📦 Project structure

```
src/
├── app/                    # Next.js app router
│   ├── page.tsx           # Landing
│   ├── editor/            # The editor itself
│   └── layout.tsx
├── components/
│   ├── ui/                # Apple-style primitives
│   ├── editor/            # Editor-specific components
│   └── landing/
├── lib/
│   ├── ai/                # All the AI analysis modules
│   │   ├── beats.ts       # Beat detection
│   │   ├── motion.ts      # Motion / scene analysis
│   │   ├── color.ts       # Color palette extraction
│   │   ├── style.ts       # Style signature
│   │   └── captions.ts    # Speech-to-text
│   ├── ffmpeg/            # FFmpeg.wasm wrapper
│   ├── tiktok/            # TikTok downloader
│   └── export/            # Export pipeline
├── store/                 # Zustand stores
└── types/
```

## 🎬 Usage

1. **Paste a TikTok URL** on the home screen — the AI analyzes its style
2. **Drop in your own clips**
3. Hit **Generate Edit** — beat-sync cuts, zooms, and color grading applied automatically
4. **Tweak** on the timeline
5. **Export** as MP4

## 📝 License

MIT
