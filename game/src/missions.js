// VELORA BAY 3D — game state: cash, respect, wanted heat and the three story jobs.
// Wanted: crimes add heat (0..5). Displayed stars = ceil(heat). Heat decays one full
// point per 12 s while no police unit can see the player. Police strength follows stars.
import { clamp } from './config.js';

export const JOBS = [
  {
    name: 'Marina Run',
    intro: 'Pick up the package at the marina pier, then deliver it downtown.',
    reward: 400, respect: 12,
    steps: [
      { at: { x: 162, z: 54 }, label: 'Reach the marina pickup', time: 120 },
      { at: { x: 0, z: 0 }, label: 'Deliver downtown — the clock is running!', time: 180 },
    ],
  },
  {
    name: 'Checkpoint Rush',
    intro: 'Hit all six checkpoints before the timer runs out.',
    reward: 600, respect: 18,
    steps: [
      { at: { x: -108, z: -108 }, label: 'Checkpoint 1 of 6', time: 150 },
      { at: { x: 108, z: -108 }, label: 'Checkpoint 2 of 6', time: 0 },
      { at: { x: 108, z: 108 }, label: 'Checkpoint 3 of 6', time: 0 },
      { at: { x: -108, z: 108 }, label: 'Checkpoint 4 of 6', time: 0 },
      { at: { x: 0, z: 54 }, label: 'Checkpoint 5 of 6', time: 0 },
      { at: { x: -54, z: 0 }, label: 'Final checkpoint!', time: 0 },
    ],
  },
  {
    name: 'Heat Escape',
    intro: 'The VBPD is on you at 3 stars. Lose your wanted level completely.',
    reward: 800, respect: 25,
    steps: [{ at: null, label: 'Lose the heat — break line of sight and stay hidden', time: 0 }],
  },
];

const RESPECT_RANKS = [
  [0, 'Nobody'], [25, 'Runner'], [60, 'Wheelman'], [110, 'Hustler'],
  [175, 'Fixer'], [260, 'Shot Caller'], [380, 'Underboss'], [540, 'Kingpin of Velora'],
];

export class GameState {
  constructor() {
    this.money = 250;
    this.respect = 0;
    this.heat = 0;            // float 0..5
    this.unseenTime = 0;      // seconds since any police saw the player
    this.jobIndex = 0;        // next job to offer
    this.activeJob = -1;
    this.step = 0;
    this.timeLeft = 0;
    this.marker = null;       // {x,z} world beacon or null
    this.objective = 'Explore Velora Bay — find the gold beacon to take a job.';
    this.onBanner = null;     // (title, sub) => {}
    this.onObjective = null;  // (text) => {}
    this.clockMin = 17 * 60 + 40; // game clock starts at golden hour 17:40
  }
  get stars() { return this.heat <= 0.02 ? 0 : Math.min(5, Math.ceil(this.heat)); }
  get rank() {
    let r = RESPECT_RANKS[0][1];
    for (const [need, name] of RESPECT_RANKS) if (this.respect >= need) r = name;
    return r;
  }
  get jobAvailable() { return this.activeJob < 0 && this.jobIndex < JOBS.length; }

  addCrime(points, witnessed) {
    if (!witnessed && points < 1) return; // minor unwitnessed scrapes are free
    this.heat = clamp(this.heat + points, 0, 5);
    this.unseenTime = 0;
  }
  setWanted(stars) { this.heat = clamp(stars, 0, 5); this.unseenTime = 0; }

  setObjective(text) {
    this.objective = text;
    if (this.onObjective) this.onObjective(text);
  }
  banner(title, sub) { if (this.onBanner) this.onBanner(title, sub); }

  startJob(i) {
    if (i < 0 || i >= JOBS.length || this.activeJob >= 0) return false;
    this.activeJob = i; this.step = 0;
    const job = JOBS[i];
    this.banner(job.name, job.intro);
    if (i === 2) { this.setWanted(3); this.marker = null; this.setObjective(job.steps[0].label); }
    else this.advanceStep();
    return true;
  }
  advanceStep() {
    const job = JOBS[this.activeJob];
    const step = job.steps[this.step];
    if (!step) return this.completeJob();
    this.marker = step.at;
    if (step.time > 0) this.timeLeft = step.time;
    this.setObjective(step.label + (step.time > 0 ? '' : ''));
  }
  completeJob() {
    const finished = this.activeJob;
    const job = JOBS[finished];
    this.money += job.reward;
    this.respect += job.respect;
    this.banner('JOB COMPLETE', `${job.name} — +$${job.reward}, respect up. Rank: ${this.rank}`);
    this.activeJob = -1; this.marker = null; this.timeLeft = 0;
    this.jobIndex = Math.min(JOBS.length, Math.max(this.jobIndex, finished + 1));
    this.setObjective(this.jobIndex < JOBS.length
      ? `Next job available: ${JOBS[this.jobIndex].name} — find the gold beacon.`
      : 'All jobs done. Velora Bay is yours — free roam!');
    if (this.onJobComplete) this.onJobComplete();
  }
  failJob(reason) {
    const job = JOBS[this.activeJob];
    this.banner('JOB FAILED', `${job.name} — ${reason}`);
    this.activeJob = -1; this.marker = null;
    this.setObjective(`Job failed. The ${job.name} beacon is still out there — try again.`);
  }

  // ctx: { playerPos:{x,z}, policeSeesPlayer:bool }
  update(dt, ctx) {
    this.clockMin = (this.clockMin + dt * 2) % (24 * 60); // 1 real second = 2 game minutes
    // wanted decay
    if (this.heat > 0) {
      if (ctx.policeSeesPlayer) this.unseenTime = 0;
      else {
        this.unseenTime += dt;
        if (this.unseenTime >= 12) { this.heat = Math.max(0, this.heat - 1); this.unseenTime = 0; }
      }
    }
    if (this.activeJob < 0) return;
    const job = JOBS[this.activeJob];
    if (this.activeJob === 2) {
      if (this.heat <= 0.02) this.completeJob();
      return;
    }
    const step = job.steps[this.step];
    if (step && step.time > 0 || (this.activeJob === 1 && this.step === 0)) {
      // timers: job 1 times each leg; job 2 times the whole run from step 0
    }
    if (this.timeLeft > 0 && (this.activeJob !== 1 || true)) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        if (this.activeJob === 1) return this.failJob('out of time');
        if (this.activeJob === 0) return this.failJob('out of time');
      }
    }
    if (step && step.at) {
      const d = Math.hypot(ctx.playerPos.x - step.at.x, ctx.playerPos.z - step.at.z);
      if (d < 7) {
        this.step++;
        if (this.activeJob === 0 && this.step === 1) this.banner('PACKAGE SECURED', 'Now deliver it downtown!');
        this.advanceStep();
      }
    }
  }

  clockText() {
    const h = Math.floor(this.clockMin / 60), m = Math.floor(this.clockMin % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
