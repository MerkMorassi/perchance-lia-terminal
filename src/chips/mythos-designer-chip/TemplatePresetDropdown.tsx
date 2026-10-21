import React, { useState, useEffect } from 'react';
import { ThemeId } from '../../types/msd';
import { THEMES } from '../../constants/themes';
import { getUnifiedTemplatePresets, TEMPLATE_PRESETS } from '../../constants/templates';
import { soundEngine } from '../../utils/audio';
import { Sliders, Star, Check } from 'lucide-react';

interface TemplatePresetDropdownProps {
  currentLayoutId: string;
  currentTheme: ThemeId;
  onSelectPreset: (presetKey: string) => void;
  onSetDefaultPreset?: (presetKey: string) => void;
  showLabel?: boolean;
  compact?: boolean;
  className?: string;
}

export const TemplatePresetDropdown: React.FC<TemplatePresetDropdownProps> = ({
  currentLayoutId,
  currentTheme,
  onSelectPreset,
  onSetDefaultPreset,
  showLabel = true,
  compact = false,
  className = '',
}) => {
  const theme = THEMES[currentTheme] || THEMES['noir-dark'];
  const presets = getUnifiedTemplatePresets();

  const [defaultPresetKey, setDefaultPresetKey] = useState<string>(() => {
    return localStorage.getItem('mythos_default_template_preset') || 'modernCloudDashboard';
  });
  const [showSavedFeedback, setShowSavedFeedback] = useState<boolean>(false);

  // Sync default preset key if updated externally
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'mythos_default_template_preset' && e.newValue) {
        setDefaultPresetKey(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Find active preset key matching current layout ID or theme ID
  const activePreset = presets.find(
    (p) => p.layoutId === currentLayoutId || p.themeId === currentTheme
  );
  const activeValue = activePreset ? activePreset.key : currentLayoutId;

  // Collect any custom synthesized themes that are not standard
  const customThemes = Object.values(THEMES).filter((t) => t.isCustom);

  // Group presets by category
  const categories = Array.from(new Set(presets.map((p) => p.category)));

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedKey = e.target.value;
    soundEngine.playChime();
    onSelectPreset(selectedKey);
  };

  const handleSetDefault = () => {
    try {
      localStorage.setItem('mythos_default_template_preset', activeValue);
    } catch {
      // ignore
    }
    setDefaultPresetKey(activeValue);
    soundEngine.playChime();
    setShowSavedFeedback(true);
    if (onSetDefaultPreset) {
      onSetDefaultPreset(activeValue);
    }
    setTimeout(() => {
      setShowSavedFeedback(false);
    }, 2200);
  };

  const isCurrentDefault = activeValue === defaultPresetKey;

  return (
    <div className={`flex items-center gap-2 font-mono-data flex-wrap ${className}`}>
      {showLabel && (
        <label
          htmlFor="switch-template-preset-select"
          className="text-slate-300 font-bold text-xs uppercase flex items-center gap-1.5 whitespace-nowrap cursor-pointer select-none"
        >
          <Sliders className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="whitespace-nowrap">SWITCH TEMPLATE PRESET:</span>
        </label>
      )}

      <select
        id="switch-template-preset-select"
        value={activeValue}
        onChange={handleChange}
        className={`bg-[#0a0f1d] border text-slate-100 font-bold uppercase rounded transition-all focus:outline-none focus:ring-1 focus:ring-cyan-400 cursor-pointer shadow-sm ${
          compact
            ? 'px-2 py-1 text-[11px] max-w-[200px] sm:max-w-[240px]'
            : 'px-2.5 py-1.5 text-xs max-w-[240px] sm:max-w-[280px]'
        }`}
        style={{
          borderColor: theme.colors.border,
        }}
        title="Select a unified layout template & theme preset"
      >
        {categories.map((category) => (
          <optgroup key={category} label={`━━ ${category} ━━`} className="bg-[#0b101c] text-cyan-400 font-bold">
            {presets
              .filter((p) => p.category === category)
              .map((p) => (
                <option
                  key={p.key}
                  value={p.key}
                  className="bg-[#0a0e1a] text-slate-200 py-1"
                >
                  {p.key === defaultPresetKey ? `★ ${p.name} [DEFAULT]` : p.name}
                </option>
              ))}
          </optgroup>
        ))}

        {customThemes.length > 0 && (
          <optgroup label="━━ Custom Extrapolated Templates ━━" className="bg-[#0b101c] text-purple-400 font-bold">
            {customThemes.map((ct) => (
              <option key={ct.id} value={`custom-${ct.id}`} className="bg-[#0a0e1a] text-purple-200">
                {`custom-${ct.id}` === defaultPresetKey ? `★ ${ct.name} [DEFAULT]` : `★ ${ct.name}`}
              </option>
            ))}
          </optgroup>
        )}
      </select>

      {/* Set As Default Functionality */}
      <div className="flex items-center gap-1.5">
        {isCurrentDefault ? (
          <div
            id="template-preset-is-default-badge"
            className="flex items-center gap-1 px-2 py-1 rounded bg-amber-950/70 border border-amber-500/80 text-amber-300 text-[11px] font-bold shadow-xs select-none"
            title="This preset is currently your default startup dashboard layout"
          >
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>DEFAULT</span>
          </div>
        ) : (
          <button
            type="button"
            id="set-default-dashboard-preset-btn"
            onClick={handleSetDefault}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 hover:bg-amber-950/60 border border-slate-700 hover:border-amber-500 text-slate-300 hover:text-amber-300 text-[11px] font-bold transition-all cursor-pointer shadow-xs whitespace-nowrap group"
            title="Set this dashboard template & theme preset as default startup layout"
          >
            <Star className="w-3.5 h-3.5 text-amber-400 group-hover:fill-amber-400 transition-colors" />
            <span>SET AS DEFAULT</span>
          </button>
        )}

        {showSavedFeedback && (
          <span
            id="template-preset-saved-toast"
            className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold animate-pulse whitespace-nowrap"
          >
            <Check className="w-3 h-3 text-emerald-400" />
            <span>SAVED AS BOOT DEFAULT</span>
          </span>
        )}
      </div>
    </div>
  );
};
