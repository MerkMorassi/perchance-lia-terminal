export interface GeminiVoiceInfo {
  name: string;
  gender: string;
  tone: string;
  category: string;
  default?: boolean;
  description: string;
}

export interface ModelPersonaProfile {
  id: string;
  name: string;
  defaultTemp: number;
  description: string;
}

export interface VoiceParameterState {
  geminiVoice: string;
  persona: string;
  temperature: number;
  speechRate: number;
  speechPitch: number;
  windowsVoiceName: string;
}

export interface VoiceParameterPreset {
  id: string;
  title: string;
  geminiVoice: string;
  persona: string;
  temperature: number;
  speechRate: number;
  speechPitch: number;
  badge: string;
  description: string;
}

export type AudioRoutingMode = 'auto' | 'gemini-only' | 'sapi-only';

export interface VoiceCommand {
  id: string;
  name: string;
  description: string;
  args: string[]; // required arguments, e.g. ['targetId']
  mode: string; // 'all' or 'diagnostics' or 'astrometry' or 'propulsion' or 'reactors' or 'communications'
  example: string; // e.g. 'click clear-logs-btn'
  isCustom?: boolean; // if added/modified by user
  isMacro?: boolean;
  macroSteps?: string[];
}

