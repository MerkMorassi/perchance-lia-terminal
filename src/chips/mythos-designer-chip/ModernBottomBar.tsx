import React, { useState, useEffect } from 'react';
import { ThemeId } from '../../types/msd';
import { THEMES } from '../../constants/themes';
import { soundEngine } from '../../utils/audio';
import {
  Clock,
  ShieldCheck,
  RotateCw,
  Wifi,
  Cpu,
  Layers
} from 'lucide-react';

interface ModernBottomBarProps {
  currentTheme: ThemeId;
  stardate?: string;
  onRefreshData?: () => void;
  archetype?: string;
}

export const ModernBottomBar: React.FC<ModernBottomBarProps> = ({
  currentTheme,
  stardate,
  onRefreshData,
  archetype = 'modern-dashboard',
}) => {
  const theme = THEMES[currentTheme] || THEMES['noir-dark'];
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="flex flex-col gap-1.5 w-full mt-2">
      <div
        className="w-full rounded-lg border px-3 py-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono-data select-none shadow-sm"
        style={{
          backgroundColor: theme.colors.bgSlate,
          borderColor: theme.colors.border,
        }}
      >
        {/* Left: Time & Archetype */}
        <div className="flex items-center gap-3 text-slate-400">
          <div className="flex items-center gap-1.5 text-slate-200">
            <Clock className="w-3.5 h-3.5" style={{ color: theme.colors.accent }} />
            <span className="font-semibold">{currentTime}</span>
          </div>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <div className="hidden sm:flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span className="uppercase text-[11px] text-slate-400">
              PROFILE: <strong className="text-slate-200">{archetype}</strong>
            </span>
          </div>
        </div>

        {/* Center: System Status Indicator */}
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-slate-300 font-semibold text-[11px]">
            {stardate || 'MESH LATENCY: 1.2ms // ZERO FAULTS DETECTED'}
          </span>
        </div>

        {/* Right: Security Attestation & Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-emerald-400 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden md:inline">TLS 1.3 ATTESTED</span>
          </div>
          {onRefreshData && (
            <button
              type="button"
              id="footer-recalibrate-btn"
              data-voice-target="recalibrate refresh telemetry"
              onClick={() => {
                soundEngine.playChime();
                onRefreshData();
              }}
              className="px-2 py-1 rounded bg-[#0b101c] hover:bg-white/10 border border-[#232f48] text-slate-300 hover:text-white flex items-center gap-1 transition-colors cursor-pointer text-[11px]"
              title="Recalibrate sensors and telemetry sync (Voice: 'Recalibrate')"
            >
              <RotateCw className="w-3 h-3 text-cyan-400" />
              <span>RECALIBRATE</span>
            </button>
          )}
        </div>
      </div>

      {/* Constitutional Integrity Status Bar */}
      <div 
        className="w-full rounded-lg border px-3 py-1.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] font-mono-data select-none"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          borderColor: theme.colors.border,
        }}
      >
        <div className="flex items-center gap-2 text-slate-400">
          <ShieldCheck className="w-3 h-3 text-emerald-500" />
          <span className="font-bold text-slate-300 uppercase">Constitutional Integrity: ATTESTED</span>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6 opacity-75 hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-semibold">MCF_HASH:</span>
            <span className="text-cyan-500 font-medium tracking-wider">c7d05cda29fe0e0fd7b9624048ab57f70be9cf9155c4dc4ec718a39f813c04ba</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-semibold">MANIFEST_HASH:</span>
            <span className="text-amber-500 font-medium tracking-wider">81a6795ad7a40d1229a3c2cd41a8980eb60aafc5fc2ee5e038252f827c4967ec</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
