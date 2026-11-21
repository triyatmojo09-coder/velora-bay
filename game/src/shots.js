// Deterministic staged scenes for the entry screenshots, in the spirit of the kit's original
// shot helper: ?shot=<name>&seed=<n> builds a fixed tableau on a fresh world, and the normal
// simulation keeps running afterwards so the scene stays alive (traffic flows, lightbars flash,
// the water shimmers, the helicopter holds its light on Ray). Scenes: title (the title screen
// over the marina), chase (a four-star pursuit with a roadblock ahead), mission (Marla's first
// job offer, dialogue panel up), city (a wide dusk view over downtown and the bay).

export function parseShot() {
  const params = new URLSearchParams(window.location.search);
  const name = params.get('shot');
  if (name === null) return null;
  const seed = Number.parseInt(params.get('seed') ?? '1', 10);
  return { name, seed: Number.isFinite(seed) && seed > 0 ? seed : 1 };
}

function stageTitle(state) {
  state.clock = 18.65 * 60;
  const p = state.player;
  p.x = 4470;
  p.y = 2350;
  p.angle = -Math.PI / 2;
  state.spawnCar('sports', 4380, 2560, -0.4, { kind: 'parked' });
  state.spawnCar('sedan', 4360, 2140, 0.2, { kind: 'parked' });
}

function stageChase(state) {
  state.clock = 19.35 * 60;
  const p = state.player;
  const car = state.spawnCar('sports', 980, 1100, 0, { kind: 'player' });
  car.vx = 320;
  p.car = car;
  p.x = car.x;
  p.y = car.y;
  state.wanted.stars = 4;
  state.wanted.heat = 210;
  state.wanted.floor = 175;
  const cop1 = state.spawnCar('police', 690, 1052, 0.1, { kind: 'police', driver: true });
  cop1.vx = 300;
  const cop2 = state.spawnCar('police', 620, 1152, -0.08, { kind: 'police', driver: true });
  cop2.vx = 295;
  // The roadblock waits at the next crossroads, parked across the lanes, officers out.
  for (const [y, a] of [[1050, Math.PI / 2], [1150, -Math.PI / 2]]) {
    const block = state.spawnCar('police', 2420, y, a, { kind: 'police', driver: false });
    block.ai = { stuckT: 0, revT: 0, holdPosition: true };
  }
  for (const off of [-70, 70]) {
    const cop = state.spawnPed(2420 + off, 1100 + (off < 0 ? -52 : 52), 'cop');
    cop.state = 'attack';
  }
  state.spawnCar('sedan', 1500, 1142, 0, { kind: 'traffic', driver: true });
  state.heli = { x: car.x - 170, y: car.y - 200, angle: 0.7, rotor: 0 };
  state.setBanner('VBPD PURSUIT', 'Four stars — the roadblock is waiting at Palm Cross');
  state.banner.dur = 1e9;
  state.objective = { x: 2440, y: 1100, label: 'Outrun the VBPD', route: null };
}

function stageMission(state) {
  state.clock = 18.5 * 60;
  const p = state.player;
  // Ray stands at the Gilded Eel's door; the boot code "talks" on an early frame, which starts
  // Marla's first job through the director's normal offer path, dialogue panel and all.
  p.x = 712;
  p.y = 1470;
  p.angle = -Math.PI / 2;
  state.spawnCar('sedan', 620, 1590, 0.12, { kind: 'parked' });
  state.spawnCar('compact', 900, 1330, -0.1, { kind: 'parked' });
  state.cameraOverride = { x: 730, y: 1430, zoom: 1.25 };
}

function stageCity(state) {
  state.clock = 19.05 * 60;
  const p = state.player;
  // Ray stands on the coast road; ambient traffic and pedestrians spawn around him, in frame.
  p.x = 4360;
  p.y = 1900;
  p.angle = -Math.PI / 2;
  state.cameraOverride = { x: 3980, y: 1760, zoom: 0.5 };
  const kinds = ['sedan', 'compact', 'taxi', 'sports', 'suv', 'van', 'sedan'];
  for (let i = 0; i < kinds.length; i += 1) {
    const east = i % 2 === 0;
    const car = state.spawnCar(kinds[i], 2450 + i * 260, east ? 1142 : 1058, east ? 0 : Math.PI, { kind: 'traffic', driver: true });
    car.ai = state.trafficInit(car);
  }
  // Coast-road traffic flowing past the marina, both ways.
  for (let i = 0; i < 4; i += 1) {
    const north = i % 2 === 0;
    const car = state.spawnCar(['sports', 'sedan', 'taxi', 'suv'][i], north ? 4318 : 4402, 900 + i * 620, north ? -Math.PI / 2 : Math.PI / 2, { kind: 'traffic', driver: true });
    car.ai = state.trafficInit(car);
  }
  state.spawnCar('sports', 4480, 2260, 0.3, { kind: 'parked' });
  state.spawnCar('compact', 4490, 1420, -0.2, { kind: 'parked' });
}

export function stageShot(state, director, name) {
  state.shotMode = true;
  if (name === 'chase') stageChase(state);
  else if (name === 'mission') stageMission(state);
  else if (name === 'city') stageCity(state);
  else stageTitle(state);
  void director;
}
