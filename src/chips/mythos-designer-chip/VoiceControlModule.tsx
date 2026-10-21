import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Radio,
  Volume2,
  CheckCircle2,
  AlertTriangle,
  Send,
  Terminal,
  Cpu,
  Power,
  Zap,
  HardDrive,
  FolderOpen,
  Network,
  Play,
  SlidersHorizontal,
  Sparkles,
  RefreshCw,
  ShieldCheck,
  Activity,
  Star,
  RotateCcw,
  GripVertical,
  Layout,
  Save,
  HelpCircle,
  MessageSquare,
} from 'lucide-react';
import { VoiceCommandModal } from './VoiceCommandModal';
import { VOXCONPACKSurface } from './VOXCONPACKSurface';
import { VoxconTranscriptionDisplay } from './VoxconTranscriptionDisplay';
import { soundEngine } from '../../utils/audio';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ThemeId } from '../../types/msd';
import { THEMES } from '../../constants/themes';
import { LiveVoiceControlHandle, VOICE_PARAMETER_PRESETS } from '../../hooks/useLiveVoiceControl';
import { VoiceParameterPreset, AudioRoutingMode } from '../../types/voice';

const SortableItem: React.FC<{ id: string; children: React.ReactNode; isLayoutMode: boolean; isFirst: boolean }> = ({ id, children, isLayoutMode, isFirst }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
    overflowAnchor: isFirst ? 'auto' : 'none' as const,
  };

  return (
    <div ref={setNodeRef} style={style} className={`relative ${isLayoutMode ? 'ring-2 ring-blue-500/30 ring-inset rounded-lg p-1 group bg-blue-500/5' : ''}`}>
      {isLayoutMode && (
        <div 
          {...attributes} 
          {...listeners}
          className="absolute -top-3 -left-3 bg-blue-600 text-white p-1.5 rounded-full z-50 cursor-grab active:cursor-grabbing shadow-lg hover:bg-blue-500 transition-colors"
          title="Drag to reorder component"
        >
          <GripVertical className="w-4 h-4" />
        </div>
      )}
      {children}
    </div>
  );
};

interface VoiceControlModuleProps {
  currentTheme: ThemeId;
  onExecuteCommand: (name: string, args: Record<string, unknown>) => void;
  activeMode: string;
  anomalySimulated: boolean;
  voiceControl: LiveVoiceControlHandle;
}

export const VoiceControlModule: React.FC<VoiceControlModuleProps> = ({
  currentTheme,
  onExecuteCommand: _onExecuteCommand,
  activeMode,
  anomalySimulated,
  voiceControl,
}) => {
  const theme = THEMES[currentTheme] || THEMES['noir-dark'];
  const [customPrompt, setCustomPrompt] = useState('');
  const [wakeWord, setWakeWord] = useState<string>(() => localStorage.getItem('mythos_wakeword') || 'Computer');
  const [isCommandRefOpen, setIsCommandRefOpen] = useState(false);
  const [workstationMode, setWorkstationMode] = useState<'surface' | 'transceiver' | 'comms'>('transceiver');

  // Layout Persistence & Editor State
  const [layout, setLayout] = useState<string[]>(() => {
    const saved = localStorage.getItem('voxcon-layout');
    // Order: Parameter Matrix above Uplink Bar as requested by operator
    return saved ? JSON.parse(saved) : ['parameter-matrix', 'uplink-bar', 'error-display', 'main-grid', 'host-control'];
  });
  const [isLayoutMode, setIsLayoutMode] = useState(false);

  useEffect(() => {
    localStorage.setItem('voxcon-layout', JSON.stringify(layout));
  }, [layout]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setLayout((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        const updated = arrayMove(items, oldIndex, newIndex);
        try {
          localStorage.setItem('voxcon-layout', JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });
    }
  };

  const resetLayout = () => {
    setLayout(['parameter-matrix', 'uplink-bar', 'error-display', 'main-grid', 'host-control']);
  };

  const {
    isConnected,
    isConnecting,
    isMicActive,
    isSpeaking,
    isUserSpeaking,
    micLevel,
    transcripts,
    executedOrders,
    errorMessage,
    selectedVoice,
    selectedPersona,
    temperature,
    speechRate,
    speechPitch,
    selectedWindowsVoice,
    routingMode,
    activeAcousticRoute,
    geminiVoices,
    personaProfiles,
    windowsVoices,
    isTtsFallbackActive,
    fallbackVoiceName,
    isPttMode,
    isPttPressed,
    setIsPttMode,
    handlePttPress,
    handlePttRelease,
    changeVoice,
    updatePersona,
    updateTemperature,
    updateSpeechRate,
    updateSpeechPitch,
    updateWindowsVoice,
    updateRoutingMode,
    applyPreset,
    defaultVoicePresetId,
    setDefaultVoicePreset,
    resetToDefaultPreset,
    auditionCombination,
    auditAcousticRouting,
    connect,
    disconnect,
    toggleMic,
    sendOrderText,
    testWindowsVoice,
  } = voiceControl;

  // Command Listener for AI-driven layout reordering
  useEffect(() => {
    const lastOrder = executedOrders[0];
    if (lastOrder && lastOrder.name === 'updateVoxconLayout') {
      const newLayout = lastOrder.args.newLayout as string[];
      if (Array.isArray(newLayout) && newLayout.length > 0) {
        // Validate IDs
        const validIds = ['parameter-matrix', 'uplink-bar', 'error-display', 'main-grid', 'host-control'];
        const filteredLayout = newLayout.filter(id => validIds.includes(id));
        if (filteredLayout.length > 0) {
          setLayout(filteredLayout);
        }
      }
    }
  }, [executedOrders]);

  const handleSendCustomPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPrompt.trim()) return;
    sendOrderText(customPrompt.trim());
    setCustomPrompt('');
  };

  // Quick Tactical Order Presets
  const quickOrders = [
    { label: 'Default: Noir > MSD > Extrapolated', prompt: `${wakeWord}, set default startup configuration: Noir Monochromatic theme, MSD Display mode, and Extrapolated Dashboard.` },
    { label: 'Voice: Zephyr (Default Voice)', prompt: `${wakeWord}, switch voice persona to Zephyr.` },
    { label: 'Model: Charon (Tactical/Command)', prompt: `${wakeWord}, acknowledge active Charon Model Parameters and Tactical Command protocol.` },
    { label: 'Extrapolated Dashboard', prompt: `${wakeWord}, switch dashboard tab to extrapolated dashboard.` },
    { label: 'Switch to MSD View', prompt: `${wakeWord}, switch mode to MSD view.` },
    { label: 'Load Image from Z: Drive', prompt: `${wakeWord}, load image from the Z drive folder Z:/missions/sector4/image.png` },
    { label: 'Load Host Schematic', prompt: `${wakeWord}, load image from /scans/core_lattice.png` },
    { label: 'Run Python Telemetry', prompt: `${wakeWord}, execute Python script ingest_telemetry.py` },
    { label: 'Query Network Daemon', prompt: `${wakeWord}, query network cluster node 127.0.0.1 on port 8000.` },
    { label: 'Switch to AI Diagnostics', prompt: `${wakeWord}, switch mode to AI diagnostics.` },
    { label: 'Switch to UI Builder', prompt: `${wakeWord}, switch mode to UI builder.` },
    { label: 'Theme: Noir Dark', prompt: 'Switch theme to noir-dark.' },
    { label: 'Theme: Aegis Amber', prompt: 'Switch theme to aegis-amber.' },
    { label: 'Theme: Quantum Cyan', prompt: 'Switch theme to quantum-cyan.' },
    { label: 'Trigger Anomaly Surge', prompt: 'Trigger emergency anomaly surge and test alert systems.' },
    { label: 'Reset System to Nominal', prompt: 'Clear all alarms and reset anomaly simulation to nominal.' },
    { label: 'Schematic: Neural Lattice', prompt: 'Select the neural lattice schematic.' },
    { label: 'Schematic: Quantum Core', prompt: 'Select the quantum core schematic.' },
    { label: 'Inspect Plasma Subsystem', prompt: 'Focus on and inspect the plasma subsystem node.' },
    { label: 'Recalibrate Telemetry', prompt: 'Recalibrate system metrics and purge microstate entropy.' },
    { label: 'Voice: Charon (Tactical)', prompt: `${wakeWord}, switch voice persona to Charon.` },
    { label: 'Voice: Kore (Articulate)', prompt: `${wakeWord}, switch voice persona to Kore.` },
  ];

  // Temperature configuration options
  const temperatureOptions = [
    { value: 0.05, label: '0.05 // Combat Strict (Deterministic)' },
    { value: 0.1, label: '0.10 // Combat Intercept (Low Variance)' },
    { value: 0.2, label: '0.20 // Tactical Command (BLUF Protocol) [DEFAULT]' },
    { value: 0.3, label: '0.30 // Disciplined Naval Operations' },
    { value: 0.35, label: '0.35 // Systems Diagnostic (Analytical)' },
    { value: 0.5, label: '0.50 // Telemetry Stream (Dynamic)' },
    { value: 0.7, label: '0.70 // Exploratory / Advisory' },
  ];

  // Speech Cadence (Rate) options
  const speechRateOptions = [
    { value: 0.85, label: '0.85x // Deliberate Tactical' },
    { value: 0.95, label: '0.95x // Measured Briefing' },
    { value: 1.0, label: '1.00x // Standard Baseline' },
    { value: 1.02, label: '1.02x // Tactical Speed [DEFAULT]' },
    { value: 1.1, label: '1.10x // Fleet Relay' },
    { value: 1.15, label: '1.15x // Rapid Intercept' },
    { value: 1.25, label: '1.25x // Emergency Evac Alert' },
  ];

  // Speech Pitch options
  const speechPitchOptions = [
    { value: 0.85, label: '0.85 // Deep Sub-Harmonic' },
    { value: 0.92, label: '0.92 // Low Command Register' },
    { value: 0.98, label: '0.98 // Tactical Register [DEFAULT]' },
    { value: 1.0, label: '1.00 // Standard Center Pitch' },
    { value: 1.08, label: '1.08 // Crisp High-Frequency' },
    { value: 1.15, label: '1.15 // High Alert Clarification' },
  ];

  // Find active preset if matched
  const activePreset = VOICE_PARAMETER_PRESETS.find(
    (p: VoiceParameterPreset) =>
      p.geminiVoice === selectedVoice &&
      p.persona === selectedPersona &&
      Math.abs(p.temperature - temperature) < 0.05
  );

  const componentMap: Record<string, React.ReactNode> = {
    'uplink-bar': (
      <div
        id="voxconpack-transceiver-panel"
        className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-md border"
        style={{
          backgroundColor: theme.colors.bgSlate,
          borderColor: theme.colors.border,
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded border flex items-center justify-center transition-colors ${
              isConnected
                ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-400'
                : 'bg-slate-900 border-slate-700 text-slate-500'
            }`}
          >
            <Radio className={`w-5 h-5 ${isConnected ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-200 tracking-wider">
                VOXCONPACK TRANSCEIVER
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-cyan-950/40 text-cyan-400 border border-cyan-700/60 font-mono-data font-bold">
                VOXCONPACK v0.2
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                gemini-3.1-flash-live-preview
              </span>
              {isTtsFallbackActive ? (
                <span
                  id="tts-fallback-badge"
                  className="text-xs px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-600/70 font-mono-data font-bold flex items-center gap-1 animate-pulse"
                  title="Gemini Live audio unavailable; operating on default Windows Read Aloud voice"
                >
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  TTS FALLBACK: WINDOWS READ ALOUD ({fallbackVoiceName})
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-950/30 text-emerald-400 border border-emerald-800/50 font-mono-data">
                  TTS: GEMINI LIVE AUDIO
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
              <span>STATE:</span>
              {isConnecting && <span className="text-yellow-400 animate-pulse">CONNECTING...</span>}
              {!isConnected && !isConnecting && <span className="text-slate-500">STANDBY / OFFLINE</span>}
              {isConnected && (
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                  ONLINE • LIVE AUDIO UPLINK
                </span>
              )}
              {isSpeaking && (
                <span className="text-blue-400 flex items-center gap-1 font-semibold ml-2">
                  <Volume2 className="w-3.5 h-3.5 animate-bounce" /> {isTtsFallbackActive ? 'WINDOWS READ ALOUD VOCALIZING' : 'AI VOCALIZING'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Command Reference & Macro Orchestration Action Button */}
          <button
            type="button"
            id="voxcon-commands-ref-btn"
            onClick={() => setIsCommandRefOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider bg-slate-900 border border-slate-700 text-cyan-400 hover:text-cyan-200 hover:border-cyan-500 transition-all cursor-pointer shadow-xs"
            title="Open Voice Command Reference Guide, Macro Orchestration & CRUD Database"
          >
            <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span>COMMANDS</span>
          </button>

          <button
            type="button"
            id="voxcon-layout-toggle-btn"
            onClick={() => {
              if (isLayoutMode) {
                // Save layout on exit to preserve changes
                try {
                  localStorage.setItem('voxcon-layout', JSON.stringify(layout));
                } catch {
                  // ignore
                }
                setIsLayoutMode(false);
              } else {
                setIsLayoutMode(true);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-all border ${
              isLayoutMode 
                ? 'bg-blue-600 border-blue-400 text-white' 
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Layout Editor Mode (Save on Exit)"
          >
            <Layout className="w-3.5 h-3.5" />
            <span>{isLayoutMode ? 'EXIT LAYOUT' : 'LAYOUT'}</span>
          </button>

          {isLayoutMode && (
            <button
              type="button"
              onClick={resetLayout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider bg-slate-900 border border-slate-700 text-slate-400 hover:text-slate-200 transition-all"
              title="Reset layout to default operational configuration"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>RESET</span>
            </button>
          )}

          <button
            type="button"
            id="audition-combination-btn"
            onClick={() => auditionCombination()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-700/60 text-cyan-300 hover:text-cyan-100 transition-all shadow-xs"
            title="Audition active voice parameter combination via acoustic speech test"
          >
            <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>AUDITION COMBO</span>
          </button>

          <button
            type="button"
            id="test-windows-voice-btn"
            onClick={() => testWindowsVoice()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold uppercase tracking-wider bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 transition-all"
            title={`Test Default Windows Read Aloud Voice (${fallbackVoiceName})`}
          >
            <Play className="w-3 h-3 text-slate-400" />
            <span>TEST OS VOICE</span>
          </button>

          <button
            type="button"
            id="audit-routing-logic-btn"
            onClick={() => auditAcousticRouting()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold uppercase tracking-wider bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-700/60 hover:border-emerald-500 text-emerald-300 transition-all shadow-xs"
            title="Execute live acoustic routing audit between Gemini Live and Windows SAPI fallback"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>AUDIT ROUTING</span>
          </button>

          <button
            type="button"
            id="transcribe-audio-btn"
            onClick={voiceControl.isTranscribing ? voiceControl.stopTranscribeRecording : voiceControl.startTranscribeRecording}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-all border ${
              voiceControl.isTranscribing
                ? 'bg-amber-950/60 border-amber-500 text-amber-300 animate-pulse'
                : 'bg-purple-950/40 hover:bg-purple-900/50 border-purple-700/60 hover:border-purple-500 text-purple-300'
            }`}
            title="Transcribe audio from microphone using gemini-3.5-transcribe"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{voiceControl.isTranscribing ? 'STOP TRANSCRIPTION' : 'TRANSCRIBE AUDIO'}</span>
          </button>

          {isConnected ? (
            <>
              <button
                type="button"
                id="toggle-mic-btn"
                onClick={() => toggleMic()}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-all border ${
                  isMicActive
                    ? 'bg-emerald-900/30 border-emerald-600 text-emerald-300 hover:bg-emerald-900/50'
                    : 'bg-red-900/30 border-red-700 text-red-300 hover:bg-red-900/50'
                }`}
                title={isMicActive ? 'Mute Microphone' : 'Unmute Microphone'}
              >
                {isMicActive ? (
                  <>
                    <Mic className="w-4 h-4 text-emerald-400" />
                    <span>MIC LIVE (16kHz)</span>
                  </>
                ) : (
                  <>
                    <MicOff className="w-4 h-4 text-red-400" />
                    <span>MIC MUTED</span>
                  </>
                )}
              </button>

              <button
                type="button"
                id="disconnect-voice-btn"
                onClick={() => disconnect()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 transition-all"
              >
                <Power className="w-3.5 h-3.5 text-slate-400" />
                <span>TERMINATE</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              id="connect-voice-btn"
              onClick={() => connect()}
              disabled={isConnecting}
              className="flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold uppercase tracking-wider bg-blue-700 hover:bg-blue-600 text-slate-100 border border-blue-500 shadow transition-all disabled:opacity-50"
            >
              <Mic className="w-4 h-4" />
              <span>{isConnecting ? 'ESTABLISHING UPLINK...' : 'INITIALIZE VOICE UPLINK'}</span>
            </button>
          )}
        </div>
      </div>
    ),
    'parameter-matrix': (
      <div
        id="voice-parameters-matrix"
        className="p-3.5 rounded-md border flex flex-col gap-3"
        style={{
          backgroundColor: theme.colors.bgSlate,
          borderColor: theme.colors.border,
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-xs uppercase tracking-wider text-slate-200">
              VOICE PARAMETER MATRIX // COMBINATION TUNER
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
              {geminiVoices.length} GEMINI VOICES POPULATED
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono-data">
            <span className="text-slate-400">ACTIVE COMBO:</span>
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-emerald-400 font-bold">
              {selectedVoice} • {selectedPersona} • T:{temperature.toFixed(2)} • {speechRate.toFixed(2)}x • P:{speechPitch.toFixed(2)}
            </span>
            {activePreset && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px] font-bold">
                  {activePreset.badge}
                </span>
                {defaultVoicePresetId === activePreset.id ? (
                  <span
                    id="active-voice-is-default-badge"
                    className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-600/80 text-[10px] font-bold flex items-center gap-1 shadow-xs select-none"
                    title="This preset is configured as the startup default voice"
                  >
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    DEFAULT PRESET
                  </span>
                ) : (
                  <button
                    type="button"
                    id="set-active-voice-default-btn"
                    onClick={() => setDefaultVoicePreset(activePreset.id)}
                    className="px-2 py-0.5 rounded bg-amber-950/50 hover:bg-amber-900/80 border border-amber-700/70 hover:border-amber-500 text-amber-300 hover:text-amber-100 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                    title={`Designate "${activePreset.title}" as default startup voice`}
                  >
                    <Star className="w-3 h-3 text-amber-400" />
                    SET AS DEFAULT
                  </button>
                )}
              </div>
            )}
            <button
              type="button"
              id="revert-to-default-voice-btn"
              onClick={resetToDefaultPreset}
              className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500 text-slate-400 hover:text-cyan-300 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ml-auto sm:ml-0"
              title="Reset parameters to the saved default voice preset"
            >
              <RotateCcw className="w-2.5 h-2.5 text-cyan-400" />
              LOAD DEFAULT
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2.5">
          <div className="flex flex-col gap-1 bg-slate-900/90 border border-slate-700/80 p-2 rounded">
            <label htmlFor="gemini-voice-select" className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider flex items-center justify-between">
              <span>1. GEMINI VOICE</span>
              <span className="text-slate-400">DYNAMIC ({geminiVoices.length})</span>
            </label>
            <select
              id="gemini-voice-select"
              value={selectedVoice}
              onChange={(e) => changeVoice(e.target.value)}
              className="w-full bg-slate-950 text-slate-200 border border-slate-700 rounded px-2 py-1.5 text-xs font-mono font-medium focus:outline-hidden focus:border-cyan-500 cursor-pointer"
              title="Select Gemini Live voice persona (dynamically populated from API)"
            >
              {geminiVoices.map((v) => (
                <option key={v.name} value={v.name} className="bg-slate-900 text-slate-200">
                  {v.name} ({v.gender} • {v.category}) {v.default ? '[DEFAULT]' : ''}
                </option>
              ))}
            </select>
            <span className="text-[9px] text-slate-400 truncate">
              {geminiVoices.find((v) => v.name === selectedVoice)?.description || 'Gemini 3.1 Flash Live voice model'}
            </span>
          </div>

          <div className="flex flex-col gap-1 bg-slate-900/90 border border-slate-700/80 p-2 rounded">
            <label htmlFor="model-persona-select" className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center justify-between">
              <span>2. MODEL PERSONA</span>
              <span className="text-slate-400">MIL-STD</span>
            </label>
            <select
              id="model-persona-select"
              value={selectedPersona}
              onChange={(e) => updatePersona(e.target.value)}
              className="w-full bg-slate-950 text-slate-200 border border-slate-700 rounded px-2 py-1.5 text-xs font-mono font-medium focus:outline-hidden focus:border-emerald-500 cursor-pointer"
              title="Select system instruction protocol persona profile"
            >
              {personaProfiles.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200">
                  {p.name}
                </option>
              ))}
            </select>
            <span className="text-[9px] text-slate-400 truncate">
              {personaProfiles.find((p) => p.id === selectedPersona)?.description || 'Active operational persona'}
            </span>
          </div>

          <div className="flex flex-col gap-1 bg-slate-900/90 border border-slate-700/80 p-2 rounded">
            <label htmlFor="voice-temperature-select" className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider flex items-center justify-between">
              <span>3. TEMPERATURE</span>
              <span className="text-slate-400">T: {temperature.toFixed(2)}</span>
            </label>
            <select
              id="voice-temperature-select"
              value={temperature}
              onChange={(e) => updateTemperature(parseFloat(e.target.value))}
              className="w-full bg-slate-950 text-slate-200 border border-slate-700 rounded px-2 py-1.5 text-xs font-mono font-medium focus:outline-hidden focus:border-amber-500 cursor-pointer"
              title="Select generation temperature (0.05 deterministic to 0.70 creative)"
            >
              {temperatureOptions.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-200">
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="text-[9px] text-slate-400 truncate">
              Lower values enforce deterministic DoD BLUF command precision.
            </span>
          </div>

          <div className="flex flex-col gap-1 bg-slate-900/90 border border-slate-700/80 p-2 rounded">
            <label htmlFor="speech-rate-select" className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider flex items-center justify-between">
              <span>4. CADENCE (RATE)</span>
              <span className="text-slate-400">{speechRate.toFixed(2)}x</span>
            </label>
            <select
              id="speech-rate-select"
              value={speechRate}
              onChange={(e) => updateSpeechRate(parseFloat(e.target.value))}
              className="w-full bg-slate-950 text-slate-200 border border-slate-700 rounded px-2 py-1.5 text-xs font-mono font-medium focus:outline-hidden focus:border-blue-500 cursor-pointer"
              title="Select vocal playback speed rate"
            >
              {speechRateOptions.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-200">
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="text-[9px] text-slate-400 truncate">
              Acoustic speech rate for tactical status announcements.
            </span>
          </div>

          <div className="flex flex-col gap-1 bg-slate-900/90 border border-slate-700/80 p-2 rounded">
            <label htmlFor="speech-pitch-select" className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider flex items-center justify-between">
              <span>5. VOCAL PITCH</span>
              <span className="text-slate-400">{speechPitch.toFixed(2)}</span>
            </label>
            <select
              id="speech-pitch-select"
              value={speechPitch}
              onChange={(e) => updateSpeechPitch(parseFloat(e.target.value))}
              className="w-full bg-slate-950 text-slate-200 border border-slate-700 rounded px-2 py-1.5 text-xs font-mono font-medium focus:outline-hidden focus:border-purple-500 cursor-pointer"
              title="Select vocal acoustic pitch modifier"
            >
              {speechPitchOptions.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-200">
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="text-[9px] text-slate-400 truncate">
              Controls fundamental acoustic vocal frequency register.
            </span>
          </div>

          <div className="flex flex-col gap-1 bg-slate-900/90 border border-slate-700/80 p-2 rounded">
            <label htmlFor="windows-voice-select" className="text-[10px] font-semibold text-amber-300 uppercase tracking-wider flex items-center justify-between">
              <span>6. WINDOWS SAPI VOICE</span>
              <span className="text-slate-400">OS ({windowsVoices.length})</span>
            </label>
            <select
              id="windows-voice-select"
              value={selectedWindowsVoice}
              onChange={(e) => updateWindowsVoice(e.target.value)}
              className="w-full bg-slate-950 text-slate-200 border border-slate-700 rounded px-2 py-1.5 text-xs font-mono font-medium focus:outline-hidden focus:border-amber-400 cursor-pointer"
              title="Explicitly select an installed Windows SpeechSynthesis voice or use auto-match"
            >
              <option value="" className="bg-slate-900 text-amber-300">
                [Auto: Heuristic Match for {selectedVoice}]
              </option>
              {windowsVoices.map((v) => (
                <option key={v.name} value={v.name} className="bg-slate-900 text-slate-200">
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
            <span className="text-[9px] text-slate-400 truncate" title={`Active Fallback Voice: ${fallbackVoiceName}`}>
              Active: <strong className="text-slate-200">{fallbackVoiceName}</strong>
            </span>
          </div>

          <div className="flex flex-col gap-1 bg-slate-900/90 border border-slate-700/80 p-2 rounded">
            <label htmlFor="voice-wakeword-input" className="text-[10px] font-semibold text-fuchsia-400 uppercase tracking-wider flex items-center justify-between">
              <span>7. SYSTEM WAKE-WORD</span>
              <span className="text-fuchsia-500 font-mono-data font-bold">ACTIVE</span>
            </label>
            <input
              id="voice-wakeword-input"
              type="text"
              value={wakeWord}
              onChange={(e) => {
                const val = e.target.value || '';
                setWakeWord(val);
                localStorage.setItem('mythos_wakeword', val);
              }}
              placeholder="e.g., Computer, VOXCON"
              className="w-full bg-slate-950 text-slate-200 border border-slate-700 rounded px-2 py-1 text-xs font-mono font-medium focus:outline-hidden focus:border-fuchsia-400 cursor-text"
            />
            <span className="text-[9px] text-slate-400 truncate">
              Custom voice activation keyword.
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>ONE-CLICK PARAMETER COMBINATION PRESETS</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 hidden md:inline">
                BOOT DEFAULT: <strong className="text-amber-300">{VOICE_PARAMETER_PRESETS.find((p) => p.id === defaultVoicePresetId)?.title || 'Tactical Baseline'}</strong>
              </span>
              <span className="text-[10px] text-slate-400">SELECT TO RECONFIGURE & AUDIT</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5">
            {VOICE_PARAMETER_PRESETS.map((preset: VoiceParameterPreset) => {
              const isCurrent = activePreset?.id === preset.id;
              const isDefault = defaultVoicePresetId === preset.id;
              return (
                <div
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  className={`group relative px-2 py-1.5 rounded text-left flex flex-col justify-between transition-all border cursor-pointer ${
                    isCurrent
                      ? 'bg-cyan-950/70 border-cyan-500 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                      : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 hover:border-slate-600 text-slate-300'
                  }`}
                  title={`${preset.title}: ${preset.description}`}
                >
                  <div className="flex items-center justify-between w-full gap-1">
                    <span className="text-[10px] font-bold truncate">{preset.geminiVoice}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {isDefault ? (
                        <span
                          className="text-[8px] px-1 py-0.2 rounded bg-amber-950/90 text-amber-300 border border-amber-600 font-bold flex items-center gap-0.5 shadow-xs"
                          title="Current default startup preset"
                        >
                          <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                          DEF
                        </span>
                      ) : (
                        <button
                          type="button"
                          id={`set-default-voice-${preset.id}-btn`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDefaultVoicePreset(preset.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-amber-300 hover:bg-amber-950/60 transition-all"
                          title={`Set "${preset.title}" as default startup voice preset`}
                        >
                          <Star className="w-3 h-3 text-amber-400/70 hover:text-amber-300 hover:fill-amber-400" />
                        </button>
                      )}
                      <span className="text-[8px] px-1 rounded bg-slate-950/80 text-slate-400 border border-slate-800">
                        T:{preset.temperature}
                      </span>
                    </div>
                  </div>
                  <span className="text-[9px] text-slate-400 truncate mt-0.5">{preset.persona}</span>
                  <div className="flex items-center justify-between text-[8px] text-slate-400 mt-1 pt-0.5 border-t border-slate-800/80">
                    <span>{preset.speechRate}x</span>
                    <span className="text-cyan-400 font-bold">{preset.badge.split(' ')[0]}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div
          id="acoustic-routing-section"
          className="pt-2 border-t border-slate-800 flex flex-col gap-2"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-400 uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>ACOUSTIC ROUTING ARCHITECTURE // GEMINI LIVE ↔ WINDOWS SAPI</span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px]">
              <span className="text-slate-400">ROUTE CIRCUIT:</span>
              <span className={`px-2 py-0.5 rounded font-bold border ${
                activeAcousticRoute === 'gemini'
                  ? 'bg-blue-950/80 border-blue-600 text-blue-300 animate-pulse'
                  : activeAcousticRoute === 'sapi'
                  ? 'bg-amber-950/80 border-amber-600 text-amber-300 animate-pulse'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}>
                {activeAcousticRoute === 'gemini' ? '● GEMINI LIVE 24kHz' : activeAcousticRoute === 'sapi' ? '● WINDOWS SAPI SYNTHESIS' : '○ STANDBY // IDLE'}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-800 text-emerald-300 font-bold">
                MUTUAL CANCELLATION ARMED
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Transmission Protocol</span>
            <div className="flex gap-1">
              <button 
                type="button"
                onClick={() => setIsPttMode(false)}
                className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-all ${!isPttMode ? 'bg-blue-600 text-white shadow-[0_0_8px_rgba(37,99,235,0.4)]' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}
              >
                Full Duplex (VOX)
              </button>
              <button 
                type="button"
                onClick={() => setIsPttMode(true)}
                className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-all ${isPttMode ? 'bg-amber-600 text-white shadow-[0_0_8px_rgba(217,119,6,0.4)]' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}
              >
                Half Duplex (PTT)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <button
              type="button"
              id="routing-mode-auto-btn"
              onClick={() => updateRoutingMode('auto')}
              className={`p-2 rounded text-left border transition-all flex flex-col justify-between ${
                routingMode === 'auto'
                  ? 'bg-emerald-950/40 border-emerald-500 text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                  : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] font-bold">1. AUTO (DUAL ENGINE)</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                  routingMode === 'auto' ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-800 text-slate-400'
                }`}>
                  RECOMMENDED
                </span>
              </div>
              <p className="text-[9px] text-slate-400 mt-1">
                Gemini 24kHz PCM primary audio. Seamlessly engages Windows Read Aloud upon 750ms timeout or socket latency.
              </p>
            </button>

            <button
              type="button"
              id="routing-mode-gemini-btn"
              onClick={() => updateRoutingMode('gemini-only')}
              className={`p-2 rounded text-left border transition-all flex flex-col justify-between ${
                routingMode === 'gemini-only'
                  ? 'bg-blue-950/40 border-blue-500 text-blue-200 shadow-[0_0_10px_rgba(59,130,246,0.15)]'
                  : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] font-bold">2. GEMINI LIVE ONLY</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                  routingMode === 'gemini-only' ? 'bg-blue-800 text-blue-100' : 'bg-slate-800 text-slate-400'
                }`}>
                  CLOUD ONLY
                </span>
              </div>
              <p className="text-[9px] text-slate-400 mt-1">
                Strictly streams Gemini cloud neural audio. Suppresses Windows SAPI fallback to prevent local synthetic speech.
              </p>
            </button>

            <button
              type="button"
              id="routing-mode-sapi-btn"
              onClick={() => updateRoutingMode('sapi-only')}
              className={`p-2 rounded text-left border transition-all flex flex-col justify-between ${
                routingMode === 'sapi-only'
                  ? 'bg-amber-950/40 border-amber-500 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.15)]'
                  : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] font-bold">3. WINDOWS SAPI ONLY</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                  routingMode === 'sapi-only' ? 'bg-amber-800 text-amber-100' : 'bg-slate-800 text-slate-400'
                }`}>
                  OFFLINE / ZERO-NET
                </span>
              </div>
              <p className="text-[9px] text-slate-400 mt-1">
                Directs all speech output through local OS SpeechSynthesis ({fallbackVoiceName}). Zero network audio latency.
              </p>
            </button>
          </div>
        </div>
      </div>
    ),
    'error-display': errorMessage ? (
      <div className="p-3 bg-red-950/30 border border-red-800/80 rounded text-xs text-red-300 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
        <div className="flex-grow">
          <span className="font-semibold">Transceiver Alert:</span> {errorMessage}
        </div>
      </div>
    ) : null,
    'main-grid': (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-grow">
        <div className="lg:col-span-5 flex flex-col gap-3">
          <div
            className="p-4 rounded-md border flex flex-col items-center justify-center relative overflow-hidden"
            style={{
              backgroundColor: theme.colors.bgSlate,
              borderColor: theme.colors.border,
            }}
          >
            <div className="relative my-4 flex items-center justify-center">
              <div
                className={`absolute w-36 h-36 rounded-full transition-all duration-700 ${
                  isSpeaking ? 'bg-emerald-500/10 scale-110 opacity-100' : 'opacity-0 scale-100'
                }`}
              />
              <div
                className={`absolute w-36 h-36 rounded-full transition-all duration-300 ${
                  isPttPressed && isMicActive ? 'bg-blue-500/20 scale-125 opacity-100' : 'opacity-0 scale-100'
                }`}
              />
              <div
                className={`absolute w-36 h-36 rounded-full transition-all duration-700 ${
                  !isPttMode && isUserSpeaking && isMicActive ? 'bg-blue-500/10 scale-110 opacity-100' : 'opacity-0 scale-100'
                }`}
              />

              <div
                className={`w-28 h-28 rounded-full border flex items-center justify-center transition-all duration-200 z-10 ${
                  isSpeaking
                    ? 'border-emerald-500 bg-emerald-950/20 shadow-[0_0_25px_rgba(16,185,129,0.3)]'
                    : isPttPressed && isMicActive
                    ? 'border-blue-400 bg-blue-900/30 shadow-[0_0_30px_rgba(59,130,246,0.4)] scale-105'
                    : isConnected && isMicActive
                    ? 'border-blue-500/80 bg-blue-950/20 shadow-[0_0_20px_rgba(59,130,246,0.2)]'
                    : 'border-slate-800 bg-slate-900/60'
                }`}
                style={{
                  transform: `scale(${1 + (isConnected && isMicActive ? micLevel * 0.25 : 0)})`,
                }}
              >
                <div
                  className={`w-20 h-20 rounded-full border flex items-center justify-center transition-all duration-300 ${
                    isSpeaking
                      ? 'border-emerald-400 bg-emerald-900/40'
                      : isPttPressed && isMicActive
                      ? 'border-blue-300 bg-blue-800/50'
                      : isUserSpeaking && isMicActive
                      ? 'border-blue-400 bg-blue-900/40'
                      : isConnected && isMicActive
                      ? 'border-blue-400/30 bg-blue-900/10'
                      : 'border-slate-700/50 bg-slate-800/40'
                  }`}
                >
                  {isMicActive ? (
                    <Mic className={`w-8 h-8 transition-colors ${isPttPressed || isUserSpeaking ? 'text-blue-400' : 'text-blue-400/60'}`} />
                  ) : (
                    <MicOff className="w-8 h-8 text-slate-600" />
                  )}
                </div>
              </div>

              <div className="absolute inset-0 flex items-center justify-between pointer-events-none px-1">
                <div className="flex flex-col gap-1">
                  {[0.8, 0.6, 0.4, 0.2].map((thresh, idx) => (
                    <div
                      key={`l-${idx}`}
                      className={`w-1.5 h-3 rounded-xs transition-colors duration-75 ${
                        micLevel >= thresh ? 'bg-blue-400' : 'bg-slate-800'
                      }`}
                    />
                  ))}
                </div>
                <div className="flex flex-col gap-1">
                  {[0.8, 0.6, 0.4, 0.2].map((thresh, idx) => (
                    <div
                      key={`r-${idx}`}
                      className={`w-1.5 h-3 rounded-xs transition-colors duration-75 ${
                        micLevel >= thresh ? 'bg-blue-400' : 'bg-slate-800'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-6 mb-2">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-3 h-3 rounded-full transition-all duration-300 ${isUserSpeaking && isMicActive ? 'bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.8)] scale-125' : 'bg-slate-800 scale-100'}`} />
                  <span className={`text-[10px] font-bold tracking-tighter uppercase ${isUserSpeaking && isMicActive ? 'text-blue-400' : 'text-slate-600'}`}>Operator</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-3 h-3 rounded-full transition-all duration-300 ${isSpeaking ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)] scale-125' : 'bg-slate-800 scale-100'}`} />
                  <span className={`text-[10px] font-bold tracking-tighter uppercase ${isSpeaking ? 'text-emerald-400' : 'text-slate-600'}`}>Agent</span>
                </div>
              </div>

              <div className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
                {isSpeaking
                  ? isTtsFallbackActive
                    ? `WINDOWS READ ALOUD ACTIVE (${fallbackVoiceName})`
                    : 'SYNTHESIZING VOCAL RESPONSE'
                  : isPttPressed
                  ? 'TRANSMITTING VOICE ORDERS...'
                  : !isPttMode && isUserSpeaking && isMicActive
                  ? 'OPERATOR VOCALIZING...'
                  : isConnected && isMicActive
                  ? isPttMode ? 'HOLD PTT TO TRANSMIT ORDERS' : 'AWAITING OPERATOR VOICE ORDERS'
                  : isConnected
                  ? 'MICROPHONE MUTED (TEXT ORDERS ACTIVE)'
                  : 'INITIALIZE TO BEGIN VOICE CONTROL'}
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {isTtsFallbackActive
                  ? `Gemini AI live audio is bypassed; speech synthesis is routed to default Windows Read Aloud (${fallbackVoiceName}).`
                  : isPttMode 
                  ? 'Walkie-Talkie Protocol engaged. Hold the PTT trigger to transmit tactical directives.'
                  : 'Speak commands naturally. The AI recognizes directives, triggers system tools, and confirms execution verbally.'}
              </p>
            </div>

            {isConnected && isMicActive && isPttMode && (
              <div className="mt-6 w-full max-w-[200px]">
                <button
                  onMouseDown={handlePttPress}
                  onMouseUp={handlePttRelease}
                  onMouseLeave={handlePttRelease}
                  onTouchStart={(e) => { e.preventDefault(); handlePttPress(); }}
                  onTouchEnd={(e) => { e.preventDefault(); handlePttRelease(); }}
                  className={`w-full py-4 rounded-lg border-2 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 select-none ${
                    isPttPressed 
                      ? 'bg-blue-600/40 border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.5)]' 
                      : 'bg-slate-800/40 border-slate-700 hover:border-slate-500 hover:bg-slate-800/60'
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full mb-1 ${isPttPressed ? 'bg-red-500 animate-pulse' : 'bg-slate-600'}`} />
                  <span className={`text-sm font-black tracking-widest ${isPttPressed ? 'text-white' : 'text-slate-400'}`}>
                    HOLD TO TALK
                  </span>
                  <span className="text-[9px] text-slate-500 uppercase font-bold">Encrypted Uplink</span>
                </button>
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-2 mt-4 pt-3 border-t border-slate-800 w-full text-xs">
              <span className="px-2 py-1 rounded bg-slate-900 text-slate-400 border border-slate-800">
                ACTIVE VIEW: <strong className="text-slate-200">{activeMode}</strong>
              </span>
              <span className="px-2 py-1 rounded bg-slate-900 text-slate-400 border border-slate-800">
                THEME: <strong className="text-slate-200">{currentTheme}</strong>
              </span>
              <span
                className={`px-2 py-1 rounded border ${
                  anomalySimulated
                    ? 'bg-red-950/30 text-red-400 border-red-800'
                    : 'bg-emerald-950/20 text-emerald-400 border-emerald-900'
                }`}
              >
                STATUS: <strong>{anomalySimulated ? 'SURGE ANOMALY' : 'NOMINAL'}</strong>
              </span>
            </div>
          </div>

          <div
            className="p-3 rounded-md border flex flex-col gap-2 flex-grow"
            style={{
              backgroundColor: theme.colors.bgSlate,
              borderColor: theme.colors.border,
            }}
          >
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider pb-1 border-b border-slate-800">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-yellow-400" />
                <span>TACTICAL ORDER PRESETS</span>
              </div>
              <span className="text-[10px] text-slate-400">CLICK TO DISPATCH</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 overflow-y-auto max-h-56 pr-1">
              {quickOrders.map((order, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    if (!isConnected) {
                      connect();
                    }
                    sendOrderText(order.prompt);
                  }}
                  className="px-2.5 py-1.5 text-left text-xs rounded bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-600 text-slate-300 hover:text-slate-100 transition-colors flex items-center justify-between group"
                >
                  <span className="truncate">{order.label}</span>
                  <span className="text-[10px] text-slate-400 group-hover:text-blue-400 ml-1">➔</span>
                </button>
              ))}
            </div>

            <form onSubmit={handleSendCustomPrompt} className="mt-2 flex gap-1.5 pt-2 border-t border-slate-800">
              <input
                type="text"
                id="voice-order-input"
                placeholder={
                  isConnected
                    ? `Type voice order (e.g., "${wakeWord}, switch theme to noir-dark")`
                    : 'Connect uplink to submit orders'
                }
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                disabled={!isConnected}
                className="flex-grow bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 disabled:opacity-50"
              />
              <button
                type="submit"
                id="submit-order-btn"
                disabled={!isConnected || !customPrompt.trim()}
                className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-slate-100 rounded text-xs font-semibold flex items-center gap-1 border border-blue-500 disabled:opacity-40 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>SEND</span>
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-7 flex flex-col gap-3">
          <div
            className="p-3 rounded-md border flex flex-col gap-2 h-44"
            style={{
              backgroundColor: theme.colors.bgSlate,
              borderColor: theme.colors.border,
            }}
          >
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider pb-1 border-b border-slate-800">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>EXECUTED ORDERS AUDIT FEED</span>
              </div>
              <span className="text-[10px] text-slate-400">
                {executedOrders.length} {executedOrders.length === 1 ? 'ORDER' : 'ORDERS'}
              </span>
            </div>

            <div className="flex-grow overflow-y-auto flex flex-col gap-1.5 pr-1">
              {executedOrders.length === 0 ? (
                <div className="flex items-center justify-center h-full text-xs text-slate-400 italic">
                  No orders executed yet. Speak or dispatch an order.
                </div>
              ) : (
                executedOrders.map((order) => (
                  <div
                    key={order.id}
                    className="p-2 rounded bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold text-[10px]">
                        EXEC
                      </span>
                      <span className="font-semibold text-slate-200 truncate">
                        {order.name}
                      </span>
                      <span className="text-slate-400 truncate text-[11px]">
                        {JSON.stringify(order.args)}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {order.timestamp}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div
            className="p-3 rounded-md border flex flex-col gap-2 flex-grow min-h-[400px]"
            style={{
              backgroundColor: theme.colors.bgSlate,
              borderColor: theme.colors.border,
            }}
          >
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider pb-1 border-b border-slate-800">
              <div className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-blue-400" />
                <span>LIVE TRANSCRIPT & AUDIO COMM STREAM</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
                <span className="text-[10px] text-slate-400">TELEMETRY SYNC</span>
              </div>
            </div>

            <div className="flex-grow overflow-y-auto flex flex-col gap-2 pr-1 min-h-[320px] max-h-[480px]">
              {transcripts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-xs text-slate-400 italic gap-1">
                  <Cpu className="w-6 h-6 text-slate-600 mb-1" />
                  <span>Connect uplink to initialize real-time audio channel with Gemini.</span>
                  <span className="text-[11px] text-slate-400">
                    Live bidirectional audio streamed at 16kHz capture / 24kHz playback.
                  </span>
                </div>
              ) : (
                transcripts.map((item) => (
                  <div
                    key={item.id}
                    className={`p-2 rounded text-xs border ${
                      item.isCommand
                        ? 'bg-emerald-950/20 border-emerald-800/80 text-emerald-300'
                        : item.role === 'user'
                        ? 'bg-blue-950/20 border-blue-800/60 text-blue-200'
                        : item.role === 'model'
                        ? 'bg-slate-900 border-slate-700 text-slate-200'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-semibold mb-1 opacity-75">
                      <span className="uppercase tracking-wider">
                        {item.isCommand
                          ? 'SYSTEM DIRECTIVE'
                          : item.role === 'user'
                          ? 'OPERATOR VOICE INPUT'
                          : item.role === 'model'
                          ? 'MYTHOS AI VOCALIZATION'
                          : 'COMM LINK'}
                      </span>
                      <span>{item.timestamp}</span>
                    </div>
                    <div className="leading-relaxed whitespace-pre-wrap">{item.text}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    ),
    'host-control': (
      <div
        className="p-3.5 rounded-lg border flex flex-col gap-3"
        style={{
          backgroundColor: theme.colors.bgSlate,
          borderColor: theme.colors.border,
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-xs uppercase tracking-wider text-slate-200">
              VOXCONPACK // Host Computer Control & Python Network Matrix
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono-data text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              ENDPOINT: /api/host/*
            </span>
            <span>|</span>
            <span className="text-cyan-400">MYTHOS ARCHITECTURE</span>
          </div>
        </div>

        <div className="px-2.5 py-1.5 rounded bg-slate-950/70 border border-slate-800 text-[11px] font-mono-data text-slate-300 flex items-center justify-between">
          <span>PRINCIPLE: <strong className="text-cyan-300">"Voice is an input modality, not authority."</strong></span>
          <span className="text-[10px] text-amber-400/90 uppercase tracking-wider hidden sm:inline">ALL SIGNAL. NO NOISE.™</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-2.5 rounded bg-slate-900/90 border border-slate-800 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
              <FolderOpen className="w-3.5 h-3.5" />
              <span>DRIVE ASSET INGESTION</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Say: <code className="text-cyan-300">"Computer, load image from Z:/scans/core.png"</code>
            </p>
            <div className="text-[10px] font-mono-data text-slate-400">
              Mounted: <span className="text-slate-300">Z:\, C:\, /mnt, local paths</span> with automated tactical SVG fallback rendering.
            </div>
          </div>

          <div className="p-2.5 rounded bg-slate-900/90 border border-slate-800 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold">
              <Play className="w-3.5 h-3.5" />
              <span>PYTHON RUNTIME BRIDGE</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Say: <code className="text-amber-300">"Computer, execute Python script analyze.py"</code>
            </p>
            <div className="text-[10px] font-mono-data text-slate-400">
              Daemon target: <span className="text-slate-300">localhost:8000</span> or direct CLI subprocess execution.
            </div>
          </div>

          <div className="p-2.5 rounded bg-slate-900/90 border border-slate-800 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-blue-400 font-bold">
              <Network className="w-3.5 h-3.5" />
              <span>NETWORK CLUSTER CONTROLS</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Say: <code className="text-blue-300">"Computer, query network node 127.0.0.1"</code>
            </p>
            <div className="text-[10px] font-mono-data text-slate-400">
              Broadcasts telemetry queries across local Python nodes and socket daemons.
            </div>
          </div>
        </div>
      </div>
    ),
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Top Workstation Mode Switcher */}
      <div className="flex items-center justify-between p-2 rounded-lg border bg-[#080c14] border-[#1e293b]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              soundEngine.playToggle();
              setWorkstationMode('transceiver');
            }}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              workstationMode === 'transceiver'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>01. TRANSCEIVER & PARAMETER MATRIX</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playToggle();
              setWorkstationMode('surface');
            }}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              workstationMode === 'surface'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>02. VOXCONPACK INTERFACE SURFACE</span>
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playToggle();
              setWorkstationMode('comms');
            }}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              workstationMode === 'comms'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>03. LIVE COMMS MONITOR</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-400 hidden sm:block font-mono">
          {workstationMode === 'surface'
            ? 'VOXCONPACK // AUTHORITY & INTENT PROTOCOL'
            : workstationMode === 'comms'
            ? 'LIVE TRANSCRIPTION // MISSION MONITORING'
            : 'AUDIO MATRIX // HARDWARE TRANSCEIVER CHANNELS'}
        </div>
      </div>

      {workstationMode === 'surface' ? (
        <VOXCONPACKSurface
          currentTheme={currentTheme}
          onExecuteOrder={_onExecuteCommand}
          voiceActive={voiceControl.isConnected}
        />
      ) : workstationMode === 'comms' ? (
        <div 
          className="flex-grow flex flex-col p-0.5 rounded-md border overflow-hidden"
          style={{
            backgroundColor: theme.colors.bgSlate,
            borderColor: theme.colors.border,
          }}
        >
          <VoxconTranscriptionDisplay transcripts={voiceControl.transcripts} currentTheme={currentTheme} />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={layout} strategy={verticalListSortingStrategy}>
            <div
              id="voice-control-module"
              className="flex flex-col gap-3 w-full h-full text-slate-300 font-mono text-sm select-none"
              style={{ overflowAnchor: 'auto' }}
            >
              {layout.map((id, idx) => {
                const content = componentMap[id];
                if (!content) return null;
                return (
                  <SortableItem key={id} id={id} isLayoutMode={isLayoutMode} isFirst={idx === 0}>
                    {content}
                  </SortableItem>
                );
              })}
              
              <div 
                className="mt-2 p-3 rounded-md border border-dashed border-slate-700 bg-slate-900/40"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-4 h-4 text-purple-400" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    VOXCON TACTICAL MESSAGE SIMULATION // OPERATOR OVERRIDE
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => voiceControl.injectVoxconMessage('command', 'All stations stand by for priority transmission from Fleet Command.')}
                    className="px-2 py-1 bg-amber-950/30 border border-amber-800 text-amber-300 text-[10px] font-bold uppercase rounded hover:bg-amber-900/50 transition-all cursor-pointer"
                  >
                    Inject Command
                  </button>
                  <button
                    onClick={() => voiceControl.injectVoxconMessage('shipwide', 'All hands to tactical stations. Yellow alert is now in effect.')}
                    className="px-2 py-1 bg-emerald-950/30 border border-emerald-800 text-emerald-300 text-[10px] font-bold uppercase rounded hover:bg-emerald-900/50 transition-all cursor-pointer"
                  >
                    Inject Shipwide
                  </button>
                  <button
                    onClick={() => voiceControl.injectVoxconMessage('fleet', 'Sector 4 patrol groups to intercept coordinates 042-990.')}
                    className="px-2 py-1 bg-blue-950/30 border border-blue-800 text-blue-300 text-[10px] font-bold uppercase rounded hover:bg-blue-900/50 transition-all cursor-pointer"
                  >
                    Inject Fleet
                  </button>
                  <button
                    onClick={() => voiceControl.injectVoxconMessage('mission', 'New primary objective: Secure the quantum lattice core.')}
                    className="px-2 py-1 bg-purple-950/30 border border-purple-800 text-purple-300 text-[10px] font-bold uppercase rounded hover:bg-purple-900/50 transition-all cursor-pointer"
                  >
                    Inject Mission
                  </button>
                </div>
              </div>
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Voice Command Reference & Macro Orchestration Modal */}
      <VoiceCommandModal
        isOpen={isCommandRefOpen}
        onClose={() => setIsCommandRefOpen(false)}
        activeMode={activeMode}
      />
    </div>
  );
};
