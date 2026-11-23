// Velora Bay's renderer: canvas only, no assets. Terrain is drawn from the city data (roads,
// blocks, beach, marina), buildings get a fake-height shadow and roof, and everything else —
// cars, people, the helicopter, tracers, the day-night tint, the HUD, the minimap, menus — is
// drawn from the simulation state each frame. A tiny offscreen map is pre-rendered once for the
// minimap.
import { WORLD, ROADS_V, ROADS_H, ROAD_W, BEACH_X, WATER_X, WEAPONS, WEAPON_ORDER, CAR_TYPES, PALETTE, FONTS, rankFor } from './config.js';
import { shade } from './city.js';
import { dist } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

/** All canvas text uses the bundled faces — Anton for display, Rajdhani for UI. No system fonts. */
const FONT = FONTS.ui;
const FONT_DISPLAY = FONTS.display;

/** Pre-rendered asphalt tile: subtle noise + worn speckle, tiled under the lane markings. */
let asphaltTile = null;
function getAsphaltTile() {
  if (asphaltTile !== null) return asphaltTile;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = PALETTE.road; g.fillRect(0, 0, 128, 128);
  let s = 1234567;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < 900; i += 1) {
    g.fillStyle = rnd() > 0.5 ? 'rgba(255,220,180,0.05)' : 'rgba(0,0,10,0.09)';
    g.fillRect(Math.floor(rnd() * 128), Math.floor(rnd() * 128), 2, 2);
  }
  for (let i = 0; i < 7; i += 1) {
    g.fillStyle = 'rgba(0,0,0,0.06)';
    g.beginPath(); g.ellipse(rnd() * 128, rnd() * 128, 8 + rnd() * 18, 5 + rnd() * 10, rnd() * 3, 0, Math.PI * 2); g.fill();
  }
  asphaltTile = c;
  return c;
}

/** Static city layer, rendered once per block-cell region and blitted each frame (perf). */
const staticCache = new Map();
function staticLayer(city, cell) {
  const key = `${cell.x},${cell.y}`;
  if (staticCache.has(key)) return staticCache.get(key);
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.ceil(cell.w)); c.height = Math.max(2, Math.ceil(cell.h));
  const g = c.getContext('2d');
  g.translate(-cell.x, -cell.y);
  const saved = { x0: cell.x, y0: cell.y, x1: cell.x + cell.w, y1: cell.y + cell.h };
  drawCellGround(g, city, cell, saved);
  staticCache.set(key, c);
  return c;
}
function drawCellGround(g, city, cell, bounds) {
  void city; void bounds;
  g.fillStyle = PALETTE.sidewalk; g.fillRect(cell.x, cell.y, cell.w, cell.h);
  g.fillStyle = cell.kind === 'park' ? PALETTE.park : cell.kind === 'parking' ? PALETTE.lot : cell.district === 'Palm Heights' ? PALETTE.park : cell.district === 'Downtown' ? PALETTE.plaza : '#c9b18c';
  g.fillRect(cell.x + 26, cell.y + 26, cell.w - 52, cell.h - 52);
  g.strokeStyle = PALETTE.sidewalkEdge; g.lineWidth = 3; g.strokeRect(cell.x + 4, cell.y + 4, cell.w - 8, cell.h - 8);
  if (cell.kind === 'parking') {
    g.strokeStyle = 'rgba(255,240,200,0.4)'; g.lineWidth = 2;
    for (let x = cell.x + 45; x < cell.x + cell.w - 40; x += 95) { g.beginPath(); g.moveTo(x, cell.y + 40); g.lineTo(x, cell.y + cell.h - 40); g.stroke(); }
  }
}

/** Darkness of the sky overlay through the day: [hour, amount] stops, dusk-first. */
const DARK_STOPS = [[0, 0.55], [4.5, 0.55], [6, 0.14], [7.5, 0.0], [17, 0.0], [18.5, 0.16], [20, 0.46], [21.5, 0.55], [24, 0.55]];
const WARM_STOPS = [[0, 0], [5, 0], [6.5, 0.5], [8, 0], [16.5, 0], [18.8, 0.75], [20, 0.15], [24, 0]];

function curve(stops, h) {
  for (let i = 0; i < stops.length - 1; i += 1) {
    const [h0, v0] = stops[i];
    const [h1, v1] = stops[i + 1];
    if (h >= h0 && h <= h1) return v0 + (v1 - v0) * ((h - h0) / Math.max(0.001, h1 - h0));
  }
  return stops[stops.length - 1][1];
}

export function lightingAt(clockMinutes) {
  const h = clockMinutes / 60;
  return { dark: curve(DARK_STOPS, h), warm: curve(WARM_STOPS, h) };
}

function makeGlowSprite(color) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return c;
}

export function prerenderMap(city) {
  const scale = 0.2;
  const c = document.createElement('canvas');
  c.width = Math.ceil(WORLD.w * scale);
  c.height = Math.ceil(WORLD.h * scale);
  const g = c.getContext('2d');
  g.fillStyle = PALETTE.grass;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = PALETTE.sand;
  g.fillRect(BEACH_X * scale, 0, (WATER_X - BEACH_X) * scale, c.height);
  g.fillStyle = PALETTE.water;
  g.fillRect(WATER_X * scale, 0, (WORLD.w - WATER_X) * scale, c.height);
  g.fillStyle = PALETTE.road;
  for (const vx of ROADS_V) g.fillRect((vx - ROAD_W / 2) * scale, 0, ROAD_W * scale, c.height);
  for (const hy of ROADS_H) g.fillRect(0, (hy - ROAD_W / 2) * scale, c.width, ROAD_W * scale);
  g.fillStyle = 'rgba(255,240,210,0.75)';
  for (const b of city.buildings) g.fillRect(b.x * scale, b.y * scale, Math.max(1.5, b.w * scale), Math.max(1.5, b.h * scale));
  g.fillStyle = 'rgba(46,196,182,0.9)';
  for (const pr of city.props) { if (pr.type === 'palm') g.fillRect(pr.x * scale - 1, pr.y * scale - 1, 2, 2); }
  return { canvas: c, scale };
}

/** Terrain and static city dressing inside the world-space bounds. */
export function drawTerrain(ctx, state, bounds, tNow) {
  const city = state.city;
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(bounds.x0, bounds.y0, bounds.x1 - bounds.x0, bounds.y1 - bounds.y0);
  // Static per-cell ground comes from the cached offscreen layers (sidewalks, plaza, park).
  for (const cell of city.cells) {
    if (cell.x > bounds.x1 || cell.x + cell.w < bounds.x0 || cell.y > bounds.y1 || cell.y + cell.h < bounds.y0) continue;
    if (cell.kind === 'beach') continue;
    ctx.drawImage(staticLayer(city, cell), cell.x, cell.y);
  }
  // Sand with a wet shoreline band, then animated teal water with sunset sparkle.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(BEACH_X, bounds.y0, WATER_X - BEACH_X, bounds.y1 - bounds.y0);
  ctx.fillStyle = PALETTE.sandWet;
  ctx.fillRect(WATER_X - 26, bounds.y0, 26, bounds.y1 - bounds.y0);
  const waterGrad = ctx.createLinearGradient(WATER_X, 0, WORLD.w, 0);
  waterGrad.addColorStop(0, PALETTE.water);
  waterGrad.addColorStop(0.45, '#0f7f9e');
  waterGrad.addColorStop(1, PALETTE.waterDeep);
  ctx.fillStyle = waterGrad;
  ctx.fillRect(WATER_X, bounds.y0, WORLD.w - WATER_X, bounds.y1 - bounds.y0);
  ctx.strokeStyle = 'rgba(255,170,90,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let y = bounds.y0 - (bounds.y0 % 90); y < bounds.y1; y += 90) {
    const off = Math.sin(y * 0.05 + tNow * 0.9) * 16;
    ctx.moveTo(WATER_X + 26 + off, y);
    ctx.lineTo(WATER_X + 120 + off, y);
    ctx.moveTo(WATER_X + 220 - off, y + 40);
    ctx.lineTo(WATER_X + 330 - off, y + 40);
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(184,255,244,0.5)';
  ctx.beginPath();
  for (let y = bounds.y0 - (bounds.y0 % 46); y < bounds.y1; y += 46) {
    const off = Math.sin(y * 0.11 + tNow * 1.7) * 9;
    ctx.moveTo(WATER_X - 8 + off, y); ctx.lineTo(WATER_X + 18 + off, y);
  }
  ctx.stroke();
  // Roads: textured asphalt tile, warm curbs, worn dashed lanes, crosswalks at intersections.
  const tile = getAsphaltTile();
  const pat = ctx.createPattern(tile, 'repeat');
  ctx.fillStyle = pat ?? PALETTE.road;
  for (const vx of ROADS_V) ctx.fillRect(vx - ROAD_W / 2, bounds.y0, ROAD_W, bounds.y1 - bounds.y0);
  for (const hy of ROADS_H) ctx.fillRect(bounds.x0, hy - ROAD_W / 2, bounds.x1 - bounds.x0, ROAD_W);
  ctx.fillStyle = PALETTE.roadEdge;
  for (const vx of ROADS_V) {
    ctx.fillRect(vx - ROAD_W / 2, bounds.y0, 6, bounds.y1 - bounds.y0);
    ctx.fillRect(vx + ROAD_W / 2 - 6, bounds.y0, 6, bounds.y1 - bounds.y0);
  }
  for (const hy of ROADS_H) {
    ctx.fillRect(bounds.x0, hy - ROAD_W / 2, bounds.x1 - bounds.x0, 6);
    ctx.fillRect(bounds.x0, hy + ROAD_W / 2 - 6, bounds.x1 - bounds.x0, 6);
  }
  ctx.strokeStyle = 'rgba(255,217,138,0.62)';
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  ctx.beginPath();
  for (const vx of ROADS_V) {
    for (const off of [-42, 42]) { ctx.moveTo(vx + off, bounds.y0); ctx.lineTo(vx + off, bounds.y1); }
  }
  for (const hy of ROADS_H) {
    for (const off of [-42, 42]) { ctx.moveTo(bounds.x0, hy + off); ctx.lineTo(bounds.x1, hy + off); }
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,244,214,0.55)';
  for (const vx of ROADS_V) for (const hy of ROADS_H) {
    if (vx < bounds.x0 - 120 || vx > bounds.x1 + 120 || hy < bounds.y0 - 120 || hy > bounds.y1 + 120) continue;
    for (let s = -70; s <= 70; s += 24) {
      ctx.fillRect(vx - ROAD_W / 2 + 8, hy + s - 5, 20, 10);
      ctx.fillRect(vx + ROAD_W / 2 - 28, hy + s - 5, 20, 10);
      ctx.fillRect(vx + s - 5, hy - ROAD_W / 2 + 8, 10, 20);
      ctx.fillRect(vx + s - 5, hy + ROAD_W / 2 - 28, 10, 20);
    }
  }
  // Marina piers and the garage's service lot.
  for (const pier of city.piers) {
    ctx.fillStyle = '#7a6248';
    ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let x = pier.x + 30; x < pier.x + pier.w; x += 44) ctx.fillRect(x, pier.y, 4, pier.h);
  }
  const garage = city.pois.find((q) => q.id === 'garage');
  if (garage.lot) {
    ctx.fillStyle = '#3a3d42';
    ctx.fillRect(garage.lot.x, garage.lot.y, garage.lot.w, garage.lot.h);
    ctx.strokeStyle = '#f2c94c';
    ctx.lineWidth = 3;
    ctx.strokeRect(garage.lot.x + 8, garage.lot.y + 8, garage.lot.w - 16, garage.lot.h - 16);
  }
  // Yachts at the marina.
  for (const boat of city.boats) {
    ctx.save();
    ctx.translate(boat.x, boat.y);
    ctx.rotate(boat.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.beginPath();
    ctx.ellipse(3, 5, boat.len / 2, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = boat.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, boat.len / 2, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#eef1f5';
    ctx.fillRect(-boat.len * 0.16, -5, boat.len * 0.3, 10);
    ctx.restore();
  }
  // Props: palms, lamps, crates.
  for (const prop of city.props) {
    if (prop.x < bounds.x0 - 40 || prop.x > bounds.x1 + 40 || prop.y < bounds.y0 - 40 || prop.y > bounds.y1 + 40) continue;
    if (prop.type === 'palm') {
      // Long low-sun trunk shadow first, then a curved trunk and layered fronds.
      ctx.fillStyle = 'rgba(30,16,40,0.22)';
      ctx.beginPath(); ctx.ellipse(prop.x + 14, prop.y + 7, 20, 6, 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#8a5a33';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(prop.x, prop.y + 3); ctx.quadraticCurveTo(prop.x + 4, prop.y - 4, prop.x + 7, prop.y - 10); ctx.stroke();
      const sway = Math.sin(tNow * 0.9 + prop.x * 0.05) * 1.8;
      for (let layer = 0; layer < 2; layer += 1) {
        ctx.strokeStyle = layer === 0 ? '#1f7a4d' : '#35a065';
        ctx.lineWidth = 3.2 - layer * 0.7;
        for (let i = 0; i < 7; i += 1) {
          const a = (i / 7) * Math.PI * 2 + prop.x + layer * 0.4;
          const len = 19 - layer * 4;
          ctx.beginPath();
          ctx.moveTo(prop.x + 7, prop.y - 10);
          ctx.quadraticCurveTo(prop.x + 7 + Math.cos(a) * len * 0.6 + sway, prop.y - 16 + Math.sin(a) * 6, prop.x + 7 + Math.cos(a) * len + sway, prop.y - 8 + Math.sin(a) * 10);
          ctx.stroke();
        }
      }
      ctx.fillStyle = '#6b4226';
      ctx.beginPath(); ctx.arc(prop.x + 7, prop.y - 10, 3.2, 0, Math.PI * 2); ctx.fill();
    } else if (prop.type === 'lamp') {
      ctx.fillStyle = 'rgba(30,16,40,0.25)'; ctx.beginPath(); ctx.ellipse(prop.x + 5, prop.y + 4, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#241f33'; ctx.fillRect(prop.x - 2, prop.y - 2, 4, 4);
      ctx.fillStyle = '#ffd76a'; ctx.fillRect(prop.x - 1.5, prop.y - 1.5, 3, 3);
    } else if (prop.type === 'umbrella') {
      ctx.fillStyle = 'rgba(30,16,40,0.2)'; ctx.beginPath(); ctx.ellipse(prop.x + 6, prop.y + 5, 15, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7a5a36'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(prop.x, prop.y); ctx.lineTo(prop.x + 2, prop.y - 4); ctx.stroke();
      ctx.fillStyle = prop.color ?? '#ff5d8f';
      ctx.beginPath(); ctx.moveTo(prop.x + 2, prop.y - 15); ctx.lineTo(prop.x - 13, prop.y - 3); ctx.lineTo(prop.x + 17, prop.y - 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(prop.x + 2, prop.y - 15); ctx.lineTo(prop.x - 4, prop.y - 3); ctx.lineTo(prop.x + 8, prop.y - 3); ctx.closePath(); ctx.fill();
    } else if (prop.type === 'barrier') {
      ctx.fillStyle = '#f4f0e6'; ctx.fillRect(prop.x - 13, prop.y - 4, 26, 8);
      ctx.fillStyle = '#ff6b57'; ctx.fillRect(prop.x - 13, prop.y - 4, 8, 8); ctx.fillRect(prop.x + 5, prop.y - 4, 8, 8);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.2; ctx.strokeRect(prop.x - 13, prop.y - 4, 26, 8);
    } else {
      ctx.fillStyle = 'rgba(30,16,40,0.22)'; ctx.fillRect(prop.x - 5, prop.y - 3, 15, 13);
      ctx.fillStyle = '#b07d4f'; ctx.fillRect(prop.x - 7, prop.y - 7, 14, 14);
      ctx.strokeStyle = 'rgba(60,30,10,0.5)'; ctx.lineWidth = 1.5; ctx.strokeRect(prop.x - 7, prop.y - 7, 14, 14);
      ctx.beginPath(); ctx.moveTo(prop.x - 7, prop.y - 7); ctx.lineTo(prop.x + 7, prop.y + 7); ctx.moveTo(prop.x + 7, prop.y - 7); ctx.lineTo(prop.x - 7, prop.y + 7); ctx.stroke();
    }
  }
  // Buildings: long sunset shadow (sun low in the west, so shadows fall east), sunlit wall,
  // parapet roof with varied material, AC units / vents / tanks, and neon signage.
  const ROOF_FILL = { terracotta: '#c96f4a', teal: '#2f8f8a', cream: '#efe3c2', coral: '#e88a7a', slate: '#5a6480', sand: '#d9bd8a' };
  for (const b of city.buildings) {
    if (b.x > bounds.x1 + 90 || b.x + b.w < bounds.x0 - 90 || b.y > bounds.y1 + 90 || b.y + b.h < bounds.y0 - 90) continue;
    const sx = b.ht * 0.34;
    const sy = b.ht * 0.14;
    ctx.fillStyle = 'rgba(28,12,44,0.34)';
    ctx.fillRect(b.x + sx, b.y + sy, b.w, b.h);
    ctx.fillStyle = shade(b.color, -34);
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = shade(b.color, 26);
    ctx.fillRect(b.x, b.y, Math.max(4, b.w * 0.16), b.h);
    const rx = b.x - b.ht * 0.05;
    const ry = b.y - b.ht * 0.09;
    ctx.fillStyle = b.kind === 'poi' ? '#3a3358' : (ROOF_FILL[b.roofMat] ?? b.roof ?? shade(b.color, 16));
    ctx.fillRect(rx, ry, b.w, b.h);
    ctx.strokeStyle = shade(b.color, -52);
    ctx.lineWidth = 5;
    ctx.strokeRect(rx + 2, ry + 2, b.w - 4, b.h - 4);
    ctx.strokeStyle = 'rgba(255,240,210,0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rx + 6, ry + 6, b.w - 12, b.h - 12);
    if (b.kind === 'container') {
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.lineWidth = 2;
      for (let x = rx + 8; x < rx + b.w - 4; x += 9) { ctx.beginPath(); ctx.moveTo(x, ry + 2); ctx.lineTo(x, ry + b.h - 2); ctx.stroke(); }
    }
    for (const det of b.details ?? []) {
      const dw = Math.max(7, det.w * b.w); const dh = Math.max(6, det.h * b.h);
      const dx = rx + det.dx * b.w; const dy = ry + det.dy * b.h;
      ctx.fillStyle = 'rgba(28,12,44,0.25)'; ctx.fillRect(dx + 3, dy + 3, dw, dh);
      if (det.kind === 'tank') { ctx.fillStyle = '#cfd8de'; ctx.beginPath(); ctx.ellipse(dx + dw / 2, dy + dh / 2, dw / 2, dh / 2, 0, 0, Math.PI * 2); ctx.fill(); }
      else if (det.kind === 'skylight') { ctx.fillStyle = 'rgba(140,230,255,0.65)'; ctx.fillRect(dx, dy, dw, dh); }
      else if (det.kind === 'vent') { ctx.fillStyle = '#8d97a5'; ctx.beginPath(); ctx.arc(dx + dw / 2, dy + dh / 2, Math.min(dw, dh) / 2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#596270'; ctx.beginPath(); ctx.arc(dx + dw / 2, dy + dh / 2, Math.min(dw, dh) / 4, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.fillStyle = '#aab4be'; ctx.fillRect(dx, dy, dw, dh); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(dx + 2, dy + dh * 0.45, dw - 4, 2); }
    }
    if (b.sign !== null && typeof b.sign === 'object') {
      ctx.save();
      ctx.font = `${Math.max(11, Math.min(17, b.w / Math.max(6, b.sign.text.length) * 1.7))}px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = b.sign.color; ctx.shadowBlur = 13;
      ctx.fillStyle = b.sign.color;
      ctx.fillText(b.sign.text, rx + b.w / 2, ry + b.h - 13);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(b.sign.text, rx + b.w / 2, ry + b.h - 13);
      ctx.restore();
    }
    if (b.kind === 'poi') {
      const poi = city.pois.find((q) => q.id === b.poiId);
      ctx.fillStyle = poi.color;
      ctx.fillRect(rx, ry + b.h - 12, b.w, 12);
    }
  }
}

export function createRenderer(canvas, city) {
  const ctx = canvas.getContext('2d');
  const glowWarm = makeGlowSprite('rgba(255,190,90,0.55)');
  const glowCool = makeGlowSprite('rgba(150,190,255,0.50)');
  const mapCache = prerenderMap(city);
  const camera = { x: 2200, y: 1500, zoom: 1, vw: 1280, vh: 720 };
  let dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.round(window.innerWidth * dpr);
    const h = Math.round(window.innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    camera.vw = window.innerWidth;
    camera.vh = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  function screenToWorld(sx, sy) {
    return {
      x: camera.x + (sx - camera.vw / 2) / camera.zoom,
      y: camera.y + (sy - camera.vh / 2) / camera.zoom,
    };
  }

  function txt(str, x, y, size, color, align = 'left', weight = 600, spacing = 0) {
    const useDisplay = size >= 26;
    ctx.font = useDisplay ? `${size}px ${FONT_DISPLAY}` : `${weight} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    try {
      ctx.letterSpacing = `${spacing}px`;
    } catch {
      /* older engines: no letter-spacing, no harm */
    }
    ctx.fillText(str, x, y);
    try {
      ctx.letterSpacing = '0px';
    } catch {
      /* as above */
    }
  }

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  // ----- entities -----

  function drawCar(car, state, tNow) {
    const spec = CAR_TYPES[car.type];
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath();
    ctx.ellipse(3, 5, spec.l / 2, spec.w / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    const body = car.dead ? shade(car.color, -46) : car.color;
    // Headlight cones first (under the body) when the dusk lights are on.
    const lightsOn = state.headlightsOn !== false && car.kind !== 'parked';
    if (lightsOn) {
      const cone = ctx.createLinearGradient(spec.l / 2, 0, spec.l / 2 + 120, 0);
      cone.addColorStop(0, 'rgba(255,226,150,0.34)');
      cone.addColorStop(1, 'rgba(255,226,150,0)');
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(spec.l / 2, -spec.w * 0.28); ctx.lineTo(spec.l / 2 + 120, -spec.w * 0.75); ctx.lineTo(spec.l / 2 + 120, spec.w * 0.75); ctx.lineTo(spec.l / 2, spec.w * 0.28); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = body;
    rr(-spec.l / 2, -spec.w / 2, spec.l, spec.w, 7);
    ctx.fill();
    // Sun-side highlight stripe + shaded flank give the body volume.
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    rr(-spec.l / 2 + 3, -spec.w / 2 + 2, spec.l - 6, spec.w * 0.3, 5); ctx.fill();
    ctx.fillStyle = 'rgba(20,8,40,0.18)';
    rr(-spec.l / 2 + 3, spec.w * 0.22, spec.l - 6, spec.w * 0.26, 5); ctx.fill();
    ctx.strokeStyle = 'rgba(20,8,40,0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (lightsOn) {
      ctx.fillStyle = '#fff3b0';
      ctx.fillRect(spec.l / 2 - 3, -spec.w * 0.32, 4, 6); ctx.fillRect(spec.l / 2 - 3, spec.w * 0.32 - 6, 4, 6);
      ctx.fillStyle = '#ff5d5d';
      ctx.fillRect(-spec.l / 2 - 1, -spec.w * 0.32, 3, 5); ctx.fillRect(-spec.l / 2 - 1, spec.w * 0.32 - 5, 3, 5);
    }
    if (car.type === 'truck' || car.type === 'van') {
      ctx.fillStyle = shade(car.color, 12);
      rr(-spec.l / 2 + 4, -spec.w / 2 + 3, spec.l * 0.62, spec.w - 6, 3);
      ctx.fill();
      ctx.fillStyle = 'rgba(16,20,28,0.92)';
      rr(spec.l * 0.18, -spec.w / 2 + 4, spec.l * 0.26, spec.w - 8, 3);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(16,20,28,0.92)';
      rr(-spec.l * 0.18, -spec.w * 0.37, spec.l * 0.38, spec.w * 0.74, 4);
      ctx.fill();
      ctx.fillStyle = shade(car.color, 22);
      rr(-spec.l * 0.13, -spec.w * 0.30, spec.l * 0.27, spec.w * 0.60, 3);
      ctx.fill();
    }
    if (car.type === 'police') {
      ctx.fillStyle = '#f4f6ff';
      rr(-spec.l / 2 + 2, -spec.w / 2 + 2, spec.l - 4, spec.w - 4, 6); ctx.fill();
      ctx.fillStyle = '#1d2f6e';
      ctx.fillRect(-spec.l * 0.05, -spec.w / 2, spec.l * 0.14, spec.w);
      ctx.fillStyle = '#16224d';
      ctx.font = `700 8px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('VBPD', 0, -spec.w * 0.28);
      const phase = Math.floor(tNow * 5 + car.id) % 2 === 0;
      ctx.save();
      ctx.shadowBlur = 16; ctx.shadowColor = phase ? '#ff2222' : '#2266ff';
      ctx.fillStyle = phase ? '#ff3333' : '#664444';
      ctx.fillRect(-4, -spec.w * 0.30, 8, spec.w * 0.28);
      ctx.fillStyle = phase ? '#444466' : '#4488ff';
      ctx.fillRect(-4, spec.w * 0.02, 8, spec.w * 0.28);
      ctx.restore();
    }
    if (car.type === 'taxi') {
      ctx.fillStyle = '#f7f3e2';
      ctx.fillRect(-7, -6, 14, 12);
      ctx.fillStyle = '#22242a';
      ctx.font = '700 7px ' + FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('TAXI', 0, 0.5);
    }
    // Wheels; the front pair turns with the steering.
    ctx.fillStyle = '#121419';
    for (const [wx, wy, front] of [[-spec.l * 0.33, -spec.w / 2, 0], [-spec.l * 0.33, spec.w / 2, 0], [spec.l * 0.33, -spec.w / 2, 1], [spec.l * 0.33, spec.w / 2, 1]]) {
      ctx.save();
      ctx.translate(wx, wy);
      if (front) ctx.rotate(car.steerVis * 0.45);
      ctx.fillRect(-6, -2.5, 12, 5);
      ctx.restore();
    }
    // Driver and passenger heads through the glass.
    let hasDriver = car.driver || car.kind === 'player';
    let hasPassenger = false;
    for (const ped of state.peds) {
      if (ped.car === car) {
        hasPassenger = true;
        break;
      }
    }
    if (state.player.car === car) hasDriver = true;
    if (hasDriver) {
      ctx.fillStyle = '#d9a37e';
      ctx.beginPath();
      ctx.arc(-2, -spec.w * 0.16, 4.6, 0, Math.PI * 2);
      ctx.fill();
    }
    if (hasPassenger) {
      ctx.fillStyle = '#b9825e';
      ctx.beginPath();
      ctx.arc(-2, spec.w * 0.16, 4.6, 0, Math.PI * 2);
      ctx.fill();
    }
    if (car.dead) {
      ctx.fillStyle = 'rgba(10,10,10,0.35)';
      rr(-spec.l / 2, -spec.w / 2, spec.l, spec.w, 7);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPed(ped, state, tNow) {
    if (ped.car !== null) return;
    ctx.save();
    ctx.translate(ped.x, ped.y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (ped.dead) {
      ctx.rotate(ped.angle + Math.PI / 2);
      ctx.fillStyle = shade(ped.shirt, -30);
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d9a37e';
      ctx.beginPath();
      ctx.arc(13, 0, 4.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    const bob = Math.sin(ped.walk * Math.PI) * 1.6;
    // Swinging arms and stepping legs first, so the figure reads as a person, not a disc.
    const swing = Math.sin(ped.walk * Math.PI) * 4;
    ctx.strokeStyle = ped.pants; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ped.angle + 0.7) * (6 + swing), Math.sin(ped.angle + 0.7) * (6 + swing));
    ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ped.angle - 0.7) * (6 - swing), Math.sin(ped.angle - 0.7) * (6 - swing));
    ctx.stroke();
    ctx.strokeStyle = ped.shirt; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ped.angle + 2.2) * (7 - swing), Math.sin(ped.angle + 2.2) * (7 - swing));
    ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ped.angle - 2.2) * (7 + swing), Math.sin(ped.angle - 2.2) * (7 + swing));
    ctx.stroke();
    ctx.fillStyle = ped.pants;
    ctx.beginPath();
    ctx.arc(0, 0, 8.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(Math.cos(ped.angle) * 1.6, Math.sin(ped.angle) * 1.6 + bob * 0.2, 6.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(Math.cos(ped.angle) * 0.4 - 1.5, Math.sin(ped.angle) * 0.4 - 1.5, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.kind === 'cop' ? '#c98d64' : '#d9a37e';
    ctx.beginPath();
    ctx.arc(Math.cos(ped.angle) * 4.4, Math.sin(ped.angle) * 4.4, 4.4, 0, Math.PI * 2);
    ctx.fill();
    if (ped.kind === 'cop') {
      ctx.fillStyle = '#1d3350';
      ctx.beginPath();
      ctx.arc(Math.cos(ped.angle) * 4.4, Math.sin(ped.angle) * 4.4, 4.8, Math.PI * 0.9, Math.PI * 2.1);
      ctx.fill();
    }
    if (ped.kind === 'gang') {
      ctx.fillStyle = '#a12424';
      ctx.fillRect(-5, -6.5, 10, 3.4);
    }
    ctx.restore();
    if (ped.hail) {
      const bounce = Math.sin(tNow * 6) * 4;
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath();
      ctx.arc(ped.x, ped.y - 24 + bounce, 9, 0, Math.PI * 2);
      ctx.fill();
      txt('$', ped.x, ped.y - 23 + bounce, 13, '#22242a', 'center', 800);
    }
    if ((ped.kind === 'named' || ped.kind === 'dex') && dist(ped.x, ped.y, state.player.x, state.player.y) < 200) {
      txt(ped.name ?? '', ped.x, ped.y - 20, 11, 'rgba(255,255,255,0.85)', 'center', 700);
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    if (p.car !== null) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 9.5, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2c3242';
    ctx.beginPath();
    ctx.arc(0, 0, 8.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e5534b';
    ctx.beginPath();
    ctx.arc(Math.cos(p.angle) * 1.6, Math.sin(p.angle) * 1.6, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d9a37e';
    ctx.beginPath();
    ctx.arc(Math.cos(p.angle) * 4.6, Math.sin(p.angle) * 4.6, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (p.weapon !== 'fist') {
      ctx.strokeStyle = '#22242a';
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(p.angle) * 8, p.y + Math.sin(p.angle) * 8);
      ctx.lineTo(p.x + Math.cos(p.angle) * 17, p.y + Math.sin(p.angle) * 17);
      ctx.stroke();
    }
  }

  function drawHeli(state, tNow) {
    const h = state.heli;
    if (h === null) return;
    const p = state.player;
    if (state.wanted.stars >= 4) {
      const grad = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, 125);
      grad.addColorStop(0, 'rgba(255,244,190,0.30)');
      grad.addColorStop(1, 'rgba(255,244,190,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(h.x, h.y);
      ctx.lineTo(p.x - 95, p.y + 60);
      ctx.lineTo(p.x + 95, p.y + 60);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x, p.y, 118, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.beginPath();
    ctx.ellipse(h.x + 30, h.y + 40, 30, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(h.angle);
    ctx.fillStyle = '#22262e';
    ctx.beginPath();
    ctx.ellipse(0, 0, 27, 12.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-52, -2.5, 34, 5);
    ctx.fillRect(-54, -9, 5, 18);
    ctx.fillStyle = '#9fd8e8';
    ctx.beginPath();
    ctx.ellipse(13, 0, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(210,215,220,0.75)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(h.rotor) * 40, Math.sin(h.rotor) * 40);
    ctx.lineTo(-Math.cos(h.rotor) * 40, -Math.sin(h.rotor) * 40);
    ctx.stroke();
    ctx.fillStyle = Math.floor(tNow * 2) % 2 === 0 ? '#ff4444' : '#661111';
    ctx.beginPath();
    ctx.arc(-20, 8, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ----- HUD -----

  function drawMinimap(state, x, y, w, h, tNow) {
    const p = state.player;
    const VW = 1750;
    const VH = (VW * h) / w;
    ctx.save();
    rr(x, y, w, h, 10);
    ctx.clip();
    ctx.fillStyle = '#20303a';
    ctx.fillRect(x, y, w, h);
    const sx = (p.x - VW / 2) * mapCache.scale;
    const sy = (p.y - VH / 2) * mapCache.scale;
    ctx.drawImage(mapCache.canvas, sx, sy, VW * mapCache.scale, VH * mapCache.scale, x, y, w, h);
    const mx = (wx) => x + ((wx - (p.x - VW / 2)) / VW) * w;
    const my = (wy) => y + ((wy - (p.y - VH / 2)) / VH) * h;
    if (state.objective?.route) {
      ctx.strokeStyle = 'rgba(255,215,106,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      state.objective.route.forEach((pt, i) => {
        if (i === 0) ctx.moveTo(mx(pt.x), my(pt.y));
        else ctx.lineTo(mx(pt.x), my(pt.y));
      });
      ctx.stroke();
    }
    for (const car of state.cars) {
      if (car.kind !== 'police' || car.dead) continue;
      ctx.fillStyle = Math.floor(tNow * 2.4) % 2 === 0 ? '#4fc3f7' : '#e5534b';
      ctx.fillRect(mx(car.x) - 2.5, my(car.y) - 2.5, 5, 5);
    }
    for (const ped of state.peds) {
      if (ped.kind !== 'cop' || ped.dead) continue;
      ctx.fillStyle = '#4fc3f7';
      ctx.fillRect(mx(ped.x) - 1.5, my(ped.y) - 1.5, 3, 3);
    }
    if (state.objective) {
      const pulse = 4 + Math.sin(tNow * 5) * 1.4;
      ctx.fillStyle = '#ffd76a';
      ctx.save();
      ctx.translate(mx(state.objective.x), my(state.objective.y));
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-pulse / 1.4, -pulse / 1.4, pulse * 1.4, pulse * 1.4);
      ctx.restore();
    }
    if (state.taxi?.phase === 'dropoff') txt('$', mx(state.taxi.dest.x), my(state.taxi.dest.y), 12, '#39d353', 'center', 800);
    // The player's arrow.
    ctx.save();
    ctx.translate(mx(p.x), my(p.y));
    ctx.rotate(p.car !== null ? p.car.angle : p.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -4.6);
    ctx.lineTo(-5, 4.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    rr(x, y, w, h, 10);
    ctx.stroke();
  }

  function drawHud(state, view, tNow) {
    const p = state.player;
    const vw = camera.vw;
    const vh = camera.vh;
    // Health and armor, top left — dark glass with a neon-gold edge.
    const barW = 218;
    ctx.fillStyle = PALETTE.glass;
    rr(16, 14, barW + 20, 58, 10);
    ctx.fill();
    ctx.strokeStyle = PALETTE.glassEdge; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    rr(26, 24, barW, 13, 4);
    ctx.fill();
    const hpFrac = Math.max(0, p.hp / 100);
    ctx.fillStyle = hpFrac > 0.5 ? '#39d353' : hpFrac > 0.25 ? '#f2c94c' : '#e5534b';
    if (hpFrac > 0) {
      rr(26, 24, barW * hpFrac, 13, 4);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    rr(26, 43, barW, 8, 4);
    ctx.fill();
    if (p.armor > 0) {
      ctx.fillStyle = '#8fb7d9';
      rr(26, 43, barW * Math.max(0, p.armor / 100), 8, 4);
      ctx.fill();
    }
    const rank = rankFor(p.respect);
    txt(`${rank.title} · ${p.respect} respect`, 26, 63, 12, 'rgba(255,255,255,0.75)', 'left', 600);
    // Cash, clock, stars, top right.
    txt('$' + p.cash.toLocaleString('en-US'), vw - 24, 30, 27, '#ffd76a', 'right', 800);
    const hh = String(Math.floor(state.clock / 60)).padStart(2, '0');
    const mm = String(Math.floor(state.clock % 60)).padStart(2, '0');
    txt(`${hh}:${mm}`, vw - 24, 56, 15, 'rgba(255,255,255,0.8)', 'right', 600);
    // Wanted stars are drawn vector icons (no font glyph), gold and glowing when lit.
    for (let i = 0; i < 5; i += 1) {
      const on = i < state.wanted.stars;
      const cxS = vw - 24 - (4 - i) * 27;
      const cyS = 84;
      const R = on && state.starFlashT > 0 ? 13 : 11;
      ctx.save();
      if (on) { ctx.shadowColor = '#ffd166'; ctx.shadowBlur = 10; }
      ctx.fillStyle = on ? '#ffd166' : 'rgba(255,255,255,0.20)';
      ctx.beginPath();
      for (let k = 0; k < 10; k += 1) {
        const ang = -Math.PI / 2 + k * Math.PI / 5;
        const rad = k % 2 === 0 ? R : R * 0.45;
        const px2 = cxS + Math.cos(ang) * rad; const py2 = cyS + Math.sin(ang) * rad;
        if (k === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
      }
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    if (state.audio && state.audio.station !== 0 && p.car !== null) {
      txt('♪ ' + state.audio.stationName(), vw - 24, 108, 12, 'rgba(255,255,255,0.6)', 'right', 600);
    }
    // Weapon, bottom right.
    const w = WEAPONS[p.weapon];
    ctx.fillStyle = 'rgba(8,10,20,0.55)';
    rr(vw - 196, vh - 76, 180, 60, 8);
    ctx.fill();
    txt(w.name.toUpperCase(), vw - 180, vh - 56, 16, '#eef1f5', 'left', 800);
    txt(p.weapon === 'fist' ? '—' : String(p.ammo[p.weapon] ?? 0), vw - 32, vh - 34, 20, '#ffd76a', 'right', 800);
    drawMinimap(state, 16, vh - 176, 216, 160, tNow);
    // Mission banner and objective line.
    const banner = state.banner;
    const bannerAge = banner !== null ? state.t - banner.t : 99;
    if (banner !== null && bannerAge < banner.dur) {
      const a = Math.min(1, bannerAge * 5, (banner.dur - bannerAge) * 1.6);
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = 'rgba(8,10,20,0.62)';
      rr(vw / 2 - 330, 18, 660, 72, 10);
      ctx.fill();
      txt(banner.title, vw / 2, 46, 25, '#ffd76a', 'center', 800, 1.5);
      if (banner.sub) txt(banner.sub, vw / 2, 72, 14.5, 'rgba(255,255,255,0.88)', 'center', 500);
      ctx.globalAlpha = 1;
    } else if (state.objective) {
      const d = Math.round(dist(p.x, p.y, state.objective.x, state.objective.y));
      txt(`▸ ${state.objective.label} · ${d}m`, vw / 2, 30, 16.5, '#ffd76a', 'center', 700);
    }
    // District banner.
    const dAge = state.t - state.districtT;
    if (dAge > 0.2 && dAge < 3.0 && state.district) {
      const a = Math.min(1, (dAge - 0.2) * 3, (3.0 - dAge) * 1.4);
      ctx.globalAlpha = Math.max(0, a) * 0.92;
      txt(state.district.toUpperCase(), vw / 2, vh * 0.26, 42, '#ffffff', 'center', 800, 6);
      ctx.globalAlpha = 1;
    }
    // Radio toast.
    if (state.radioName && state.t - (state.radioT ?? -9) < 1.8) {
      txt('♪ ' + state.radioName, vw / 2, 108, 15, 'rgba(255,255,255,0.85)', 'center', 700);
    }
    // Interaction prompt.
    if (state.prompt && state.dialogue === null && state.shop === null) {
      const label = state.prompt;
      ctx.font = `600 15.5px ${FONT}`;
      const tw = ctx.measureText(label).width + 34;
      ctx.fillStyle = 'rgba(8,10,20,0.72)';
      rr(vw / 2 - tw / 2, vh - 128, tw, 34, 17);
      ctx.fill();
      txt(label, vw / 2, vh - 110, 15.5, '#ffffff', 'center', 600);
    }
    // Busted meter floats over the player.
    if (p.bustedT > 0.12 && p.car === null) {
      const sp = worldToScreen(p.x, p.y - 30);
      ctx.fillStyle = 'rgba(8,10,20,0.7)';
      rr(sp.x - 30, sp.y, 60, 9, 4);
      ctx.fill();
      ctx.fillStyle = '#e5534b';
      rr(sp.x - 30, sp.y, 60 * Math.min(1, p.bustedT / 2.2), 9, 4);
      ctx.fill();
    }
    if (state.race !== null && state.race.countT > 0) {
      txt(String(Math.ceil(state.race.countT)), vw / 2, vh * 0.4, 96, '#ffd76a', 'center', 800);
      txt('GET READY', vw / 2, vh * 0.4 + 66, 20, '#ffffff', 'center', 700, 3);
    }
    if (p.hp < 30 && p.hp > 0) {
      const grad = ctx.createRadialGradient(vw / 2, vh / 2, vh * 0.32, vw / 2, vh / 2, vh * 0.75);
      grad.addColorStop(0, 'rgba(160,0,0,0)');
      grad.addColorStop(1, `rgba(160,0,0,${0.30 + Math.sin(tNow * 5) * 0.08})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, vw, vh);
    }
  }

  function worldToScreen(wx, wy) {
    return {
      x: (wx - camera.x) * camera.zoom + camera.vw / 2,
      y: (wy - camera.y) * camera.zoom + camera.vh / 2,
    };
  }

  // ----- panels & screens -----

  function drawMenuItems(view, cx, y0, itemH = 46) {
    view.menuItems.forEach((item, i) => {
      const y = y0 + i * itemH;
      const sel = i === view.menuSel;
      const w = 340;
      if (sel && !item.disabled) {
        ctx.fillStyle = 'rgba(229,83,75,0.20)';
        rr(cx - w / 2, y - 19, w, 38, 8);
        ctx.fill();
        ctx.fillStyle = '#e5534b';
        ctx.fillRect(cx - w / 2, y - 19, 5, 38);
      }
      txt(item.label, cx, y, 23, item.disabled ? 'rgba(255,255,255,0.35)' : sel ? '#ffffff' : 'rgba(255,255,255,0.82)', 'center', 700);
      if (item.sub) txt(item.sub, cx, y + 24, 12.5, 'rgba(255,255,255,0.45)', 'center', 500);
      view.hot.push({ id: item.id, x: cx - w / 2, y: y - 19, w, h: 38 });
    });
  }

  function drawTitle(state, view, tNow) {
    const vw = camera.vw;
    const vh = camera.vh;
    const grad = ctx.createLinearGradient(0, 0, 0, vh);
    grad.addColorStop(0, 'rgba(255,93,143,0.20)');
    grad.addColorStop(0.4, 'rgba(255,140,66,0.10)');
    grad.addColorStop(0.72, 'rgba(36,27,77,0.28)');
    grad.addColorStop(1, 'rgba(16,10,36,0.88)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, vw, vh);
    ctx.save();
    ctx.shadowColor = 'rgba(255,46,99,0.9)';
    ctx.shadowBlur = 34;
    txt('VELORA BAY', vw / 2, vh * 0.27, 104, '#fff3d6', 'center', 400, 4);
    ctx.restore();
    const rule = ctx.createLinearGradient(vw / 2 - 230, 0, vw / 2 + 230, 0);
    rule.addColorStop(0, '#ff5d8f'); rule.addColorStop(0.5, '#ffd166'); rule.addColorStop(1, '#2ec4b6');
    ctx.fillStyle = rule;
    ctx.fillRect(vw / 2 - 230, vh * 0.27 + 62, 460, 5);
    txt('E V E R Y   T I D E   B R I N G S   T R O U B L E', vw / 2, vh * 0.27 + 86, 16, '#ffd76a', 'center', 700);
    txt('An open-world crime story: 8 jobs · VBPD pursuits & roadblocks · a police helicopter · races · taxi fares · gun shop & garage · saves', vw / 2, vh * 0.27 + 116, 14.5, 'rgba(255,255,255,0.75)', 'center', 500);
    drawMenuItems(view, vw / 2, vh * 0.52);
    txt('WASD / arrows move & drive · E enter cars & talk · F exit · mouse aim, click to shoot · 1–4 / Q weapons · Shift sprint · Space handbrake · R radio · M mute · Esc pause', vw / 2, vh - 30, 13, 'rgba(255,255,255,0.55)', 'center', 500);
    void tNow;
  }

  function drawPause(state, view) {
    const vw = camera.vw;
    const vh = camera.vh;
    ctx.fillStyle = 'rgba(6,8,16,0.74)';
    ctx.fillRect(0, 0, vw, vh);
    const p = state.player;
    const rank = rankFor(p.respect);
    const pw = 600;
    const ph = 480;
    const px = vw / 2 - pw / 2;
    const py = vh / 2 - ph / 2;
    ctx.fillStyle = 'rgba(14,17,30,0.97)';
    rr(px, py, pw, ph, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.stroke();
    txt('PAUSED', vw / 2, py + 40, 32, '#f5ead2', 'center', 800, 3);
    txt(`Ray Solano — ${rank.title}`, vw / 2, py + 76, 17, '#ffd76a', 'center', 700);
    if (rank.next !== null) {
      const frac = (p.respect - rank.threshold) / (rank.next[0] - rank.threshold);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      rr(px + 90, py + 96, pw - 180, 8, 4);
      ctx.fill();
      ctx.fillStyle = '#ffd76a';
      rr(px + 90, py + 96, (pw - 180) * Math.max(0, Math.min(1, frac)), 8, 4);
      ctx.fill();
      txt(`Next rank: ${rank.next[1]} at ${rank.next[0]} respect`, vw / 2, py + 118, 12.5, 'rgba(255,255,255,0.6)', 'center', 500);
    }
    const s = state.stats;
    const rows = [
      ['Cash', '$' + p.cash.toLocaleString('en-US')],
      ['Story jobs done', `${s.jobsDone} / 8`],
      ['Cars stolen', String(s.carsStolen)],
      ['Cars wrecked', String(s.carsWrecked)],
      ['Taxi fares', String(s.taxiFares)],
      ['Races won', String(s.racesWon)],
      ['Shots / hits', `${s.shots} / ${s.hits}`],
      ['Total earned', '$' + s.earned.toLocaleString('en-US')],
    ];
    rows.forEach((row, i) => {
      const col = i % 2;
      const rowI = Math.floor(i / 2);
      const rx = px + 60 + col * (pw / 2 - 40);
      const ry = py + 152 + rowI * 30;
      txt(row[0], rx, ry, 14.5, 'rgba(255,255,255,0.6)', 'left', 500);
      txt(row[1], rx + 190, ry, 14.5, '#ffffff', 'right', 700);
    });
    txt('WASD drive · Space handbrake · mouse shoot · Q wheel · R radio · M mute', vw / 2, py + 292, 13, 'rgba(255,255,255,0.55)', 'center', 500);
    drawMenuItems(view, vw / 2, py + 336, 44);
  }

  function drawShop(state, view) {
    const vw = camera.vw;
    const vh = camera.vh;
    ctx.fillStyle = 'rgba(6,8,16,0.66)';
    ctx.fillRect(0, 0, vw, vh);
    const shop = state.shop;
    const items = view.shopItems ?? [];
    const pw = 640;
    const ph = 130 + items.length * 52 + 60;
    const px = vw / 2 - pw / 2;
    const py = vh / 2 - ph / 2;
    ctx.fillStyle = 'rgba(14,17,30,0.97)';
    rr(px, py, pw, ph, 14);
    ctx.fill();
    ctx.strokeStyle = shop.kind === 'gun' ? '#4fc3f7' : '#f2c94c';
    ctx.lineWidth = 2;
    ctx.stroke();
    txt(shop.kind === 'gun' ? 'HARBOR ARMS' : 'VELORA AUTO WORKS', vw / 2, py + 38, 27, '#f5ead2', 'center', 800, 2);
    txt(shop.msg ?? '', vw / 2, py + 68, 14.5, 'rgba(255,255,255,0.7)', 'center', 500);
    items.forEach((item, i) => {
      const y = py + 108 + i * 52;
      const sel = i === shop.sel;
      if (sel) {
        ctx.fillStyle = 'rgba(255,215,106,0.14)';
        rr(px + 22, y - 21, pw - 44, 42, 8);
        ctx.fill();
      }
      ctx.globalAlpha = item.disabled ? 0.42 : 1;
      txt(item.label, px + 44, y - 4, 17.5, '#ffffff', 'left', 700);
      txt(item.note ?? '', px + 44, y + 15, 12, 'rgba(255,255,255,0.55)', 'left', 500);
      txt(item.price > 0 ? '$' + item.price.toLocaleString('en-US') : '—', px + pw - 44, y, 17, '#ffd76a', 'right', 800);
      ctx.globalAlpha = 1;
    });
    txt(`Cash $${state.player.cash.toLocaleString('en-US')} · ↑↓ choose · Enter confirm · Esc leave`, vw / 2, py + ph - 28, 13.5, 'rgba(255,255,255,0.6)', 'center', 500);
  }

  function drawDialogue(state) {
    const vw = camera.vw;
    const vh = camera.vh;
    const dlg = state.dialogue;
    if (dlg === null) return;
    const line = dlg.lines[dlg.i];
    if (line === undefined) return;
    const colors = { MARLA: '#e5534b', DEX: '#f2c94c', RAY: '#4fc3f7' };
    const w = Math.min(800, vw - 60);
    const x = vw / 2 - w / 2;
    const y = vh - 158;
    ctx.fillStyle = 'rgba(8,10,20,0.90)';
    rr(x, y, w, 108, 12);
    ctx.fill();
    ctx.fillStyle = colors[line.who] ?? '#e8e8e8';
    ctx.fillRect(x, y + 12, 5, 84);
    txt(line.who, x + 24, y + 26, 14.5, colors[line.who] ?? '#e8e8e8', 'left', 800, 1.5);
    const shown = Math.floor((state.t - (dlg.t0 ?? state.t)) * 60);
    const text = shown >= line.text.length ? line.text : line.text.slice(0, Math.max(0, shown));
    wrapText(text, x + 24, y + 56, w - 48, 21, 18.5);
    if (shown >= line.text.length) {
      const blink = Math.floor(state.t * 2.4) % 2 === 0;
      if (blink) txt('E ▸', x + w - 26, y + 88, 14, '#ffd76a', 'right', 800);
    }
  }

  function wrapText(text, x, y, maxW, lineH, size) {
    ctx.font = `500 ${size}px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const words = text.split(' ');
    let line = '';
    let ly = y;
    for (const word of words) {
      const trial = line === '' ? word : line + ' ' + word;
      if (ctx.measureText(trial).width > maxW && line !== '') {
        ctx.fillText(line, x, ly);
        line = word;
        ly += lineH;
      } else {
        line = trial;
      }
    }
    if (line !== '') ctx.fillText(line, x, ly);
  }

  function drawWheel(state, view) {
    const vw = camera.vw;
    const vh = camera.vh;
    const cx = vw / 2;
    const cy = vh / 2;
    ctx.fillStyle = 'rgba(6,8,16,0.45)';
    ctx.fillRect(0, 0, vw, vh);
    WEAPON_ORDER.forEach((key, i) => {
      const w = WEAPONS[key];
      const ang = -Math.PI / 2 + i * (Math.PI / 2);
      const sel = view.wheel.index === i;
      const owned = state.player.weapons[key];
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, 118, ang - Math.PI / 4 + 0.04, ang + Math.PI / 4 - 0.04);
      ctx.closePath();
      ctx.fillStyle = sel ? 'rgba(255,215,106,0.30)' : 'rgba(255,255,255,0.07)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.stroke();
      const lx = cx + Math.cos(ang) * 76;
      const ly = cy + Math.sin(ang) * 76;
      ctx.globalAlpha = owned ? 1 : 0.35;
      txt(w.name.toUpperCase(), lx, ly - 8, 14.5, '#ffffff', 'center', 800);
      txt(key === 'fist' ? '—' : owned ? String(state.player.ammo[key] ?? 0) : 'LOCKED', lx, ly + 12, 12.5, '#ffd76a', 'center', 700);
      ctx.globalAlpha = 1;
    });
    txt(WEAPONS[state.player.weapon].name.toUpperCase(), cx, cy, 15, '#ffd76a', 'center', 800);
  }

  function drawEnd(state, view) {
    const vw = camera.vw;
    const vh = camera.vh;
    const wasted = view.screen === SCREEN_WASTED;
    ctx.fillStyle = wasted ? 'rgba(70,4,4,0.55)' : 'rgba(4,14,60,0.55)';
    ctx.fillRect(0, 0, vw, vh);
    txt(wasted ? 'WASTED' : 'BUSTED', vw / 2, vh * 0.4, 92, wasted ? '#e5534b' : '#4fc3f7', 'center', 800, 10);
    txt(view.feeText ?? '', vw / 2, vh * 0.4 + 74, 17.5, 'rgba(255,255,255,0.9)', 'center', 500);
    txt('Press Enter', vw / 2, vh * 0.4 + 116, 16, '#ffd76a', 'center', 700);
  }

  // ----- the frame -----

  function draw(state, view) {
    resize();
    const tNow = view.tNow ?? state.t;
    view.hot = view.hot ?? [];
    view.hot.length = 0;
    const p = state.player;
    // Camera.
    if (state.cameraOverride) {
      camera.x = state.cameraOverride.x;
      camera.y = state.cameraOverride.y;
      camera.zoom = state.cameraOverride.zoom ?? 1;
    } else {
      const target = p.car !== null ? p.car : p;
      const lead = 0.22;
      const tx = target.x + (target.vx ?? 0) * lead;
      const ty = target.y + (target.vy ?? 0) * lead;
      const k = state.camSnap ? 1 : 1 - Math.exp(-(view.dt ?? 0.016) * 5);
      camera.x += (tx - camera.x) * k;
      camera.y += (ty - camera.y) * k;
      const speedZoom = p.car !== null ? Math.min(0.15, Math.abs(p.car.speed) / 2800) : 0;
      camera.zoom += ((1 - speedZoom) - camera.zoom) * k;
      state.camSnap = false;
    }
    const shakeX = state.camShake > 0 ? (Math.random() - 0.5) * state.camShake : 0;
    const shakeY = state.camShake > 0 ? (Math.random() - 0.5) * state.camShake : 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0d1020';
    ctx.fillRect(0, 0, camera.vw, camera.vh);
    ctx.save();
    ctx.translate(camera.vw / 2, camera.vh / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x + shakeX, -camera.y + shakeY);
    const bounds = {
      x0: camera.x - camera.vw / 2 / camera.zoom - 90,
      y0: camera.y - camera.vh / 2 / camera.zoom - 90,
      x1: camera.x + camera.vw / 2 / camera.zoom + 90,
      y1: camera.y + camera.vh / 2 / camera.zoom + 90,
    };
    drawTerrain(ctx, state, bounds, tNow);
    // Skid marks under everything that moves.
    ctx.lineWidth = 3.4;
    for (const s of state.skids) {
      ctx.strokeStyle = `rgba(12,12,14,${s.a})`;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }
    // Objective beacon.
    if (state.objective) {
      const o = state.objective;
      const pulse = 0.5 + Math.sin(tNow * 4) * 0.18;
      const grad = ctx.createLinearGradient(0, o.y - 320, 0, o.y);
      grad.addColorStop(0, 'rgba(255,215,106,0)');
      grad.addColorStop(1, `rgba(255,215,106,${pulse * 0.5})`);
      ctx.fillStyle = grad;
      ctx.fillRect(o.x - 13, o.y - 320, 26, 320);
    }
    for (const car of state.cars) {
      if (car.x < bounds.x0 - 120 || car.x > bounds.x1 + 120 || car.y < bounds.y0 - 120 || car.y > bounds.y1 + 120) continue;
      drawCar(car, state, tNow);
    }
    for (const ped of state.peds) {
      if (ped.x < bounds.x0 - 60 || ped.x > bounds.x1 + 60 || ped.y < bounds.y0 - 60 || ped.y > bounds.y1 + 60) continue;
      drawPed(ped, state, tNow);
    }
    drawPlayer(state);
    // Tracers, flashes, particles, explosions.
    for (const tr of state.tracers) {
      ctx.strokeStyle = tr.color;
      ctx.globalAlpha = 1 - tr.t / tr.life;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tr.x1, tr.y1);
      ctx.lineTo(tr.x2, tr.y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const part of state.parts) {
      ctx.globalAlpha = Math.max(0, 1 - part.t / part.life);
      ctx.fillStyle = part.color;
      ctx.fillRect(part.x - part.size / 2, part.y - part.size / 2, part.size, part.size);
    }
    ctx.globalAlpha = 1;
    for (const f of state.flashes) {
      ctx.globalAlpha = 1 - f.t / f.life;
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const boom of state.booms) {
      const frac = boom.t / boom.life;
      ctx.strokeStyle = `rgba(255,190,90,${1 - frac})`;
      ctx.lineWidth = 5 * (1 - frac) + 1;
      ctx.beginPath();
      ctx.arc(boom.x, boom.y, boom.r * frac, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,120,40,${(1 - frac) * 0.5})`;
      ctx.beginPath();
      ctx.arc(boom.x, boom.y, boom.r * 0.45 * (1 - frac * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    drawHeli(state, tNow);
    // Dusk grade: a sunset gradient wash (pink high, teal low) over the whole world,
    // plus the day-night tint. At golden hour the warm wash dominates so scenes read sun-soaked.
    const duskGrad = ctx.createLinearGradient(0, bounds.y0, 0, bounds.y1);
    duskGrad.addColorStop(0, 'rgba(255,93,143,0.13)');
    duskGrad.addColorStop(0.5, 'rgba(255,140,66,0.10)');
    duskGrad.addColorStop(1, 'rgba(18,120,140,0.12)');
    ctx.fillStyle = duskGrad;
    ctx.fillRect(bounds.x0, bounds.y0, bounds.x1 - bounds.x0, bounds.y1 - bounds.y0);
    const light = lightingAt(state.clock);
    if (light.dark > 0.01 || light.warm > 0.01) {
      ctx.fillStyle = `rgba(16,14,52,${light.dark * 0.46})`;
      ctx.fillRect(bounds.x0, bounds.y0, bounds.x1 - bounds.x0, bounds.y1 - bounds.y0);
      if (light.warm > 0.01) {
        ctx.fillStyle = `rgba(255,116,52,${light.warm * 0.13})`;
        ctx.fillRect(bounds.x0, bounds.y0, bounds.x1 - bounds.x0, bounds.y1 - bounds.y0);
      }
    }
    if (light.dark > 0.12) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const prop of city.props) {
        if (prop.type !== 'lamp') continue;
        if (prop.x < bounds.x0 || prop.x > bounds.x1 || prop.y < bounds.y0 || prop.y > bounds.y1) continue;
        ctx.globalAlpha = Math.min(0.85, light.dark * 0.9 + 0.18);
        ctx.drawImage(glowWarm, prop.x - 46, prop.y - 46, 92, 92);
      }
      for (const car of state.cars) {
        if (car.dead || car.x < bounds.x0 || car.x > bounds.x1 || car.y < bounds.y0 || car.y > bounds.y1) continue;
        const spec = CAR_TYPES[car.type];
        const fx = Math.cos(car.angle);
        const fy = Math.sin(car.angle);
        ctx.globalAlpha = light.dark * 0.4;
        ctx.drawImage(glowWarm, car.x + fx * spec.l * 0.6 - 22, car.y + fy * spec.l * 0.6 - 22, 44, 44);
      }
      for (const poi of city.pois) {
        if (poi.door.x < bounds.x0 - 100 || poi.door.x > bounds.x1 + 100 || poi.door.y < bounds.y0 - 100 || poi.door.y > bounds.y1 + 100) continue;
        ctx.globalAlpha = light.dark * 0.35;
        ctx.drawImage(glowCool, poi.door.x - 36, poi.door.y - 36, 72, 72);
      }
      ctx.restore();
    }
    // Landmark labels and the objective diamond float above the tint.
    for (const poi of city.pois) {
      if (dist(poi.door.x, poi.door.y, camera.x, camera.y) > 780) continue;
      ctx.font = `700 13px ${FONT}`;
      const tw = ctx.measureText(poi.sign).width + 20;
      ctx.fillStyle = 'rgba(8,10,20,0.72)';
      rr(poi.door.x - tw / 2, poi.door.y - 68, tw, 24, 12);
      ctx.fill();
      txt(poi.sign, poi.door.x, poi.door.y - 55, 13, poi.color, 'center', 700);
    }
    if (state.objective) {
      const o = state.objective;
      const bob = Math.sin(tNow * 4) * 5;
      ctx.save();
      ctx.translate(o.x, o.y - 34 + bob);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ffd76a';
      ctx.fillRect(-8, -8, 16, 16);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.strokeRect(-8, -8, 16, 16);
      ctx.restore();
    }
    ctx.restore();
    // Cinematic vignette in screen space, under the HUD.
    const vig = ctx.createRadialGradient(camera.vw / 2, camera.vh / 2, camera.vh * 0.42, camera.vw / 2, camera.vh / 2, camera.vh * 0.92);
    vig.addColorStop(0, 'rgba(20,8,36,0)');
    vig.addColorStop(1, 'rgba(20,8,36,0.34)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, camera.vw, camera.vh);
    // Screen space.
    const inGame = view.screen === SCREEN_PLAY || view.screen === SCREEN_PAUSED || view.screen === SCREEN_BUSTED || view.screen === SCREEN_WASTED;
    if (inGame && view.hud !== false) drawHud(state, view, tNow);
    if (state.shop !== null && view.screen === SCREEN_PLAY) drawShop(state, view);
    if (view.wheel?.open) drawWheel(state, view);
    drawDialogue(state);
    if (view.screen === SCREEN_TITLE) drawTitle(state, view, tNow);
    else if (view.screen === SCREEN_PAUSED) drawPause(state, view);
    else if (view.screen === SCREEN_BUSTED || view.screen === SCREEN_WASTED) drawEnd(state, view);
  }

  return { draw, screenToWorld, camera };
}
