'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Wand2, Palette, Volume2, Sliders, Scissors, Music } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { cn, formatTime } from '@/lib/utils';
import { COLOR_PRESETS } from '@/lib/ai/color-presets';
import { CAPTION_PRESETS } from '@/lib/ai/captions';

const TABS = [
  { id: 'edit', label: 'Edit', icon: Sliders },
  { id: 'color', label: 'Color', icon: Palette },
  { id: 'audio', label: 'Audio', icon: Volume2 },
  { id: 'ai', label: 'AI', icon: Wand2 },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function Inspector() {
  const segments = useEditorStore((s) => s.segments);
  const selectedSegmentId = useEditorStore((s) => s.selectedSegmentId);
  const setSelectedSegmentId = useEditorStore((s) => s.setSelectedSegmentId);
  const userClips = useEditorStore((s) => s.userClips);
  const styleSignature = useEditorStore((s) => s.styleSignature);
  const refBeats = useEditorStore((s) => s.refBeats);
  const enableCaptions = useEditorStore((s) => s.enableCaptions);
  const setEnableCaptions = useEditorStore((s) => s.setEnableCaptions);
  const captionStyle = useEditorStore((s) => s.captionStyle);
  const setCaptionStyle = useEditorStore((s) => s.setCaptionStyle);
  const colorPreset = useEditorStore((s) => s.colorPreset);
  const setColorPreset = useEditorStore((s) => s.setColorPreset);
  const zoomPunches = useEditorStore((s) => s.zoomPunches);
  const setZoomPunches = useEditorStore((s) => s.setZoomPunches);
  const beatSync = useEditorStore((s) => s.beatSync);
  const setBeatSync = useEditorStore((s) => s.setBeatSync);
  const includeReferenceInRemix = useEditorStore((s) => s.includeReferenceInRemix);
  const setIncludeReferenceInRemix = useEditorStore((s) => s.setIncludeReferenceInRemix);

  const [tab, setTab] = useState<TabId>('edit');

  const selectedSegment = segments.find((s) => s.id === selectedSegmentId);
  const selectedClip = selectedSegment
    ? userClips.find((c) => c.id === selectedSegment.sourceClipId)
    : null;

  return (
    <aside className="w-80 shrink-0 border-l border-white/5 flex flex-col bg-black/20">
      {/* Tabs */}
      <div className="flex items-center border-b border-white/5 px-1 pt-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium transition-colors relative',
              tab === t.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
            {tab === t.id && (
              <motion.div
                layoutId="inspector-tab-indicator"
                className="absolute bottom-0 left-2 right-2 h-0.5 bg-foreground"
              />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'edit' && (
          <EditTab
            selectedSegment={selectedSegment}
            selectedClip={selectedClip}
            onSelectSegment={setSelectedSegmentId}
            segments={segments}
          />
        )}
        {tab === 'color' && (
          <ColorTab />
        )}
        {tab === 'audio' && (
          <AudioTab />
        )}
        {tab === 'ai' && (
          <AITab
            colorPreset={colorPreset}
            setColorPreset={setColorPreset}
            enableCaptions={enableCaptions}
            setEnableCaptions={setEnableCaptions}
            captionStyle={captionStyle}
            setCaptionStyle={setCaptionStyle}
            zoomPunches={zoomPunches}
            setZoomPunches={setZoomPunches}
            beatSync={beatSync}
            setBeatSync={setBeatSync}
            includeReferenceInRemix={includeReferenceInRemix}
            setIncludeReferenceInRemix={setIncludeReferenceInRemix}
            bpm={styleSignature?.bpm || 0}
          />
        )}
      </div>
    </aside>
  );
}

function EditTab({
  selectedSegment,
  selectedClip,
  segments,
  onSelectSegment,
}: {
  selectedSegment: any;
  selectedClip: any;
  segments: any[];
  onSelectSegment: (id: string | null) => void;
}) {
  if (segments.length === 0) {
    return (
      <div className="text-center text-muted-foreground text-sm py-12">
        <Sliders className="h-6 w-6 mx-auto mb-2 opacity-50" />
        <p>No segments yet</p>
        <p className="text-xs mt-1 opacity-70">Click "Generate Edit" below to start</p>
      </div>
    );
  }

  if (!selectedSegment) {
    return (
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground mb-2">
          {segments.length} segments · click to inspect
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {segments.map((seg, i) => (
            <button
              key={seg.id}
              onClick={() => onSelectSegment(seg.id)}
              className="aspect-video rounded-md border border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 transition-colors flex items-center justify-center text-[10px] font-mono tabular-nums"
            >
              #{i + 1}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Segment</div>
        <div className="rounded-xl bg-white/5 p-3 space-y-1.5">
          <Row label="Timeline" value={`${formatTime(selectedSegment.timelineStart)} → ${formatTime(selectedSegment.timelineEnd)}`} />
          <Row label="Duration" value={`${(selectedSegment.timelineEnd - selectedSegment.timelineStart).toFixed(2)}s`} />
          <Row label="Source" value={selectedClip?.name || '—'} />
          <Row label="Source in" value={`${formatTime(selectedSegment.sourceStart)} → ${formatTime(selectedSegment.sourceEnd)}`} />
        </div>
      </div>

      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Transform</div>
        <div className="space-y-3 rounded-xl bg-white/5 p-3">
          <FieldRow label="Scale">
            <Slider
              min={0.5}
              max={2}
              step={0.01}
              value={[selectedSegment.scale || 1]}
              onValueChange={() => {}}
              className="w-full"
            />
          </FieldRow>
          <FieldRow label="Speed">
            <Slider
              min={0.25}
              max={3}
              step={0.05}
              value={[selectedSegment.speed || 1]}
              onValueChange={() => {}}
              className="w-full"
            />
          </FieldRow>
        </div>
      </div>

      <button
        onClick={() => onSelectSegment(null)}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center"
      >
        ← Back to all segments
      </button>
    </div>
  );
}

function ColorTab() {
  const colorPreset = useEditorStore((s) => s.colorPreset);
  const setColorPreset = useEditorStore((s) => s.setColorPreset);
  const presetList = Object.values(COLOR_PRESETS);
  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Color preset</div>
        <div className="grid grid-cols-2 gap-1.5">
          {presetList.map((p) => (
            <button
              key={p.id}
              onClick={() => setColorPreset(p.id as any)}
              className={cn(
                'relative h-14 rounded-xl border transition-all overflow-hidden',
                colorPreset === p.id
                  ? 'border-white ring-1 ring-white/30'
                  : 'border-white/10 hover:border-white/20'
              )}
              style={{ background: p.swatch }}
            >
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                <div className="text-[10px] text-white font-medium">{p.label}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {COLOR_PRESETS[colorPreset]?.description}
      </p>
    </div>
  );
}

function AudioTab() {
  return (
    <div className="space-y-4 text-center text-muted-foreground text-sm py-8">
      <Volume2 className="h-6 w-6 mx-auto mb-2 opacity-50" />
      <p>Audio editing coming soon</p>
      <p className="text-xs opacity-70">Beat-sync cuts use detected BPM</p>
    </div>
  );
}

function AITab({
  colorPreset,
  setColorPreset,
  enableCaptions,
  setEnableCaptions,
  captionStyle,
  setCaptionStyle,
  zoomPunches,
  setZoomPunches,
  beatSync,
  setBeatSync,
  includeReferenceInRemix,
  setIncludeReferenceInRemix,
  bpm,
}: any) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Style detected</div>
        <div className="rounded-xl bg-white/5 p-3 space-y-1.5">
          <Row label="BPM" value={bpm || '—'} />
          <Row label="Color preset" value={colorPreset === 'none' ? 'Original' : colorPreset} />
        </div>
      </div>

      <div className="space-y-2">
        <ToggleRow label="Beat sync" desc="Cut on every detected beat" checked={beatSync} onChange={setBeatSync} />
        <ToggleRow label="Zoom punches" desc="Punch-in on the beat" checked={zoomPunches} onChange={setZoomPunches} />
        <ToggleRow label="Captions" desc="Add kinetic-style subtitles" checked={enableCaptions} onChange={setEnableCaptions} />
        <ToggleRow
          label="Include reference in remix"
          desc="Also use the reference clip as a source"
          checked={includeReferenceInRemix}
          onChange={setIncludeReferenceInRemix}
        />
      </div>

      {enableCaptions && (
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Caption style</div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setCaptionStyle('none')}
              className={cn(
                'h-8 rounded-lg text-xs font-medium border transition-colors',
                captionStyle === 'none'
                  ? 'border-white bg-white text-black'
                  : 'border-white/10 hover:bg-white/5'
              )}
            >
              Off
            </button>
            {Object.entries(CAPTION_PRESETS).map(([key, p]) => (
              <button
                key={key}
                onClick={() => setCaptionStyle(key as any)}
                className={cn(
                  'h-8 rounded-lg text-xs font-medium border transition-colors',
                  captionStyle === key
                    ? 'border-white bg-white text-black'
                    : 'border-white/10 hover:bg-white/5'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums truncate max-w-[60%]">{value}</span>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
      </div>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (b: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2.5">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-[11px] text-muted-foreground">{desc}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
