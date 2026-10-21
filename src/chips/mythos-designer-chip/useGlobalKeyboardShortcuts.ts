import { useEffect, useState, useRef, useCallback } from 'react';
import { soundEngine } from '../utils/audio';

interface GlobalKeyboardShortcutsOptions {
  onToggleMic: () => void;
  onDisconnectVoice?: () => void;
  onToggleAnomaly: () => void;
  onRecalibrate: () => void;
  onCycleAppMode: (direction: 'forward' | 'backward') => void;
  onSetAppModeByIndex: (index: number) => void;
  onCycleDashboardTab: () => void;
  onToggleMute: () => void;
  onToggleHelp: () => void;
  onCloseModals: () => void;
}

export interface ShortcutFeedbackState {
  label: string;
  keys: string;
  type: 'info' | 'alert' | 'success';
}

export function useGlobalKeyboardShortcuts({
  onToggleMic,
  onDisconnectVoice,
  onToggleAnomaly,
  onRecalibrate,
  onCycleAppMode,
  onSetAppModeByIndex,
  onCycleDashboardTab,
  onToggleMute,
  onToggleHelp,
  onCloseModals,
}: GlobalKeyboardShortcutsOptions) {
  const [feedback, setFeedback] = useState<ShortcutFeedbackState | null>(null);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showFeedback = useCallback((label: string, keys: string, type: 'info' | 'alert' | 'success' = 'info') => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }
    setFeedback({ label, keys, type });
    feedbackTimerRef.current = setTimeout(() => {
      setFeedback(null);
    }, 2400);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      const isAlt = e.altKey;
      const isShift = e.shiftKey;
      const isCtrl = e.ctrlKey || e.metaKey;
      const key = e.key;
      const lowerKey = key.toLowerCase();

      // Escape always closes overlays
      if (key === 'Escape') {
        onCloseModals();
        return;
      }

      // 1. Voice Control Uplink Disconnect: Alt + Shift + M
      if (isAlt && isShift && lowerKey === 'm') {
        e.preventDefault();
        onDisconnectVoice?.();
        showFeedback('VOICE UPLINK TERMINATED', 'Alt + Shift + M', 'alert');
        return;
      }

      // 2. Toggle Voice Microphone: M (when not typing) OR Alt + M (anywhere)
      if ((isAlt && lowerKey === 'm') || (!isTyping && !isCtrl && !isAlt && lowerKey === 'm')) {
        e.preventDefault();
        onToggleMic();
        showFeedback('TOGGLE MICROPHONE', isAlt ? 'Alt + M' : 'M', 'info');
        return;
      }

      // 3. Toggle System Anomaly Simulation: A (when not typing) OR Alt + A (anywhere)
      if ((isAlt && lowerKey === 'a') || (!isTyping && !isCtrl && !isAlt && lowerKey === 'a')) {
        e.preventDefault();
        onToggleAnomaly();
        showFeedback('TOGGLE ANOMALY SIMULATION', isAlt ? 'Alt + A' : 'A', 'alert');
        return;
      }

      // 4. Recalibrate Telemetry: R (when not typing) OR Alt + R (anywhere)
      if ((isAlt && lowerKey === 'r') || (!isTyping && !isCtrl && !isAlt && lowerKey === 'r')) {
        e.preventDefault();
        onRecalibrate();
        showFeedback('RECALIBRATE TELEMETRY', isAlt ? 'Alt + R' : 'R', 'success');
        return;
      }

      // 5. Master Sound Mute Toggle: U (when not typing) OR Alt + U (anywhere)
      if ((isAlt && lowerKey === 'u') || (!isTyping && !isCtrl && !isAlt && lowerKey === 'u')) {
        e.preventDefault();
        onToggleMute();
        showFeedback('TOGGLE SOUND ENGINE', isAlt ? 'Alt + U' : 'U', 'info');
        return;
      }

      // 6. Cycle App Mode / Workstation Tabs:
      // Alt + T (forward), Alt + Shift + T (backward), or T / Shift + T (when not typing)
      if (isAlt && lowerKey === 't') {
        e.preventDefault();
        const dir = isShift ? 'backward' : 'forward';
        onCycleAppMode(dir);
        showFeedback(`SWITCH TAB (${dir.toUpperCase()})`, isShift ? 'Alt + Shift + T' : 'Alt + T', 'info');
        return;
      }
      if (!isTyping && !isCtrl && !isAlt && lowerKey === 't') {
        e.preventDefault();
        const dir = isShift ? 'backward' : 'forward';
        onCycleAppMode(dir);
        showFeedback(`SWITCH TAB (${dir.toUpperCase()})`, isShift ? 'Shift + T' : 'T', 'info');
        return;
      }

      // 7. Direct Tab Numbers: 1 to 5 (when not typing) OR Alt + 1 to 5
      if ((isAlt || !isTyping) && !isCtrl && ['1', '2', '3', '4', '5'].includes(key)) {
        e.preventDefault();
        const tabIndex = parseInt(key, 10) - 1;
        onSetAppModeByIndex(tabIndex);
        showFeedback(`WORKSTATION MODE ${key}`, isAlt ? `Alt + ${key}` : key, 'info');
        return;
      }

      // 8. Cycle Dashboard Sub-Tabs (Dashboard / Schematic / Split): D or Alt + D
      if ((isAlt && lowerKey === 'd') || (!isTyping && !isCtrl && !isAlt && lowerKey === 'd')) {
        e.preventDefault();
        onCycleDashboardTab();
        showFeedback('CYCLE DASHBOARD SUB-TAB', isAlt ? 'Alt + D' : 'D', 'info');
        return;
      }

      // 9. Help & Accessibility Shortcuts Panel: ? or Shift + / or F1
      if ((!isTyping && (key === '?' || (isShift && key === '/'))) || key === 'F1') {
        e.preventDefault();
        soundEngine.playToggle();
        onToggleHelp();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  }, [
    onToggleMic,
    onDisconnectVoice,
    onToggleAnomaly,
    onRecalibrate,
    onCycleAppMode,
    onSetAppModeByIndex,
    onCycleDashboardTab,
    onToggleMute,
    onToggleHelp,
    onCloseModals,
    showFeedback,
  ]);

  return { feedback };
}
