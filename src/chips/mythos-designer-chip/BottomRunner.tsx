import React, { useState, useEffect } from 'react';
import { ThemeId } from '../../types/msd';
import { THEMES } from '../../constants/themes';
import { BarRunner } from './BarRunner';
import { Radio, Terminal, Zap, Shield, RefreshCw } from 'lucide-react';
import { soundEngine } from '../../utils/audio';

interface BottomRunnerProps {
  currentTheme: ThemeId;
  stardate?: string;
  onRefreshData?: () => void;
}

export const BottomRunner: React.FC<BottomRunnerProps> = ({
  currentTheme,
  stardate = '2026-09-04',
  onRefreshData,
}) => {
  const theme = THEMES[currentTheme];
  const [timestamp, setTimestamp] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [tzMode, setTzMode] = useState<'MST' | 'LOCAL' | 'UTC'>(() => {
    return (localStorage.getItem('voxcon-tz-mode') as 'MST' | 'LOCAL' | 'UTC') || 'MST';
  });

  // Listen to timezone updates across components
  useEffect(() => {
    const handleTzUpdate = () => {
      setTzMode((localStorage.getItem('voxcon-tz-mode') as 'MST' | 'LOCAL' | 'UTC') || 'MST');
    };
    window.addEventListener('voxcon_tz_updated', handleTzUpdate);
    return () => window.removeEventListener('voxcon_tz_updated', handleTzUpdate);
  }, []);

  const cycleTzMode = () => {
    const nextModeMap: Record<'MST' | 'LOCAL' | 'UTC', 'MST' | 'LOCAL' | 'UTC'> = {
      MST: 'LOCAL',
      LOCAL: 'UTC',
      UTC: 'MST',
    };
    const nextMode = nextModeMap[tzMode];
    localStorage.setItem('voxcon-tz-mode', nextMode);
    setTzMode(nextMode);
    window.dispatchEvent(new Event('voxcon_tz_updated'));
    soundEngine.playBeep(660, 'sine', 0.05);
  };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let timeStr = '';
      let dateStr = '';

      if (tzMode === 'MST') {
        timeStr = now.toLocaleTimeString([], {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'America/Phoenix',
        }) + ' MST';

        const formatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Phoenix',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        dateStr = formatter.format(now);
      } else if (tzMode === 'UTC') {
        timeStr = now.toLocaleTimeString([], {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'UTC',
        }) + ' UTC';

        const formatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'UTC',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        dateStr = formatter.format(now);
      } else {
        timeStr = now.toLocaleTimeString([], {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }) + ' LOCAL';

        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
      }

      setTimestamp(timeStr);
      setCurrentDate(dateStr);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [tzMode]);

  const handleRefresh = () => {
    soundEngine.playChime();
    if (onRefreshData) onRefreshData();
  };

  return (
    <footer className="w-full flex flex-col gap-1 select-none mt-2">
      {/* Continuous Bar Runner Segment */}
      <BarRunner
        color={theme.colors.primary}
        segments={[10, 25, 30, 20, 15]}
        labels={['SYS', 'BAR RUNNER 01', 'SPEC-PARITY OK', 'TELEMETRY', 'MYTHOS']}
        height={10}
      />

      {/* Main Bottom Framing Console */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-[#0a0a0a] border-b-2 border-[#333333] rounded-b-xl text-xs font-mono-data">
        <div className="flex items-center gap-4 text-slate-400">
          <div className="flex items-center gap-1.5 text-blue-400">
            <Terminal className="w-4 h-4 text-yellow-400" />
            <span className="font-bold">MythOS ENGINE v1.0</span>
          </div>
          <span className="text-[#333333]">|</span>
          <div className="hidden sm:flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-green-400 animate-pulse" />
            <span>SUBSPACE FREQ:</span>
            <span className="text-yellow-400 font-bold">47.22 GHz</span>
          </div>
          <span className="hidden sm:inline text-[#333333]">|</span>
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            <span>STATUS:</span>
            <span className="text-green-400 font-bold">NOMINAL</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-slate-400">
            <span className="mr-1">SYS-DATE:</span>
            <span className="text-yellow-400 font-bold">{currentDate || stardate}</span>
          </div>

          <div 
            onClick={cycleTzMode}
            className="hidden md:flex items-center gap-1.5 text-slate-400 cursor-pointer hover:bg-slate-800/45 px-2 py-0.5 rounded border border-transparent hover:border-slate-700/60 transition-all select-none group"
            title="Click to cycle timezone (MST / Local / UTC)"
          >
            <span className="group-hover:text-slate-200">SYS-TIME:</span>
            <span className="text-slate-300 ml-1 font-bold group-hover:text-yellow-400 transition-colors">{timestamp}</span>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            className="flex items-center gap-1 bg-[#222222] border border-[#444444] text-slate-300 hover:bg-[#333333] hover:text-white px-2.5 py-1 rounded text-xs font-antonio font-bold uppercase transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            RE-CALIBRATE
          </button>
        </div>
      </div>
    </footer>
  );
};
