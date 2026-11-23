// VELORA BAY 3D — DOM HUD: cash, respect, wanted stars, clock, objective, prompts,
// banners, and the canvas minimap (streets, water, player arrow, police, job beacon).
import { CONFIG, CHANNELS } from './config.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.moneyEl = $('money'); this.respectEl = $('respect'); this.rankEl = $('rank');
    this.starsEl = $('stars'); this.clockEl = $('clock');
    this.objectiveEl = $('objective'); this.promptEl = $('prompt');
    this.bannerEl = $('banner'); this.bannerTitle = $('banner-title'); this.bannerSub = $('banner-sub');
    this.timerEl = $('timer');
    this.map = $('minimap'); this.mctx = this.map.getContext('2d');
    this.charChip = $('char-chip'); this.camChip = $('cam-chip'); this.camTimeout = 0;
    this.bannerTimeout = 0;
    this.lastStars = -1;
  }
  setMoney(n) { this.moneyEl.textContent = '$' + Math.floor(n).toLocaleString('en-US'); }
  setChar(name) { if (this.charChip) this.charChip.textContent = name; }
  setStory(text) { const el = document.getElementById('story-line'); if (el) el.textContent = text; }
  chapterCard(chNum, chName) {
    const card = document.getElementById('chapter-card'); if (!card) return;
    document.getElementById('chapter-num').textContent = 'CHAPTER ' + chNum;
    document.getElementById('chapter-name').textContent = chName;
    card.classList.add('show');
    clearTimeout(this.chTimeout);
    this.chTimeout = setTimeout(() => card.classList.remove('show'), 3400);
  }
  showCamMode(label) {
    if (!this.camChip) return;
    this.camChip.textContent = label; this.camChip.style.display = 'block';
    clearTimeout(this.camTimeout);
    this.camTimeout = setTimeout(() => { this.camChip.style.display = 'none'; }, 1400);
  }
  setRespect(n, rank) { this.respectEl.style.width = Math.min(100, (n % 100)) + '%'; this.rankEl.textContent = rank; }
  setStars(n) {
    if (n === this.lastStars) return;
    this.lastStars = n;
    const spans = this.starsEl.children;
    for (let i = 0; i < spans.length; i++) spans[i].className = i < n ? 'star on' : 'star';
  }
  setClock(t) { this.clockEl.textContent = t; }
  setTimer(sec) {
    if (sec > 0) { this.timerEl.style.display = 'block'; this.timerEl.textContent = '⏱ ' + Math.ceil(sec) + 's'; }
    else this.timerEl.style.display = 'none';
  }
  setObjective(text) { this.objectiveEl.textContent = text; }
  showPrompt(text) {
    if (text) { this.promptEl.textContent = text; this.promptEl.style.display = 'block'; }
    else this.promptEl.style.display = 'none';
  }
  banner(title, sub) {
    this.bannerTitle.textContent = title;
    this.bannerSub.textContent = sub || '';
    this.bannerEl.classList.add('show');
    clearTimeout(this.bannerTimeout);
    this.bannerTimeout = setTimeout(() => this.bannerEl.classList.remove('show'), 3400);
  }

  // world [-190,190] -> minimap [0,220]
  drawMinimap(world) {
    const c = this.mctx, S = 220, H = 190;
    const mx = (x) => ((x + H) / (2 * H)) * S;
    const mz = (z) => ((z + H) / (2 * H)) * S;
    c.fillStyle = '#f2dcc3'; c.fillRect(0, 0, S, S);
    // water + beach
    c.fillStyle = '#ffe3a8'; c.fillRect(mx(CONFIG.BEACH_X), 0, S - mx(CONFIG.BEACH_X), S);
    c.fillStyle = '#35c4c9'; c.fillRect(mx(CONFIG.WATER_X), 0, S - mx(CONFIG.WATER_X), S);
    // inlet channels cutting inland
    for (const ch of CHANNELS) c.fillRect(mx(ch.minX), mz(ch.minZ), mx(ch.maxX) - mx(ch.minX), mz(ch.maxZ) - mz(ch.minZ));
    // streets
    c.strokeStyle = '#b8a3b5'; c.lineWidth = 3;
    for (const s of CONFIG.STREET_CENTERS) {
      c.beginPath(); c.moveTo(mx(s), 0); c.lineTo(mx(s), S); c.stroke();
      c.beginPath(); c.moveTo(0, mz(s)); c.lineTo(S, mz(s)); c.stroke();
    }
    // traffic
    c.fillStyle = '#8a7296';
    for (const t of world.traffic) { c.fillRect(mx(t.sim.pos.x) - 1.5, mz(t.sim.pos.z) - 1.5, 3, 3); }
    // police
    c.fillStyle = '#ff2a3c';
    for (const p of world.police) {
      if (!p.active) continue;
      c.beginPath(); c.arc(mx(p.sim.pos.x), mz(p.sim.pos.z), 3, 0, 7); c.fill();
    }
    // job marker / beacon
    const tNow = performance.now() / 1000;
    const marker = world.marker;
    if (marker) {
      c.fillStyle = '#ffc94d';
      c.beginPath(); c.arc(mx(marker.x), mz(marker.z), 4 + Math.sin(tNow * 5) * 1.4, 0, 7); c.fill();
      c.strokeStyle = 'rgba(255,201,77,0.5)';
      c.beginPath(); c.arc(mx(marker.x), mz(marker.z), 8 + Math.sin(tNow * 5) * 2, 0, 7); c.stroke();
    }
    // player arrow
    const px = mx(world.playerPos.x), pz = mz(world.playerPos.z);
    c.save(); c.translate(px, pz); c.rotate(world.playerHeading);
    c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(0, -6); c.lineTo(4, 5); c.lineTo(0, 2.4); c.lineTo(-4, 5); c.closePath(); c.fill();
    c.restore();
    // north label
    c.fillStyle = '#7a4a12'; c.font = '700 11px "M PLUS Rounded 1c", sans-serif'; c.fillText('N', S - 14, 13);
  }
}
