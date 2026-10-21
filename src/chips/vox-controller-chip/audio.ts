/**
 * Web Audio API MythOS Tactical Sound Engine
 * Synthesizes tactile button clicks, telemetry chimes, and alert tones.
 */

class LcarSoundEngine {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public playBeep(freq = 880, type: OscillatorType = 'sine', duration = 0.08, gainVal = 0.08) {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Audio autoplay restrictions or context error
    }
  }

  public playChime() {
    if (!this.enabled) return;
    this.playBeep(1046.5, 'sine', 0.06, 0.06); // C6
    setTimeout(() => this.playBeep(1318.5, 'sine', 0.08, 0.06), 40); // E6
  }

  public playAlert() {
    if (!this.enabled) return;
    this.playBeep(440, 'triangle', 0.15, 0.1);
    setTimeout(() => this.playBeep(880, 'triangle', 0.15, 0.1), 120);
  }

  public playWarning() {
    if (!this.enabled) return;
    this.playBeep(329.63, 'sawtooth', 0.12, 0.08); // E4
  }

  public playToggle() {
    if (!this.enabled) return;
    this.playBeep(783.99, 'sine', 0.05, 0.05); // G5
  }

  public playSquelch(type: 'open' | 'close' = 'open') {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const bufferSize = this.ctx.sampleRate * (type === 'open' ? 0.08 : 0.12);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (type === 'open' ? 0.05 : 0.03);
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(type === 'open' ? 1200 : 800, this.ctx.currentTime);
      filter.Q.setValueAtTime(1.5, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (type === 'open' ? 0.07 : 0.1));

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start();
    } catch {
      // Silent fail
    }
  }

  public playNegative() {
    if (!this.enabled) return;
    // Two low, short warning tones
    this.playBeep(220, 'square', 0.15, 0.05);
    setTimeout(() => this.playBeep(220, 'square', 0.15, 0.05), 200);
  }

  public playRoger() {
    if (!this.enabled) return;
    // Single high, short confirmation tone
    this.playBeep(880, 'sine', 0.08, 0.05);
  }

  public playCriticalAlert() {
    if (!this.enabled) return;
    // Rapid urgent multi-tone klaxon for CRITICAL
    this.playBeep(987.77, 'sawtooth', 0.1, 0.1); // B5
    setTimeout(() => this.playBeep(1318.5, 'sawtooth', 0.1, 0.1), 100); // E6
    setTimeout(() => this.playBeep(987.77, 'sawtooth', 0.1, 0.1), 200); // B5
    setTimeout(() => this.playBeep(1318.5, 'sawtooth', 0.15, 0.12), 300); // E6
  }

  public playThreatAlert() {
    if (!this.enabled) return;
    // Distinct tactical radar pulse / warning tone for THREAT
    this.playBeep(587.33, 'square', 0.15, 0.09); // D5
    setTimeout(() => this.playBeep(440, 'square', 0.15, 0.09), 150); // A4
    setTimeout(() => this.playBeep(587.33, 'square', 0.2, 0.1), 300); // D5
  }

  public isMuted(): boolean {
    return !this.enabled;
  }

  public toggleMute(): boolean {
    this.enabled = !this.enabled;
    return !this.enabled;
  }
}

export const soundEngine = new LcarSoundEngine();
