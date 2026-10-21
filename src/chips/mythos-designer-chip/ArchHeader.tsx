import React, { useState, useEffect } from 'react';
import { AppMode, MSDHeader, ThemeId } from '../../types/msd';
import { THEMES } from '../../constants/themes';
import { PillboxButton } from './PillboxButton';
import { soundEngine } from '../../utils/audio';
import { TemplatePresetDropdown } from './TemplatePresetDropdown';
import { Volume2, VolumeX, Sparkles, Sliders, ShieldCheck, Layers, Cpu, Mic, MicOff, Power, Pause, Play, RotateCw } from 'lucide-react';

interface ArchHeaderProps {
  headerData: MSDHeader;
  currentTheme: ThemeId;
  onThemeChange: (theme: ThemeId) => void;
  appMode: AppMode;
  onAppModeChange: (mode: AppMode) => void;
  onOpenThemeForge?: () => void;
  onSelectTemplate?: (templateKey: string) => void;
  currentTemplateId?: string;
  voiceActive?: boolean;
  voiceConnecting?: boolean;
  voiceMicActive?: boolean;
  voiceSpeaking?: boolean;
  onConnectVoice?: () => void;
  onToggleVoiceMic?: () => void;
  onDisconnectVoice?: () => void;
}

export const ArchHeader: React.FC<ArchHeaderProps> = ({
  headerData,
  currentTheme,
  onThemeChange,
  appMode,
  onAppModeChange,
  onOpenThemeForge,
  onSelectTemplate,
  currentTemplateId,
  voiceActive,
  voiceConnecting,
  voiceMicActive,
  voiceSpeaking: _voiceSpeaking,
  onConnectVoice,
  onToggleVoiceMic,
  onDisconnectVoice,
}) => {
  const [audioEnabled, setAudioEnabled] = useState(soundEngine.enabled);
  const [isEditorExpanded, setIsEditorExpanded] = useState<boolean>(true);
  const [localSystemTime, setLocalSystemTime] = useState<string>('');
  const [localSystemDate, setLocalSystemDate] = useState<string>('');
  const [tzMode, setTzMode] = useState<'MST' | 'LOCAL' | 'UTC'>(() => {
    return (localStorage.getItem('voxcon-tz-mode') as 'MST' | 'LOCAL' | 'UTC') || 'MST';
  });
  const [, setThemesVersion] = useState<number>(0);
  const theme = THEMES[currentTheme] || THEMES['noir-dark'];

  // Listen to custom theme registry events
  useEffect(() => {
    const handleThemeUpdate = () => {
      setThemesVersion((v) => v + 1);
    };
    window.addEventListener('mythos_theme_registered', handleThemeUpdate);
    window.addEventListener('mythos_theme_deleted', handleThemeUpdate);
    return () => {
      window.removeEventListener('mythos_theme_registered', handleThemeUpdate);
      window.removeEventListener('mythos_theme_deleted', handleThemeUpdate);
    };
  }, []);

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

  // Update local system time and date dynamically
  useEffect(() => {
    const updateTimes = () => {
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

      setLocalSystemTime(timeStr);
      setLocalSystemDate(dateStr);
    };

    updateTimes();
    const interval = setInterval(updateTimes, 1000);
    return () => clearInterval(interval);
  }, [tzMode]);

  const toggleAudio = () => {
    soundEngine.enabled = !audioEnabled;
    setAudioEnabled(!audioEnabled);
    if (!audioEnabled) {
      soundEngine.playBeep(880, 'sine', 0.1);
    }
  };

  return (
    <header className="w-full flex flex-col gap-1 select-none">
      {/* Upper Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-[#0b0e14] border-b border-[#2f3749] text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono-data text-cyan-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="font-bold tracking-wider">{headerData.authorizationCode}</span>
          </div>
          <span className="text-[#2f3749]">|</span>
          <div 
            onClick={cycleTzMode}
            className="hidden sm:flex items-center gap-2 font-mono-data text-slate-400 cursor-pointer hover:bg-slate-800/45 px-2 py-0.5 rounded border border-transparent hover:border-slate-700/60 transition-all select-none group"
            title="Click to cycle timezone (MST / Local / UTC)"
          >
            <span className="group-hover:text-slate-200">SYS-TIME:</span>
            <span className="text-yellow-400 font-bold group-hover:text-yellow-300 transition-colors">{localSystemTime}</span>
          </div>
          <span className="hidden md:inline text-[#2f3749]">|</span>
          <div className="hidden md:flex items-center gap-2 font-mono-data text-slate-400">
            <span>SYS-DATE:</span>
            <span className="text-cyan-400 font-bold">{localSystemDate}</span>
          </div>
        </div>

        {/* Mode Toggle (+ / -), Voice Live HUD & Audio Toggle */}
        <div className="flex items-center gap-2">
          {/* Persistent Live Voice Status Widget when voice is active */}
          {voiceActive && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#06141c] border border-emerald-500/50 text-[11px] font-mono-data text-emerald-400 shadow-sm animate-pulse">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-bold tracking-wider hidden sm:inline text-emerald-300">VOICE LIVE</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVoiceMic?.();
                }}
                className={`p-1 rounded cursor-pointer transition-colors ${
                  voiceMicActive
                    ? 'text-emerald-400 hover:text-emerald-200 bg-emerald-950/60 border border-emerald-700/60'
                    : 'text-amber-400 hover:text-amber-200 bg-amber-950/60 border border-amber-700/60'
                }`}
                title={voiceMicActive ? 'Mute Microphone' : 'Unmute Microphone'}
              >
                {voiceMicActive ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDisconnectVoice?.();
                }}
                className="p-1 rounded text-red-400 hover:text-red-200 hover:bg-red-950/60 border border-transparent hover:border-red-800 transition-colors cursor-pointer"
                title="Disconnect Voice Uplink"
              >
                <Power className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Show / Hide Toggle between Editor Mode and Preview Actual Theme */}
          <button
            type="button"
            onClick={() => {
              soundEngine.playToggle();
              setIsEditorExpanded(!isEditorExpanded);
            }}
            className="px-2 py-1 text-xs font-mono-data font-bold rounded-sm border flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:brightness-125"
            style={{
              backgroundColor: isEditorExpanded ? `${theme.colors.accent}15` : `${theme.colors.primary}25`,
              borderColor: isEditorExpanded ? theme.colors.accent : theme.colors.primary,
              color: isEditorExpanded ? theme.colors.accent : theme.colors.primary,
            }}
            title={
              isEditorExpanded
                ? '[-] Hide editor controls to preview actual theme'
                : '[+] Show editor controls (Editor Mode)'
            }
          >
            <span className="text-sm font-black leading-none w-3 text-center">
              {isEditorExpanded ? '−' : '+'}
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider">
              {isEditorExpanded ? 'PREVIEW THEME' : 'EDITOR MODE'}
            </span>
          </button>

          <button
            type="button"
            id="arch-header-sound-toggle-btn"
            onClick={toggleAudio}
            title={audioEnabled ? 'Mute Tactical Audio' : 'Unmute Tactical Audio'}
            className="p-1.5 rounded-sm bg-[#111111] border border-[#333333] text-slate-300 hover:text-blue-400 hover:border-blue-400 transition-colors"
          >
            {audioEnabled ? <Volume2 className="w-4 h-4 text-green-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* Voice Uplink Master & Standby Controller */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              id="arch-header-voice-control-shortcut-btn"
              onClick={() => {
                soundEngine.playToggle();
                if (voiceActive) {
                  onDisconnectVoice?.();
                } else {
                  onConnectVoice?.();
                }
              }}
              disabled={voiceConnecting}
              title={
                voiceActive
                  ? 'Terminate Voice Uplink (Disconnect Live Session)'
                  : voiceConnecting
                  ? 'Connecting Voice Uplink...'
                  : 'Initialize Voice Uplink (Connect Live Gemini Session)'
              }
              className={`p-1.5 rounded-sm border transition-colors cursor-pointer flex items-center gap-1 ${
                voiceActive
                  ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                  : voiceConnecting
                  ? 'bg-amber-950/90 border-amber-500 text-amber-300 animate-pulse'
                  : 'bg-[#111111] border-[#333333] text-slate-300 hover:text-cyan-400 hover:border-cyan-400'
              }`}
            >
              {voiceConnecting ? (
                <RotateCw className="w-4 h-4 animate-spin text-amber-400" />
              ) : voiceActive ? (
                <Mic className="w-4 h-4 text-emerald-400 animate-pulse" />
              ) : (
                <MicOff className="w-4 h-4 text-slate-400" />
              )}
              {voiceActive && <span className="text-[9px] font-mono font-bold text-emerald-300">LIVE</span>}
            </button>

            {voiceActive && (
              <button
                type="button"
                id="arch-header-voice-standby-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  soundEngine.playToggle();
                  onToggleVoiceMic?.();
                }}
                title={voiceMicActive ? 'Standby Mode (Pause Microphone)' : 'Resume Voice (Exit Standby)'}
                className={`p-1.5 rounded-sm border transition-colors cursor-pointer ${
                  voiceMicActive
                    ? 'bg-[#111111] border-emerald-700/60 text-emerald-400 hover:border-emerald-500'
                    : 'bg-amber-950/80 border-amber-600 text-amber-300 hover:bg-amber-900'
                }`}
              >
                {voiceMicActive ? <Pause className="w-4 h-4 text-amber-400" /> : <Play className="w-4 h-4 text-emerald-400 animate-pulse" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Editor Controls: Nav Elements & Switch Template Preset (Show/Hide via + and -) */}
      {isEditorExpanded && (
        <>
          {/* Header Nav Elements DIV: 100% Width */}
          <div className="w-full bg-[#070b12] p-1.5 rounded-sm border border-[#1f293d]">
            <nav className="w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
              <PillboxButton
                size="sm"
                active={appMode === 'msd-view'}
                onClick={() => onAppModeChange('msd-view')}
                color={appMode === 'msd-view' ? theme.colors.accent : theme.colors.secondary}
              >
                <Layers className="w-3.5 h-3.5 inline mr-1" />
                01. MSD DISPLAY
              </PillboxButton>

              <PillboxButton
                size="sm"
                active={appMode === 'ui-builder'}
                onClick={() => onAppModeChange('ui-builder')}
                color={appMode === 'ui-builder' ? theme.colors.accent : theme.colors.secondary}
              >
                <Sliders className="w-3.5 h-3.5 inline mr-1" />
                02. UI BUILDER
              </PillboxButton>

              <PillboxButton
                size="sm"
                active={appMode === 'token-inspector'}
                onClick={() => onAppModeChange('token-inspector')}
                color={appMode === 'token-inspector' ? theme.colors.accent : theme.colors.secondary}
              >
                <Cpu className="w-3.5 h-3.5 inline mr-1" />
                03. TOKEN LAB
              </PillboxButton>

              <PillboxButton
                size="sm"
                active={appMode === 'ai-diagnostics'}
                onClick={() => onAppModeChange('ai-diagnostics')}
                color={appMode === 'ai-diagnostics' ? theme.colors.accent : theme.colors.secondary}
              >
                <Sparkles className="w-3.5 h-3.5 inline mr-1 text-yellow-400" />
                04. AI DIAGNOSTIC
              </PillboxButton>

              <PillboxButton
                size="sm"
                active={appMode === 'voice-control'}
                onClick={() => onAppModeChange('voice-control')}
                color={appMode === 'voice-control' ? theme.colors.accent : voiceActive ? '#10b981' : theme.colors.secondary}
              >
                <Mic className={`w-3.5 h-3.5 inline mr-1 ${voiceActive ? 'text-emerald-400 animate-pulse' : 'text-emerald-400'}`} />
                05. VOICE CONTROL
                {voiceActive && (
                  <span className="ml-1 px-1 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">
                    LIVE
                  </span>
                )}
              </PillboxButton>

              <PillboxButton
                size="sm"
                onClick={() => {
                  soundEngine.playChime();
                  if (onOpenThemeForge) onOpenThemeForge();
                }}
                color={theme.colors.accent}
              >
                <Sparkles className="w-3.5 h-3.5 inline mr-1 text-amber-400 animate-pulse" />
                06. SKETCH THEME
              </PillboxButton>
            </nav>
          </div>

          {/* Positioned Under Nav: SWITCH TEMPLATE PRESET */}
          <div className="w-full flex flex-wrap items-center justify-between gap-3 px-3 py-2 rounded-sm bg-[#060a14] border border-[#1b2537] text-xs font-mono-data">
            <TemplatePresetDropdown
              currentLayoutId={currentTemplateId || 'helios-core-msd-01'}
              currentTheme={currentTheme}
              onSelectPreset={onSelectTemplate ? onSelectTemplate : onThemeChange}
              showLabel={true}
              compact={false}
            />
            <div className="flex items-center gap-2 text-slate-400 text-[11px]">
              <span className="text-slate-500 uppercase">ACTIVE THEME:</span>
              <span className="text-amber-300 font-bold">{theme.name}</span>
            </div>
          </div>
        </>
      )}

      {/* Main Curved Arch Frame Header */}
      <div className="relative w-full flex items-stretch min-h-[54px] rounded-t-xl overflow-hidden bg-[#0a0a0a] border-t-2 border-[#333333]">
        {/* Left Curved Elbow Cap */}
        <div
          className="w-24 sm:w-36 flex-shrink-0 flex items-center justify-center p-2 rounded-tl-2xl transition-colors duration-300"
          style={{ backgroundColor: theme.colors.primary }}
        >
          <div className={`font-antonio font-extrabold text-sm sm:text-base tracking-widest text-center leading-tight ${currentTheme === 'noir-dark' ? 'text-slate-200' : 'text-black'}`}>
            MYTH
            <br />
            OS
          </div>
        </div>

        {/* Arch Connector Gap Bar */}
        <div className="w-2 bg-[#000000] flex-shrink-0" />

        {/* Arch Title & Telemetry Header Bar */}
        <div
          className="flex-grow flex flex-col justify-center px-4 py-2 transition-colors duration-300 relative overflow-hidden"
          style={{
            background: `linear-gradient(90deg, ${theme.colors.secondary} 0%, ${theme.colors.bgSlate} 100%)`,
            borderBottom: `2px solid ${theme.colors.accent}`,
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="font-antonio text-base sm:text-xl md:text-2xl font-black uppercase tracking-widest text-slate-200 leading-none">
                {headerData.title}
              </h1>
                {headerData.subTitle && (
                <p className="font-mono-data text-[10px] sm:text-xs tracking-wider mt-0.5 opacity-90 text-slate-400">
                  {headerData.subTitle}
                </p>
              )}
            </div>

            <div className="hidden lg:flex items-center gap-4 font-mono-data text-xs">
              <div className="flex items-center gap-1.5 bg-[#000000]/70 px-2.5 py-1 rounded border border-[#333333]">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-slate-400">SYSTEM COHERENCE:</span>
                <span className="text-green-400 font-bold">99.98%</span>
              </div>
              <div className="flex items-center gap-1.5 bg-[#000000]/70 px-2.5 py-1 rounded border border-[#333333]">
                <span className="text-slate-400">ENTROPY:</span>
                <span className="text-yellow-400 font-bold">0.042 ρS</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Terminal Cap */}
        <div
          className={`w-12 sm:w-20 flex-shrink-0 transition-colors duration-300 flex items-center justify-center font-antonio font-bold text-xs ${currentTheme === 'noir-dark' ? 'text-slate-200' : 'text-black'}`}
          style={{ backgroundColor: theme.colors.accent }}
        >
          v1.0
        </div>
      </div>
    </header>
  );
};
