/**
 * Windows "Read Aloud" Speech Synthesis Engine
 * Provides fallback text-to-speech using default Windows OS / Edge Read Aloud voices
 * (e.g., Microsoft David, Microsoft Zira, Microsoft Mark, Microsoft Natural / Online Read Aloud).
 */

export interface WindowsVoiceMatch {
  voice: SpeechSynthesisVoice | null;
  name: string;
  isNatural: boolean;
  isWindowsDefault: boolean;
}

class WindowsVoiceEngine {
  private voices: SpeechSynthesisVoice[] = [];
  private isInitialized = false;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.refreshVoices();
      if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
        window.speechSynthesis.onvoiceschanged = () => {
          this.refreshVoices();
        };
      }
    }
  }

  public refreshVoices(): SpeechSynthesisVoice[] {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return [];
    }
    const list = window.speechSynthesis.getVoices();
    if (list.length > 0) {
      this.voices = list;
      this.isInitialized = true;
    }
    return this.voices;
  }

  /**
   * Identifies best-matching Windows "Read Aloud" voice for a given persona hint.
   * Priority order:
   * 1. Microsoft Natural / Online Read Aloud voices (e.g. Edge "Read Aloud" Natural voices)
   * 2. Standard Windows Desktop SAPI voices (Microsoft David, Microsoft Zira, Microsoft Mark)
   * 3. Any Microsoft English voice
   * 4. System default English voice
   */
  public getBestWindowsVoice(personaHint?: string): WindowsVoiceMatch {
    const list = this.refreshVoices();
    if (list.length === 0) {
      return {
        voice: null,
        name: 'Windows Default Voice (Synthesizer Pending)',
        isNatural: false,
        isWindowsDefault: true,
      };
    }

    const safeHint = typeof personaHint === 'string' ? personaHint : '';
    const lowerHint = safeHint.toLowerCase();
    const isFemalePreferred = !['charon', 'fenrir', 'puck', 'orpheus', 'enceladus'].includes(lowerHint);

    // 1. Check for Microsoft Natural / Online Read Aloud voices
    const naturalVoices = list.filter(
      (v) =>
        v.lang.startsWith('en') &&
        (v.name.includes('Natural') || v.name.includes('Online')) &&
        (v.name.includes('Microsoft') || v.name.includes('Edge'))
    );

    if (naturalVoices.length > 0) {
      if (isFemalePreferred) {
        const femaleNat = naturalVoices.find(
          (v) =>
            v.name.includes('Jenny') ||
            v.name.includes('Aria') ||
            v.name.includes('Ava') ||
            v.name.includes('Michelle')
        );
        if (femaleNat) {
          return { voice: femaleNat, name: femaleNat.name, isNatural: true, isWindowsDefault: true };
        }
      } else {
        const maleNat = naturalVoices.find(
          (v) =>
            v.name.includes('Christopher') ||
            v.name.includes('Guy') ||
            v.name.includes('Davis') ||
            v.name.includes('Steffan') ||
            v.name.includes('Andrew')
        );
        if (maleNat) {
          return { voice: maleNat, name: maleNat.name, isNatural: true, isWindowsDefault: true };
        }
      }
      return {
        voice: naturalVoices[0],
        name: naturalVoices[0].name,
        isNatural: true,
        isWindowsDefault: true,
      };
    }

    // 2. Standard Windows Desktop SAPI voices (Microsoft David, Zira, Mark, George)
    if (isFemalePreferred) {
      const zira = list.find(
        (v) => v.name.includes('Microsoft Zira') || (v.name.includes('Zira') && v.lang.startsWith('en'))
      );
      if (zira) {
        return { voice: zira, name: zira.name, isNatural: false, isWindowsDefault: true };
      }
    } else {
      const david = list.find(
        (v) => v.name.includes('Microsoft David') || (v.name.includes('David') && v.lang.startsWith('en'))
      );
      if (david) {
        return { voice: david, name: david.name, isNatural: false, isWindowsDefault: true };
      }
      const mark = list.find(
        (v) => v.name.includes('Microsoft Mark') || (v.name.includes('Mark') && v.lang.startsWith('en'))
      );
      if (mark) {
        return { voice: mark, name: mark.name, isNatural: false, isWindowsDefault: true };
      }
    }

    // 3. Any Microsoft English voice
    const anyMs = list.find((v) => v.name.includes('Microsoft') && v.lang.startsWith('en'));
    if (anyMs) {
      return { voice: anyMs, name: anyMs.name, isNatural: false, isWindowsDefault: true };
    }

    // 4. Default OS English voice
    const defaultVoice = list.find((v) => v.default && v.lang.startsWith('en')) || list.find((v) => v.lang.startsWith('en')) || list[0];
    return {
      voice: defaultVoice || null,
      name: defaultVoice ? defaultVoice.name : 'System Default',
      isNatural: false,
      isWindowsDefault: false,
    };
  }

  /**
   * Speak using Windows Read Aloud Speech Synthesis
   */
  public speak(
    phrase: string,
    options: {
      personaHint?: string;
      specificVoiceName?: string;
      rate?: number;
      pitch?: number;
      volume?: number;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: unknown) => void;
    } = {}
  ): boolean {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.warn('[WindowsVoice] SpeechSynthesis API unavailable.');
      options.onError?.(new Error('SpeechSynthesis API unavailable'));
      return false;
    }

    try {
      window.speechSynthesis.cancel();

      const cleanText = phrase.trim();
      if (!cleanText) return false;

      // PRONUNCIATION DIRECTIVE: The acronym 'VOXCON' is pronounced as two syllables: 'Vox-Con' 
      // (the first syllable 'Vox' sounds like 'fox' with a 'v', and 'Con' sounds like the first syllable of the word 'conference'). 
      // Never spell out 'V-O-X-C-O-N' letter-by-letter.
      const phoneticallyTunedText = cleanText.replace(/\bVOXCON\b/gi, 'Vox-Con');
      const utterance = new SpeechSynthesisUtterance(phoneticallyTunedText);
      let selectedVoiceObj: SpeechSynthesisVoice | null = null;

      if (options.specificVoiceName) {
        const found = this.voices.find((v) => v.name === options.specificVoiceName);
        if (found) {
          selectedVoiceObj = found;
        }
      }

      if (!selectedVoiceObj) {
        const match = this.getBestWindowsVoice(options.personaHint);
        selectedVoiceObj = match.voice;
      }

      if (selectedVoiceObj) {
        utterance.voice = selectedVoiceObj;
      }

      utterance.rate = options.rate ?? 1.02;
      utterance.pitch = options.pitch ?? 0.98;
      if (typeof options.volume === 'number') {
        utterance.volume = options.volume;
      }

      utterance.onstart = () => {
        options.onStart?.();
      };

      utterance.onend = () => {
        options.onEnd?.();
      };

      utterance.onerror = (e) => {
        console.warn('[WindowsVoice] Utterance error:', e);
        options.onEnd?.();
        options.onError?.(e);
      };

      window.speechSynthesis.speak(utterance);
      return true;
    } catch (err) {
      console.error('[WindowsVoice] Synthesis failure:', err);
      options.onError?.(err);
      return false;
    }
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.refreshVoices();
  }

  public onVoicesUpdated(callback: (voices: SpeechSynthesisVoice[]) => void): () => void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return () => {};
    }
    const handler = () => {
      callback(this.refreshVoices());
    };
    window.speechSynthesis.addEventListener('voiceschanged', handler);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', handler);
    };
  }

  public cancel(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  public isSpeaking(): boolean {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return false;
    }
    return window.speechSynthesis.speaking;
  }

  public isAvailable(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }
}

export const windowsVoiceEngine = new WindowsVoiceEngine();
