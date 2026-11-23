// VELORA BAY — story campaign: 5 chapters, 12 short missions built from three
// templates (deliver/pickup steps, checkpoint runs, heat escapes). All names,
// givers and dialogue are original. Free roam between missions; the gold
// beacon marks the next mission giver.
import { clamp } from './config.js';

export const CHAPTERS = [
  { name: 'Paradise Found', missions: [0, 1, 2] },
  { name: 'Paradise Lost', missions: [3, 4] },
  { name: 'Money, Vice & Neon', missions: [5, 6] },
  { name: 'Neon Jurisdiction', missions: [7, 8, 9] },
  { name: 'The Last Tide', missions: [10, 11] },
];
export const chapterOf = (mi) => CHAPTERS.findIndex((c) => c.missions.includes(mi));

const D = (x, z, label, time = 0) => ({ at: { x, z }, label, time });
const ESCAPE = (label) => ({ at: null, label, time: 0 });

export const JOBS = [
  // Chapter 1 — Paradise Found
  { name: 'First Shift', giver: "Haris 'Pakde' Wira", chapter: 0, reward: 400, respect: 12,
    intro: 'Pakde Haris: "Pick up the crate at the marina pier, bring it downtown. Earn your keep."',
    steps: [D(162, 54, 'Reach the marina pickup', 120), D(0, 0, 'Deliver downtown — the clock is running!', 180)] },
  { name: 'Loud Shirt, Big Favour', giver: 'Bimo Hartono', chapter: 0, reward: 450, respect: 12,
    intro: 'Bimo: "My cousin left a bag by the south bridge. Grab it, drop it at the north docks. Lunch is on me."',
    steps: [D(-108, 108, 'Collect Bimo\'s bag by the south bridge', 120), D(54, -108, 'Drop it at the north docks', 150)] },
  { name: 'The Middleman', giver: 'Dodi the Fixer', chapter: 0, reward: 550, respect: 16,
    intro: 'Dodi: "Three corners of this city, one envelope each. Fast hands get remembered."',
    steps: [D(-108, -108, 'Envelope 1 of 3', 150), D(108, -108, 'Envelope 2 of 3'), D(0, 54, 'Final envelope — back to Dodi\'s corner')] },
  // Chapter 2 — Paradise Lost
  { name: 'Wrong Turn', giver: 'Sela Marín', chapter: 1, reward: 600, respect: 16, heatOnStart: 2,
    intro: 'Sela: "That drop was a setup — the bay is watching. Move the package anyway, and shake the heat."',
    steps: [D(54, -108, 'Reach the north pickup', 120), D(-108, 54, 'Deliver west — lose any tail first', 180)] },
  { name: 'Heat Rising', giver: 'Sela Marín', chapter: 1, reward: 650, respect: 18, escape: true,
    intro: 'Sela: "Sirens. Everywhere. Go dark until the bay forgets your face."',
    steps: [ESCAPE('Lose the heat — break line of sight and stay hidden')] },
  // Chapter 3 — Money, Vice & Neon
  { name: 'Casino Chips', giver: 'Raka Pradana', chapter: 2, reward: 800, respect: 18,
    intro: 'Raka: "A case of chips leaves my casino tonight. South pickup, west delivery. Discretion is the dress code."',
    steps: [D(108, 108, 'Pick up the chip case', 120), D(-54, 0, 'Deliver to Raka\'s buyer', 180)] },
  { name: 'Neon Debt', giver: 'Raka Pradana', chapter: 2, reward: 850, respect: 20,
    intro: 'Raka: "Three debtors, three neon corners. Collect what the bay owes me."',
    steps: [D(0, -108, 'Debtor 1 of 3', 150), D(108, 0, 'Debtor 2 of 3'), D(162, 54, 'Final debtor — the marina')] },
  // Chapter 4 — Neon Jurisdiction
  { name: 'City Run', giver: 'Dodi the Fixer', chapter: 3, reward: 900, respect: 20,
    intro: 'Dodi: "The agency watches four corners tonight. Be seen at all of them — then be gone."',
    steps: [D(-108, -108, 'Corner 1 of 4', 170), D(108, -108, 'Corner 2 of 4'), D(108, 108, 'Corner 3 of 4'), D(-108, 108, 'Final corner')] },
  { name: 'Prep: Wheels', giver: "Haris 'Pakde' Wira", chapter: 3, reward: 700, respect: 16,
    intro: 'Pakde Haris: "For the takedown we need the marked car near the plaza. Take it, stash it west."',
    steps: [D(54, 54, 'Reach the marked car at the plaza', 120), D(-108, -54, 'Stash it at the west garage', 150)] },
  { name: 'Prep: Intel', giver: 'Sela Marín', chapter: 3, reward: 750, respect: 18,
    intro: 'Sela: "Three dead drops hold the agency\'s routes. Collect them all before they rotate."',
    steps: [D(-54, 0, 'Dead drop 1 of 3', 150), D(108, 0, 'Dead drop 2 of 3'), D(0, 108, 'Final dead drop')] },
  // Chapter 5 — The Last Tide
  { name: 'Agency Takedown', giver: 'Dodi the Fixer', chapter: 4, reward: 1500, respect: 35,
    intro: 'Dodi: "Tonight we end it. Hit the agency vault, the marina vault, then bring it all home."',
    steps: [D(108, -108, 'Hit the agency vault', 170), D(162, 54, 'Hit the marina vault'), D(0, 0, 'Bring it downtown — finish this')] },
  { name: 'Into the Sunrise', giver: 'Sela Marín', chapter: 4, reward: 1000, respect: 25, escape: true, heatOnStart: 2,
    intro: 'Sela: "It is done. One last thing — disappear, and watch the sun come up over our bay."',
    steps: [ESCAPE('Lose the heat — break line of sight and stay hidden')] },
];

const RESPECT_RANKS = [
  [0, 'Nobody'], [25, 'Runner'], [60, 'Wheelman'], [110, 'Hustler'],
  [175, 'Fixer'], [260, 'Shot Caller'], [380, 'Underboss'], [540, 'Kingpin of Velora'],
];

export class GameState {
  constructor() {
    this.money = 250;
    this.respect = 0;
    this.heat = 0;
    this.unseenTime = 0;
    this.jobIndex = 0;        // next campaign mission to offer
    this.activeJob = -1;
    this.step = 0;
    this.timeLeft = 0;
    this.marker = null;
    this.objective = 'Explore Velora Bay — find the gold beacon to take a mission.';
    this.onBanner = null;
    this.onObjective = null;
    this.onChapter = null;    // (chapterIdx) => chapter title card
    this.onUnlockCheck = null;
    this.payoutMul = 1; this.decayMul = 1; this.heatGainMul = 1;
    this.loot = []; // sellable items granted by missions, sold at the pawn shop
    this.clockMin = 17 * 60 + 40;
    this._chapterShown = -1;
  }
  get stars() { return this.heat <= 0.02 ? 0 : Math.min(5, Math.ceil(this.heat)); }
  get rank() {
    let r = RESPECT_RANKS[0][1];
    for (const [need, name] of RESPECT_RANKS) if (this.respect >= need) r = name;
    return r;
  }
  get jobAvailable() { return this.activeJob < 0 && this.jobIndex < JOBS.length; }
  get chapter() { return this.jobIndex >= JOBS.length ? CHAPTERS.length - 1 : chapterOf(this.jobIndex); }
  progressText() {
    if (this.jobIndex >= JOBS.length) return 'Campaign complete — free roam';
    const ch = this.chapter, list = CHAPTERS[ch].missions;
    const done = list.filter((m) => m < this.jobIndex).length;
    return `Chapter ${ch + 1}: ${CHAPTERS[ch].name} — ${done}/${list.length} missions`;
  }

  addCrime(points, witnessed) {
    if (!witnessed && points < 1) return;
    this.heat = clamp(this.heat + points * (this.heatGainMul || 1), 0, 5);
    this.unseenTime = 0;
  }
  setWanted(stars) { this.heat = clamp(stars, 0, 5); this.unseenTime = 0; }
  setObjective(text) { this.objective = text; if (this.onObjective) this.onObjective(text); }
  banner(title, sub) { if (this.onBanner) this.onBanner(title, sub); }

  startJob(i) {
    if (i < 0 || i >= JOBS.length || this.activeJob >= 0) return false;
    this.activeJob = i; this.step = 0;
    const job = JOBS[i];
    if (job.chapter !== this._chapterShown) {
      this._chapterShown = job.chapter;
      if (this.onChapter) this.onChapter(job.chapter);
    }
    this.banner(job.name.toUpperCase(), job.intro);
    if (job.escape) { this.setWanted(job.heatOnStart || 3); this.marker = null; this.setObjective(job.steps[0].label); }
    else {
      if (job.heatOnStart) this.setWanted(job.heatOnStart);
      this.advanceStep();
    }
    return true;
  }
  advanceStep() {
    const job = JOBS[this.activeJob];
    const step = job.steps[this.step];
    if (!step) return this.completeJob();
    this.marker = step.at;
    if (step.time > 0) this.timeLeft = step.time;
    this.setObjective(step.label);
  }
  completeJob() {
    const finished = this.activeJob;
    const job = JOBS[finished];
    const reward = Math.round(job.reward * (this.payoutMul || 1));
    this.money += reward;
    this.respect += job.respect;
    const LOOT = [['Sealed Crate', 120], ['Loud Shirt (Vintage)', 60], ['Marked Envelope', 90], ['Courier Satchel', 110], ['Heat-Scarred Radio', 75], ['Chip Case', 220], ['Neon Sign Shard', 140], ['Agency Badge', 180], ['Stash Keys', 95], ['Route Drive', 160], ['Vault Loot', 400], ['Sunrise Photo', 50]];
    this.loot.push({ name: LOOT[finished][0], price: LOOT[finished][1] });
    this.banner('MISSION COMPLETE', `${job.name} — +$${reward}, +${job.respect} respect. Rank: ${this.rank}`);
    if (this.onUnlockCheck) this.onUnlockCheck(finished);
    this.activeJob = -1; this.marker = null; this.timeLeft = 0;
    this.jobIndex = Math.min(JOBS.length, Math.max(this.jobIndex, finished + 1));
    this.setObjective(this.jobIndex < JOBS.length
      ? `Next mission: ${JOBS[this.jobIndex].name} — find ${JOBS[this.jobIndex].giver} at the gold beacon.`
      : 'Campaign complete. Velora Bay is yours — free roam!');
    if (this.onJobComplete) this.onJobComplete();
  }
  failJob(reason) {
    const job = JOBS[this.activeJob];
    this.banner('MISSION FAILED', `${job.name} — ${reason}`);
    this.activeJob = -1; this.marker = null;
    this.setObjective(`Mission failed. The ${job.name} beacon is still out there — try again.`);
  }

  update(dt, ctx) {
    this.clockMin = (this.clockMin + dt * 2) % (24 * 60);
    if (this.heat > 0) {
      if (ctx.policeSeesPlayer) this.unseenTime = 0;
      else {
        this.unseenTime += dt * (this.decayMul || 1);
        if (this.unseenTime >= 12) { this.heat = Math.max(0, this.heat - 1); this.unseenTime = 0; }
      }
    }
    if (this.activeJob < 0) return;
    const job = JOBS[this.activeJob];
    if (job.escape) {
      if (this.heat <= 0.02) this.completeJob();
      return;
    }
    const step = job.steps[this.step];
    if (this.timeLeft > 0) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) return this.failJob('out of time');
    }
    if (step && step.at) {
      const d = Math.hypot(ctx.playerPos.x - step.at.x, ctx.playerPos.z - step.at.z);
      if (d < 7) { this.step++; this.advanceStep(); }
    }
  }

  clockText() {
    const h = Math.floor(this.clockMin / 60), m = Math.floor(this.clockMin % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
