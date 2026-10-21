import { ThemeConfig, ThemeId } from '../types/msd';

export const THEMES: Record<ThemeId, ThemeConfig> = {
  'noir-dark': {
    id: 'noir-dark',
    name: 'Noir Monochromatic (#000–#444)',
    era: 'Minimalist Stealth // #000 #111 #222 #333 #444',
    colors: {
      bgObsidian: '#000000',
      bgSlate: '#111111',
      border: '#333333',
      primary: '#444444',
      secondary: '#222222',
      accent: '#3b82f6',
      alert: '#ef4444',
      gold: '#eab308',
      live: '#22c55e',
      text: '#d1d5db',
      textMuted: '#9ca3af',
    },
    archHeaderClass: 'bg-gradient-to-r from-[#444444] via-[#222222] to-[#111111] text-[#d1d5db]',
    elbowClass: 'bg-[#444444]',
    pillboxPrimaryClass: 'bg-[#333333] text-[#d1d5db] hover:bg-[#444444] border border-[#444444]',
    pillboxSecondaryClass: 'bg-[#1e1e1e] text-[#9ca3af] hover:bg-[#2a2a2a] hover:text-[#d1d5db] border border-[#333333]',
    glowColor: 'rgba(59, 130, 246, 0.12)',
  },
  'quantum-cyan': {
    id: 'quantum-cyan',
    name: 'Quantum Cyan (Primary)',
    era: 'MythOS // Helios Command Matrix',
    colors: {
      bgObsidian: '#050608',
      bgSlate: '#101216',
      border: '#2f3749',
      primary: '#37a6d1',
      secondary: '#2a7193',
      accent: '#00eeee',
      alert: '#e7442a',
      gold: '#ffaa00',
      live: '#10b981',
      text: '#f1f5f9',
      textMuted: '#94a3b8',
    },
    archHeaderClass: 'bg-gradient-to-r from-[#37a6d1] via-[#2a7193] to-[#1c3c55] text-black',
    elbowClass: 'bg-[#37a6d1]',
    pillboxPrimaryClass: 'bg-[#37a6d1] text-black hover:bg-[#00eeee]',
    pillboxSecondaryClass: 'bg-[#1c3c55] text-[#00eeee] hover:bg-[#2a7193] hover:text-white',
    glowColor: 'rgba(0, 238, 238, 0.4)',
  },
  'aegis-amber': {
    id: 'aegis-amber',
    name: 'Aegis Amber (Tactical)',
    era: 'Industrial Aerospace // Aegis Grid',
    colors: {
      bgObsidian: '#0a0808',
      bgSlate: '#181214',
      border: '#4a2e38',
      primary: '#ffaa00',
      secondary: '#ff7700',
      accent: '#ddbbff',
      alert: '#cc3333',
      gold: '#ffaa00',
      live: '#33cc99',
      text: '#fef08a',
      textMuted: '#d4b896',
    },
    archHeaderClass: 'bg-gradient-to-r from-[#ffaa00] via-[#ff7700] to-[#ddbbff] text-black',
    elbowClass: 'bg-[#ffaa00]',
    pillboxPrimaryClass: 'bg-[#ffaa00] text-black hover:bg-[#ff7700]',
    pillboxSecondaryClass: 'bg-[#4a2e38] text-[#ddbbff] hover:bg-[#9966cc] hover:text-white',
    glowColor: 'rgba(255, 170, 0, 0.4)',
  },
  'hyperion-blue': {
    id: 'hyperion-blue',
    name: 'Hyperion Cyber Blue',
    era: 'Orbital Telemetry // Hyperion Deck',
    colors: {
      bgObsidian: '#020617',
      bgSlate: '#0f172a',
      border: '#1e293b',
      primary: '#38bdf8',
      secondary: '#0284c7',
      accent: '#60a5fa',
      alert: '#f43f5e',
      gold: '#f59e0b',
      live: '#10b981',
      text: '#f8fafc',
      textMuted: '#64748b',
    },
    archHeaderClass: 'bg-gradient-to-r from-[#38bdf8] via-[#0284c7] to-[#1e3a8a] text-black',
    elbowClass: 'bg-[#38bdf8]',
    pillboxPrimaryClass: 'bg-[#38bdf8] text-black hover:bg-[#60a5fa]',
    pillboxSecondaryClass: 'bg-[#1e293b] text-[#38bdf8] hover:bg-[#0284c7] hover:text-white',
    glowColor: 'rgba(56, 189, 248, 0.4)',
  },
  'obsidian-void': {
    id: 'obsidian-void',
    name: 'Obsidian High-Entropy',
    era: 'Deep Space Field // Void-Entropy HUD',
    colors: {
      bgObsidian: '#0c0a09',
      bgSlate: '#1c1917',
      border: '#44403c',
      primary: '#f97316',
      secondary: '#ea580c',
      accent: '#eab308',
      alert: '#ef4444',
      gold: '#eab308',
      live: '#84cc16',
      text: '#ffedd5',
      textMuted: '#a8a29e',
    },
    archHeaderClass: 'bg-gradient-to-r from-[#f97316] via-[#ea580c] to-[#7c2d12] text-black',
    elbowClass: 'bg-[#f97316]',
    pillboxPrimaryClass: 'bg-[#f97316] text-black hover:bg-[#eab308]',
    pillboxSecondaryClass: 'bg-[#292524] text-[#f97316] hover:bg-[#ea580c] hover:text-white',
    glowColor: 'rgba(249, 115, 22, 0.4)',
  },
  'crt-phosphor': {
    id: 'crt-phosphor',
    name: 'Phosphor Green (Legacy CRT Sketch)',
    era: 'Retro Terminal // Monochrome CRT Vector Display',
    colors: {
      bgObsidian: '#020a04',
      bgSlate: '#07160b',
      border: '#13351b',
      primary: '#22c55e',
      secondary: '#15803d',
      accent: '#4ade80',
      alert: '#ef4444',
      gold: '#a3e635',
      live: '#22c55e',
      text: '#dcfce7',
      textMuted: '#86efac',
    },
    archHeaderClass: 'bg-gradient-to-r from-[#22c55e] via-[#15803d] to-[#052e16] text-black',
    elbowClass: 'bg-[#22c55e]',
    pillboxPrimaryClass: 'bg-[#22c55e] text-black hover:bg-[#4ade80]',
    pillboxSecondaryClass: 'bg-[#07160b] text-[#4ade80] hover:bg-[#15803d] hover:text-white border border-[#13351b]',
    glowColor: 'rgba(34, 197, 94, 0.45)',
    fonts: {
      display: 'Share Tech Mono, monospace',
      mono: 'Share Tech Mono, monospace',
      body: 'Share Tech Mono, monospace',
    },
    source: {
      type: 'sketch',
      summary: 'Synthesized from 1980s monochrome vector display blueprint and CRT phosphor swatches.',
      timestamp: '2026-09-04',
    },
    isCustom: true,
  },
  'voyager-violet': {
    id: 'voyager-violet',
    name: 'Voyager Violet (PADD Wireframe)',
    era: 'Deep Range PADD // Subspace Optical Matrix',
    colors: {
      bgObsidian: '#090514',
      bgSlate: '#130d24',
      border: '#3b2064',
      primary: '#a855f7',
      secondary: '#7e22ce',
      accent: '#e879f9',
      alert: '#f43f5e',
      gold: '#f59e0b',
      live: '#10b981',
      text: '#f5f3ff',
      textMuted: '#c4b5fd',
    },
    archHeaderClass: 'bg-gradient-to-r from-[#a855f7] via-[#7e22ce] to-[#3b0764] text-black',
    elbowClass: 'bg-[#a855f7]',
    pillboxPrimaryClass: 'bg-[#a855f7] text-black hover:bg-[#e879f9]',
    pillboxSecondaryClass: 'bg-[#130d24] text-[#e879f9] hover:bg-[#7e22ce] hover:text-white border border-[#3b2064]',
    glowColor: 'rgba(168, 85, 247, 0.45)',
    fonts: {
      display: 'Antonio, sans-serif',
      mono: 'Courier New, monospace',
      body: 'Inter, sans-serif',
    },
    source: {
      type: 'sketch',
      summary: 'Extracted from tactical handheld PADD layout sketch and violet gradient swatches.',
      timestamp: '2026-09-04',
    },
    isCustom: true,
  },
};

// Stored custom themes manager
const STORAGE_KEY = 'mythos_custom_themes';

export function getStoredCustomThemes(): Record<string, ThemeConfig> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to parse custom themes from storage:', e);
  }
  return {};
}

export function registerCustomTheme(theme: ThemeConfig): void {
  THEMES[theme.id] = { ...theme, isCustom: true };
  if (typeof window !== 'undefined') {
    try {
      const existing = getStoredCustomThemes();
      existing[theme.id] = { ...theme, isCustom: true };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
      window.dispatchEvent(new CustomEvent('mythos_theme_registered', { detail: theme }));
    } catch (e) {
      console.error('Failed to save custom theme:', e);
    }
  }
}

export function deleteCustomTheme(themeId: string): void {
  delete THEMES[themeId];
  if (typeof window !== 'undefined') {
    try {
      const existing = getStoredCustomThemes();
      delete existing[themeId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
      window.dispatchEvent(new CustomEvent('mythos_theme_deleted', { detail: themeId }));
    } catch (e) {
      console.error('Failed to delete custom theme:', e);
    }
  }
}

export function getTheme(id: string): ThemeConfig {
  return THEMES[id] || THEMES['noir-dark'];
}

// Initialize custom themes into THEMES object on module load
if (typeof window !== 'undefined') {
  try {
    const stored = getStoredCustomThemes();
    Object.keys(stored).forEach((id) => {
      THEMES[id] = stored[id];
    });
  } catch (e) {
    console.error('Failed to initialize custom themes:', e);
  }
}
