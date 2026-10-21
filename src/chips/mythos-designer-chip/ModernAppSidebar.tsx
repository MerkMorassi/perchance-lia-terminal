import React from 'react';
import { MSDNavigationItem, ThemeId, SystemMetric } from '../../types/msd';
import { THEMES } from '../../constants/themes';
import { soundEngine } from '../../utils/audio';
import {
  Compass,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Layers,
  Server,
  Zap,
  Radio,
  MessageSquare
} from 'lucide-react';
import { VoxconTranscriptionDisplay } from '../voice/VoxconTranscriptionDisplay';

interface ModernAppSidebarProps {
  navigationItems: MSDNavigationItem[];
  activeNavId: string;
  onSelectNav: (id: string) => void;
  currentTheme: ThemeId;
  anomalySimulated: boolean;
  onToggleAnomaly: () => void;
  metrics?: Record<string, SystemMetric>;
  transcripts?: any[];
}

export const ModernAppSidebar: React.FC<ModernAppSidebarProps> = ({
  navigationItems,
  activeNavId,
  onSelectNav,
  currentTheme,
  anomalySimulated,
  onToggleAnomaly,
  metrics,
  transcripts = [],
}) => {
  const theme = THEMES[currentTheme] || THEMES['noir-dark'];

  return (
    <aside className="w-full md:w-64 flex-shrink-0 flex flex-col gap-2.5 select-none font-sans">
      {/* Workspace System Status Card */}
      <div
        className="p-3 rounded-lg border flex flex-col gap-1.5 shadow-sm"
        style={{
          backgroundColor: theme.colors.bgSlate,
          borderColor: theme.colors.border,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white uppercase tracking-wider font-mono-data">
            <Server className="w-3.5 h-3.5" style={{ color: theme.colors.accent }} />
            <span>SYSTEM CONSOLE</span>
          </div>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-mono-data font-semibold"
            style={{
              backgroundColor: anomalySimulated ? '#ef444422' : `${theme.colors.live}22`,
              color: anomalySimulated ? '#ef4444' : theme.colors.live,
              border: `1px solid ${anomalySimulated ? '#ef444455' : `${theme.colors.live}55`}`,
            }}
          >
            {anomalySimulated ? 'FAULT INJECTED' : 'NOMINAL'}
          </span>
        </div>
        <div className="text-[11px] text-slate-400 font-mono-data">
          ACTIVE PROFILE: <span className="text-slate-200">{theme.name}</span>
        </div>
      </div>

      {/* Navigation Modules */}
      <div
        className="p-2.5 rounded-lg border flex flex-col gap-1.5 shadow-sm"
        style={{
          backgroundColor: theme.colors.bgSlate,
          borderColor: theme.colors.border,
        }}
      >
        <div className="text-[10px] font-mono-data text-slate-400 px-1 py-0.5 flex items-center justify-between uppercase tracking-wider">
          <span>NAVIGATION CHANNELS</span>
          <Compass className="w-3 h-3" style={{ color: theme.colors.accent }} />
        </div>

        <nav className="flex flex-col gap-1">
          {navigationItems.map((nav, idx) => {
            const isActive = nav.id === activeNavId;
            return (
              <button
                key={nav.id}
                type="button"
                onClick={() => {
                  soundEngine.playBeep(isActive ? 660 : 880, 'sine', 0.05);
                  onSelectNav(nav.id);
                }}
                className={`w-full px-2.5 py-2 rounded text-xs font-mono-data font-semibold flex items-center justify-between transition-all cursor-pointer text-left border ${
                  isActive
                    ? 'text-white shadow font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-white/5 border-transparent'
                }`}
                style={{
                  backgroundColor: isActive ? `${theme.colors.primary}20` : 'transparent',
                  borderColor: isActive ? theme.colors.primary : 'transparent',
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      backgroundColor: isActive ? theme.colors.accent : '#475569',
                    }}
                  />
                  <span>{nav.label}</span>
                </div>
                <span className="text-[10px] opacity-60 font-mono-data">
                  0{idx + 1}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Live System Telemetry Overview */}
      <div
        className="p-3 rounded-lg border flex flex-col gap-2 shadow-sm"
        style={{
          backgroundColor: theme.colors.bgSlate,
          borderColor: theme.colors.border,
        }}
      >
        <div className="flex items-center justify-between text-xs font-mono-data font-bold text-slate-200">
          <span className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            TELEMETRY SIGNALS
          </span>
          <span className="text-[10px] text-emerald-400 font-mono-data">STREAMING</span>
        </div>

        <div className="space-y-2 text-xs font-mono-data">
          <div>
            <div className="flex justify-between text-[11px] mb-1 text-slate-300">
              <span>COHERENCE</span>
              <span className="font-bold" style={{ color: theme.colors.accent }}>
                {metrics?.coherenceFactor ? `${metrics.coherenceFactor.value.toFixed(1)}%` : '98.4%'}
              </span>
            </div>
            <div className="w-full bg-[#0a0f1d] rounded-full h-1.5 overflow-hidden border border-[#1e293b]">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${metrics?.coherenceFactor?.value || 98.4}%`,
                  backgroundColor: theme.colors.primary,
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1 text-slate-300">
              <span>THROUGHPUT</span>
              <span className="font-bold" style={{ color: theme.colors.accent }}>
                {metrics?.plasmaFlowRate ? `${metrics.plasmaFlowRate.value.toFixed(1)} ${metrics.plasmaFlowRate.unit}` : '48.2 GB/s'}
              </span>
            </div>
            <div className="w-full bg-[#0a0f1d] rounded-full h-1.5 overflow-hidden border border-[#1e293b]">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, ((metrics?.plasmaFlowRate?.value || 48) / 100) * 100)}%`,
                  backgroundColor: theme.colors.accent,
                }}
              />
            </div>
          </div>
        </div>

        {/* Anomaly Simulation Toggle */}
        <button
          type="button"
          onClick={() => {
            soundEngine.playAlert();
            onToggleAnomaly();
          }}
          className={`w-full mt-1.5 py-1.5 px-2 rounded text-xs font-mono-data font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
            anomalySimulated
              ? 'bg-red-500/20 text-red-300 border-red-500 animate-pulse'
              : 'bg-[#0f172a] text-slate-300 border-[#334155] hover:border-amber-400 hover:text-amber-300'
          }`}
        >
          {anomalySimulated ? (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span>RESET SIMULATED FAULT</span>
            </>
          ) : (
            <>
              <Radio className="w-3.5 h-3.5 text-amber-400" />
              <span>SIMULATE SYSTEM FAULT</span>
            </>
          )}
        </button>
      </div>

      {/* Live Comms Monitor Expansion Block */}
      <div
        className="p-2.5 rounded-lg border flex flex-col gap-2 shadow-sm flex-grow w-full min-h-[220px] max-h-[400px] transition-all duration-300"
        style={{
          backgroundColor: theme.colors.bgSlate,
          borderColor: theme.colors.border,
        }}
      >
        <VoxconTranscriptionDisplay transcripts={transcripts} currentTheme={currentTheme} />
      </div>
    </aside>
  );
};
