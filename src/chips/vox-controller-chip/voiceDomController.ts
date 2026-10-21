/**
 * Voice DOM Controller & Tactical Element Dispatcher
 * Allows VOXCON to click, focus, toggle, and adjust all named DIVs, buttons,
 * tabs, knobs, and controls across the application.
 */

import { soundEngine } from './audio';

export interface VoiceActionResult {
  success: boolean;
  message: string;
  elementId?: string;
}

/**
 * Tactical pulse highlight class to confirm voice activation on an element
 */
const TACTICAL_VOICE_PULSE_CLASS = 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-black shadow-[0_0_15px_rgba(6,182,212,0.9)] animate-pulse';

function applyTacticalHighlight(el: HTMLElement) {
  try {
    const originalTransition = el.style.transition;
    el.style.transition = 'all 0.2s ease-in-out';
    el.classList.add(...TACTICAL_VOICE_PULSE_CLASS.split(' '));

    setTimeout(() => {
      try {
        el.classList.remove(...TACTICAL_VOICE_PULSE_CLASS.split(' '));
        el.style.transition = originalTransition;
      } catch {}
    }, 1400);
  } catch {}
}

/**
 * Normalizes voice query strings by stripping filler words
 */
export function normalizeVoiceQuery(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, '')
    .replace(/\b(the|a|an|tab|button|knob|slider|div|card|view|please|can|you|now|just|click|press|activate|select|switch|open)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolves an element in the DOM based on a voice target string
 */
export function findElementByVoiceTarget(targetName: string): HTMLElement | null {
  if (!targetName || typeof document === 'undefined') return null;

  const rawLower = targetName.toLowerCase().trim();
  const normalized = normalizeVoiceQuery(targetName);

  // 1. Direct ID matches
  const directId = document.getElementById(rawLower) || document.getElementById(targetName);
  if (directId) return directId;

  // 2. High-priority predefined mapping for tactical tabs and buttons
  const predefinedMap: Record<string, string[]> = {
    'extrapolated': ['tab-extrapolated-dashboard'],
    'dashboard': ['tab-extrapolated-dashboard'],
    'schematic': ['tab-schematic-canvas'],
    'canvas': ['tab-schematic-canvas'],
    'split': ['tab-split-observability'],
    'observability': ['tab-split-observability'],
    'importer': ['btn-manifest-importer', 'header-importer-btn'],
    'import': ['btn-manifest-importer', 'header-importer-btn'],
    'theme forge': ['nav-btn-sketch-theme', 'btn-theme-forge'],
    'sketch theme': ['nav-btn-sketch-theme'],
    'anomaly': ['header-anomaly-toggle-btn', 'footer-anomaly-toggle-btn'],
    'sound': ['header-sound-toggle-btn'],
    'mute': ['header-sound-toggle-btn'],
    'standby': ['header-voice-standby-btn'],
    'editor mode': ['header-editor-toggle-btn'],
    'preview theme': ['header-editor-toggle-btn'],
  };

  for (const [keyword, elementIds] of Object.entries(predefinedMap)) {
    if (rawLower.includes(keyword) || normalized.includes(keyword)) {
      for (const id of elementIds) {
        const el = document.getElementById(id);
        if (el) return el;
      }
    }
  }

  // 3. Search elements with data-voice-target attribute
  const dataVoiceElements = Array.from(document.querySelectorAll<HTMLElement>('[data-voice-target]'));
  for (const el of dataVoiceElements) {
    const val = (el.getAttribute('data-voice-target') || '').toLowerCase();
    if (val === rawLower || val === normalized || val.includes(normalized) || normalized.includes(val)) {
      return el;
    }
  }

  // 4. Search interactive elements: buttons, tabs, links, inputs
  const interactives = Array.from(
    document.querySelectorAll<HTMLElement>(
      'button, a, [role="button"], [role="tab"], input[type="button"], input[type="submit"], div[id], div[data-voice-target]'
    )
  );

  let bestMatch: HTMLElement | null = null;
  let bestScore = 0;

  for (const el of interactives) {
    const text = (el.innerText || el.textContent || '').toLowerCase().trim();
    const aria = (el.getAttribute('aria-label') || '').toLowerCase();
    const title = (el.getAttribute('title') || '').toLowerCase();
    const id = (el.id || '').toLowerCase();

    // Exact text match
    if (text === rawLower || text === normalized) {
      return el;
    }

    let score = 0;
    if (id.includes(normalized) && normalized.length > 2) score += 50;
    if (text.includes(normalized) && normalized.length > 2) score += 40;
    if (aria.includes(normalized) && normalized.length > 2) score += 30;
    if (title.includes(normalized) && normalized.length > 2) score += 30;

    // Word token matching
    const targetWords = normalized.split(' ').filter((w) => w.length > 2);
    for (const word of targetWords) {
      if (text.includes(word)) score += 15;
      if (id.includes(word)) score += 20;
      if (aria.includes(word) || title.includes(word)) score += 10;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = el;
    }
  }

  if (bestScore >= 30) {
    return bestMatch;
  }

  // 5. Fallback: Search all DIV elements with distinct IDs or cursor-pointer
  const divs = Array.from(document.querySelectorAll<HTMLElement>('div[id], div.cursor-pointer, div[onClick]'));
  for (const d of divs) {
    const text = (d.innerText || '').toLowerCase();
    const id = (d.id || '').toLowerCase();
    if (id.includes(normalized) || (text.includes(normalized) && normalized.length > 3)) {
      return d;
    }
  }

  return null;
}

/**
 * Dispatches a tactical click or activation on any named element in the UI
 */
export function executeVoiceDomClick(targetName: string): VoiceActionResult {
  const el = findElementByVoiceTarget(targetName);
  if (!el) {
    console.warn('[VoiceDom] Could not resolve target element for voice order:', targetName);
    return {
      success: false,
      message: `Element not located: "${targetName}".`,
    };
  }

  applyTacticalHighlight(el);
  soundEngine.playToggle();

  // Execute standard click and mouse events
  try {
    el.focus();
    el.click();
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  } catch (err) {
    console.error('[VoiceDom] Click dispatch error:', err);
  }

  const label = el.innerText?.slice(0, 30) || el.id || targetName;
  return {
    success: true,
    message: `Activated: ${label}`,
    elementId: el.id,
  };
}

/**
 * Adjusts a named slider, knob, or numeric control by name
 */
export function executeVoiceDomAdjust(
  controlName: string,
  action: 'increment' | 'decrement' | 'set' | 'toggle',
  value?: number
): VoiceActionResult {
  if (typeof document === 'undefined') {
    return { success: false, message: 'DOM unavailable' };
  }

  const query = normalizeVoiceQuery(controlName);

  // Search all range and number inputs
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="range"], input[type="number"], input[type="checkbox"]'));

  let targetInput: HTMLInputElement | null = null;

  for (const input of inputs) {
    const id = (input.id || '').toLowerCase();
    const name = (input.name || '').toLowerCase();
    const parentText = (input.parentElement?.innerText || '').toLowerCase();
    const grandparentText = (input.parentElement?.parentElement?.innerText || '').toLowerCase();

    if (id.includes(query) || name.includes(query) || parentText.includes(query) || grandparentText.includes(query)) {
      targetInput = input;
      break;
    }
  }

  if (!targetInput) {
    return {
      success: false,
      message: `Control knob or slider "${controlName}" not located.`,
    };
  }

  applyTacticalHighlight(targetInput);

  if (targetInput.type === 'checkbox') {
    targetInput.checked = !targetInput.checked;
    targetInput.dispatchEvent(new Event('change', { bubbles: true }));
    soundEngine.playToggle();
    return {
      success: true,
      message: `Toggled ${controlName} to ${targetInput.checked ? 'ON' : 'OFF'}.`,
    };
  }

  const min = parseFloat(targetInput.min || '0');
  const max = parseFloat(targetInput.max || '100');
  const step = parseFloat(targetInput.step || '1') || 1;
  const current = parseFloat(targetInput.value || '0');

  let nextValue = current;

  if (action === 'set' && typeof value === 'number') {
    nextValue = Math.min(max, Math.max(min, value));
  } else if (action === 'increment') {
    const delta = step || (max - min) * 0.05;
    nextValue = Math.min(max, current + delta);
  } else if (action === 'decrement') {
    const delta = step || (max - min) * 0.05;
    nextValue = Math.max(min, current - delta);
  }

  targetInput.value = String(nextValue);
  targetInput.dispatchEvent(new Event('input', { bubbles: true }));
  targetInput.dispatchEvent(new Event('change', { bubbles: true }));
  soundEngine.playBeep(750, 'sine', 0.03, 0.03);

  return {
    success: true,
    message: `Adjusted ${controlName} to ${nextValue.toFixed(1)}.`,
    elementId: targetInput.id,
  };
}

/**
 * Fast client-side intent recognition to ensure immediate response to spoken commands
 */
export function matchVoiceIntentFast(text: string): { name: string; args: Record<string, unknown> } | null {
  const lower = text.toLowerCase().trim();

  // 1. Dashboard Tabs (EXTRAPOLATED DASHBOARD, SCHEMATIC CANVAS, SPLIT OBSERVABILITY)
  if (lower.includes('extrapolated') || (lower.includes('dashboard') && !lower.includes('split'))) {
    return { name: 'switchDashboardTab', args: { targetTab: 'dashboard' } };
  }
  if (lower.includes('schematic') || lower.includes('canvas')) {
    return { name: 'switchDashboardTab', args: { targetTab: 'schematic' } };
  }
  if (lower.includes('split') || lower.includes('observability')) {
    return { name: 'switchDashboardTab', args: { targetTab: 'split' } };
  }

  // 2. Themes (NOIR MONOCHROME, Quantum Cyan, Aegis Amber, Hyperion Blue, Obsidian Void)
  if (lower.includes('noir') || lower.includes('monochrome')) {
    return { name: 'switchTheme', args: { themeId: 'noir-dark' } };
  }
  if (lower.includes('quantum') || lower.includes('cyan')) {
    return { name: 'switchTheme', args: { themeId: 'quantum-cyan' } };
  }
  if (lower.includes('aegis') || lower.includes('amber')) {
    return { name: 'switchTheme', args: { themeId: 'aegis-amber' } };
  }
  if (lower.includes('hyperion') || lower.includes('blue')) {
    return { name: 'switchTheme', args: { themeId: 'hyperion-blue' } };
  }
  if (lower.includes('obsidian') || lower.includes('void')) {
    return { name: 'switchTheme', args: { themeId: 'obsidian-void' } };
  }

  // 3. Application Workspace Modes
  if (lower.includes('ui builder') || lower.includes('visual studio') || lower.includes('builder mode')) {
    return { name: 'switchMode', args: { mode: 'ui-builder' } };
  }
  if (lower.includes('token') || lower.includes('token lab') || lower.includes('design tokens') || lower.includes('geometry')) {
    return { name: 'switchMode', args: { mode: 'token-inspector' } };
  }
  if (lower.includes('ai diagnostic') || lower.includes('diagnostics') || lower.includes('mythos diagnostic')) {
    return { name: 'switchMode', args: { mode: 'ai-diagnostics' } };
  }
  if (lower.includes('voice control') || lower.includes('voxcon audio') || lower.includes('transceiver console')) {
    return { name: 'switchMode', args: { mode: 'voice-control' } };
  }
  if (lower.includes('msd view') || lower.includes('master systems') || lower.includes('production console')) {
    return { name: 'switchMode', args: { mode: 'msd-view' } };
  }

  // 4. Anomaly Simulation & Recalibration
  if (lower.includes('induce anomaly') || lower.includes('trigger surge') || lower.includes('trigger anomaly') || lower.includes('simulate anomaly')) {
    return { name: 'setAnomalySimulation', args: { active: true } };
  }
  if (lower.includes('reset nominal') || lower.includes('nominal status') || lower.includes('clear anomaly') || lower.includes('stand down anomaly')) {
    return { name: 'setAnomalySimulation', args: { active: false } };
  }
  if (lower.includes('recalibrate') || lower.includes('purge entropy') || lower.includes('restore coherence')) {
    return { name: 'recalibrateSystem', args: {} };
  }

  // 5. Open Modals
  if (lower.includes('theme forge') || lower.includes('sketch theme')) {
    return { name: 'clickElement', args: { targetName: 'nav-btn-sketch-theme' } };
  }
  if (lower.includes('manifest importer') || lower.includes('import manifest')) {
    return { name: 'clickElement', args: { targetName: 'btn-manifest-importer' } };
  }

  // 6. Direct Click Directives (e.g. "click export", "press ingest", "select pod", "open editor")
  const clickMatch = lower.match(/(?:click|press|select|open|activate)\s+(?:on\s+)?(?:the\s+)?(.+)/i);
  if (clickMatch && clickMatch[1]) {
    return { name: 'clickElement', args: { targetName: clickMatch[1].trim() } };
  }

  // 7. Direct Knob/Slider Adjustment Directives
  const adjustMatch = lower.match(/(?:set|adjust)\s+(?:the\s+)?(.+?)\s+(?:to|=)\s+([0-9.]+)/i);
  if (adjustMatch && adjustMatch[1] && adjustMatch[2]) {
    return {
      name: 'adjustControl',
      args: {
        controlName: adjustMatch[1].trim(),
        action: 'set',
        value: parseFloat(adjustMatch[2]),
      },
    };
  }

  return null;
}
