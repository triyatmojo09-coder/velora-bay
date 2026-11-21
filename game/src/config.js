// Velora Bay's tuning tables: world size, weapons, vehicles, respect ladder and palette.
// Everything named here is original to this game — an invented city, invented people, invented cars.

export const STEP = 1 / 60;

export const WORLD = { w: 5200, h: 3800 };

/** Road centre-lines. The blocks between them hold the buildings. Road width is ROAD_W. */
export const ROADS_V = [520, 1160, 1800, 2440, 3080, 3720, 4360];
export const ROADS_H = [480, 1100, 1720, 2340, 2960, 3520];
export const ROAD_W = 170;

/** The sea starts at WATER_X; between BEACH_X and WATER_X is sand. */
export const BEACH_X = 4560;
export const WATER_X = 4780;

export const WEAPONS = {
  fist: { slot: 1, name: 'Fists', dmg: 22, rate: 0.38, range: 54, spread: 0, pellets: 1, auto: false, melee: true, price: 0, ammoPrice: 0, pack: 0 },
  pistol: { slot: 2, name: 'Pistol', dmg: 34, rate: 0.30, range: 560, spread: 0.022, pellets: 1, auto: false, price: 300, ammoPrice: 120, pack: 60 },
  smg: { slot: 3, name: 'SMG', dmg: 15, rate: 0.085, range: 500, spread: 0.075, pellets: 1, auto: true, price: 900, ammoPrice: 240, pack: 120 },
  shotgun: { slot: 4, name: 'Scattergun', dmg: 11, rate: 0.95, range: 350, spread: 0.17, pellets: 6, auto: false, price: 1400, ammoPrice: 160, pack: 24 },
};
export const WEAPON_ORDER = ['fist', 'pistol', 'smg', 'shotgun'];

export const CAR_TYPES = {
  compact: { name: 'Kite', maxSpeed: 255, accel: 235, grip: 3.4, hp: 70, w: 34, l: 62 },
  sedan: { name: 'Meridian', maxSpeed: 278, accel: 242, grip: 3.2, hp: 95, w: 36, l: 70 },
  taxi: { name: 'Meridian Cab', maxSpeed: 278, accel: 242, grip: 3.2, hp: 95, w: 36, l: 70 },
  sports: { name: 'Vantara GT', maxSpeed: 368, accel: 335, grip: 3.9, hp: 85, w: 37, l: 72 },
  suv: { name: 'Trailfox', maxSpeed: 268, accel: 232, grip: 3.0, hp: 125, w: 40, l: 76 },
  van: { name: 'Hauler Van', maxSpeed: 218, accel: 195, grip: 2.7, hp: 165, w: 42, l: 84 },
  truck: { name: 'Vault Hauler', maxSpeed: 232, accel: 200, grip: 2.6, hp: 420, w: 44, l: 92 },
  police: { name: 'VBPD Interceptor', maxSpeed: 335, accel: 312, grip: 3.6, hp: 115, w: 36, l: 70 },
};
export const CAR_COLORS = ['#c94f38', '#3e6fb0', '#d9a441', '#4d9e6b', '#8a8f98', '#e3e0d8', '#5b4a8a', '#b03a5e', '#2f8f8a', '#704214', '#22303c', '#7a1f1f'];
export const SPORTS_COLORS = ['#e8b13a', '#c22430', '#28418c', '#0f7a6d', '#e6e6e6', '#15151a'];

/** Respect ladder: [threshold, title]. Shown in the HUD and on the pause screen. */
export const RANKS = [
  [0, 'Nobody'],
  [100, 'Runner'],
  [250, 'Wheelman'],
  [450, 'Hustler'],
  [700, 'Fixer'],
  [1000, 'Shot Caller'],
  [1400, 'Underboss'],
  [1900, 'Kingpin of Velora'],
];

export function rankFor(respect) {
  let current = RANKS[0];
  let next = null;
  for (let i = 0; i < RANKS.length; i += 1) {
    if (respect >= RANKS[i][0]) {
      current = RANKS[i];
      next = RANKS[i + 1] ?? null;
    }
  }
  return { title: current[1], threshold: current[0], next };
}

/** Heat points at which each wanted star switches on (index = stars). */
export const STAR_THRESHOLDS = [0, 25, 60, 110, 175, 260, Infinity];

/** Dusk-first palette: hot coral, teal sea, cream light, deep navy night. */
export const PALETTE = {
  grass: '#3d6b46',
  park: '#47824f',
  sand: '#dec088',
  water: '#175d75',
  waterDeep: '#0f4258',
  road: '#33363d',
  roadEdge: '#26282e',
  lane: '#d8cf9f',
  sidewalk: '#9aa0a3',
  lot: '#8f8a80',
  plaza: '#a89a83',
};

export const SAVE_KEY = 'velora-bay-save-v1';
export const MUTE_KEY = 'velora-bay-muted';
