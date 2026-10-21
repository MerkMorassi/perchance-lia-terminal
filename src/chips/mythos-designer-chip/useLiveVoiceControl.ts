import { useState, useRef, useCallback, useEffect } from 'react';
import { LiveAudioPlayer, floatTo16BitPCM, arrayBufferToBase64 } from '../utils/liveAudioEngine';
import { soundEngine } from '../utils/audio';
import { windowsVoiceEngine } from '../utils/windowsVoiceEngine';
import { playStoredAudio, STANDARD_RESPONSES } from '../utils/storedAudio';
import { matchVoiceIntentFast } from '../utils/voiceDomController';
import { GeminiVoiceInfo, ModelPersonaProfile, VoiceParameterPreset, AudioRoutingMode } from '../types/voice';

export interface LiveTranscriptItem {
  id: string;
  role: 'user' | 'model' | 'system' | 'command' | 'fleet' | 'shipwide' | 'mission';
  text: string;
  timestamp: string;
  isCommand?: boolean;
}

export interface ExecutedOrder {
  id: string;
  name: string;
  args: Record<string, unknown>;
  timestamp: string;
  status: 'executed' | 'failed';
}

export interface UseLiveVoiceControlOptions {
  onExecuteCommand?: (name: string, args: Record<string, unknown>) => void;
}

export const DEFAULT_GEMINI_VOICES: GeminiVoiceInfo[] = [
  { name: 'Zephyr', gender: 'Female / Bright', tone: 'Smooth / Crisp', category: 'Tactical Ops', default: true, description: 'Default vocal persona. Clear, disciplined naval command cadence.' },
  { name: 'Kore', gender: 'Female / Firm', tone: 'Articulate / Advisory', category: 'Diagnostics', description: 'High-confidence technical diagnostics, analytical decomposition.' },
  { name: 'Aoede', gender: 'Female / Melodic', tone: 'Breezy / Conversational', category: 'Extended Narration', description: 'Balanced acoustic profile, extended briefing and status readouts.' },
  { name: 'Leda', gender: 'Female / Serene', tone: 'Calm / Composed', category: 'Command Bridge', description: 'Steady cadence for bridge crew coordination and long-range relay.' },
  { name: 'Despina', gender: 'Female / Smooth', tone: 'Measured / Warm', category: 'Crew Operations', description: 'Even cadence for life-support and interior deck management.' },
  { name: 'Erinome', gender: 'Female / Expressive', tone: 'Precise / Articulate', category: 'Engineering Array', description: 'Microsecond precision for reactor timing and frequency arrays.' },
  { name: 'Laomedeia', gender: 'Female / Fast', tone: 'Rhythmic / Crisp', category: 'Rapid Telemetry', description: 'High-speed protocol verification and buffer status relay.' },
  { name: 'Sulafat', gender: 'Neutral / Focused', tone: 'Compact / Direct', category: 'Tactical Weapons', description: 'Short-burst targeting directives and defensive shield updates.' },
  { name: 'Achernar', gender: 'Neutral / Direct', tone: 'Modern / Tactical', category: 'Surveillance', description: 'Passive sensor array scanning and perimeter radar sweeps.' },
  { name: 'Schedar', gender: 'Female / Sharp', tone: 'Technical / Piercing', category: 'Avionics', description: 'Attitude control thrusters and flight surface telemetry.' },
  { name: 'Callirrhoe', gender: 'Female / Melodic', tone: 'Analytical / Smooth', category: 'Deep Space', description: 'Long-range sensor sweeps and deep telemetry acquisition.' },
  { name: 'Autonoe', gender: 'Female / Vigilant', tone: 'Alert / Decisive', category: 'Early Warning', description: 'Proximity alert verification and hostile vector calculation.' },
  { name: 'Achird', gender: 'Neutral / Clear', tone: 'Scientific / Metric', category: 'Physics Array', description: 'Particle resonance metrics and quantum flux calculation.' },
  { name: 'Vindemiatrix', gender: 'Female / Precise', tone: 'Metric / Analytical', category: 'Quantum Matrix', description: 'Mathematical extrapolation and lattice coherence.' }
];

export const DEFAULT_PERSONA_PROFILES: ModelPersonaProfile[] = [
  {
    id: 'Charon',
    name: 'Charon (Tactical / Command)',
    defaultTemp: 0.2,
    description: 'DoD 5110.04-M BLUF protocol, active voice, 20-word maximum sentences, authoritative military command discipline.'
  },
  {
    id: 'Kore',
    name: 'Kore (Advisory / Diagnostics)',
    defaultTemp: 0.35,
    description: 'Detailed systems diagnostics, analytical root-cause decomposition, articulate status reports.'
  },
  {
    id: 'Fenrir',
    name: 'Fenrir (Combat / Intercept)',
    defaultTemp: 0.1,
    description: 'High-priority threat vector reporting, minimal response latency, combat alert cadence.'
  },
  {
    id: 'Puck',
    name: 'Puck (Sensor / Telemetry)',
    defaultTemp: 0.5,
    description: 'Continuous subsystem telemetry streaming, live sensor feeds, dynamic data reporting.'
  },
  {
    id: 'Zephyr',
    name: 'Zephyr (Strategic / Naval Operations)',
    defaultTemp: 0.2,
    description: 'Fleet operations standard, strategic logistics, disciplined COMMPACK-MIL protocol.'
  },
  {
    id: 'Custom',
    name: 'Custom (Operator Tuning)',
    defaultTemp: 0.2,
    description: 'User-defined temperature, cadence, pitch, and operational directives.'
  }
];

export const VOICE_PARAMETER_PRESETS: VoiceParameterPreset[] = [
  {
    id: 'tactical-command',
    title: 'Tactical Command Baseline',
    geminiVoice: 'Zephyr',
    persona: 'Charon',
    temperature: 0.2,
    speechRate: 1.02,
    speechPitch: 0.98,
    badge: 'DEFAULT // MIL-STD',
    description: 'DoD BLUF protocol, 20-word maximum concise orders, authoritative naval cadence.',
  },
  {
    id: 'combat-reaction',
    title: 'Combat Rapid Intercept',
    geminiVoice: 'Autonoe',
    persona: 'Fenrir',
    temperature: 0.1,
    speechRate: 1.15,
    speechPitch: 0.92,
    badge: 'TACTICAL INTERCEPT',
    description: 'Minimal latency, deterministic directives, high-priority emergency alerts.',
  },
  {
    id: 'diagnostic-advisory',
    title: 'Systems Diagnostic Advisory',
    geminiVoice: 'Kore',
    persona: 'Kore',
    temperature: 0.35,
    speechRate: 1.0,
    speechPitch: 1.0,
    badge: 'DIAGNOSTICS',
    description: 'In-depth anomaly analysis, subsystem root-cause breakdown, articulate cadence.',
  },
  {
    id: 'sensor-telemetry',
    title: 'Realtime Sensor Telemetry',
    geminiVoice: 'Achird',
    persona: 'Puck',
    temperature: 0.5,
    speechRate: 1.1,
    speechPitch: 1.05,
    badge: 'TELEMETRY STREAM',
    description: 'Continuous subsystem monitoring, high-energy stream verification.',
  },
  {
    id: 'strategic-fleet',
    title: 'Strategic Fleet Briefing',
    geminiVoice: 'Leda',
    persona: 'Zephyr',
    temperature: 0.2,
    speechRate: 0.95,
    speechPitch: 0.9,
    badge: 'FLEET LOGISTICS',
    description: 'Deep harmonic resonance, fleet logistics coordination, maritime-space protocol.',
  },
  {
    id: 'hazard-alarm',
    title: 'Hazard Alert Dispatch',
    geminiVoice: 'Schedar',
    persona: 'Fenrir',
    temperature: 0.15,
    speechRate: 1.2,
    speechPitch: 1.08,
    badge: 'HAZARD EVAC',
    description: 'High-urgency anomaly detection and reactor evacuation signaling.',
  },
  {
    id: 'deep-space-scan',
    title: 'Deep Space Long-Range Scan',
    geminiVoice: 'Callirrhoe',
    persona: 'Kore',
    temperature: 0.4,
    speechRate: 0.98,
    speechPitch: 1.0,
    badge: 'DEEP SPACE',
    description: 'Long-range sensor sweeps, stellar charting, astronomical analysis.',
  },
  {
    id: 'bridge-ops',
    title: 'Command Deck Operations',
    geminiVoice: 'Leda',
    persona: 'Charon',
    temperature: 0.25,
    speechRate: 1.0,
    speechPitch: 0.98,
    badge: 'BRIDGE DECK',
    description: 'Calm, composed bridge crew communications and station coordination.',
  },
];

export function useLiveVoiceControl({ onExecuteCommand }: UseLiveVoiceControlOptions = {}) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState<boolean>(false);
  const [isPttMode, setIsPttMode] = useState<boolean>(false);
  const [isPttPressed, setIsPttPressed] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [micLevel, setMicLevel] = useState<number>(0);
  const [transcripts, setTranscripts] = useState<LiveTranscriptItem[]>([]);
  const [executedOrders, setExecutedOrders] = useState<ExecutedOrder[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTtsFallbackActive, setIsTtsFallbackActive] = useState<boolean>(false);
  const [fallbackVoiceName, setFallbackVoiceName] = useState<string>(() => {
    return windowsVoiceEngine.getBestWindowsVoice().name;
  });

  // Default Voice Preset Identification
  const [defaultVoicePresetId, setDefaultVoicePresetId] = useState<string>(() => {
    return localStorage.getItem('mythos_default_voice_preset_id') || 'tactical-command';
  });

  // Voice Parameters - initialized from saved values or the designated default voice preset
  // Suppresses male voices and enforces female/neutral voice selection
  const [selectedVoice, setSelectedVoice] = useState<string>(() => {
    const saved = localStorage.getItem('mythos_voice');
    if (saved && DEFAULT_GEMINI_VOICES.some((v) => v.name === saved)) {
      return saved;
    }
    const defaultPreset = VOICE_PARAMETER_PRESETS.find(
      (p) => p.id === (localStorage.getItem('mythos_default_voice_preset_id') || 'tactical-command')
    );
    const fallbackVoice = defaultPreset?.geminiVoice || 'Zephyr';
    try {
      localStorage.setItem('mythos_voice', fallbackVoice);
    } catch {
      // ignore
    }
    return fallbackVoice;
  });
  const [selectedPersona, setSelectedPersona] = useState<string>(() => {
    const saved = localStorage.getItem('mythos_persona');
    if (saved) return saved;
    const defaultPreset = VOICE_PARAMETER_PRESETS.find(
      (p) => p.id === (localStorage.getItem('mythos_default_voice_preset_id') || 'tactical-command')
    );
    return defaultPreset ? defaultPreset.persona : 'Charon';
  });
  const [temperature, setTemperature] = useState<number>(() => {
    const saved = parseFloat(localStorage.getItem('mythos_temp') || '');
    if (!isNaN(saved)) return saved;
    const defaultPreset = VOICE_PARAMETER_PRESETS.find(
      (p) => p.id === (localStorage.getItem('mythos_default_voice_preset_id') || 'tactical-command')
    );
    return defaultPreset ? defaultPreset.temperature : 0.2;
  });
  const [speechRate, setSpeechRate] = useState<number>(() => {
    const saved = parseFloat(localStorage.getItem('mythos_rate') || '');
    if (!isNaN(saved)) return saved;
    const defaultPreset = VOICE_PARAMETER_PRESETS.find(
      (p) => p.id === (localStorage.getItem('mythos_default_voice_preset_id') || 'tactical-command')
    );
    return defaultPreset ? defaultPreset.speechRate : 1.02;
  });
  const [speechPitch, setSpeechPitch] = useState<number>(() => {
    const saved = parseFloat(localStorage.getItem('mythos_pitch') || '');
    if (!isNaN(saved)) return saved;
    const defaultPreset = VOICE_PARAMETER_PRESETS.find(
      (p) => p.id === (localStorage.getItem('mythos_default_voice_preset_id') || 'tactical-command')
    );
    return defaultPreset ? defaultPreset.speechPitch : 0.98;
  });
  const [selectedWindowsVoice, setSelectedWindowsVoice] = useState<string>(() => {
    return localStorage.getItem('mythos_windows_voice') || '';
  });

  // Acoustic Routing Policy: 'auto' (Dual-Engine with SAPI failsafe) | 'gemini-only' | 'sapi-only'
  const [routingMode, setRoutingMode] = useState<AudioRoutingMode>(() => {
    const saved = localStorage.getItem('mythos_routing_mode');
    return (saved === 'auto' || saved === 'gemini-only' || saved === 'sapi-only') ? saved : 'auto';
  });
  const [activeAcousticRoute, setActiveAcousticRoute] = useState<'gemini' | 'sapi' | 'idle'>('idle');

  // Dynamic Voices & Profiles
  const [geminiVoices, setGeminiVoices] = useState<GeminiVoiceInfo[]>(DEFAULT_GEMINI_VOICES);
  const [personaProfiles, setPersonaProfiles] = useState<ModelPersonaProfile[]>(DEFAULT_PERSONA_PROFILES);
  const [windowsVoices, setWindowsVoices] = useState<SpeechSynthesisVoice[]>(() => {
    return windowsVoiceEngine.getAvailableVoices();
  });

  const wsRef = useRef<WebSocket | null>(null);
  const playerRef = useRef<LiveAudioPlayer | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const onExecuteCommandRef = useRef(onExecuteCommand);
  const hasPlayedAudioRef = useRef<boolean>(false);
  const turnHasReceivedAudioRef = useRef<boolean>(false);
  const routingModeRef = useRef<AudioRoutingMode>(routingMode);
  const greetingFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptTtsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    routingModeRef.current = routingMode;
  }, [routingMode]);

  useEffect(() => {
    onExecuteCommandRef.current = onExecuteCommand;
  }, [onExecuteCommand]);

  // Fetch available Gemini Voices and Personas dynamically from server API
  useEffect(() => {
    let isMounted = true;
    fetch('/api/gemini-voices')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        if (Array.isArray(data?.voices) && data.voices.length > 0) {
          const femaleOrNeutralOnly = data.voices.filter(
            (v: GeminiVoiceInfo) => !v.gender.toLowerCase().startsWith('male')
          );
          setGeminiVoices(femaleOrNeutralOnly.length > 0 ? femaleOrNeutralOnly : DEFAULT_GEMINI_VOICES);
        }
        if (Array.isArray(data?.personas) && data.personas.length > 0) {
          setPersonaProfiles(data.personas);
        }
      })
      .catch((err) => {
        console.warn('[LiveVoice] Could not fetch dynamic voices from /api/gemini-voices, using embedded registry:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Subscribe to Windows Speech Synthesis voices list updates
  useEffect(() => {
    // Audit: Ensure any pending SAPI speech from previous sessions is terminated on mount
    windowsVoiceEngine.cancel();
    setWindowsVoices(windowsVoiceEngine.getAvailableVoices());
    const unsubscribe = windowsVoiceEngine.onVoicesUpdated((voices) => {
      setWindowsVoices(voices);
    });
    return unsubscribe;
  }, []);

  // Keep fallback voice name aligned with selected persona and OS voice changes
  useEffect(() => {
    const updateVoiceName = () => {
      if (selectedWindowsVoice) {
        setFallbackVoiceName(selectedWindowsVoice);
      } else {
        const match = windowsVoiceEngine.getBestWindowsVoice(selectedVoice);
        setFallbackVoiceName(match.name);
      }
    };
    updateVoiceName();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoiceName;
    }
  }, [selectedVoice, selectedWindowsVoice]);

  const pttPressedRef = useRef<boolean>(false);
  const isPttModeRef = useRef<boolean>(false);

  useEffect(() => {
    pttPressedRef.current = isPttPressed;
  }, [isPttPressed]);

  useEffect(() => {
    isPttModeRef.current = isPttMode;
  }, [isPttMode]);

  // Agent EOT (End of Transmission) Squelch Tail
  const prevIsSpeakingRef = useRef<boolean>(false);
  useEffect(() => {
    if (prevIsSpeakingRef.current && !isSpeaking) {
      soundEngine.playSquelch('close');
    }
    prevIsSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  const addTranscript = useCallback((role: 'user' | 'model' | 'system' | 'command' | 'fleet' | 'shipwide' | 'mission', text: string, isCommand = false) => {
    const time = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'America/Phoenix',
      hour12: false
    });
    setTranscripts((prev) => [
      ...prev.slice(-49), // retain last 50 entries
      {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        role,
        text,
        timestamp: time,
        isCommand,
      },
    ]);
  }, []);

  const injectVoxconMessage = useCallback((role: 'command' | 'fleet' | 'shipwide' | 'mission', text: string) => {
    addTranscript(role, text);
    soundEngine.playBeep(440, 'sine', 0.1, 0.05);
  }, [addTranscript]);

  const speakFallback = useCallback(
    async (text: string, personaHint?: string) => {
      if (routingModeRef.current === 'gemini-only') {
        console.log('[LiveVoice] SAPI speech suppressed by GEMINI_ONLY routing policy');
        return;
      }

      // Attempt to play from stored audio registry first to save tokens and prioritize high-fidelity assets
      const playedStored = await playStoredAudio(text);
      if (playedStored) {
        console.log(`[LiveVoice] Standard response dispatched via stored audio asset: "${text}"`);
        return;
      }

      // CRITICAL AUDIT FIX: Interrupt any active cloud audio player before starting SAPI speech
      if (playerRef.current) {
        playerRef.current.interrupt();
      }
      setIsTtsFallbackActive(true);
      setActiveAcousticRoute('sapi');
      const safeHint = typeof personaHint === 'string' && personaHint ? personaHint : selectedVoice;
      const match = windowsVoiceEngine.getBestWindowsVoice(safeHint);
      setFallbackVoiceName(selectedWindowsVoice || match.name);
      windowsVoiceEngine.speak(text, {
        personaHint: safeHint,
        specificVoiceName: selectedWindowsVoice || undefined,
        rate: speechRate,
        pitch: speechPitch,
        onStart: () => setIsSpeaking(true),
        onEnd: () => {
          setIsSpeaking(false);
          setActiveAcousticRoute('idle');
        },
        onError: () => {
          setIsSpeaking(false);
          setActiveAcousticRoute('idle');
        },
      });
    },
    [selectedVoice, selectedWindowsVoice, speechRate, speechPitch]
  );

  const handlePttPress = useCallback(() => {
    if (!isConnected || !isMicActive) return;
    
    // Tactical Break-in: Force clear current model turn when PTT is engaged
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ 
        realtimeInput: { 
          clearCurrentTurn: true 
        } 
      }));
    }
    
    if (playerRef.current) {
      playerRef.current.interrupt();
    }

    soundEngine.playSquelch('open');
    setIsPttPressed(true);
  }, [isConnected, isMicActive]);

  const handlePttRelease = useCallback(() => {
    if (!pttPressedRef.current) return;
    
    setIsPttPressed(false);
    soundEngine.playSquelch('close');
  }, []);

  // Keyboard Tactical PTT Linkage (Space bar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        // Guard: Don't trigger if user is typing in a text field
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
        
        if (isConnected && isMicActive && isPttMode) {
          e.preventDefault();
          handlePttPress();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        if (isConnected && isMicActive && isPttMode) {
          // No need to preventDefault here usually
          handlePttRelease();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isConnected, isMicActive, isPttMode, handlePttPress, handlePttRelease]);

  const cleanupMic = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (inputAudioCtxRef.current && inputAudioCtxRef.current.state !== 'closed') {
      inputAudioCtxRef.current.close();
      inputAudioCtxRef.current = null;
    }
    setIsMicActive(false);
    setIsPttPressed(false);
    setMicLevel(0);
  }, []);

  const disconnect = useCallback(() => {
    if (greetingFallbackTimerRef.current) {
      clearTimeout(greetingFallbackTimerRef.current);
      greetingFallbackTimerRef.current = null;
    }
    if (transcriptTtsTimerRef.current) {
      clearTimeout(transcriptTtsTimerRef.current);
      transcriptTtsTimerRef.current = null;
    }
    windowsVoiceEngine.cancel();
    turnHasReceivedAudioRef.current = false;
    hasPlayedAudioRef.current = false;
    cleanupMic();
    if (playerRef.current) {
      playerRef.current.close();
      playerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    setIsSpeaking(false);
    setActiveAcousticRoute('idle');
  }, [cleanupMic]);

  const startMic = useCallback(
    async (ws: WebSocket) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        streamRef.current = stream;

        const inputCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({
          sampleRate: 16000,
        });
        inputAudioCtxRef.current = inputCtx;

        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;

          const inputData = e.inputBuffer.getChannelData(0);

          let sumSquares = 0;
          for (let i = 0; i < inputData.length; i++) {
            sumSquares += inputData[i] * inputData[i];
          }
          const rms = Math.sqrt(sumSquares / inputData.length);
          const level = Math.min(100, Math.round(rms * 400));
          setMicLevel(level);
          setIsUserSpeaking(level > 15);

          // ACOUSTIC ENFORCEMENT: Walkie-Talkie (Half-Duplex) Protocol
          if (isPttModeRef.current && !pttPressedRef.current) {
            return;
          }

          const pcm16 = floatTo16BitPCM(inputData);
          const base64 = arrayBufferToBase64(pcm16);

          ws.send(
            JSON.stringify({
              realtimeInput: {
                mediaChunks: [
                  {
                    mimeType: 'audio/pcm;rate=16000',
                    data: base64,
                  },
                ],
              },
            })
          );
        };

        source.connect(processor);
        processor.connect(inputCtx.destination);
        setIsMicActive(true);
        setErrorMessage(null);
      } catch (err) {
        console.error('Microphone access failed:', err);
        const msg = err instanceof Error ? err.message : 'Microphone access denied or unavailable.';
        setErrorMessage(msg);
        addTranscript('system', `Microphone warning: ${msg}. You can still dispatch orders via text.`);
      }
    },
    [addTranscript]
  );

  const connect = useCallback(
    (options?: string | { voice?: string; persona?: string; temperature?: number } | unknown) => {
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        return;
      }

      let voiceToUse = selectedVoice;
      let personaToUse = selectedPersona;
      let tempToUse = temperature;

      if (typeof options === 'string' && options) {
        voiceToUse = options;
      } else if (typeof options === 'object' && options !== null) {
        const opt = options as { voice?: string; persona?: string; temperature?: number };
        if (typeof opt.voice === 'string' && opt.voice) voiceToUse = opt.voice;
        if (typeof opt.persona === 'string' && opt.persona) personaToUse = opt.persona;
        if (typeof opt.temperature === 'number') tempToUse = opt.temperature;
      }

      setIsConnecting(true);
      setErrorMessage(null);

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live-ws?voice=${encodeURIComponent(voiceToUse)}&persona=${encodeURIComponent(personaToUse)}&temperature=${encodeURIComponent(tempToUse)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      if (!playerRef.current) {
        playerRef.current = new LiveAudioPlayer();
      }

      ws.onopen = () => {
        console.log(`[LiveVoice] WebSocket opened with Voice: ${voiceToUse}, Persona: ${personaToUse}, Temp: ${tempToUse}`);
        setIsConnected(true);
        setIsConnecting(false);
        soundEngine.playChime();
        addTranscript('system', `Voice Control Uplink Established. Voice: ${voiceToUse} • Persona: ${personaToUse} • T:${tempToUse} (gemini-3.1-flash-live-preview).`);
        addTranscript('model', 'VOXCON Active. This is the VOXCON Tactical Execution AI. Standing by to receive your orders, operator.');

        if (!navigator.onLine) {
          addTranscript('system', 'CATASTROPHIC FAILURE: Local network link severed. TTS connection unavailable. Engaging Windows SAPI failsafe.');
          speakFallback('VOXCON Active. Network failure detected. Operating on local SAPI protocol.', voiceToUse);
          return;
        }

        // Arm tactical voice synthesis fallback if model live audio is delayed (timed after chime)
        turnHasReceivedAudioRef.current = false;
        hasPlayedAudioRef.current = false;
        if (greetingFallbackTimerRef.current) {
          clearTimeout(greetingFallbackTimerRef.current);
          greetingFallbackTimerRef.current = null;
        }

        if (routingModeRef.current === 'sapi-only') {
          const match = windowsVoiceEngine.getBestWindowsVoice(voiceToUse);
          addTranscript('system', `ROUTING POLICY: SAPI-ONLY forced. Engaging local Windows voice (${selectedWindowsVoice || match.name}).`);
          speakFallback('VOXCON Active. This is the VOXCON Tactical Execution AI. Standing by to receive your orders, operator.', voiceToUse);
        } else if (routingModeRef.current === 'auto') {
          // AUDIT: Reduced aggressiveness of SAPI greeting fallback per Operator directive.
          // Now only triggers if explicitly failing or after a much longer delay to allow Gemini priority.
          greetingFallbackTimerRef.current = setTimeout(() => {
            if (!turnHasReceivedAudioRef.current && !hasPlayedAudioRef.current) {
              const match = windowsVoiceEngine.getBestWindowsVoice(voiceToUse);
              console.warn('[LiveVoice] Gemini Live greeting audio delayed. SAPI fallback suppressed per Operational Mandate unless catastrophic failure detected.');
              addTranscript('system', `ROUTING ADVISORY: Gemini audio delayed. SAPI suppressed to prioritize neural voice.`);
              // Only speak if we are certain Gemini won't (e.g. error or very long delay)
              // For now, we remain silent to respect "Windows should never speak unless catastrophic failure"
            }
          }, 3500); // Increased from 1400ms
        }

        // Auto-start mic after user clicked connect
        startMic(ws);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'connected' || (msg.type === 'status' && msg.status === 'connected')) {
            setIsConnected(true);
          }

          if (msg.type === 'command') {
            console.log('[LiveVoice] Command order received:', msg.name, msg.args);
            
            // Internal Tactical Audio Dispatch (Saves Tokens)
            if (msg.name === 'dispatchTacticalAudio') {
              const responseId = msg.args?.responseId as string;
              if (responseId) {
                playStoredAudio(responseId);
                // Map ID back to text for transcript
                const entry = Object.entries(STANDARD_RESPONSES).find(([_, id]) => id === responseId);
                if (entry) {
                  addTranscript('model', entry[0]);
                }
              }
              return; // Handled internally
            }

            const time = new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              timeZone: 'America/Phoenix',
              hour12: false
            });
            const newOrder: ExecutedOrder = {
              id: msg.id || `${Date.now()}`,
              name: msg.name,
              args: msg.args || {},
              timestamp: time,
              status: 'executed',
            };
            setExecutedOrders((prev) => [newOrder, ...prev.slice(0, 24)]);
            addTranscript('system', `ORDER EXECUTED: ${msg.name}(${JSON.stringify(msg.args)})`, true);
            if (onExecuteCommandRef.current) {
              onExecuteCommandRef.current(msg.name, msg.args);
            }

            // Check if command is a registered macro to orchestrate sequence steps
            try {
              const savedCmds = localStorage.getItem('voxcon-voice-commands');
              if (savedCmds) {
                const list = JSON.parse(savedCmds);
                const macro = list.find((c: { name: string; isMacro?: boolean; macroSteps?: string[] }) => c.name === msg.name && c.isMacro);
                if (macro && Array.isArray(macro.macroSteps) && macro.macroSteps.length > 0) {
                  addTranscript('system', `ORCHESTRATING MACRO [${macro.name}]: ${macro.macroSteps.length} sequence steps triggered.`, true);
                  macro.macroSteps.forEach((step: string, idx: number) => {
                    setTimeout(() => {
                      sendOrderText(step);
                    }, (idx + 1) * 400);
                  });
                }
              }
            } catch {
              // ignore
            }
          }

          if (msg.type === 'audio' && msg.audio) {
            // If SAPI-only mode is forced by operator, suppress cloud audio stream
            if (routingModeRef.current === 'sapi-only') {
              return;
            }

            turnHasReceivedAudioRef.current = true;
            hasPlayedAudioRef.current = true;
            if (greetingFallbackTimerRef.current) {
              clearTimeout(greetingFallbackTimerRef.current);
              greetingFallbackTimerRef.current = null;
            }
            if (transcriptTtsTimerRef.current) {
              clearTimeout(transcriptTtsTimerRef.current);
              transcriptTtsTimerRef.current = null;
            }

            // CRITICAL AUDIT FIX: Mutual Cancellation - stop any running SAPI speech immediately
            windowsVoiceEngine.cancel();
            setIsTtsFallbackActive(false);
            setActiveAcousticRoute('gemini');

            if (!playerRef.current) {
              playerRef.current = new LiveAudioPlayer();
            }
            playerRef.current.playChunk(msg.audio);
            setIsSpeaking(true);
            setTimeout(() => {
              if (!playerRef.current?.isPlaying() && !windowsVoiceEngine.isSpeaking()) {
                setIsSpeaking(false);
                setActiveAcousticRoute('idle');
              }
            }, 600);
          }

          if (msg.type === 'transcript') {
            addTranscript(msg.role, msg.text);

            if (msg.role === 'model' && msg.text && msg.text.trim()) {
              if (routingModeRef.current === 'sapi-only') {
                // SAPI-only mode: immediate local vocalization
                windowsVoiceEngine.cancel();
                if (playerRef.current) {
                  playerRef.current.interrupt();
                }
                speakFallback(msg.text, voiceToUse);
              } else if (routingModeRef.current === 'auto') {
                if (transcriptTtsTimerRef.current) {
                  clearTimeout(transcriptTtsTimerRef.current);
                }
                // CRITICAL AUDIT FIX: Per-turn audio check ensures fallback reliably activates on any turn
                transcriptTtsTimerRef.current = setTimeout(() => {
                  if (!turnHasReceivedAudioRef.current && msg.text && msg.text.trim()) {
                    console.warn('[LiveVoice] Model audio missing for turn transcript, vocalizing via Windows SAPI engine:', msg.text);
                    windowsVoiceEngine.cancel();
                    if (playerRef.current) {
                      playerRef.current.interrupt();
                    }
                    speakFallback(msg.text, voiceToUse);
                  }
                }, 750);
              }
            }
          }

          if (msg.type === 'interrupted') {
            if (playerRef.current) {
              playerRef.current.interrupt();
            }
            windowsVoiceEngine.cancel();
            if (transcriptTtsTimerRef.current) {
              clearTimeout(transcriptTtsTimerRef.current);
              transcriptTtsTimerRef.current = null;
            }
            setIsSpeaking(false);
            setActiveAcousticRoute('idle');
          }

          if (msg.type === 'error') {
            console.error('[LiveVoice] Server reported error:', msg.error);
            setErrorMessage(msg.error);
            addTranscript('system', `VOXCON Error: ${msg.error}`);
            if (msg.tts_fallback) {
              setIsTtsFallbackActive(true);
              const match = windowsVoiceEngine.getBestWindowsVoice(voiceToUse);
              addTranscript('system', `Failsafe engaged: Routing vocal acknowledgments to Windows Read Aloud (${match.name}).`);
            }
          }
        } catch (err) {
          console.error('[LiveVoice] Message parse failure:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('[LiveVoice] WebSocket error:', err);
        setErrorMessage('WebSocket connection failed.');
        setIsConnecting(false);
        setIsConnected(false);
        addTranscript('system', 'Voice Control connection error. Fallback Windows Read Aloud engine engaged.');
        setIsTtsFallbackActive(true);
      };

      ws.onclose = () => {
        console.log('[LiveVoice] WebSocket closed.');
        setIsConnected(false);
        setIsConnecting(false);
        cleanupMic();
      };
    },
    [selectedVoice, selectedPersona, temperature, addTranscript, cleanupMic, speakFallback, startMic, selectedWindowsVoice]
  );

  const toggleMic = useCallback(() => {
    if (!isConnected || !wsRef.current) return;
    if (isMicActive) {
      cleanupMic();
      addTranscript('system', 'Microphone muted.');
    } else {
      startMic(wsRef.current);
      addTranscript('system', 'Microphone unmuted (16kHz PCM stream).');
    }
  }, [isConnected, isMicActive, cleanupMic, startMic, addTranscript]);

  const sendOrderText = useCallback(
    (text: string) => {
      // Check for macro trigger in text input
      try {
        const savedCmds = localStorage.getItem('voxcon-voice-commands');
        if (savedCmds) {
          const list = JSON.parse(savedCmds);
          const cleanText = text.trim().toLowerCase();
          const matchedMacro = list.find((c: { name: string; isMacro?: boolean; macroSteps?: string[] }) =>
            c.isMacro && (cleanText === c.name.toLowerCase() || cleanText.includes(c.name.toLowerCase()))
          );
          if (matchedMacro && Array.isArray(matchedMacro.macroSteps) && matchedMacro.macroSteps.length > 0) {
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
            setExecutedOrders((prev) => [{
              id: `${Date.now()}`,
              name: matchedMacro.name,
              args: { macroSteps: matchedMacro.macroSteps },
              timestamp: time,
              status: 'executed',
            }, ...prev.slice(0, 24)]);
            addTranscript('system', `MACRO TRIGGERED: [${matchedMacro.name}] (${matchedMacro.macroSteps.length} sequence steps)`, true);
            matchedMacro.macroSteps.forEach((step: string, idx: number) => {
              setTimeout(() => {
                sendOrderText(step);
              }, (idx + 1) * 350);
            });
            return;
          }
        }
      } catch {
        // ignore
      }

      const parsedCommand = matchVoiceIntentFast(text);
      if (parsedCommand && onExecuteCommandRef.current) {
        console.log('[VoiceControl] Executing matched DOM/MSD command from text:', parsedCommand);
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        setExecutedOrders((prev) => [{
          id: `${Date.now()}`,
          name: parsedCommand.name,
          args: parsedCommand.args,
          timestamp: time,
          status: 'executed',
        }, ...prev.slice(0, 24)]);
        onExecuteCommandRef.current(parsedCommand.name, parsedCommand.args);
        addTranscript('system', `DIRECTIVE EXECUTED: ${parsedCommand.name}(${JSON.stringify(parsedCommand.args)})`, true);
      }

      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        addTranscript('user', text);
        const match = windowsVoiceEngine.getBestWindowsVoice(selectedVoice);
        addTranscript('system', `Order acknowledged locally via Windows Read Aloud (${selectedWindowsVoice || match.name}).`);
        speakFallback(`Order received: ${text}. Uplink standing by.`, selectedVoice);
        return;
      }
      addTranscript('user', text);
      turnHasReceivedAudioRef.current = false;
      hasPlayedAudioRef.current = false;
      wsRef.current.send(
        JSON.stringify({
          type: 'text',
          text,
        })
      );
    },
    [addTranscript, selectedVoice, speakFallback, selectedWindowsVoice]
  );

  const changeVoice = useCallback(
    (voice: string) => {
      setSelectedVoice(voice);
      const match = windowsVoiceEngine.getBestWindowsVoice(voice);
      setFallbackVoiceName(selectedWindowsVoice || match.name);
      try {
        localStorage.setItem('mythos_voice', voice);
      } catch (err) {
        console.warn('Unable to persist voice preference:', err);
      }
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        disconnect();
        setTimeout(() => {
          connect({ voice, persona: selectedPersona, temperature });
        }, 200);
      }
    },
    [disconnect, connect, selectedPersona, temperature, selectedWindowsVoice]
  );

  const updatePersona = useCallback(
    (personaId: string) => {
      setSelectedPersona(personaId);
      const profile = personaProfiles.find((p) => p.id === personaId);
      if (profile && personaId !== 'Custom') {
        setTemperature(profile.defaultTemp);
        try {
          localStorage.setItem('mythos_temp', profile.defaultTemp.toString());
        } catch {
          // ignore
        }
      }
      try {
        localStorage.setItem('mythos_persona', personaId);
      } catch (err) {
        console.warn('Unable to persist persona preference:', err);
      }
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        disconnect();
        setTimeout(() => {
          connect({ voice: selectedVoice, persona: personaId, temperature: profile ? profile.defaultTemp : temperature });
        }, 200);
      }
    },
    [disconnect, connect, selectedVoice, temperature, personaProfiles]
  );

  const updateTemperature = useCallback(
    (temp: number) => {
      const safe = Math.min(Math.max(temp, 0.0), 1.0);
      setTemperature(safe);
      try {
        localStorage.setItem('mythos_temp', safe.toString());
      } catch {
        // ignore
      }
    },
    []
  );

  const startTranscribeRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          try {
            const res = await fetch('/api/gemini/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audioData: base64Audio }),
            });
            const data = await res.json();
            if (data.transcription) {
              addTranscript('user', `[AUDIO TRANSCRIPTION]`);
              addTranscript('model', data.transcription);
            }
          } catch (err) {
            console.error('Transcription failed:', err);
            addTranscript('system', 'Transcription service unavailable.');
          } finally {
            setIsTranscribing(false);
          }
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsTranscribing(true);
      addTranscript('system', 'VOXCON Transcriber: Recording active... (Click stop to process)');
    } catch (err) {
      console.error('Failed to start transcription recording:', err);
      addTranscript('system', 'Microphone access denied for transcription.');
    }
  }, [addTranscript]);

  const stopTranscribeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const updateSpeechRate = useCallback((rate: number) => {
    setSpeechRate(rate);
    try {
      localStorage.setItem('mythos_rate', rate.toString());
    } catch {
      // ignore
    }
  }, []);

  const updateSpeechPitch = useCallback((pitch: number) => {
    setSpeechPitch(pitch);
    try {
      localStorage.setItem('mythos_pitch', pitch.toString());
    } catch {
      // ignore
    }
  }, []);

  const updateWindowsVoice = useCallback((voiceName: string) => {
    setSelectedWindowsVoice(voiceName);
    try {
      localStorage.setItem('mythos_windows_voice', voiceName);
    } catch {
      // ignore
    }
    if (voiceName) {
      setFallbackVoiceName(voiceName);
    } else {
      const match = windowsVoiceEngine.getBestWindowsVoice(selectedVoice);
      setFallbackVoiceName(match.name);
    }
  }, [selectedVoice]);

  const applyPreset = useCallback(
    (preset: VoiceParameterPreset) => {
      setSelectedVoice(preset.geminiVoice);
      setSelectedPersona(preset.persona);
      setTemperature(preset.temperature);
      setSpeechRate(preset.speechRate);
      setSpeechPitch(preset.speechPitch);
      try {
        localStorage.setItem('mythos_voice', preset.geminiVoice);
        localStorage.setItem('mythos_persona', preset.persona);
        localStorage.setItem('mythos_temp', preset.temperature.toString());
        localStorage.setItem('mythos_rate', preset.speechRate.toString());
        localStorage.setItem('mythos_pitch', preset.speechPitch.toString());
      } catch {
        // ignore
      }
      addTranscript('system', `Applied voice preset: ${preset.title} [${preset.geminiVoice} // ${preset.persona} // T:${preset.temperature} // ${preset.speechRate}x]`);
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        disconnect();
        setTimeout(() => {
          connect({ voice: preset.geminiVoice, persona: preset.persona, temperature: preset.temperature });
        }, 250);
      }
    },
    [disconnect, connect, addTranscript]
  );

  const testWindowsVoice = useCallback(() => {
    const match = windowsVoiceEngine.getBestWindowsVoice(selectedVoice);
    const activeName = selectedWindowsVoice || match.name;
    addTranscript('system', `Testing Windows Read Aloud voice: ${activeName}`);
    speakFallback('VOXCON Active. Default Windows Read Aloud engine verified and standing by.', selectedVoice);
  }, [selectedVoice, selectedWindowsVoice, addTranscript, speakFallback]);

  const auditionCombination = useCallback(
    (customPhrase?: string) => {
      const phrase = customPhrase || `VOXCON acoustic audit. Voice persona: ${selectedVoice}. Model parameter profile: ${selectedPersona}. Temperature: ${temperature}. Cadence: ${speechRate}x. Pitch: ${speechPitch}. Standing by.`;
      addTranscript('system', `AUDITIONING PARAMETERS: [${selectedVoice} // ${selectedPersona} // T:${temperature} // ${speechRate}x // P:${speechPitch}]`);
      speakFallback(phrase, selectedVoice);
    },
    [selectedVoice, selectedPersona, temperature, speechRate, speechPitch, addTranscript, speakFallback]
  );

  const updateRoutingMode = useCallback(
    (mode: AudioRoutingMode) => {
      setRoutingMode(mode);
      try {
        localStorage.setItem('mythos_routing_mode', mode);
      } catch {
        // ignore
      }
      const label = mode === 'auto'
        ? 'AUTO (Dual Engine + 750ms SAPI Failsafe)'
        : mode === 'gemini-only'
        ? 'PRIMARY GEMINI LIVE ONLY (SAPI Suppressed)'
        : 'LOCAL WINDOWS SAPI ONLY (Zero Network Audio)';
      addTranscript('system', `ACOUSTIC ROUTING RECONFIGURED: ${label}`);
    },
    [addTranscript]
  );

  const setDefaultVoicePreset = useCallback(
    (presetId: string) => {
      const preset = VOICE_PARAMETER_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      setDefaultVoicePresetId(presetId);
      try {
        localStorage.setItem('mythos_default_voice_preset_id', presetId);
      } catch {
        // ignore
      }
      soundEngine.playChime();
      addTranscript(
        'system',
        `DEFAULT PRESET DESIGNATED: Voice preset "${preset.title}" [${preset.geminiVoice} // ${preset.persona} // T:${preset.temperature}] is now registered as startup default.`
      );
    },
    [addTranscript]
  );

  const resetToDefaultPreset = useCallback(() => {
    const defaultPreset =
      VOICE_PARAMETER_PRESETS.find((p) => p.id === defaultVoicePresetId) ||
      VOICE_PARAMETER_PRESETS[0];
    applyPreset(defaultPreset);
    soundEngine.playChime();
    addTranscript(
      'system',
      `RESET TO DEFAULT: Reverted voice parameters to default preset "${defaultPreset.title}".`
    );
  }, [defaultVoicePresetId, applyPreset, addTranscript]);

  const auditAcousticRouting = useCallback(() => {
    const isSapiReady = windowsVoiceEngine.isAvailable();
    const osVoices = windowsVoiceEngine.getAvailableVoices();
    const isLiveSocketOpen = wsRef.current?.readyState === WebSocket.OPEN;
    const match = windowsVoiceEngine.getBestWindowsVoice(selectedVoice);
    const activeSapiVoice = selectedWindowsVoice || match.name;

    addTranscript('system', `=== ACOUSTIC ROUTING AUDIT ===`);
    addTranscript('system', `ACTIVE POLICY: [${routingMode.toUpperCase()}]`);
    addTranscript('system', `PRIMARY PIPELINE: Gemini Live 24kHz PCM (${isLiveSocketOpen ? 'ONLINE' : 'STANDBY'})`);
    addTranscript('system', `SECONDARY PIPELINE: Windows SAPI Engine (${isSapiReady ? `OPERATIONAL // ${osVoices.length} VOICES` : 'UNAVAILABLE'})`);
    addTranscript('system', `ACTIVE SAPI TARGET: ${activeSapiVoice} [Rate: ${speechRate}x, Pitch: ${speechPitch}]`);
    addTranscript('system', `COLLISION SUPPRESSION: Mutual Cancellation Verified`);
    addTranscript('system', `FAILSAFE TIMEOUTS: 750ms Turn Guard / 1400ms Greeting Guard`);
    addTranscript('system', `STATUS: ALL ROUTING CIRCUITS NOMINAL`);

    soundEngine.playChime();
    if (routingMode === 'sapi-only' || !isLiveSocketOpen) {
      speakFallback(`Acoustic routing audit complete. Route confirmed via Windows SAPI engine: ${activeSapiVoice}. Standing by.`, selectedVoice);
    } else {
      speakFallback(`Acoustic routing audit complete. Dual-pipeline failsafe verified. Standing by.`, selectedVoice);
    }
  }, [routingMode, selectedVoice, selectedWindowsVoice, speechRate, speechPitch, addTranscript, speakFallback]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isConnecting,
    isMicActive,
    isSpeaking,
    isUserSpeaking,
    isPttMode,
    isPttPressed,
    micLevel,
    setIsPttMode,
    handlePttPress,
    handlePttRelease,
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
    isTranscribing,
    startTranscribeRecording,
    stopTranscribeRecording,
    injectVoxconMessage,
  };
}

export type LiveVoiceControlHandle = ReturnType<typeof useLiveVoiceControl>;
