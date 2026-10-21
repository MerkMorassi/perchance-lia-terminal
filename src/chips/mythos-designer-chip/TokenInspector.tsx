import React, { useState, useEffect } from 'react';
import { ThemeId, ThemeConfig } from '../../types/msd';
import { THEMES, deleteCustomTheme } from '../../constants/themes';
import { GeometryLab } from './GeometryLab';
import { Cpu, Palette, Type, Check, Copy, Ruler, Sparkles, Trash2, CheckCircle2 } from 'lucide-react';
import { soundEngine } from '../../utils/audio';

interface TokenInspectorProps {
  currentTheme: ThemeId;
  onThemeChange?: (theme: ThemeId) => void;
  onOpenThemeForge?: () => void;
}

export const TokenInspector: React.FC<TokenInspectorProps> = ({
  currentTheme,
  onThemeChange,
  onOpenThemeForge,
}) => {
  const [, setVersion] = useState(0);
  const theme = THEMES[currentTheme] || THEMES['noir-dark'];
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  useEffect(() => {
    const handleUpdate = () => setVersion((v) => v + 1);
    window.addEventListener('mythos_theme_registered', handleUpdate);
    window.addEventListener('mythos_theme_deleted', handleUpdate);
    return () => {
      window.removeEventListener('mythos_theme_registered', handleUpdate);
      window.removeEventListener('mythos_theme_deleted', handleUpdate);
    };
  }, []);

  const handleDeleteTheme = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    soundEngine.playAlert();
    deleteCustomTheme(id);
    if (currentTheme === id && onThemeChange) {
      onThemeChange('noir-dark');
    }
  };

  const cssTokens = [
    { var: '--sys-bg-obsidian', val: theme.colors.bgObsidian, desc: 'Base Canvas Obsidian (#000)' },
    { var: '--sys-bg-slate', val: theme.colors.bgSlate, desc: 'Panel & Container Slate (#111)' },
    { var: '--sys-secondary-surface', val: theme.colors.secondary, desc: 'Secondary Surface Bar (#222)' },
    { var: '--sys-border', val: theme.colors.border, desc: 'Structural Border & Divider (#333)' },
    { var: '--sys-primary-frame', val: theme.colors.primary, desc: 'Primary Control Cap (#444)' },
    { var: '--sys-accent', val: theme.colors.accent, desc: 'Accent & Highlight' },
    { var: '--sys-alert', val: theme.colors.alert, desc: 'Critical Alert Red' },
    { var: '--sys-live', val: theme.colors.live, desc: 'Live Nominal Status' },
    { var: '--sys-text', val: theme.colors.text, desc: 'High-Contrast Primary Text' },
    { var: '--sys-text-muted', val: theme.colors.textMuted, desc: 'Muted Secondary Readout Text' },
  ];

  const handleCopy = (tokenVar: string) => {
    soundEngine.playChime();
    navigator.clipboard.writeText(`var(${tokenVar})`);
    setCopiedToken(tokenVar);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  return (
    <div className="w-full flex flex-col gap-6 select-none">
      {/* Token Header Banner */}
      <div className="p-4 bg-[#0a0d12] border-2 border-[#2f3749] rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-2">
          <Palette className="w-6 h-6 text-cyan-400" />
          <div>
            <h2 className="font-antonio font-extrabold text-lg uppercase text-slate-100 tracking-wider">
              MythOS DESIGN ENGINE // TOKEN TAXONOMY & THEME FORGE
            </h2>
            <p className="font-mono-data text-xs text-slate-400">
              Multi-Asset Theme Synthesis, Design Tokens, & Structural Geometry Rules.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenThemeForge && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playChime();
                onOpenThemeForge();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 text-black font-antonio font-extrabold uppercase text-xs rounded transition-all shadow cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>SKETCH → THEME COMPILER</span>
            </button>
          )}

          <span
            className="font-mono-data text-xs font-bold px-3 py-1 rounded shadow"
            style={{
              backgroundColor: theme.colors.primary,
              color: '#000000',
            }}
          >
            ACTIVE: {theme.name}
          </span>
        </div>
      </div>

      {/* 2.0 SEPARATE THEMES REGISTRY CARDS */}
      <div className="flex flex-col gap-3 bg-[#0a0d12] p-4 rounded-xl border border-[#2f3749]">
        <div className="font-antonio font-bold text-sm text-cyan-300 uppercase tracking-wider pb-2 border-b border-[#2f3749] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>2.0 SEPARATE THEMES REGISTRY ({Object.keys(THEMES).length} AVAILABLE)</span>
          </div>
          <span className="font-mono-data text-[10px] text-slate-400">CLICK TO SWITCH RUNTIME THEME</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.values(THEMES).map((t: ThemeConfig) => {
            const isActive = t.id === currentTheme;
            return (
              <div
                key={t.id}
                onClick={() => {
                  soundEngine.playToggle();
                  if (onThemeChange) onThemeChange(t.id);
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 relative group ${
                  isActive
                    ? 'border-cyan-400 bg-[#121927] shadow-lg shadow-cyan-950/40'
                    : 'border-[#2f3749] bg-[#0c1017] hover:border-slate-400 hover:bg-[#101520]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <span className="font-antonio font-bold text-xs uppercase text-slate-100 truncate">
                        {t.name}
                      </span>
                    </div>
                    {isActive ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-cyan-400 bg-cyan-950/80 border border-cyan-500/50 px-1.5 py-0.5 rounded">
                        <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                        ACTIVE
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono-data text-slate-500">
                        {t.isCustom ? '★ CUSTOM' : 'PRESET'}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-mono-data text-slate-400 mt-1 line-clamp-1">
                    {t.era}
                  </p>
                </div>

                {/* Color Chips Strip */}
                <div className="flex items-center gap-1.5 pt-2 border-t border-[#2f3749]/60">
                  <div
                    className="w-5 h-5 rounded border border-white/20 shadow-sm"
                    style={{ backgroundColor: t.colors.bgObsidian }}
                    title={`Obsidian: ${t.colors.bgObsidian}`}
                  />
                  <div
                    className="w-5 h-5 rounded border border-white/20 shadow-sm"
                    style={{ backgroundColor: t.colors.primary }}
                    title={`Primary: ${t.colors.primary}`}
                  />
                  <div
                    className="w-5 h-5 rounded border border-white/20 shadow-sm"
                    style={{ backgroundColor: t.colors.secondary }}
                    title={`Secondary: ${t.colors.secondary}`}
                  />
                  <div
                    className="w-5 h-5 rounded border border-white/20 shadow-sm"
                    style={{ backgroundColor: t.colors.accent }}
                    title={`Accent: ${t.colors.accent}`}
                  />
                  <div
                    className="w-5 h-5 rounded border border-white/20 shadow-sm"
                    style={{ backgroundColor: t.colors.alert }}
                    title={`Alert: ${t.colors.alert}`}
                  />
                  <div
                    className="w-5 h-5 rounded border border-white/20 shadow-sm"
                    style={{ backgroundColor: t.colors.live }}
                    title={`Live: ${t.colors.live}`}
                  />

                  {t.isCustom && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteTheme(t.id, e)}
                      className="ml-auto p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete custom theme"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Color Taxonomy & CSS Variables Grid */}
        <div className="flex flex-col gap-3 bg-[#0a0d12] p-4 rounded-xl border border-[#2f3749]">
          <div className="font-antonio font-bold text-sm text-cyan-300 uppercase tracking-wider pb-2 border-b border-[#2f3749] flex items-center justify-between">
            <span>2.1 COLOR TAXONOMY & VARIABLES</span>
            <span className="font-mono-data text-[10px] text-slate-400">CSS CUSTOM PROPERTIES</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto pr-1">
            {cssTokens.map((t) => (
              <div
                key={t.var}
                onClick={() => handleCopy(t.var)}
                className="flex items-center justify-between p-2.5 bg-[#101216] border border-[#2f3749] hover:border-cyan-400 rounded cursor-pointer transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-7 h-7 rounded border border-white/20 shadow-md flex-shrink-0"
                    style={{ backgroundColor: t.val }}
                  />
                  <div>
                    <div className="font-mono-data text-xs text-slate-200 font-bold group-hover:text-cyan-300">
                      {t.var}
                    </div>
                    <div className="font-mono-data text-[10px] text-slate-400">{t.val}</div>
                  </div>
                </div>

                <button type="button" className="text-slate-400 group-hover:text-white p-1">
                  {copiedToken === t.var ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Typographic Pairing Rules */}
        <div className="flex flex-col gap-3 bg-[#0a0d12] p-4 rounded-xl border border-[#2f3749]">
          <div className="font-antonio font-bold text-sm text-cyan-300 uppercase tracking-wider pb-2 border-b border-[#2f3749] flex items-center justify-between">
            <span>2.2 TYPOGRAPHIC PAIRINGS</span>
            <Type className="w-4 h-4 text-amber-400" />
          </div>

          <div className="space-y-4 font-mono-data text-xs">
            <div className="p-3 bg-[#101216] rounded border border-[#2f3749]">
              <div className="text-amber-400 font-bold mb-1">DISPLAY & CONTROL HEADERS</div>
              <div
                className="text-lg font-antonio font-black uppercase tracking-wider"
                style={{ color: theme.colors.primary }}
              >
                {theme.fonts?.display || 'ANTONIO (Condensed Sans, Bold 700+)'}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Used for primary LCARS/MythOS arches, mode indicators, and control buttons.
              </div>
            </div>

            <div className="p-3 bg-[#101216] rounded border border-[#2f3749]">
              <div className="text-amber-400 font-bold mb-1">TELEMETRY & CODE DATA</div>
              <div
                className="text-sm font-mono-data"
                style={{ color: theme.colors.accent }}
              >
                0x4F8A // COHERENCE Φ: 0.998 // ENTROPY: 0.042 ρS
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Font: {theme.fonts?.mono || 'Share Tech Mono / JetBrains Mono (Monospaced)'}
              </div>
            </div>

            <div className="p-3 bg-[#101216] rounded border border-[#2f3749]">
              <div className="text-amber-400 font-bold mb-1">BODY & EXPLANATORY PROSE</div>
              <div
                className="max-w-prose leading-relaxed"
                style={{ color: theme.colors.text }}
              >
                {theme.designNotes || 'The MythOS Design Engine decouples visual presentation into standardized design tokens, modular structural frames, and schema-driven MSD canvases.'}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Font: {theme.fonts?.body || 'Inter / System Sans'} (Constrained 65–75ch for baseline readability).
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Structural Geometry Lab */}
      <GeometryLab />
    </div>
  );
};
