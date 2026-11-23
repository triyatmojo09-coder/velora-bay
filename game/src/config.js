// VELORA BAY — shared constants: city grid, golden-hour vivid-grade pastel palette, tuning, toon shading.
// The city is a regular grid: 14 m streets on a 54 m pitch, 40 m blocks between them.
// Street centrelines sit at multiples of 54 offset by -162, block centres between them.
import * as THREE from 'three';
let _grad = null;
export function toonGradient() {
  if (_grad) return _grad;
  const data = new Uint8Array([90, 150, 210, 255]);
  _grad = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
  _grad.minFilter = _grad.magFilter = THREE.NearestFilter;
  _grad.needsUpdate = true;
  return _grad;
}
export function toonMat(color, opts = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...opts });
}

export const CONFIG = {
  WORLD_HALF: 180,          // playable half-extent (m)
  STREET_CENTERS: [-162, -108, -54, 0, 54, 108, 162],
  BLOCK_CENTERS: [-135, -81, -27, 27, 81, 135],
  STREET_W: 14,
  BLOCK: 40,
  BEACH_X: 148,             // sand starts here, water beyond WATER_X
  WATER_X: 176,
  WALK_SPEED: 4.2,
  SPRINT_SPEED: 7.2,
  CAR_MAX_SPEED: 38,
  CAR_REVERSE: 10,
  CAR_ACCEL: 22,
  TRAFFIC_COUNT: 10,
  PARKED_COUNT: 14,
  POLICE_POOL: 4,
  PED_COUNT: 10,
  SAVE_KEY: 'velorabay3d',
};

export const PALETTE = {
  sky: 0xffb877,
  fog: 0xffc490,
  sun: 0xffd28a,
  hemiSky: 0xbfe3ff,
  hemiGround: 0xffc490,
  ground: 0x86b06c,
  sand: 0xffd98a,
  asphalt: 0x776f8c,
  sidewalk: 0xf5cf9f,
  water: 0x0fb2cc,
  gold: 0xffc94d,
  pink: 0xff5d8f,
  teal: 0x2ec4b6,
  buildingPastels: [0xff9ebb, 0xffcf4d, 0x63e0bb, 0x8fb4ff, 0xff9a62, 0x6fe3d0, 0xffe3b3, 0x7fd4ff, 0xffbe86, 0xb8ec6a],
};

// Miami layout: two water channels cut into the land from the eastern ocean,
// leaving a downtown peninsula between them. Vertical streets cross each
// channel on bridges (bridgeXs); everything else in the rect is open water.
export const CHANNELS = [
  { minX: -20, maxX: 195, minZ: 68, maxZ: 94, bridges: [54, 108, 162] },
  { minX: 40, maxX: 195, minZ: -94, maxZ: -68, bridges: [54, 108, 162] },
];
export function inChannel(x, z) {
  for (const c of CHANNELS) {
    if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ) {
      if (c.bridges.some((b) => Math.abs(x - b) < 8)) return false;
      return c;
    }
  }
  return null;
}

// Deterministic RNG (mulberry32) so staged shots and city layout are reproducible.
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Is (x,z) on a street (either a vertical or horizontal street band)?
export function onStreet(x, z) {
  const w = CONFIG.STREET_W / 2;
  for (const c of CONFIG.STREET_CENTERS) {
    if (Math.abs(x - c) <= w || Math.abs(z - c) <= w) return true;
  }
  return false;
}

// Resolve a circle (x,z,r) against a list of AABBs; mutates pos {x,z}, returns true on hit.
export function collideCircle(pos, r, colliders) {
  let hit = false;
  for (const b of colliders) {
    const nx = Math.max(b.minX, Math.min(pos.x, b.maxX));
    const nz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
    const dx = pos.x - nx, dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * r;
        pos.z = nz + (dz / d) * r;
      } else {
        const pl = pos.x - b.minX, pr = b.maxX - pos.x, pt = pos.z - b.minZ, pb = b.maxZ - pos.z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) pos.x = b.minX - r;
        else if (m === pr) pos.x = b.maxX + r;
        else if (m === pt) pos.z = b.minZ - r;
        else pos.z = b.maxZ + r;
      }
    }
  }
  // keep everything out of the inlet/bay water (bridges are dry)
  const ch = inChannel(pos.x, pos.z);
  if (ch) {
    hit = true;
    const pl = pos.x - ch.minX, pr = ch.maxX - pos.x, pt = pos.z - ch.minZ, pb = ch.maxZ - pos.z;
    const m = Math.min(pl, pr, pt, pb);
    if (m === pt) pos.z = ch.minZ - r;
    else if (m === pb) pos.z = ch.maxZ + r;
    else if (m === pl) pos.x = ch.minX - r;
    else pos.x = ch.maxX + r;
  }
  const lim = CONFIG.WORLD_HALF + 60;
  if (pos.x > CONFIG.WATER_X + 4) pos.x = CONFIG.WATER_X + 4;
  if (pos.x < -lim) pos.x = -lim;
  pos.z = Math.max(-lim, Math.min(pos.z, lim));
  return hit;
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export function lerpAngle(a, b, t) {
  return a + angleDiff(a, b) * t;
}
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
