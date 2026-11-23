// VELORA BAY 3D — tiny WebAudio synth: engine, siren, jingles, crash thuds.
// Everything is created lazily on the first user gesture; all failures are swallowed.
export class GameAudio {
  constructor() {
    this.ctx = null; this.engineOsc = null; this.engineGain = null; this.engineFilter = null;
    this.sirenOsc = null; this.sirenGain = null; this.muted = false;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch { this.ctx = null; }
  }
  startEngine() {
    this.ensure(); if (!this.ctx || this.engineOsc) return;
    try {
      const c = this.ctx;
      this.engineOsc = c.createOscillator(); this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 55;
      this.engineFilter = c.createBiquadFilter(); this.engineFilter.type = 'lowpass'; this.engineFilter.frequency.value = 320;
      this.engineGain = c.createGain(); this.engineGain.gain.value = 0.0;
      this.engineOsc.connect(this.engineFilter).connect(this.engineGain).connect(this.master);
      this.engineOsc.start();
      this.sirenOsc = c.createOscillator(); this.sirenOsc.type = 'square'; this.sirenOsc.frequency.value = 700;
      this.sirenGain = c.createGain(); this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain).connect(this.master);
      this.sirenOsc.start();
    } catch { /* audio is decorative */ }
  }
  stopEngine() {
    try { this.engineOsc?.stop(); this.sirenOsc?.stop(); } catch {}
    this.engineOsc = null; this.sirenOsc = null;
  }
  // speedNorm 0..1, sirenLevel 0..1 (nearest police), t seconds
  update(speedNorm, sirenLevel, t) {
    if (!this.ctx || !this.engineOsc) return;
    try {
      const c = this.ctx;
      this.engineOsc.frequency.setTargetAtTime(50 + speedNorm * 165, c.currentTime, 0.08);
      this.engineFilter.frequency.setTargetAtTime(280 + speedNorm * 900, c.currentTime, 0.1);
      this.engineGain.gain.setTargetAtTime(0.05 + speedNorm * 0.1, c.currentTime, 0.1);
      this.sirenOsc.frequency.setTargetAtTime((Math.sin(t * 4.4) > 0 ? 715 : 955), c.currentTime, 0.03);
      this.sirenGain.gain.setTargetAtTime(sirenLevel * 0.045, c.currentTime, 0.15);
    } catch {}
  }
  jingle(ok = true) {
    this.ensure(); if (!this.ctx) return;
    try {
      const c = this.ctx, notes = ok ? [523, 659, 784] : [392, 330, 262];
      notes.forEach((f, i) => {
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, c.currentTime + i * 0.11);
        g.gain.exponentialRampToValueAtTime(0.16, c.currentTime + i * 0.11 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + i * 0.11 + 0.24);
        o.connect(g).connect(this.master); o.start(c.currentTime + i * 0.11); o.stop(c.currentTime + i * 0.11 + 0.3);
      });
    } catch {}
  }
  crash(intensity = 1) {
    this.ensure(); if (!this.ctx) return;
    try {
      const c = this.ctx, len = Math.floor(c.sampleRate * 0.16);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = c.createBufferSource(); src.buffer = buf;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
      const g = c.createGain(); g.gain.value = 0.22 * Math.min(1, intensity);
      src.connect(f).connect(g).connect(this.master); src.start();
    } catch {}
  }
}
