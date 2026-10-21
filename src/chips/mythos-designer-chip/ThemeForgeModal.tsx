import React, { useState } from 'react';
import { ThemeConfig, MSDLayoutManifest, LayoutArchetype } from '../../types/msd';
import { registerCustomTheme } from '../../constants/themes';
import { soundEngine } from '../../utils/audio';
import {
  Sparkles,
  Upload,
  X,
  FileCode,
  Image as ImageIcon,
  Check,
  Copy,
  Layers,
  Palette,
  AlertCircle,
  Eye,
  Sliders,
  Trash2,
  LayoutGrid,
  TrendingUp,
  Server
} from 'lucide-react';

interface UploadedAsset {
  id: string;
  name: string;
  mimeType: string;
  data: string; // base64 / dataUrl
  size: number;
}

interface ThemeForgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onThemeActivated: (themeId: string) => void;
  onTemplateActivated?: (template: MSDLayoutManifest) => void;
  currentThemeId: string;
}

// Preset samples for fast one-click demonstration of modern non-Star-Trek archetypes
const SAMPLE_PRESETS = [
  {
    title: 'SaaS Cloud Observability',
    desc: 'Modern cloud microservice telemetry with cyan accents and dark navy slate',
    nameHint: 'Cloud Observability Mesh',
    notes: 'Modern SaaS production dashboard with clean rectangular cards, high-contrast KPI cards, and low-latency metrics. No LCARS or Star Trek styling.',
    css: `:root {
  --cloud-bg: #070c18;
  --cloud-panel: #0d1527;
  --cloud-border: #1e2c4a;
  --cloud-primary: #38bdf8;
  --cloud-accent: #818cf8;
  --cloud-live: #10b981;
  --cloud-text: #f8fafc;
}`,
  },
  {
    title: 'Aerospace Flight Avionics',
    desc: 'Orbital telemetry and guidance deck with technical amber accents',
    nameHint: 'Aerospace Flight Avionics',
    notes: 'Flight deck telemetry for orbital rocketry with high-contrast amber warnings, clean rectangular cards, and precision numeric typography.',
    css: `:root {
  --aero-bg: #09090b;
  --aero-panel: #18181b;
  --aero-border: #27272a;
  --aero-primary: #f59e0b;
  --aero-accent: #fbbf24;
  --aero-alert: #ef4444;
  --aero-text: #fafafa;
}`,
  },
  {
    title: 'Cyber Defense SOC',
    desc: 'Security operations center threat monitoring matrix',
    nameHint: 'Cyber Defense SOC',
    notes: 'Technical cybersecurity monitoring console with emerald crypto status, packet rate meters, and tactical incident log.',
    css: `:root {
  --soc-bg: #05080e;
  --soc-panel: #0a101d;
  --soc-border: #152238;
  --soc-primary: #10b981;
  --soc-accent: #06b6d4;
  --soc-alert: #f43f5e;
  --soc-text: #e2e8f0;
}`,
  },
];

export const ThemeForgeModal: React.FC<ThemeForgeModalProps> = ({
  isOpen,
  onClose,
  onThemeActivated,
  onTemplateActivated,
  currentThemeId,
}) => {
  const [uploadedAssets, setUploadedAssets] = useState<UploadedAsset[]>([]);
  const [cssCode, setCssCode] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [themeNameHint, setThemeNameHint] = useState<string>('');
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [synthesizedTheme, setSynthesizedTheme] = useState<ThemeConfig | null>(null);
  const [synthesizedTemplate, setSynthesizedTemplate] = useState<MSDLayoutManifest | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  if (!isOpen) return null;

  // Handle image and CSS file uploads
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    soundEngine.playChime();
    setErrorMsg(null);

    const newAssets: UploadedAsset[] = [];
    let mergedCss = cssCode;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (file.name.endsWith('.css') || file.type === 'text/css') {
        const text = await file.text();
        mergedCss = (mergedCss ? mergedCss + '\n\n' : '') + `/* File: ${file.name} */\n` + text;
      } else if (file.type.startsWith('image/')) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        newAssets.push({
          id: `${Date.now()}-${i}`,
          name: file.name,
          mimeType: file.type,
          data: base64,
          size: file.size,
        });
      }
    }

    if (newAssets.length > 0) {
      setUploadedAssets((prev) => [...prev, ...newAssets]);
    }
    if (mergedCss !== cssCode) {
      setCssCode(mergedCss);
    }
  };

  const handleRemoveAsset = (id: string) => {
    soundEngine.playToggle();
    setUploadedAssets((prev) => prev.filter((a) => a.id !== id));
  };

  const handleLoadPreset = (preset: (typeof SAMPLE_PRESETS)[0]) => {
    soundEngine.playChime();
    setThemeNameHint(preset.nameHint);
    setNotes(preset.notes);
    setCssCode(preset.css);
  };

  // Trigger synthesis via backend API
  const handleSynthesizeTheme = async () => {
    try {
      setIsSynthesizing(true);
      setErrorMsg(null);
      soundEngine.playChime();

      const payload = {
        images: uploadedAssets.map((a) => ({
          data: a.data,
          mimeType: a.mimeType,
          name: a.name,
        })),
        cssCode,
        notes,
        targetName: themeNameHint.trim(),
      };

      const res = await fetch('/api/theme/transform', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Synthesis failed with HTTP status ${res.status}`);
      }

      const data = await res.json();
      if (!data.theme) {
        throw new Error('Server returned invalid theme structure');
      }

      soundEngine.playChime();
      setSynthesizedTheme(data.theme);
      if (data.template) {
        setSynthesizedTemplate(data.template);
      }
    } catch (err: unknown) {
      soundEngine.playAlert();
      console.error('Synthesis error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Theme synthesis failed.');
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Activate theme and store in registry
  const handleActivateAndStore = () => {
    if (!synthesizedTheme) return;

    soundEngine.playChime();
    registerCustomTheme(synthesizedTheme);
    onThemeActivated(synthesizedTheme.id);
    if (synthesizedTemplate && onTemplateActivated) {
      onTemplateActivated(synthesizedTemplate);
    }
    onClose();
  };

  // Copy TypeScript code
  const handleCopyCode = () => {
    if (!synthesizedTheme) return;
    soundEngine.playChime();
    const tsCode = `  '${synthesizedTheme.id}': ${JSON.stringify(synthesizedTheme, null, 2)},`;
    navigator.clipboard.writeText(tsCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 select-none overflow-y-auto">
      <div className="w-full max-w-4xl bg-[#080a0f] border-2 border-[#2f3749] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-fade-in text-slate-100">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#0d1118] border-b border-[#2f3749]">
          <div className="flex items-center gap-2.5 font-antonio font-black text-base sm:text-lg text-cyan-300 uppercase tracking-widest">
            <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
            <span>SKETCH & ASSET-TO-THEME COMPILER</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex flex-col gap-5 text-xs font-mono-data">
          {/* Instructions Banner */}
          <div className="p-3 bg-[#10141d] border border-[#2f3749] rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Palette className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-slate-200 font-bold font-sans">
                  Multimodal Layout & Style Transformation
                </p>
                <p className="text-slate-400 text-[11px]">
                  Upload sketches, UI wireframes, screenshot assets, or legacy .css files. Gemini extracts colors, fonts, and geometry tokens into a distinct, persistent theme.
                </p>
              </div>
            </div>

            {/* Fast Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider mr-1">
                TEST PRESETS:
              </span>
              {SAMPLE_PRESETS.map((p) => (
                <button
                  key={p.title}
                  type="button"
                  onClick={() => handleLoadPreset(p)}
                  className="px-2 py-1 bg-[#1a2130] border border-[#2f3749] hover:border-cyan-400 rounded text-[10px] text-cyan-300 font-sans font-semibold transition-colors cursor-pointer"
                >
                  {p.title}
                </button>
              ))}
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 bg-red-950/70 border border-red-500/70 p-3 rounded-lg text-red-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Primary Ingestion Inputs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Image / Asset Dropzone */}
            <div className="flex flex-col gap-2 bg-[#0c1017] p-3.5 rounded-xl border border-[#2f3749]">
              <div className="flex items-center justify-between pb-1.5 border-b border-[#2f3749]">
                <div className="flex items-center gap-1.5 text-cyan-300 font-antonio font-bold text-sm tracking-wider uppercase">
                  <ImageIcon className="w-4 h-4 text-emerald-400" />
                  <span>1. SKETCHES, SCREENSHOTS & SWATCHES</span>
                </div>
                <span className="text-[10px] text-slate-400">
                  {uploadedAssets.length} asset{uploadedAssets.length === 1 ? '' : 's'}
                </span>
              </div>

              {/* Upload Input Area */}
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-[#2f3749] hover:border-cyan-400 rounded-lg cursor-pointer bg-[#090d14] transition-colors group text-center">
                <Upload className="w-6 h-6 text-slate-400 group-hover:text-cyan-400 mb-1.5" />
                <span className="text-slate-300 font-bold">Click or drag images & assets</span>
                <span className="text-slate-500 text-[10px] mt-0.5">
                  Supports PNG, JPG, WEBP, SVG wireframes & screenshots
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/*,.css"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {/* Uploaded Thumbnails Carousel */}
              {uploadedAssets.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-1 max-h-36 overflow-y-auto pr-1">
                  {uploadedAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className="relative group rounded-md overflow-hidden border border-[#2f3749] bg-black aspect-video flex items-center justify-center"
                    >
                      <img
                        src={asset.data}
                        alt={asset.name}
                        className="object-cover w-full h-full opacity-80 group-hover:opacity-100 transition-opacity"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveAsset(asset.id)}
                        className="absolute top-1 right-1 p-1 bg-black/80 hover:bg-red-600 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove asset"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Legacy CSS, Styles & Directives */}
            <div className="flex flex-col gap-2 bg-[#0c1017] p-3.5 rounded-xl border border-[#2f3749]">
              <div className="flex items-center justify-between pb-1.5 border-b border-[#2f3749]">
                <div className="flex items-center gap-1.5 text-cyan-300 font-antonio font-bold text-sm tracking-wider uppercase">
                  <FileCode className="w-4 h-4 text-amber-400" />
                  <span>2. LEGACY CSS & DIRECTIVES</span>
                </div>
                <label className="text-[10px] text-cyan-400 hover:underline cursor-pointer">
                  [+ Upload .css]
                  <input
                    type="file"
                    accept=".css"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Optional Name & Notes Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                    TARGET THEME NAME (OPTIONAL)
                  </label>
                  <input
                    type="text"
                    value={themeNameHint}
                    onChange={(e) => setThemeNameHint(e.target.value)}
                    placeholder="e.g. Cobalt Subspace Grid"
                    className="w-full px-2.5 py-1.5 bg-[#090d14] border border-[#2f3749] rounded text-slate-200 focus:outline-none focus:border-cyan-400 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                    DESIGN DIRECTIVES / FOCUS
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. High contrast neon amber accents"
                    className="w-full px-2.5 py-1.5 bg-[#090d14] border border-[#2f3749] rounded text-slate-200 focus:outline-none focus:border-cyan-400 text-xs"
                  />
                </div>
              </div>

              {/* CSS Code Editor / Paste Box */}
              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                  LEGACY CSS / HEX SWATCHES / ROOT VARIABLES
                </label>
                <textarea
                  rows={4}
                  value={cssCode}
                  onChange={(e) => setCssCode(e.target.value)}
                  placeholder="Paste legacy CSS rules, hex codes, or :root variables here..."
                  className="w-full p-2.5 bg-[#090d14] border border-[#2f3749] rounded text-cyan-300 font-mono text-[11px] focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          </div>

          {/* Synthesize Action Bar */}
          <div className="flex items-center justify-between p-3 bg-[#10141d] rounded-xl border border-[#2f3749]">
            <div className="text-slate-400 text-[11px]">
              Ready to compile {uploadedAssets.length} image asset{uploadedAssets.length === 1 ? '' : 's'}{' '}
              {cssCode ? 'and CSS definitions' : ''} into a new theme.
            </div>

            <button
              type="button"
              onClick={handleSynthesizeTheme}
              disabled={isSynthesizing}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-antonio font-extrabold uppercase text-sm tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-lg cursor-pointer disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 ${isSynthesizing ? 'animate-spin' : ''}`} />
              <span>{isSynthesizing ? 'SYNTHESIZING THEME...' : 'SYNTHESIZE THEME'}</span>
            </button>
          </div>

          {/* Synthesized Theme Preview Result Section */}
          {synthesizedTheme && (
            <div className="flex flex-col gap-3 p-4 bg-[#0a0d14] rounded-xl border-2 border-cyan-500/50 shadow-2xl animate-fade-in">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#2f3749]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-antonio font-extrabold text-base text-cyan-300 uppercase">
                      {synthesizedTheme.name}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500 text-emerald-400 text-[10px] font-bold">
                      COMPILED
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] font-mono-data mt-0.5">
                    {synthesizedTheme.era}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#18202f] border border-[#2f3749] text-slate-300 hover:text-white rounded text-xs transition-colors cursor-pointer"
                  >
                    {copiedCode ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedCode ? 'COPIED!' : 'COPY CODE'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleActivateAndStore}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-antonio font-black text-xs uppercase tracking-wider rounded transition-colors shadow cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>APPLY & STORE AS SEPARATE THEME</span>
                  </button>
                </div>
              </div>

              {/* Design Rationale Notes */}
              {synthesizedTheme.designNotes && (
                <div className="text-[11px] text-slate-300 bg-[#121824] p-2.5 rounded border border-[#2f3749]/60">
                  <span className="font-bold text-amber-400 mr-1.5">AI SYNTHESIS RATIONALE:</span>
                  {synthesizedTheme.designNotes}
                </div>
              )}

              {/* Extracted Swatches Strip */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                  EXTRACTED COLOR TAXONOMY:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {Object.entries(synthesizedTheme.colors).map(([key, hex]) => (
                    <div
                      key={key}
                      className="flex items-center gap-2 p-2 bg-[#121824] border border-[#2f3749] rounded"
                    >
                      <div
                        className="w-5 h-5 rounded border border-white/20 shadow-sm flex-shrink-0"
                        style={{ backgroundColor: hex }}
                      />
                      <div className="overflow-hidden">
                        <div className="font-bold text-[10px] text-slate-300 truncate">
                          {key}
                        </div>
                        <div className="text-[9px] text-slate-400 font-mono">{hex}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Visual Preview Widget */}
              <div className="flex flex-col gap-1.5 mt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                    EXTRAPOLATED INTERFACE & PAGE TEMPLATE PREVIEW:
                  </span>
                  {synthesizedTemplate?.layoutArchetype && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-cyan-300 border border-blue-500/40 uppercase font-bold">
                      ARCHETYPE: {synthesizedTemplate.layoutArchetype}
                    </span>
                  )}
                </div>
                <div
                  className="p-3.5 rounded-lg border flex flex-col gap-3"
                  style={{
                    backgroundColor: synthesizedTheme.colors.bgObsidian,
                    borderColor: synthesizedTheme.colors.border,
                  }}
                >
                  {/* Modern Header Bar Mockup */}
                  <div
                    className="flex items-center justify-between p-2.5 rounded border"
                    style={{
                      backgroundColor: synthesizedTheme.colors.bgSlate,
                      borderColor: synthesizedTheme.colors.border,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center font-bold text-[10px]"
                        style={{
                          backgroundColor: synthesizedTheme.colors.primary,
                          color: '#000000',
                        }}
                      >
                        APP
                      </div>
                      <span className="font-bold text-xs text-white">
                        {synthesizedTemplate?.header?.title || synthesizedTheme.name}
                      </span>
                    </div>
                    <div
                      className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold"
                      style={{
                        backgroundColor: `${synthesizedTheme.colors.accent}20`,
                        color: synthesizedTheme.colors.accent,
                        border: `1px solid ${synthesizedTheme.colors.accent}40`,
                      }}
                    >
                      {synthesizedTemplate?.header?.authorizationCode || 'EXTRAPOLATED TEMPLATE'}
                    </div>
                  </div>

                  {/* Extrapolated KPI Cards Preview */}
                  {synthesizedTemplate?.kpiCards && synthesizedTemplate.kpiCards.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {synthesizedTemplate.kpiCards.map((kpi, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded border flex flex-col gap-1"
                          style={{
                            backgroundColor: synthesizedTheme.colors.bgSlate,
                            borderColor: synthesizedTheme.colors.border,
                          }}
                        >
                          <span className="text-[9px] text-slate-400 uppercase truncate">
                            {kpi.label}
                          </span>
                          <span className="text-sm font-bold text-white font-mono">
                            {kpi.value}
                          </span>
                          <span
                            className="text-[9px] font-mono"
                            style={{ color: synthesizedTheme.colors.accent }}
                          >
                            {kpi.change || 'Nominal'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div
                        className="px-3 py-1.5 rounded text-xs font-bold uppercase shadow"
                        style={{
                          backgroundColor: synthesizedTheme.colors.primary,
                          color: '#000000',
                        }}
                      >
                        01. PRIMARY ACTION
                      </div>
                      <div
                        className="px-3 py-1.5 rounded text-xs font-bold uppercase border shadow"
                        style={{
                          backgroundColor: synthesizedTheme.colors.bgSlate,
                          color: synthesizedTheme.colors.accent,
                          borderColor: synthesizedTheme.colors.border,
                        }}
                      >
                        02. SECONDARY ACTION
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
