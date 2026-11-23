// All of Velora Bay's sound is synthesized with WebAudio — no audio files. One-shots (gunfire,
// explosions, UI) are built from noise bursts and oscillator drops; the engine and the sirens are
// continuous voices steered every frame; the radio is a small step sequencer that plays three
// generative stations (Neon FM synthwave, Palma Waves chill, Chrome Radio house) while you drive.

const NOTE = (midi) => 440 * 2 ** ((midi - 69) / 12);

const STATIONS = [
  null, // 0 = radio off
  {
    name: 'NEON FM',
    bpm: 102,
    bass: [45, -1, 45, -1, 45, -1, 48, -1, 43, -1, 43, -1, 50, -1, 48, -1],
    arp: [69, 72, 76, 79, 76, 72, 69, 72, 76, 79, 81, 79, 76, 72, 69, 64],
    wave: 'sawtooth',
    bright: 900,
  },
  {
    name: 'PALMA WAVES',
    bpm: 74,
    bass: [41, -1, -1, -1, 48, -1, -1, -1, 43, -1, -1, -1, 50, -1, -1, -1],
    arp: [65, 69, 72, 76, 72, 69, 65, 69, 64, 67, 71, 74, 71, 67, 64, 67],
    wave: 'triangle',
    bright: 1400,
  },
  {
    name: 'CHROME RADIO',
    bpm: 124,
    bass: [38, 38, -1, 38, 38, -1, 38, 41, 38, 38, -1, 38, 43, -1, 41, -1],
    arp: [62, -1, 65, -1, 69, -1, 65, -1, 62, -1, 65, -1, 72, -1, 69, -1],
    wave: 'square',
    bright: 2200,
  },
];
export const STATION_NAMES = STATIONS.map((s) => (s === null ? 'Off' : s.name));

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let radioGain = null;
  let ambGain = null;
  let ambStarted = false;
  let muted = false;
  let station = 1;
  let seqTimer = null;
  let step = 0;
  let nextStepTime = 0;

  function unlock() {
    if (ctx !== null) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? window.webkitAudioContext;
    if (AC === undefined) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ctx.destination);

    // Engine voice: two detuned saws through a lowpass, gain steered by speed.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'square';
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    engineOsc2.start();

    // Siren voice: a square wave whose pitch the update loop wobbles.
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();

    radioGain = ctx.createGain();
    radioGain.gain.value = 0;
    radioGain.connect(master);
    seqTimer = window.setInterval(scheduleRadio, 90);

    // Evening ambience layer: soft looping surf (filtered noise, slow swell) with sparse
    // synthesized crickets over it. Very low gain, and it rides the same master/mute as everything.
    ambGain = ctx.createGain();
    ambGain.gain.value = 0.0;
    ambGain.connect(master);
    const surf = ctx.createBufferSource();
    surf.buffer = noiseBuffer(2.4);
    surf.loop = true;
    const surfFilter = ctx.createBiquadFilter();
    surfFilter.type = 'lowpass';
    surfFilter.frequency.value = 480;
    const surfGain = ctx.createGain();
    surfGain.gain.value = 0.5;
    const swell = ctx.createOscillator();
    swell.type = 'sine';
    swell.frequency.value = 0.09;
    const swellDepth = ctx.createGain();
    swellDepth.gain.value = 0.22;
    swell.connect(swellDepth);
    swellDepth.connect(surfGain.gain);
    surf.connect(surfFilter);
    surfFilter.connect(surfGain);
    surfGain.connect(ambGain);
    surf.start();
    swell.start();
    ambStarted = true;
  }

  /** One soft cricket chirp: three short high sine pips. Called sparsely from update(). */
  function cricket() {
    if (ctx === null || ambGain === null) return;
    const t0 = ctx.currentTime + 0.02;
    for (let i = 0; i < 3; i += 1) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 4200 + Math.random() * 300;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0, t0 + i * 0.09);
      g.gain.linearRampToValueAtTime(0.16, t0 + i * 0.09 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.09 + 0.06);
      osc.connect(g); g.connect(ambGain);
      osc.start(t0 + i * 0.09); osc.stop(t0 + i * 0.09 + 0.07);
    }
  }
  let cricketT = 0;

  function noiseBuffer(dur) {
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function burst(dur, filterType, from, to, gainValue, when = 0) {
    if (ctx === null) return;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur);
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
    src.stop(t + dur);
  }

  function tone(type, from, to, dur, gainValue, when = 0) {
    if (ctx === null) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur);
  }

  function scheduleRadio() {
    if (ctx === null || radioGain === null) return;
    const st = STATIONS[station];
    const wantGain = st !== null && radioOn ? 0.16 : 0;
    radioGain.gain.setTargetAtTime(wantGain, ctx.currentTime, 0.1);
    if (st === null || !radioOn) return;
    const stepDur = 60 / st.bpm / 2; // eighth notes
    if (nextStepTime < ctx.currentTime) nextStepTime = ctx.currentTime + 0.05;
    while (nextStepTime < ctx.currentTime + 0.22) {
      playStep(st, step % 16, nextStepTime);
      step += 1;
      nextStepTime += stepDur;
    }
  }

  function playStep(st, s, t) {
    const bassNote = st.bass[s];
    if (bassNote > 0) {
      const osc = ctx.createOscillator();
      osc.type = st.wave;
      osc.frequency.value = NOTE(bassNote);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = st.bright;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.20, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 60 / st.bpm / 2);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(radioGain);
      osc.start(t);
      osc.stop(t + 60 / st.bpm / 2);
    }
    const arpNote = st.arp[s];
    if (arpNote > 0) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = NOTE(arpNote);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.07, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain);
      gain.connect(radioGain);
      osc.start(t);
      osc.stop(t + 0.18);
    }
    if (station === 3) {
      // Chrome Radio gets a four-on-the-floor kick and off-beat hats.
      if (s % 4 === 0) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        osc.connect(gain);
        gain.connect(radioGain);
        osc.start(t);
        osc.stop(t + 0.15);
      }
      if (s % 4 === 2) burstAt(t, 0.03, 7000, 0.05);
    }
  }

  function burstAt(t, dur, freq, gainValue) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur);
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(radioGain);
    src.start(t);
    src.stop(t + dur);
  }

  let radioOn = false;

  return {
    unlock,
    get muted() {
      return muted;
    },
    setMuted(value) {
      muted = value;
      if (master !== null && ctx !== null) master.gain.setTargetAtTime(muted ? 0 : 0.55, ctx.currentTime, 0.03);
    },
    get station() {
      return station;
    },
    stationName() {
      return STATION_NAMES[station];
    },
    cycleStation() {
      station = (station + 1) % STATIONS.length;
      step = 0;
      nextStepTime = 0;
      return station;
    },
    /** Called every frame with the world state: steers engine, sirens and radio audibility. */
    update(state) {
      if (ctx === null) return;
      // Ambience swells near the shore and fades inland; crickets chirp at random dusk intervals.
      if (ambGain !== null && ambStarted) {
        const nearShore = state.player.x > 4000 ? 1 : state.player.x > 3000 ? 0.55 : 0.3;
        ambGain.gain.setTargetAtTime(0.055 * nearShore, ctx.currentTime, 0.4);
        cricketT -= 1 / 60;
        if (cricketT <= 0) { cricket(); cricketT = 1.5 + Math.random() * 4; }
      }
      const player = state.player;
      const inCar = player.car !== null;
      radioOn = inCar && station !== 0;
      if (engineGain !== null) {
        const speed = inCar ? Math.abs(player.car.speed) : 0;
        const target = inCar ? 0.05 + Math.min(0.05, speed / 6000) : 0;
        engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
        const f = 55 + speed * 0.42;
        engineOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.05);
        engineOsc2.frequency.setTargetAtTime(f * 0.5 + 2, ctx.currentTime, 0.05);
      }
      if (sirenGain !== null) {
        let nearest = Infinity;
        for (const car of state.cars) {
          if (car.kind !== 'police' || car.dead) continue;
          const d = Math.hypot(car.x - player.x, car.y - player.y);
          if (d < nearest) nearest = d;
        }
        const target = state.wanted.stars > 0 && nearest < 900 ? Math.max(0, 0.075 * (1 - nearest / 900)) : 0;
        sirenGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
        if (target > 0) sirenOsc.frequency.setTargetAtTime(700 + Math.sin(state.t * 5.2) * 160, ctx.currentTime, 0.03);
      }
    },
    click() {
      tone('square', 880, 660, 0.06, 0.08);
    },
    confirm() {
      tone('square', 660, 990, 0.09, 0.09);
    },
    shot(kind) {
      if (kind === 'shotgun') {
        burst(0.22, 'lowpass', 2600, 200, 0.5);
        tone('sine', 160, 50, 0.18, 0.3);
      } else if (kind === 'smg') {
        burst(0.07, 'bandpass', 1800, 500, 0.30);
      } else {
        burst(0.11, 'bandpass', 1400, 300, 0.38);
      }
    },
    dryFire() {
      tone('square', 1200, 900, 0.04, 0.06);
    },
    punch() {
      burst(0.08, 'lowpass', 700, 150, 0.3);
    },
    crash(big) {
      burst(big ? 0.4 : 0.18, 'lowpass', 1200, 120, big ? 0.5 : 0.28);
      tone('sine', 120, 40, big ? 0.35 : 0.18, 0.25);
    },
    explosion() {
      burst(0.7, 'lowpass', 3000, 60, 0.8);
      tone('sine', 90, 28, 0.6, 0.6);
    },
    cash() {
      tone('square', 990, 990, 0.06, 0.10);
      tone('square', 1320, 1320, 0.1, 0.10, 0.06);
    },
    starUp() {
      tone('sawtooth', 392, 392, 0.12, 0.12);
      tone('sawtooth', 523, 523, 0.2, 0.12, 0.1);
    },
    jobDone() {
      tone('triangle', 523, 523, 0.12, 0.14);
      tone('triangle', 659, 659, 0.12, 0.14, 0.1);
      tone('triangle', 784, 784, 0.22, 0.14, 0.2);
    },
    jobFail() {
      tone('triangle', 330, 330, 0.16, 0.14);
      tone('triangle', 262, 247, 0.3, 0.14, 0.14);
    },
    pickup() {
      tone('sine', 740, 1180, 0.09, 0.12);
    },
  };
}
