// VELORA BAY 3D — shared constants: city grid, sunset palette, tuning.
// The city is a regular grid: 14 m streets on a 54 m pitch, 40 m blocks between them.
// Street centrelines sit at multiples of 54 offset by -162, block centres between them.

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
  sky: 0x35224d,
  fog: 0x2a1e3f,
  sun: 0xff9a3c,
  hemiSky: 0xff8fb2,
  hemiGround: 0x3a2b5c,
  ground: 0x4a3b52,
  sand: 0xd9a066,
  asphalt: 0x2e2a3a,
  sidewalk: 0x8d8296,
  water: 0x1b7f8e,
  gold: 0xffc94d,
  pink: 0xff5d8f,
  teal: 0x2ec4b6,
  buildingPastels: [0xf2b8c6, 0xf7d08a, 0xa8d8c8, 0xb8c6f2, 0xf2a65a, 0xd8b8f2, 0xf7ede2, 0x9fd8e8, 0xf2c6a0, 0xc8e6a0],
};

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
