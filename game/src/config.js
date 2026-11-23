// Velora Bay's tuning tables: world size, weapons, vehicles, respect ladder and palette.
// Everything named here is original to this game — an invented city, invented people, invented cars.
// Art direction (v2): a sun-soaked dusk city — Vice-pink sunset, teal bay water, coral and
// turquoise neon — set in type with Anton for display and Rajdhani for UI, bundled in game/fonts/.

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
/** Vice-era paint: coral, turquoise, flamingo pink, sunset gold, mint, cream — no rental-car grey. */
export const CAR_COLORS = ['#ff6b57', '#19b5a6', '#ff8fb2', '#ffc53d', '#7bd88f', '#f4ead5', '#ff7847', '#4cc9f0', '#c77dff', '#ff5d8f', '#2ec4b6', '#ffd166'];
export const SPORTS_COLORS = ['#ffd166', '#ff2e63', '#08d9d6', '#ff8c42', '#f9f7f7', '#b5179e'];

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

/** Bundled typefaces — the only fonts the game is allowed to draw with. */
export const FONTS = {
  display: '"Anton", "Rajdhani", sans-serif',
  ui: '"Rajdhani", sans-serif',
};

/** Invented neon signage painted onto rooftops and facades around the bay. */
export const NEON_SIGNS = [
  { text: 'HOTEL CORAL', color: '#ff5d8f' },
  { text: 'CAFÉ PALMA', color: '#4cc9f0' },
  { text: 'TIKI BAR', color: '#ffd166' },
  { text: 'VELORA INN', color: '#2ec4b6' },
  { text: 'DISCO MARINA', color: '#c77dff' },
  { text: 'NOODLE 88', color: '#ff7847' },
  { text: 'SURF SHACK', color: '#7bd88f' },
  { text: 'CASINO AZUL', color: '#4cc9f0' },
  { text: 'PIZZA SOL', color: '#ff6b57' },
  { text: 'CLUB NEON', color: '#ff2e63' },
];

/**
 * Dusk Vice palette: warm sand and coral ground, teal water, dark blue-violet asphalt
 * (never flat grey), cream sidewalks warmed by the low sun.
 */
export const PALETTE = {
  grass: '#2e7d5b',
  park: '#359668',
  sand: '#f2c98a',
  sandWet: '#e0aa6e',
  water: '#12a5b4',
  waterDeep: '#0b5e7a',
  waterFoam: '#b8fff4',
  road: '#2b2a3d',
  roadEdge: '#1d1c2b',
  lane: '#ffd98a',
  sidewalk: '#d9c7a7',
  sidewalkEdge: '#b8a37e',
  lot: '#3d3a4d',
  plaza: '#e6cfa3',
  sunsetPink: '#ff5d8f',
  sunsetOrange: '#ff8c42',
  sunsetGold: '#ffd166',
  teal: '#2ec4b6',
  skyDeep: '#241b4d',
  glass: 'rgba(16,14,36,0.72)',
  glassEdge: 'rgba(255,209,102,0.55)',
};

export const SAVE_KEY = 'velora-bay-save-v1';
export const MUTE_KEY = 'velora-bay-muted';
