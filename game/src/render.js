// Velora Bay's renderer: canvas only, no assets. Terrain is drawn from the city data (roads,
// blocks, beach, marina), buildings get a fake-height shadow and roof, and everything else —
// cars, people, the helicopter, tracers, the day-night tint, the HUD, the minimap, menus — is
// drawn from the simulation state each frame. A tiny offscreen map is pre-rendered once for the
// minimap.
import { WORLD, ROADS_V, ROADS_H, ROAD_W, BEACH_X, WATER_X, WEAPONS, WEAPON_ORDER, CAR_TYPES, rankFor } from './config.js';
import { shade } from './city.js';
import { dist } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

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
  g.fillStyle = '#3d6b46';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#dec088';
  g.fillRect(BEACH_X * scale, 0, (WATER_X - BEACH_X) * scale, c.height);
  g.fillStyle = '#175d75';
  g.fillRect(WATER_X * scale, 0, (WORLD.w - WATER_X) * scale, c.height);
  g.fillStyle = '#33363d';
  for (const vx of ROADS_V) g.fillRect((vx - ROAD_W / 2) * scale, 0, ROAD_W * scale, c.height);
  for (const hy of ROADS_H) g.fillRect(0, (hy - ROAD_W / 2) * scale, c.width, ROAD_W * scale);
  g.fillStyle = 'rgba(230,230,230,0.5)';
  for (const b of city.buildings) g.fillRect(b.x * scale, b.y * scale, Math.max(1.5, b.w * scale), Math.max(1.5, b.h * scale));
  return { canvas: c, scale };
}

/** Terrain and static city dressing inside the world-space bounds. */
export function drawTerrain(ctx, state, bounds, tNow) {
  const city = state.city;
  ctx.fillStyle = '#3d6b46';
  ctx.fillRect(bounds.x0, bounds.y0, bounds.x1 - bounds.x0, bounds.y1 - bounds.y0);
  // District ground tints per cell, then the shore and the sea.
  for (const cell of city.cells) {
    if (cell.x > bounds.x1 || cell.x + cell.w < bounds.x0 || cell.y > bounds.y1 || cell.y + cell.h < bounds.y0) continue;
    if (cell.kind === 'beach') continue;
    ctx.fillStyle = '#9aa0a3';
    ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
    ctx.fillStyle = cell.kind === 'park' ? '#47824f' : cell.kind === 'parking' ? '#3a3d42' : cell.district === 'Palm Heights' ? '#47824f' : cell.district === 'Downtown' ? '#a89a83' : '#8f8a80';
    ctx.fillRect(cell.x + 30, cell.y + 30, cell.w - 60, cell.h - 60);
    if (cell.kind === 'parking') {
      ctx.strokeStyle = 'rgba(230,230,230,0.35)';
      ctx.lineWidth = 2;
      for (let x = cell.x + 45; x < cell.x + cell.w - 40; x += 95) {
        ctx.beginPath();
        ctx.moveTo(x, cell.y + 40);
        ctx.lineTo(x, cell.y + cell.h - 40);
        ctx.stroke();
      }
    }
  }
  ctx.fillStyle = '#dec088';
  ctx.fillRect(BEACH_X, bounds.y0, WATER_X - BEACH_X, bounds.y1 - bounds.y0);
  const waterGrad = ctx.createLinearGradient(WATER_X, 0, WORLD.w, 0);
  waterGrad.addColorStop(0, '#175d75');
  waterGrad.addColorStop(1, '#0f4258');
  ctx.fillStyle = waterGrad;
  ctx.fillRect(WATER_X, bounds.y0, WORLD.w - WATER_X, bounds.y1 - bounds.y0);
  ctx.strokeStyle = 'rgba(255,255,255,0.13)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let y = bounds.y0 - (bounds.y0 % 90); y < bounds.y1; y += 90) {
    const off = Math.sin(y * 0.05 + tNow * 0.7) * 14;
    ctx.moveTo(WATER_X + 26 + off, y);
    ctx.lineTo(WATER_X + 120 + off, y);
    ctx.moveTo(WATER_X + 220 - off, y + 40);
    ctx.lineTo(WATER_X + 330 - off, y + 40);
  }
  ctx.stroke();
  // Roads: asphalt, edges, dashed lane lines.
  ctx.fillStyle = '#33363d';
  for (const vx of ROADS_V) ctx.fillRect(vx - ROAD_W / 2, bounds.y0, ROAD_W, bounds.y1 - bounds.y0);
  for (const hy of ROADS_H) ctx.fillRect(bounds.x0, hy - ROAD_W / 2, bounds.x1 - bounds.x0, ROAD_W);
  ctx.fillStyle = '#26282e';
  for (const vx of ROADS_V) {
    ctx.fillRect(vx - ROAD_W / 2, bounds.y0, 5, bounds.y1 - bounds.y0);
    ctx.fillRect(vx + ROAD_W / 2 - 5, bounds.y0, 5, bounds.y1 - bounds.y0);
  }
  for (const hy of ROADS_H) {
    ctx.fillRect(bounds.x0, hy - ROAD_W / 2, bounds.x1 - bounds.x0, 5);
    ctx.fillRect(bounds.x0, hy + ROAD_W / 2 - 5, bounds.x1 - bounds.x0, 5);
  }
  ctx.strokeStyle = 'rgba(216,207,159,0.55)';
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  ctx.beginPath();
  for (const vx of ROADS_V) {
    for (const off of [-42, 42]) {
      ctx.moveTo(vx + off, bounds.y0);
      ctx.lineTo(vx + off, bounds.y1);
    }
  }
  for (const hy of ROADS_H) {
    for (const off of [-42, 42]) {
      ctx.moveTo(bounds.x0, hy + off);
      ctx.lineTo(bounds.x1, hy + off);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);
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
      ctx.strokeStyle = '#6b4a2c';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(prop.x, prop.y);
      ctx.lineTo(prop.x + 3, prop.y - 7);
      ctx.stroke();
      ctx.strokeStyle = '#2f7a44';
      ctx.lineWidth = 3;
      const sway = Math.sin(tNow * 0.9 + prop.x * 0.05) * 1.6;
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + prop.x;
        ctx.beginPath();
        ctx.moveTo(prop.x + 3, prop.y - 7);
        ctx.quadraticCurveTo(prop.x + 3 + Math.cos(a) * 11 + sway, prop.y - 12 + Math.sin(a) * 5, prop.x + 3 + Math.cos(a) * 17 + sway, prop.y - 6 + Math.sin(a) * 8);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(prop.x + 6, prop.y + 4, 13, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (prop.type === 'lamp') {
      ctx.fillStyle = '#2c2f36';
      ctx.fillRect(prop.x - 2, prop.y - 2, 4, 4);
      ctx.fillStyle = '#ffd76a';
      ctx.fillRect(prop.x - 1.5, prop.y - 1.5, 3, 3);
    } else {
      ctx.fillStyle = '#8a6f4d';
      ctx.fillRect(prop.x - 7, prop.y - 7, 14, 14);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(prop.x - 7, prop.y - 7, 14, 14);
    }
  }
  // Buildings: shadow first (fake height), then the block, then the raised roof.
  for (const b of city.buildings) {
    if (b.x > bounds.x1 + 60 || b.x + b.w < bounds.x0 - 60 || b.y > bounds.y1 + 60 || b.y + b.h < bounds.y0 - 60) continue;
    const sx = b.ht * 0.16;
    const sy = b.ht * 0.20;
    ctx.fillStyle = 'rgba(10,10,20,0.30)';
    ctx.fillRect(b.x + sx, b.y + sy, b.w, b.h);
    ctx.fillStyle = shade(b.color, -28);
    ctx.fillRect(b.x, b.y, b.w, b.h);
    const rx = b.x - b.ht * 0.05;
    const ry = b.y - b.ht * 0.09;
    ctx.fillStyle = b.roof || shade(b.color, 16);
    ctx.fillRect(rx, ry, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(rx, ry, b.w, b.h);
    if (b.kind === 'container') {
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.lineWidth = 2;
      for (let x = rx + 8; x < rx + b.w - 4; x += 9) {
        ctx.beginPath();
        ctx.moveTo(x, ry + 2);
        ctx.lineTo(x, ry + b.h - 2);
        ctx.stroke();
      }
    }
    for (const det of b.details ?? []) {
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.fillRect(rx + det.dx * b.w, ry + det.dy * b.h, det.w * b.w, det.h * b.h);
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
    ctx.font = `${weight} ${size}px ${FONT}`;
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
    ctx.fillStyle = body;
    rr(-spec.l / 2, -spec.w / 2, spec.l, spec.w, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
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
      ctx.fillStyle = '#28418c';
      ctx.fillRect(-spec.l * 0.05, -spec.w / 2, spec.l * 0.14, spec.w);
      const phase = Math.floor(tNow * 5 + car.id) % 2 === 0;
      ctx.fillStyle = phase ? '#ff4444' : '#664444';
      ctx.fillRect(-4, -spec.w * 0.30, 8, spec.w * 0.28);
      ctx.fillStyle = phase ? '#4466ff' : '#444466';
      ctx.fillRect(-4, spec.w * 0.02, 8, spec.w * 0.28);
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
    ctx.fillStyle = ped.pants;
    ctx.beginPath();
    ctx.arc(0, 0, 8.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(Math.cos(ped.angle) * 1.6, Math.sin(ped.angle) * 1.6 + bob * 0.2, 6.8, 0, Math.PI * 2);
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
    // Health and armor, top left.
    const barW = 218;
    ctx.fillStyle = 'rgba(8,10,20,0.55)';
    rr(16, 14, barW + 20, 58, 8);
    ctx.fill();
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
    for (let i = 0; i < 5; i += 1) {
      const on = i < state.wanted.stars;
      const size = on && state.starFlashT > 0 ? 30 : 25;
      txt('★', vw - 24 - (4 - i) * 27, 84, size, on ? '#ffd76a' : 'rgba(255,255,255,0.22)', 'center', 800);
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
    grad.addColorStop(0, 'rgba(10,8,26,0.18)');
    grad.addColorStop(0.55, 'rgba(10,8,26,0.10)');
    grad.addColorStop(1, 'rgba(10,8,26,0.82)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, vw, vh);
    ctx.save();
    ctx.shadowColor = 'rgba(229,83,75,0.8)';
    ctx.shadowBlur = 30;
    txt('VELORA BAY', vw / 2, vh * 0.27, 96, '#f5ead2', 'center', 800, 4);
    ctx.restore();
    ctx.fillStyle = '#e5534b';
    ctx.fillRect(vw / 2 - 210, vh * 0.27 + 58, 420, 5);
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
    // Day-night tint and artificial light.
    const light = lightingAt(state.clock);
    if (light.dark > 0.01 || light.warm > 0.01) {
      ctx.fillStyle = `rgba(10,12,44,${light.dark * 0.52})`;
      ctx.fillRect(bounds.x0, bounds.y0, bounds.x1 - bounds.x0, bounds.y1 - bounds.y0);
      if (light.warm > 0.01) {
        ctx.fillStyle = `rgba(255,116,52,${light.warm * 0.10})`;
        ctx.fillRect(bounds.x0, bounds.y0, bounds.x1 - bounds.x0, bounds.y1 - bounds.y0);
      }
    }
    if (light.dark > 0.12) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const prop of city.props) {
        if (prop.type !== 'lamp') continue;
        if (prop.x < bounds.x0 || prop.x > bounds.x1 || prop.y < bounds.y0 || prop.y > bounds.y1) continue;
        ctx.globalAlpha = light.dark * 0.5;
        ctx.drawImage(glowWarm, prop.x - 30, prop.y - 30, 60, 60);
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
