// VELORA BAY 3D — boot, third-person controller, traffic/police/ped simulation,
// camera, HUD wiring, save games, menu/pause flow and ?shot= staging.
import * as THREE from 'three';
import { CONFIG, PALETTE, makeRng, clamp, lerpAngle, angleDiff, collideCircle, onStreet } from './config.js';
import { buildCity } from './city.js';
import { Human } from './character.js';
import { CarSim, TrafficCar, parkedCars, steerTo, CAR_COLORS } from './vehicles.js';
import { GameState, JOBS } from './missions.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { GameAudio } from './audio.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const rng = makeRng(Number(params.get('seed') || 1));

// ---------------------------------------------------------------- renderer
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.domElement.classList.add('webgl');
app.prepend(renderer.domElement);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 900);
camera.position.set(150, 30, 90);

// ---------------------------------------------------------------- world
const city = buildCity(scene, rng);
const colliders = city.colliders;

const state = new GameState();
const hud = new Hud();
const input = new Input(renderer.domElement);
const audio = new GameAudio();
state.onBanner = (t, s) => { hud.banner(t, s); if (t === 'JOB COMPLETE') audio.jingle(true); if (t === 'JOB FAILED') audio.jingle(false); };
state.onObjective = (t) => hud.setObjective(t);

// job-start beacons (where a job is offered) — the active job uses state.marker instead
const JOB_STARTS = [{ x: 27, z: -27 }, { x: 54, z: 54 }, { x: -54, z: 108 }];

// glowing beacon column + floating gem, reused for job starts and objectives
const beacon = new THREE.Group();
const beam = new THREE.Mesh(
  new THREE.CylinderGeometry(2.3, 2.3, 16, 18, 1, true),
  new THREE.MeshBasicMaterial({ color: PALETTE.gold, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
);
beam.position.y = 8; beacon.add(beam);
const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.9), new THREE.MeshBasicMaterial({ color: PALETTE.gold }));
gem.position.y = 10.5; beacon.add(gem);
beacon.visible = false;
scene.add(beacon);

// ---------------------------------------------------------------- player
const player = new Human({ shirt: 0x2ec4b6, sleeves: 0xff5d8f, pants: 0x23233a, skin: 0xd99a6c, cap: 0xffc94d });
scene.add(player.group);
const playerPos = { x: 8, z: 26 };
player.group.position.set(playerPos.x, 0, playerPos.z);
let playerHeading = Math.PI;
let health = 100, hurtCooldown = 0, lastHurt = -99;

const heroCar = new CarSim(3.2, 14, 0, 0x2ec4b6, {});
scene.add(heroCar.group);
let currentCar = null; // CarSim the player is driving, or null on foot

// ---------------------------------------------------------------- traffic & parked
const traffic = [];
for (let i = 0; i < CONFIG.TRAFFIC_COUNT; i++) {
  const vertical = rng() < 0.5;
  const c = CONFIG.STREET_CENTERS[Math.floor(rng() * CONFIG.STREET_CENTERS.length)];
  const along = -150 + rng() * 300;
  const x = vertical ? c + 3 : along, z = vertical ? along : c - 3;
  const heading = vertical ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
  const tc = new TrafficCar(x, z, heading, CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)], rng);
  traffic.push(tc); scene.add(tc.sim.group);
}
const parked = parkedCars(rng);
for (const p of parked) scene.add(p.group);
const allCars = () => [heroCar, ...traffic.map((t) => t.sim), ...parked];

// ---------------------------------------------------------------- police
const police = [];
for (let i = 0; i < CONFIG.POLICE_POOL; i++) {
  const sim = new CarSim(0, -400, 0, 0x16161f, { police: true });
  sim.group.visible = false;
  scene.add(sim.group);
  police.push({ sim, active: false });
}
const policeLight = new THREE.PointLight(0xff4455, 0, 26);
scene.add(policeLight);

// ---------------------------------------------------------------- peds
const PED_STYLES = [
  { shirt: 0xf2b138, sleeves: 0xf2f2f2, pants: 0x3a4a6b, skin: 0xb87a4e, cap: 0xe84a6f },
  { shirt: 0xe84a6f, sleeves: 0x2b2b3a, pants: 0x23233a, skin: 0x8a5a34, cap: 0x3fa7d6 },
  { shirt: 0x7bc950, sleeves: 0xff5d8f, pants: 0x554a63, skin: 0xe8b088, cap: 0xf2f2f2 },
  { shirt: 0xb388eb, sleeves: 0x2ec4b6, pants: 0x2b2b3a, skin: 0xd99a6c, cap: 0x23233a },
];
const peds = [];
for (let i = 0; i < CONFIG.PED_COUNT; i++) {
  const h = new Human(PED_STYLES[i % PED_STYLES.length]);
  const bx = CONFIG.BLOCK_CENTERS[Math.floor(rng() * 5)], bz = CONFIG.BLOCK_CENTERS[Math.floor(rng() * 5)];
  const ped = { human: h, pos: { x: bx + (rng() - 0.5) * 30, z: bz + (rng() - 0.5) * 30 }, heading: rng() * 6.28, target: null, down: 0, speed: 1.3 + rng() * 0.5 };
  ped.target = { x: ped.pos.x + (rng() - 0.5) * 60, z: ped.pos.z + (rng() - 0.5) * 60 };
  h.group.position.set(ped.pos.x, 0, ped.pos.z);
  scene.add(h.group);
  peds.push(ped);
}

// ---------------------------------------------------------------- save
function save() {
  try { localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify({ money: state.money, respect: state.respect, jobIndex: state.jobIndex })); } catch {}
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(CONFIG.SAVE_KEY) || 'null');
    if (s) { state.money = s.money ?? state.money; state.respect = s.respect ?? 0; state.jobIndex = s.jobIndex ?? 0; return true; }
  } catch {}
  return false;
}
state.onJobComplete = save;

// ---------------------------------------------------------------- modes & UI
let mode = SHOT ? 'shot' : 'menu';
const $ = (id) => document.getElementById(id);
const menuEl = $('menu-overlay'), pauseEl = $('pause-overlay'), wastedEl = $('wasted-overlay');
function startPlay(fresh) {
  if (fresh) { try { localStorage.removeItem(CONFIG.SAVE_KEY); } catch {} Object.assign(state, new GameState()); state.onBanner = (t, s) => { hud.banner(t, s); }; state.onObjective = (t) => hud.setObjective(t); state.onJobComplete = save; hud.setObjective(state.objective); }
  menuEl.classList.add('hidden'); pauseEl.classList.add('hidden'); wastedEl.classList.add('hidden');
  mode = 'play';
  audio.ensure();
}
$('btn-new').onclick = () => startPlay(true);
$('btn-continue').onclick = () => { load(); startPlay(false); };
$('btn-how').onclick = () => { const h = $('howto'); h.style.display = h.style.display === 'none' ? 'block' : 'none'; };
$('btn-resume').onclick = () => { pauseEl.classList.add('hidden'); mode = 'play'; };
$('btn-quit').onclick = () => { pauseEl.classList.add('hidden'); menuEl.classList.remove('hidden'); mode = 'menu'; };
$('btn-respawn').onclick = () => {
  wastedEl.classList.add('hidden');
  state.money = Math.floor(state.money * 0.9); state.setWanted(0);
  health = 100; playerPos.x = -108; playerPos.z = 54; exitCar(true);
  mode = 'play';
};
addEventListener('blur', () => { if (mode === 'play') { mode = 'pause'; pauseEl.classList.remove('hidden'); $('pause-stats').textContent = `${state.rank} · $${state.money} · Respect ${state.respect}`; } });

// ---------------------------------------------------------------- car entry
function nearestCar(maxD) {
  let best = null, bd = maxD;
  for (const c of allCars()) {
    const d = Math.hypot(c.pos.x - playerPos.x, c.pos.z - playerPos.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
function witnessed(range = 42) {
  for (const p of police) if (p.active && Math.hypot(p.sim.pos.x - playerPos.x, p.sim.pos.z - playerPos.z) < range) return true;
  for (const ped of peds) if (Math.hypot(ped.pos.x - playerPos.x, ped.pos.z - playerPos.z) < range) return true;
  return false;
}
function enterCar(car) {
  currentCar = car;
  if (car.parked) car.parked = false;
  player.group.visible = false;
  player.setArmsDriving(true);
  audio.ensure(); audio.startEngine();
  if (car !== heroCar && car.trafficOwned !== true) {
    // stealing a stranger's car: a crime if anyone sees it
    if (!traffic.includes(car) && !parked.includes(car)) { /* hero car */ }
    const isTraffic = traffic.some((t) => t.sim === car);
    if (isTraffic || parked.includes(car)) {
      const w = witnessed();
      state.addCrime(1, w);
      if (w) hud.banner('CARJACKED', 'Someone saw that — the VBPD is coming!');
      car.trafficOwned = true;
      // remove from traffic AI control
      const ti = traffic.findIndex((t) => t.sim === car);
      if (ti >= 0) traffic.splice(ti, 1);
    }
  }
}
function exitCar(silent = false) {
  if (!currentCar) return;
  const c = currentCar; currentCar = null;
  playerPos.x = c.pos.x + Math.cos(c.heading) * -2.2 + Math.sin(c.heading) * 0;
  playerPos.x = c.pos.x - Math.cos(c.heading) * 2.4;
  playerPos.z = c.pos.z + Math.sin(c.heading) * 2.4;
  collideCircle(playerPos, 0.5, colliders);
  player.group.visible = true;
  player.setArmsDriving(false);
  audio.stopEngine();
}

// ---------------------------------------------------------------- police mgmt
function updatePolice(dt, t) {
  const want = Math.min(state.stars, CONFIG.POLICE_POOL);
  let sees = false, nearestD = 1e9;
  police.forEach((p, i) => {
    const should = i < want;
    if (should && !p.active) {
      // spawn on a street 75–95 m away from the player
      const a = rng() * Math.PI * 2, d = 78 + rng() * 18;
      let sx = clamp(playerPos.x + Math.sin(a) * d, -168, 168), sz = clamp(playerPos.z + Math.cos(a) * d, -168, 168);
      // snap to nearest street centre on one axis
      const snap = (v) => CONFIG.STREET_CENTERS.reduce((x, y) => (Math.abs(y - v) < Math.abs(x - v) ? y : x));
      if (rng() < 0.5) sx = snap(sx); else sz = snap(sz);
      p.sim.pos.x = sx; p.sim.pos.z = sz; p.sim.speed = 8; p.sim.heading = Math.atan2(playerPos.x - sx, playerPos.z - sz);
      p.sim.syncMesh(); p.sim.group.visible = true; p.active = true;
    }
    if (!should && p.active) { p.active = false; p.sim.group.visible = false; p.sim.speed = 0; }
    if (!p.active) return;
    const target = currentCar ? { x: currentCar.pos.x + Math.sin(currentCar.heading) * currentCar.speed * 0.4, z: currentCar.pos.z + Math.cos(currentCar.heading) * currentCar.speed * 0.4 } : playerPos;
    const { dist } = steerTo(p.sim, target.x, target.z, dt);
    const input = steerTo(p.sim, target.x, target.z, dt).input;
    input.throttle = Math.min(1, input.throttle * 1.15);
    const crashed = p.sim.update(input, dt, colliders);
    p.sim.flashLightbar(t);
    if (dist < 58) sees = true;
    nearestD = Math.min(nearestD, dist);
    // ram contact
    const victim = currentCar ? currentCar.pos : playerPos;
    const vd = Math.hypot(p.sim.pos.x - victim.x, p.sim.pos.z - victim.z);
    if (vd < 3.1 && Math.abs(p.sim.speed) > 4 && hurtCooldown <= 0) {
      hurtCooldown = 0.8; lastHurt = elapsed;
      health -= currentCar ? 5 : 9;
      audio.crash(0.8);
      if (currentCar) currentCar.speed *= -0.25;
    }
    if (crashed) audio.crash(0.4);
  });
  // single shared point light rides the nearest active unit, alternating colour
  if (nearestD < 60) {
    const near = police.find((p) => p.active);
    if (near) {
      policeLight.position.set(near.sim.pos.x, 3.2, near.sim.pos.z);
      policeLight.color.setHex(Math.sin(t * 11) > 0 ? 0xff3344 : 0x3366ff);
      policeLight.intensity = 22;
    }
  } else policeLight.intensity = 0;
  return { sees, nearestD };
}

// ---------------------------------------------------------------- debug hook (play-tests)
window.__vb = {
  get state() { return state; },
  get mode() { return mode; },
  get playerPos() { return playerPos; },
  get currentCar() { return currentCar; },
  get health() { return health; },
  enterNearestCar() { const c = nearestCar(30); if (c) { if (mode !== 'play') startPlay(false); enterCar(c); return true; } return false; },
  exitCar() { exitCar(); },
  setWanted(n) { state.setWanted(n); },
  startJob(i) { return state.startJob(i); },
  startPlay(fresh) { startPlay(fresh); },
};

// ---------------------------------------------------------------- shot staging
if (SHOT) {
  menuEl.classList.toggle('hidden', SHOT !== 'title');
  stageShot(SHOT, {
    camera, player, playerCar: heroCar, traffic, police, state, hud, beacon,
    enterCarVisual(car) { currentCar = car; player.group.visible = false; },
  });
  hud.setMoney(state.money); hud.setRespect(state.respect, state.rank);
  hud.setStars(state.stars); hud.setClock(state.clockText());
  hud.setObjective(state.objective);
  setTimeout(() => { window.__shotReady = true; }, 700);
}

// ---------------------------------------------------------------- camera
let camYaw = Math.PI, elapsed = 0;
function updateCamera(dt) {
  const target = currentCar ? currentCar.pos : playerPos;
  const heading = currentCar ? currentCar.heading : playerHeading;
  const moving = currentCar ? Math.abs(currentCar.speed) > 2 : input.isDown('KeyW') || input.isDown('KeyA') || input.isDown('KeyS') || input.isDown('KeyD');
  if (moving) camYaw = lerpAngle(camYaw, heading, Math.min(1, dt * 2.2));
  const dist = currentCar ? Math.max(input.dist, 9.5) : input.dist;
  const yaw = camYaw + input.yawOff;
  const pitch = input.pitch;
  const cx = target.x - Math.sin(yaw) * Math.cos(pitch) * dist;
  const cz = target.z - Math.cos(yaw) * Math.cos(pitch) * dist;
  const cy = Math.sin(pitch) * dist + 1.6;
  camera.position.set(cx, Math.max(0.7, cy), cz);
  camera.lookAt(target.x, 1.7, target.z);
}

// ---------------------------------------------------------------- main loop
const clockT = new THREE.Clock();
let mapTimer = 0, crimeCooldown = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clockT.getDelta(), 0.05);
  elapsed += dt;
  const t = elapsed;
  city.update(dt);
  hurtCooldown = Math.max(0, hurtCooldown - dt);
  crimeCooldown = Math.max(0, crimeCooldown - dt);

  if (mode === 'menu') {
    // slow cinematic orbit over the bay
    const a = t * 0.05;
    camera.position.set(120 + Math.sin(a) * 55, 26 + Math.sin(t * 0.13) * 4, 70 + Math.cos(a) * 55);
    camera.lookAt(-20, 8, -10);
    player.group.position.set(playerPos.x, 0, playerPos.z);
    player.setPose(dt, 0);
    beacon.visible = false;
    renderer.render(scene, camera);
    input.endFrame();
    return;
  }
  if (mode === 'shot') {
    for (const p of police) if (p.active) p.sim.flashLightbar(t);
    player.setPose(dt, SHOT === 'foot' ? 0.55 : 0);
    gem.rotation.y += dt * 1.4;
    const mk = state.marker;
    beacon.visible = !!mk;
    if (mk) beacon.position.set(mk.x, 0, mk.z);
    mapTimer -= dt;
    if (mapTimer <= 0) {
      mapTimer = 0.12;
      const fp = currentCar ? currentCar.pos : { x: player.group.position.x, z: player.group.position.z };
      hud.drawMinimap({ traffic, police, playerPos: fp, playerHeading: Math.PI - (currentCar ? currentCar.heading : player.group.rotation.y), marker: mk });
    }
    renderer.render(scene, camera);
    input.endFrame();
    return;
  }
  if (mode === 'pause' || mode === 'wasted') { renderer.render(scene, camera); input.endFrame(); return; }

  // -------------------------------------------------------------- play mode
  if (input.consumePress('KeyP') || input.consumePress('Escape')) {
    mode = 'pause'; pauseEl.classList.remove('hidden');
    $('pause-stats').textContent = `${state.rank} · $${state.money} · Respect ${state.respect}`;
    input.endFrame(); renderer.render(scene, camera); return;
  }

  const focusPos = currentCar ? currentCar.pos : playerPos;

  // ----- on foot
  if (!currentCar) {
    const fwd = input.axis('KeyS', 'KeyW') + input.axis('ArrowDown', 'ArrowUp');
    const str = input.axis('KeyA', 'KeyD') + input.axis('ArrowLeft', 'ArrowRight');
    const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const speed = sprint ? CONFIG.SPRINT_SPEED : CONFIG.WALK_SPEED;
    let mx = 0, mz = 0;
    if (fwd || str) {
      const base = camYaw + input.yawOff;
      const moveA = Math.atan2(str, fwd) + base;
      mx = Math.sin(moveA); mz = Math.cos(moveA);
      playerHeading = lerpAngle(playerHeading, moveA, Math.min(1, dt * 11));
      playerPos.x += mx * speed * dt;
      playerPos.z += mz * speed * dt;
      collideCircle(playerPos, 0.5, colliders);
      player.setPose(dt, sprint ? 1 : 0.55);
    } else player.setPose(dt, 0);
    player.group.position.set(playerPos.x, 0, playerPos.z);
    player.group.rotation.y = playerHeading;

    const near = nearestCar(3.2);
    hud.showPrompt(near ? 'F — enter car' : null);
    if (near && (input.consumePress('KeyF') || input.consumePress('KeyE'))) enterCar(near);
  } else {
    // ----- driving
    hud.showPrompt(null);
    const inp = {
      throttle: input.axis('KeyS', 'KeyW') + input.axis('ArrowDown', 'ArrowUp'),
      steer: -(input.axis('KeyA', 'KeyD') + input.axis('ArrowLeft', 'ArrowRight')),
      handbrake: input.isDown('Space'),
    };
    const crashed = currentCar.update(inp, dt, colliders);
    if (crashed) { audio.crash(0.7); health -= 2; lastHurt = elapsed; }
    playerPos.x = currentCar.pos.x; playerPos.z = currentCar.pos.z;
    playerHeading = currentCar.heading;
    if (input.consumePress('KeyF') || input.consumePress('KeyE')) exitCar();
    // collisions with traffic / parked cars
    if (crimeCooldown <= 0) {
      for (const c of allCars()) {
        if (c === currentCar) continue;
        const d = Math.hypot(c.pos.x - currentCar.pos.x, c.pos.z - currentCar.pos.z);
        if (d < 3.4 && Math.abs(currentCar.speed) > 5) {
          crimeCooldown = 1.2;
          audio.crash(1);
          state.addCrime(0.5, witnessed(46));
          c.speed = currentCar.speed * 0.4;
          currentCar.speed *= 0.55;
          health -= 3; lastHurt = elapsed;
          break;
        }
      }
    }
    // running down a ped
    for (const ped of peds) {
      if (ped.down > 0) continue;
      const d = Math.hypot(ped.pos.x - currentCar.pos.x, ped.pos.z - currentCar.pos.z);
      if (d < 1.7 && Math.abs(currentCar.speed) > 4) {
        ped.down = 6; ped.human.group.rotation.x = -Math.PI / 2; ped.human.group.position.y = 0.25;
        state.addCrime(1, witnessed(46));
        hud.banner('PEDESTRIAN DOWN', 'That is going to bring heat…');
        audio.crash(0.9);
      }
    }
  }

  // ----- peds wander / flee
  for (const ped of peds) {
    if (ped.down > 0) { ped.down -= dt; if (ped.down <= 0) { ped.human.group.rotation.x = 0; ped.human.group.position.y = 0; } continue; }
    const threat = currentCar && Math.abs(currentCar.speed) > 6 ? currentCar.pos : null;
    let sp = ped.speed;
    if (threat && Math.hypot(threat.x - ped.pos.x, threat.z - ped.pos.z) < 8) {
      ped.target = { x: ped.pos.x + (ped.pos.x - threat.x) * 2, z: ped.pos.z + (ped.pos.z - threat.z) * 2 };
      sp = 3.6;
    }
    const dx = ped.target.x - ped.pos.x, dz = ped.target.z - ped.pos.z;
    const distT = Math.hypot(dx, dz);
    if (distT < 1.5) ped.target = { x: clamp(ped.pos.x + (rng() - 0.5) * 90, -168, 140), z: clamp(ped.pos.z + (rng() - 0.5) * 90, -168, 168) };
    else {
      const ta = Math.atan2(dx, dz);
      ped.heading = lerpAngle(ped.heading, ta, Math.min(1, dt * 5));
      ped.pos.x += Math.sin(ped.heading) * sp * dt;
      ped.pos.z += Math.cos(ped.heading) * sp * dt;
      collideCircle(ped.pos, 0.5, colliders);
    }
    ped.human.group.position.set(ped.pos.x, 0, ped.pos.z);
    ped.human.group.rotation.y = ped.heading;
    ped.human.setPose(dt, sp > 2 ? 0.9 : 0.35);
  }

  // ----- traffic
  for (const tc of traffic) tc.update(dt, colliders, focusPos);

  // ----- police + wanted + jobs
  const { sees, nearestD } = updatePolice(dt, t);
  state.update(dt, { playerPos: focusPos, policeSeesPlayer: sees });

  // ----- job beacon (start or objective)
  let markerPos = state.marker;
  if (!markerPos && state.jobAvailable) markerPos = JOB_STARTS[state.jobIndex];
  if (markerPos) {
    beacon.visible = true;
    beacon.position.set(markerPos.x, 0, markerPos.z);
    gem.rotation.y += dt * 2; gem.position.y = 10.5 + Math.sin(t * 2.4) * 0.5;
    beam.material.opacity = 0.24 + Math.sin(t * 3.2) * 0.08;
    if (state.activeJob < 0 && state.jobAvailable) {
      const d = Math.hypot(focusPos.x - markerPos.x, focusPos.z - markerPos.z);
      if (d < 5.5) { if (state.startJob(state.jobIndex)) audio.jingle(true); }
    }
  } else beacon.visible = false;

  // ----- health / wasted
  if (elapsed - lastHurt > 5 && health < 100) health = Math.min(100, health + dt * 3);
  if (health <= 0) { mode = 'wasted'; wastedEl.classList.remove('hidden'); audio.stopEngine(); }

  // ----- audio
  if (currentCar) audio.update(clamp(Math.abs(currentCar.speed) / CONFIG.CAR_MAX_SPEED, 0, 1), state.stars > 0 ? clamp(1 - nearestD / 60, 0, 1) : 0, t);

  // ----- HUD
  hud.setMoney(state.money);
  hud.setRespect(state.respect, state.rank);
  hud.setStars(state.stars);
  hud.setClock(state.clockText());
  hud.setTimer(state.activeJob >= 0 ? state.timeLeft : 0);
  mapTimer -= dt;
  if (mapTimer <= 0) {
    mapTimer = 0.1;
    hud.drawMinimap({ traffic, police, playerPos: focusPos, playerHeading: Math.PI - (currentCar ? currentCar.heading : playerHeading), marker: markerPos });
  }

  updateCamera(dt);
  renderer.render(scene, camera);
  input.endFrame();
}
frame();
