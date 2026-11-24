// VELORA BAY 3D — tiny WebAudio synth: engine, siren, jingles, crash thuds.
// Everything is created lazily on the first user gesture; all failures are swallowed.
const N = { C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196, A3: 220, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440 };
export const RADIO_STATIONS = [
  { name: '📻 NEON DRIVE FM — Synthwave', bpm: 104, arp: true, hat: true, bassType: 'sawtooth', arpType: 'square', padType: 'sawtooth', chords: [[N.A3, N.C4, N.E4], [N.F3, N.A3, N.C4], [N.C3, N.E3, N.G3], [N.G3, N.B3, N.D4]] },
  { name: '📻 TIDAL LOUNGE — Lo-Fi', bpm: 72, arp: false, hat: false, bassType: 'sine', arpType: 'triangle', padType: 'triangle', chords: [[N.C3, N.E3, N.G3], [N.A3, N.C4, N.E4], [N.F3, N.A3, N.C4], [N.G3, N.B3, N.D4]] },
  { name: '📻 RADIO SOLANA — Latin', bpm: 96, arp: true, hat: true, bassType: 'triangle', arpType: 'triangle', padType: 'square', chords: [[N.A3, N.C4, N.E4], [N.E3, N.G3, N.B3], [N.F3, N.A3, N.C4], [N.E3, N.G3, N.B3]] },
];
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
  // --- car radio: 3 synthesized stations (no audio assets) ----------------
  // station: -1 off, 0 synthwave, 1 lo-fi, 2 latin-ish. A lookahead scheduler
  // plays short note patterns through a dedicated gain so it never fights
  // the engine/siren chain.
  setRadio(station) {
    this.radioStation = station;
    if (station < 0) { this.stopRadio(); return null; }
    this.ensure(); if (!this.ctx) return null;
    try {
      if (!this.radioGain) {
        this.radioGain = this.ctx.createGain(); this.radioGain.gain.value = 0.14;
        this.radioGain.connect(this.master);
      }
      this.radioStep = 0; this.radioNext = this.ctx.currentTime + 0.1;
      if (this.radioTimer) clearInterval(this.radioTimer);
      this.radioTimer = setInterval(() => this._radioTick(), 90);
      return RADIO_STATIONS[station].name;
    } catch { return null; }
  }
  stopRadio() {
    if (this.radioTimer) { clearInterval(this.radioTimer); this.radioTimer = null; }
    this.radioStation = -1;
  }
  _radioTick() {
    if (!this.ctx || this.radioStation < 0 || !this.radioGain) return;
    try {
      const st = RADIO_STATIONS[this.radioStation];
      const stepDur = 60 / st.bpm / 2; // eighth notes
      while (this.radioNext < this.ctx.currentTime + 0.28) {
        const step = this.radioStep;
        const bar = Math.floor(step / 8) % st.chords.length;
        const chord = st.chords[bar];
        const t0 = this.radioNext;
        // bass on beats, chord stabs / arp on eighths
        if (step % 2 === 0) this._note(chord[0] / 2, t0, stepDur * 1.6, st.bassType, 0.30);
        const arpNote = chord[step % chord.length];
        if (st.arp) this._note(arpNote * 2, t0, stepDur * 0.9, st.arpType, 0.10);
        if (step % 4 === 2) for (const n of chord) this._note(n, t0, stepDur * 1.4, st.padType, 0.05);
        if (st.hat && step % 2 === 1) this._hat(t0, 0.05);
        this.radioNext += stepDur; this.radioStep++;
      }
    } catch { /* radio is decorative */ }
  }
  _note(freq, t0, dur, type, vol) {
    const c = this.ctx;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.radioGain); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  _hat(t0, vol) {
    const c = this.ctx, len = Math.floor(c.sampleRate * 0.04);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
    const g = c.createGain(); g.gain.value = vol;
    src.connect(f).connect(g).connect(this.radioGain); src.start(t0);
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
