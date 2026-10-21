import React, { useEffect } from 'react';
import { ThemeId } from '../../types/msd';
import { THEMES } from '../../constants/themes';
import { soundEngine } from '../../utils/audio';
import { Keyboard, X, Mic, AlertTriangle, Layers, Volume2, RotateCw, HelpCircle, Sliders } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: ThemeId;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  category: 'Voice & Audio' | 'System & Telemetry' | 'Navigation & Workstation' | 'General';
  icon: React.ReactNode;
}

const SHORTCUTS: ShortcutItem[] = [
  {
    keys: ['M', 'Alt + M'],
    description: 'Toggle Voice Microphone (Mute / Unmute / Connect Uplink)',
    category: 'Voice & Audio',
    icon: <Mic className="w-4 h-4 text-emerald-400" />,
  },
  {
    keys: ['Alt + Shift + M'],
    description: 'Disconnect Voice Control Uplink session',
    category: 'Voice & Audio',
    icon: <Mic className="w-4 h-4 text-amber-400" />,
  },
  {
    keys: ['U', 'Alt + U'],
    description: 'Toggle Master Acoustic Mute (Sound Effects)',
    category: 'Voice & Audio',
    icon: <Volume2 className="w-4 h-4 text-cyan-400" />,
  },
  {
    keys: ['A', 'Alt + A'],
    description: 'Toggle Simulated System Anomaly (Critical Alert State)',
    category: 'System & Telemetry',
    icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
  },
  {
    keys: ['R', 'Alt + R'],
    description: 'Recalibrate System Telemetry to Nominal Levels',
    category: 'System & Telemetry',
    icon: <RotateCw className="w-4 h-4 text-emerald-400" />,
  },
  {
    keys: ['T', 'Alt + T'],
    description: 'Cycle Forward through Workstation Application Modes',
    category: 'Navigation & Workstation',
    icon: <Layers className="w-4 h-4 text-cyan-400" />,
  },
  {
    keys: ['Shift + T', 'Alt + Shift + T'],
    description: 'Cycle Backward through Workstation Application Modes',
    category: 'Navigation & Workstation',
    icon: <Layers className="w-4 h-4 text-cyan-400" />,
  },
  {
    keys: ['1', '2', '3', '4', '5'],
    description: 'Direct Select Tab: 1=MSD, 2=Studio, 3=Tokens, 4=AI, 5=Voice',
    category: 'Navigation & Workstation',
    icon: <Layers className="w-4 h-4 text-purple-400" />,
  },
  {
    keys: ['D', 'Alt + D'],
    description: 'Cycle Dashboard Sub-Tab (Dashboard / Schematic / Split View)',
    category: 'Navigation & Workstation',
    icon: <Sliders className="w-4 h-4 text-blue-400" />,
  },
  {
    keys: ['?', 'Shift + /', 'F1'],
    description: 'Open / Close this Keyboard Shortcuts & Accessibility Panel',
    category: 'General',
    icon: <HelpCircle className="w-4 h-4 text-amber-400" />,
  },
  {
    keys: ['Esc'],
    description: 'Close Active Modals or Dismiss Overlays',
    category: 'General',
    icon: <Keyboard className="w-4 h-4 text-slate-400" />,
  },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
  currentTheme,
}) => {
  const theme = THEMES[currentTheme] || THEMES['noir-dark'];

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        soundEngine.playToggle();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categories = Array.from(new Set(SHORTCUTS.map((s) => s.category)));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border p-5 shadow-2xl flex flex-col gap-4 font-mono-data max-h-[85vh] overflow-y-auto"
        style={{
          backgroundColor: theme.colors.bgSlate,
          borderColor: theme.colors.border,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-700/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#0b101c] border border-cyan-900/60 text-cyan-400">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 id="shortcuts-modal-title" className="text-base font-bold text-slate-100 flex items-center gap-2">
                ACCESSIBILITY & KEYBOARD COMMAND INTERFACE
              </h2>
              <p className="text-xs text-slate-400">
                Direct keystroke bindings for hands-free workstation operation
              </p>
            </div>
          </div>
          <button
            type="button"
            id="close-shortcuts-modal-btn"
            onClick={() => {
              soundEngine.playToggle();
              onClose();
            }}
            className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 bg-[#080d19] transition-colors cursor-pointer"
            title="Close Shortcuts (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts Grouped by Category */}
        <div className="flex flex-col gap-4">
          {categories.map((cat) => (
            <div key={cat} className="flex flex-col gap-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5 pb-1 border-b border-slate-800">
                <span>{cat}</span>
              </div>
              <div className="grid grid-cols-1 gap-1.5 pt-1">
                {SHORTCUTS.filter((s) => s.category === cat).map((s, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-[#0b101c]/80 border border-slate-800/80 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="shrink-0">{s.icon}</span>
                      <span className="text-xs text-slate-300 truncate">{s.description}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-3">
                      {s.keys.map((k, kidx) => (
                        <kbd
                          key={kidx}
                          className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200 text-[11px] font-mono shadow-xs"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Note */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span>* Single key shortcuts function when not typing inside text input fields.</span>
          <span className="text-cyan-400 font-semibold">Press Esc to dismiss</span>
        </div>
      </div>
    </div>
  );
};
