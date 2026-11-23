// VELORA BAY 3D — boot, third-person controller, traffic/police/ped simulation,
// camera, HUD wiring, save games, menu/pause flow and ?shot= staging.
import * as THREE from 'three';
import { CONFIG, PALETTE, makeRng, clamp, lerpAngle, angleDiff, collideCircle, onStreet } from './config.js';
import { buildCity } from './city.js';
import { Human } from './character.js';
import { CarSim, TrafficCar, parkedCars, steerTo, CAR_COLORS } from './vehicles.js';
import { GameState, JOBS, CHAPTERS } from './missions.js';
import { ROSTER, charById } from './characters.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { GameAudio } from './audio.js';
import { stageShot } from './shots.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const rng = makeRng(Number(params.get('seed') || 1));

// ---------------------------------------------------------------- renderer
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.classList.add('webgl');
app.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 900);
camera.position.set(150, 30, 90);

// soft anime bloom + output tone mapping
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.55, 0.85);
composer.addPass(bloom);
// vivid colour grade: gentle contrast lift + saturation boost before output
const gradePass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    saturation: { value: 1.22 },
    contrast: { value: 1.06 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float saturation;
    uniform float contrast;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 color = texel.rgb;
      color = (color - 0.5) * contrast + 0.5;
      float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(luminance), color, saturation);
      gl_FragColor = vec4(color, texel.a);
    }
  `,
});
composer.addPass(gradePass);
composer.addPass(new OutputPass());
function renderFrame() { composer.render(); }
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

// ---------------------------------------------------------------- world
const city = buildCity(scene, rng);
const colliders = city.colliders;

const state = new GameState();
const hud = new Hud();
const input = new Input(renderer.domElement);
const audio = new GameAudio();
state.onBanner = (t, s) => { hud.banner(t, s); if (t === 'JOB COMPLETE') audio.jingle(true); if (t === 'JOB FAILED') audio.jingle(false); };
state.onObjective = (t) => hud.setObjective(t);

// mission-giver beacons: the next mission's first marker (escape missions use a fixed giver corner)
const giverLoc = (i) => (JOBS[i] && JOBS[i].steps.find((s) => s.at)?.at) || { x: -54, z: 54 };

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

// ---------------------------------------------------------------- player + roster
let charId = 'dario';
let unlocked = ['dario'];
let outfitOverride = null; // {shirt?, pants?, hair?} from clothing store / salon — persists
let player = null;
const playerPos = { x: 8, z: 26 };
let playerHeading = Math.PI;
let health = 100, hurtCooldown = 0, lastHurt = -99;
let camMode = 'third'; // 'third' | 'first' — persists across car transitions
const charDef = () => charById(charId);
function applyCharacter(id, keepSilhouette = false) {
  charId = id;
  const def = charDef();
  const style = { ...def.style };
  if (outfitOverride) {
    if (outfitOverride.shirt !== undefined) { style.shirt = outfitOverride.shirt; style.sleeves = outfitOverride.shirt; }
    if (outfitOverride.pants !== undefined) style.pants = outfitOverride.pants;
    if (outfitOverride.hair !== undefined) style.hair = outfitOverride.hair;
    if (outfitOverride.hairLen !== undefined) style.hairLen = outfitOverride.hairLen;
  }
  const wasDriving = player ? player.driving : false;
  const wasVisible = player ? player.group.visible : true;
  if (player) scene.remove(player.group);
  player = new Human(style);
  player.setArmsDriving(wasDriving);
  player.group.position.set(playerPos.x, 0, playerPos.z);
  player.group.rotation.y = playerHeading;
  player.group.visible = wasVisible;
  scene.add(player.group);
  // stat effects onto the shared state
  state.payoutMul = def.payoutMul; state.decayMul = def.decayMul; state.heatGainMul = def.heatGainMul;
  health = Math.min(health, def.healthMax);
  hud.setChar(def.name);
  hud.setStory(state.progressText());
}
function isUnlocked(id) { return unlocked.includes(id); }
applyCharacter('dario');

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
  { shirt: 0xf2b138, sleeves: 0xf2f2f2, pants: 0x3a4a6b, skin: 0xb87a4e, hair: 0xe84a6f, hairLen: 0.9, buildW: 0.95 },
  { shirt: 0xe84a6f, sleeves: 0x2b2b3a, pants: 0x23233a, skin: 0x8a5a34, hair: 0x3fa7d6, hairLen: 0.25, buildW: 1.1, capOn: true },
  { shirt: 0x7bc950, sleeves: 0xff5d8f, pants: 0x554a63, skin: 0xe8b088, hair: 0x2b2135, hairLen: 0.6, buildW: 1.0 },
  { shirt: 0xb388eb, sleeves: 0x2ec4b6, pants: 0x2b2b3a, skin: 0xd99a6c, hair: 0xf2b138, hairLen: 0.4, buildW: 1.25 },
  { shirt: 0xfff3e0, sleeves: 0x2b2b3a, pants: 0x1c1c26, skin: 0xd99a6c, hair: 0x1c1c26, hairLen: 0.15, buildW: 1.0, chain: true },
  { shirt: 0x7a8a99, sleeves: 0x7a8a99, pants: 0x554a63, skin: 0xb87a4e, hair: 0xb8b8b8, hairLen: 0.25, buildW: 1.08, beard: true },
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
  try { localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify({ money: state.money, respect: state.respect, jobIndex: state.jobIndex, charId, unlocked, outfit: outfitOverride, loot: state.loot || [] })); } catch {}
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(CONFIG.SAVE_KEY) || 'null');
    if (s) {
      state.money = s.money ?? state.money; state.respect = s.respect ?? 0; state.jobIndex = s.jobIndex ?? 0;
      state.loot = s.loot || [];
      if (Array.isArray(s.unlocked)) unlocked = ['dario', ...s.unlocked.filter((u) => u !== 'dario')];
      outfitOverride = s.outfit || null;
      applyCharacter(s.charId && isUnlocked(s.charId) ? s.charId : 'dario');
      return true;
    }
  } catch {}
  return false;
}
state.onJobComplete = () => { hud.setStory(state.progressText()); save(); };
state.onChapter = (ch) => hud.chapterCard(ch + 1, CHAPTERS[ch].name);
state.onUnlockCheck = (finishedMission) => {
  const newly = ROSTER.filter((c) => c.unlock && c.unlock.kind === 'mission' && c.unlock.job === finishedMission && !isUnlocked(c.id));
  for (const c of newly) {
    unlocked.push(c.id);
    setTimeout(() => hud.banner('KARAKTER TERBUKA', `${c.name} sekarang bisa dipilih!`), 3700);
  }
  if (newly.length) save();
};

// ---------------------------------------------------------------- modes & UI
let mode = SHOT ? 'shot' : 'intro';
const $ = (id) => document.getElementById(id);
const menuEl = $('menu-overlay'), pauseEl = $('pause-overlay'), wastedEl = $('wasted-overlay');
const selectEl = $('select-overlay');
let selectFrom = 'new'; // 'new' | 'switch' | 'shot'
let selIdx = 0;
function wireStateHooks() {
  state.onBanner = (t, s) => { hud.banner(t, s); if (t === 'MISSION COMPLETE') audio.jingle(true); if (t === 'MISSION FAILED') audio.jingle(false); };
  state.onObjective = (t) => hud.setObjective(t);
  state.onJobComplete = () => { hud.setStory(state.progressText()); save(); maybeBeat(); };
  state.onChapter = (ch) => hud.chapterCard(ch + 1, CHAPTERS[ch].name);
  state.onUnlockCheck = (finishedMission) => {
    const newly = ROSTER.filter((c) => c.unlock && c.unlock.kind === 'mission' && c.unlock.job === finishedMission && !isUnlocked(c.id));
    for (const c of newly) {
      unlocked.push(c.id);
      setTimeout(() => hud.banner('KARAKTER TERBUKA', `${c.name} sekarang bisa dipilih!`), 3700);
    }
    if (newly.length) save();
  };
}
function startPlay(fresh) {
  if (fresh) {
    try { localStorage.removeItem(CONFIG.SAVE_KEY); } catch {}
    const keepChar = charId;
    Object.assign(state, new GameState());
    unlocked = ['dario']; outfitOverride = null; state.loot = [];
    wireStateHooks();
    applyCharacter(isUnlocked(keepChar) ? keepChar : 'dario');
    state.money = charDef().startMoney;
    health = charDef().healthMax;
    hud.setObjective(state.objective);
  }
  menuEl.classList.add('hidden'); pauseEl.classList.add('hidden'); wastedEl.classList.add('hidden'); selectEl.classList.add('hidden');
  mode = 'play';
  audio.ensure();
}
// ----- character select (live turntable of the actual rig)
function refreshSelect() {
  const def = ROSTER[selIdx];
  applyCharacter(def.id);
  const locked = !isUnlocked(def.id);
  player.setSilhouette(locked);
  $('sel-name').textContent = def.name;
  $('sel-role').textContent = def.role;
  $('sel-stats').innerHTML = Object.entries(def.stats).map(([k, v]) =>
    `<div class="stat-row"><span style="width:52px">${k}</span><div class="bar"><div class="fill" style="width:${v * 20}%"></div></div><span>${v}/5</span></div>`).join('');
  const lockEl = $('sel-lock');
  if (locked) { lockEl.style.display = 'block'; lockEl.textContent = '🔒 ' + def.unlockText; }
  else lockEl.style.display = 'none';
  $('btn-sel-confirm').textContent = locked ? 'Terkunci' : 'Pilih';
  $('sel-dots').textContent = ROSTER.map((c, i) => (i === selIdx ? '●' : (isUnlocked(c.id) ? '○' : '🔒'))).join(' ');
}
let charBeforeSelect = 'dario';
function openSelect(from) {
  selectFrom = from;
  charBeforeSelect = charId;
  selIdx = Math.max(0, ROSTER.findIndex((c) => c.id === charId));
  menuEl.classList.add('hidden'); pauseEl.classList.add('hidden');
  selectEl.classList.remove('hidden');
  mode = 'select';
  refreshSelect();
}
function previewChar(id) {
  const i = ROSTER.findIndex((c) => c.id === id);
  if (i < 0) return false;
  selIdx = i; refreshSelect(); return true;
}
function confirmSelect() {
  const def = ROSTER[selIdx];
  if (!isUnlocked(def.id)) {
    const lockEl = $('sel-lock');
    lockEl.style.display = 'block'; lockEl.textContent = '🔒 ' + def.unlockText;
    return false;
  }
  player.setSilhouette(false);
  applyCharacter(def.id);
  selectEl.classList.add('hidden');
  if (selectFrom === 'new') { startPlay(true); applyCharacter(def.id); state.money = def.startMoney; health = def.healthMax; save(); }
  else if (selectFrom === 'shot') { mode = 'shot'; }
  else { mode = 'play'; save(); }
  return true;
}
$('btn-sel-prev').onclick = () => { selIdx = (selIdx + ROSTER.length - 1) % ROSTER.length; refreshSelect(); };
$('btn-sel-next').onclick = () => { selIdx = (selIdx + 1) % ROSTER.length; refreshSelect(); };
$('btn-sel-confirm').onclick = () => confirmSelect();
$('btn-sel-back').onclick = () => {
  selectEl.classList.add('hidden'); player.setSilhouette(false);
  applyCharacter(charBeforeSelect);
  if (selectFrom === 'switch') { pauseEl.classList.remove('hidden'); mode = 'pause'; }
  else if (selectFrom === 'shot') { mode = 'shot'; }
  else { menuEl.classList.remove('hidden'); mode = 'menu'; }
};
$('btn-new').onclick = () => openSelect('new');
$('btn-continue').onclick = () => { load(); startPlay(false); };
$('btn-how').onclick = () => { const h = $('howto'); h.style.display = h.style.display === 'none' ? 'block' : 'none'; };
$('btn-resume').onclick = () => { pauseEl.classList.add('hidden'); mode = 'play'; };
$('btn-switch').onclick = () => { pauseEl.classList.add('hidden'); openSelect('switch'); };
$('btn-quit').onclick = () => { pauseEl.classList.add('hidden'); menuEl.classList.remove('hidden'); mode = 'menu'; };
$('btn-respawn').onclick = () => {
  wastedEl.classList.add('hidden');
  state.money = Math.floor(state.money * 0.9); state.setWanted(0);
  health = charDef().healthMax; playerPos.x = -108; playerPos.z = 54; exitCar(true);
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
  if (car.baseMax === undefined) car.baseMax = car.maxSpeed;
  car.maxSpeed = car.baseMax * charDef().carMul;
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
      if (w) { hud.banner('CARJACKED', 'Someone saw that — the VBPD is coming!'); hud.showCamMode('👁 DILIHAT SAKSI'); }
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
  player.group.visible = camMode !== 'first';
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

// ---------------------------------------------------------------- FPS + auto quality
let fpsNow = 60, fpsFrames = 0, fpsTime = 0, qualityLevel = 0, fpsShow = false, goodStreak = 0;
function updateFps(dt) {
  fpsFrames++; fpsTime += dt;
  const el = $('fps-chip');
  if (el && fpsShow) el.textContent = `${Math.round(fpsNow)} FPS · Q${qualityLevel}`;
  if (fpsTime < 2.5) return;
  fpsNow = fpsFrames / fpsTime; fpsFrames = 0; fpsTime = 0;
  if (SHOT) return; // captures keep full quality; auto-quality targets real hardware
  if (fpsNow < 45 && qualityLevel < 3) { qualityLevel++; goodStreak = 0; applyQuality(); }
  else if (fpsNow > 57 && qualityLevel > 0) { if (++goodStreak >= 2) { qualityLevel--; goodStreak = 0; applyQuality(); } }
  else goodStreak = 0;
}
function applyQuality() {
  bloom.enabled = qualityLevel < 1;
  if (city.sun) city.sun.castShadow = qualityLevel < 2;
  if (qualityLevel >= 3) { renderer.setPixelRatio(1); composer.setPixelRatio(1); composer.setSize(innerWidth, innerHeight); }
  else { renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); composer.setPixelRatio(Math.min(devicePixelRatio, 2)); composer.setSize(innerWidth, innerHeight); }
}

// ---------------------------------------------------------------- interiors (clothing / salon / pawn)
const SHOPS = [
  { id: 'clothing', name: 'VELORA THREADS — Clothing', door: { x: 2, z: -47 }, room: { x: -60, z: 225 } },
  { id: 'salon', name: 'GELOMBANG SALON', door: { x: -52, z: 9 }, room: { x: 0, z: 225 } },
  { id: 'pawn', name: 'BAY PAWN — Gadai & Beli', door: { x: 106, z: 67 }, room: { x: 60, z: 225 } },
];
let currentInterior = null, returnPoint = null;
{
  const floorMat = new THREE.MeshLambertMaterial({ color: 0xf2dcc3 });
  const wallMat = new THREE.MeshLambertMaterial({ color: 0xffc7d6 });
  const propCols = [0x2ec4b6, 0xff5d8f, 0xffc94d, 0x7ed491, 0xb388eb, 0xffffff];
  for (const s of SHOPS) {
    const { x, z } = s.room;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 13), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.position.set(x, 0.02, z); scene.add(floor);
    const mkWall = (w, d, wx, wz) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 3.4, d), wallMat);
      m.position.set(wx, 1.7, wz); scene.add(m);
      colliders.push({ minX: wx - w / 2, maxX: wx + w / 2, minZ: wz - d / 2, maxZ: wz + d / 2 });
    };
    mkWall(18, 0.4, x, z - 6.5); mkWall(0.4, 13, x - 9, z); mkWall(0.4, 13, x + 9, z);
    mkWall(7, 0.4, x - 5.5, z + 6.5); mkWall(7, 0.4, x + 5.5, z + 6.5); // south wall with door gap
    for (let i = 0; i < 4; i++) {
      const prop = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.7, 0.6), new THREE.MeshLambertMaterial({ color: propCols[(i + x) % propCols.length] }));
      prop.position.set(x - 6 + i * 4, 0.85, z - 5.4); scene.add(prop);
    }
    // storefront sign marker at the door
    const sign = new THREE.Mesh(new THREE.OctahedronGeometry(0.55), new THREE.MeshBasicMaterial({ color: PALETTE.gold }));
    sign.position.set(s.door.x, 3.1, s.door.z); sign.name = 'shop-sign'; scene.add(sign);
  }
}
function nearestShop() {
  if (currentCar || currentInterior) return null;
  for (const s of SHOPS) if (Math.hypot(playerPos.x - s.door.x, playerPos.z - s.door.z) < 4) return s;
  return null;
}
function enterInterior(id, fromHook = false) {
  const s = SHOPS.find((x) => x.id === id);
  if (!s || currentCar) return false;
  if (!fromHook && Math.hypot(playerPos.x - s.door.x, playerPos.z - s.door.z) > 5) return false;
  returnPoint = { x: playerPos.x, z: playerPos.z, h: playerHeading };
  currentInterior = id;
  playerPos.x = s.room.x; playerPos.z = s.room.z + 3.5; playerHeading = Math.PI;
  player.group.position.set(playerPos.x, 0, playerPos.z);
  openShopMenu(s);
  mode = 'shop';
  return true;
}
function exitInterior() {
  if (!currentInterior) return false;
  $('shop-overlay').classList.add('hidden');
  if (returnPoint) { playerPos.x = returnPoint.x; playerPos.z = returnPoint.z; playerHeading = returnPoint.h; }
  currentInterior = null;
  mode = 'play';
  return true;
}
const SHIRT_CHOICES = [0x2ec4b6, 0xff5d8f, 0xffc94d, 0xffffff, 0xb388eb, 0xff8a3c];
const PANTS_CHOICES = [0x2b2b3a, 0x2b4a7a, 0x8a6844, 0xf2f2f2, 0x554a63];
const HAIR_CHOICES = [0x2a1a2e, 0xff5d8f, 0x7ec8e8, 0xffc94d, 0xb8b8b8, 0x7ed491];
function applyShopChoice(kind, idx) {
  outfitOverride = outfitOverride || {};
  if (kind === 'shirt') outfitOverride.shirt = SHIRT_CHOICES[idx % SHIRT_CHOICES.length];
  if (kind === 'pants') outfitOverride.pants = PANTS_CHOICES[idx % PANTS_CHOICES.length];
  if (kind === 'hair') outfitOverride.hair = HAIR_CHOICES[idx % HAIR_CHOICES.length];
  if (kind === 'hairLen') outfitOverride.hairLen = [0.2, 0.6, 1][idx % 3];
  applyCharacter(charId);
  save();
  return true;
}
function sellAllLoot() {
  const items = state.loot || [];
  if (!items.length) return 0;
  const total = items.reduce((a, b) => a + b.price, 0);
  state.money += total; state.loot = [];
  hud.setMoney(state.money); save();
  return total;
}
function shopButton(label, fn) {
  const b = document.createElement('button');
  b.className = 'btn ghost'; b.style.color = '#7a2d4d'; b.style.fontSize = '15px'; b.style.padding = '8px 16px';
  b.textContent = label; b.onclick = fn;
  return b;
}
function openShopMenu(s) {
  $('shop-title').textContent = s.name;
  const body = $('shop-body'), btns = $('shop-buttons');
  btns.innerHTML = '';
  if (s.id === 'clothing') {
    body.textContent = 'Ganti warna outfit — tersimpan otomatis.';
    SHIRT_CHOICES.forEach((c, i) => btns.appendChild(shopButton('Baju ' + (i + 1), () => applyShopChoice('shirt', i))));
    PANTS_CHOICES.forEach((c, i) => btns.appendChild(shopButton('Celana ' + (i + 1), () => applyShopChoice('pants', i))));
  } else if (s.id === 'salon') {
    body.textContent = 'Warna & gaya rambut baru, langsung dipakai.';
    HAIR_CHOICES.forEach((c, i) => btns.appendChild(shopButton('Warna ' + (i + 1), () => applyShopChoice('hair', i))));
    ['Pendek', 'Sedang', 'Panjang'].forEach((l, i) => btns.appendChild(shopButton(l, () => applyShopChoice('hairLen', i))));
  } else {
    const items = state.loot || [];
    body.textContent = items.length ? items.map((it) => `${it.name} — $${it.price}`).join(' · ') : 'Belum ada loot. Selesaikan misi untuk dapat barang jual.';
    btns.appendChild(shopButton(`Jual Semua ($${items.reduce((a, b) => a + b.price, 0)})`, () => { sellAllLoot(); openShopMenu(s); }));
  }
  $('shop-overlay').classList.remove('hidden');
}
$('btn-shop-exit').onclick = () => exitInterior();

// ---------------------------------------------------------------- companion (Sela)
let companionOn = false, companion = null, companionPos = { x: 10, z: 30 };
function toggleCompanion() {
  if (!isUnlocked('sela')) { hud.banner('TERKUNCI', "Sela terbuka setelah Bab 1 — selesaikan quest 'The Middleman'."); return false; }
  companionOn = !companionOn;
  if (companionOn && !companion) {
    companion = new Human(charById('sela').style);
    companionPos = { x: playerPos.x + 2, z: playerPos.z + 2 };
    scene.add(companion.group);
  }
  if (companion) companion.group.visible = companionOn && !currentCar;
  hud.banner(companionOn ? 'SELA IKUT' : 'SELA MENUNGGU', companionOn ? 'Dia mengikutimu — tekan C untuk menyuruhnya menunggu.' : '');
  return companionOn;
}
function updateCompanion(dt) {
  if (!companionOn || !companion) return;
  companion.group.visible = !currentCar;
  if (currentCar) return;
  const tx = playerPos.x - Math.sin(playerHeading) * 1.8, tz = playerPos.z - Math.cos(playerHeading) * 1.8;
  const dx = tx - companionPos.x, dz = tz - companionPos.z, d = Math.hypot(dx, dz);
  let sp = 0;
  if (d > 1.2) {
    sp = d > 8 ? 6.8 : 3.6;
    const a = Math.atan2(dx, dz);
    companionPos.x += Math.sin(a) * sp * dt; companionPos.z += Math.cos(a) * sp * dt;
    companion.group.rotation.y = a;
  }
  companion.group.position.set(companionPos.x, 0, companionPos.z);
  companion.setPose(dt, sp > 4 ? 0.9 : sp > 0.5 ? 0.45 : 0);
}

// ---------------------------------------------------------------- wildlife: gulls, dog, iguana
const gulls = [];
let dogHeartT = 0, dogCooldown = 0, dogMeshRef = null, iguanaRef = null;
const heartMesh = (() => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff5d8f }));
  m.visible = false; scene.add(m); return m;
})();
let dogPos = { x: 160, z: 24 };
{
  const gullMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  for (let i = 0; i < 8; i++) {
    const g = new THREE.Group();
    const w1 = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.28), gullMat); w1.position.x = -0.45; g.add(w1);
    const w2 = w1.clone(); w2.position.x = 0.45; g.add(w2);
    g.userData = { c: { x: 120 + Math.random() * 60, z: -40 + Math.random() * 110 }, r: 9 + Math.random() * 10, a: Math.random() * 6.28, sp: 0.25 + Math.random() * 0.25, w1, w2, scatter: 0 };
    scene.add(g); gulls.push(g);
  }
  const dog = new THREE.Group();
  const dm = toonMatSimple(0xb87a4e);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.34, 0.3), dm); body.position.y = 0.36; dog.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.26), dm); head.position.set(0.4, 0.52, 0); dog.add(head);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.07), dm); tail.position.set(-0.42, 0.5, 0); tail.rotation.z = 0.6; dog.add(tail);
  dog.userData.tail = tail;
  dog.position.set(dogPos.x, 0, dogPos.z); dog.rotation.y = -1.2;
  scene.add(dog); dogMeshRef = dog;
  const ig = new THREE.Group();
  const im = toonMatSimple(0x5ec97a);
  const ib = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.16), im); ib.position.y = 0.95; ig.add(ib);
  const it = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.06), im); it.position.set(-0.5, 0.95, 0); ig.add(it);
  ig.userData.tail = it; ig.position.set(196, 0, 54);
  scene.add(ig); iguanaRef = ig;
}
function toonMatSimple(c) { return new THREE.MeshLambertMaterial({ color: c }); }
function petDog() {
  if (dogCooldown > 0) return false;
  if (Math.hypot(playerPos.x - dogPos.x, playerPos.z - dogPos.z) > 5) return false;
  dogCooldown = 30; dogHeartT = 1.6;
  state.respect += 2; hud.setRespect(state.respect, state.rank);
  hud.banner('❤ ANJING PANTAI', '+2 respect — good boy.');
  save();
  return true;
}
function updateWildlife(dt) {
  dogCooldown = Math.max(0, dogCooldown - dt);
  for (const g of gulls) {
    const u = g.userData;
    const pd = Math.hypot(playerPos.x - g.position.x, playerPos.z - g.position.z);
    u.scatter = pd < 13 ? Math.min(1, u.scatter + dt * 2) : Math.max(0, u.scatter - dt * 0.4);
    u.a += dt * u.sp * (1 + u.scatter);
    const r = u.r + u.scatter * 13;
    g.position.set(u.c.x + Math.cos(u.a) * r, 7 + u.scatter * 7 + Math.sin(u.a * 3) * 0.7, u.c.z + Math.sin(u.a) * r);
    g.rotation.y = -u.a;
    const flap = Math.sin(elapsed * 9 + u.r) * 0.55;
    u.w1.rotation.z = flap; u.w2.rotation.z = -flap;
  }
  if (dogMeshRef) dogMeshRef.userData.tail.rotation.z = 0.6 + Math.sin(elapsed * (dogHeartT > 0 ? 14 : 3)) * 0.3;
  if (iguanaRef) iguanaRef.userData.tail.rotation.y = Math.sin(elapsed * 1.4) * 0.25;
  if (dogHeartT > 0) {
    dogHeartT -= dt;
    heartMesh.visible = true;
    heartMesh.position.set(dogPos.x, 1 + (1.6 - dogHeartT) * 0.5, dogPos.z);
    heartMesh.scale.setScalar(1 + Math.sin(dogHeartT * 10) * 0.25);
  } else heartMesh.visible = false;
}

// ---------------------------------------------------------------- dialogue beats + cinematic cards
const BEATS = {
  0: [['SELA', '"Kota ini keras, Dario. Tapi lihat pantainya — selalu ada alasan untuk bertahan."'], ['DARIO', '"Mulai sekarang kita jalan berdua. Velora tidak akan tahu apa yang menimpanya."']],
  1: [['SELA', '"Diner ini masih sama seperti dulu. Bedanya, sekarang kita yang dikejar waktu."'], ['DARIO', '"Satu misi lagi. Lalu kita bicara tentang masa depan."']],
  3: [['DARIO', '"Dari atap ini, semua lampu itu terlihat kecil. Masalah kita juga."'], ['SELA', '"Besok kita selesaikan. Malam ini, kita bernapas dulu."']],
};
let beatQueue = null;
function showBeat(lines) {
  beatQueue = [...lines];
  mode = 'beat';
  nextBeatLine();
}
function nextBeatLine() {
  const el = $('beat-overlay');
  if (!beatQueue || !beatQueue.length) { el.style.display = 'none'; beatQueue = null; if (mode === 'beat') mode = 'play'; return; }
  const [who, line] = beatQueue.shift();
  $('beat-speaker').textContent = who;
  $('beat-line').textContent = line;
  el.style.display = 'block'; el.style.pointerEvents = 'auto';
}
function maybeBeat() {
  const nextCh = state.jobIndex < JOBS.length ? JOBS[state.jobIndex].chapter : 99;
  const prevCh = state.jobIndex > 0 ? JOBS[state.jobIndex - 1].chapter : -1;
  if (nextCh !== prevCh && BEATS[prevCh]) showBeat(BEATS[prevCh]);
}
let cineTimer = 0;
function showCine(giver, line) {
  const el = $('beat-overlay');
  $('beat-speaker').textContent = giver.toUpperCase();
  $('beat-line').textContent = line;
  el.style.display = 'block'; el.style.pointerEvents = 'none';
  clearTimeout(cineTimer);
  cineTimer = setTimeout(() => { if (!beatQueue) el.style.display = 'none'; }, 4200);
}
addEventListener('keydown', () => { if (mode === 'beat') nextBeatLine(); });
$('beat-overlay').addEventListener('pointerdown', () => { if (mode === 'beat') nextBeatLine(); });

// ---------------------------------------------------------------- boot intro
const introEl = $('intro-overlay');
let introT = 0, introDone = !!SHOT;
const INTRO_CAPTIONS = ['THE MARINA', 'ACROSS THE BAY', 'THE BEACH STRIP', 'THE CHASE'];
if (SHOT) { introEl.classList.add('gone'); }
function finishIntro() {
  if (introDone) return;
  introDone = true;
  introEl.classList.add('fade');
  setTimeout(() => introEl.classList.add('gone'), 750);
  menuEl.classList.remove('hidden');
  $('press-start').style.display = 'block';
  mode = 'menu';
}
addEventListener('keydown', () => {
  if (mode === 'intro') finishIntro();
  else if (mode === 'menu') $('press-start').style.display = 'none';
  else if (mode === 'select') {
    // arrow-key browsing on the select screen
  }
});
addEventListener('pointerdown', () => { if (mode === 'intro') finishIntro(); });
addEventListener('keydown', (e) => {
  if (mode !== 'select') return;
  if (e.code === 'ArrowRight') { selIdx = (selIdx + 1) % ROSTER.length; refreshSelect(); }
  if (e.code === 'ArrowLeft') { selIdx = (selIdx + ROSTER.length - 1) % ROSTER.length; refreshSelect(); }
  if (e.code === 'Enter') confirmSelect();
});

// ---------------------------------------------------------------- debug hook (play-tests)
window.__vb = {
  get state() { return state; },
  get mode() { return mode; },
  get playerPos() { return playerPos; },
  get currentCar() { return currentCar; },
  get health() { return health; },
  get charId() { return charId; },
  get camMode() { return camMode; },
  get unlocked() { return [...unlocked]; },
  charDef() { return charDef(); },
  isUnlocked(id) { return isUnlocked(id); },
  openSelect(from) { openSelect(from || 'switch'); },
  previewChar(id) { return previewChar(id); },
  confirmSelect() { return confirmSelect(); },
  enterNearestCar() { const c = nearestCar(30); if (c) { if (mode !== 'play') startPlay(false); enterCar(c); return true; } return false; },
  exitCar() { exitCar(); },
  setWanted(n) { state.setWanted(n); },
  startJob(i) { return state.startJob(i); },
  startPlay(fresh) { startPlay(fresh); },
  skipIntro() { finishIntro(); },
  toggleCam() { toggleCam(); },
  get companionOn() { return companionOn; },
  toggleCompanion() { return toggleCompanion(); },
  petDog() { return petDog(); },
  enterInterior(id) { return enterInterior(id); },
  exitInterior() { return exitInterior(); },
  get interior() { return currentInterior; },
  sellLoot() { return sellAllLoot(); },
  setOutfit(kind, idx) { return applyShopChoice(kind, idx); },
  get fps() { return fpsNow; },
};

// ---------------------------------------------------------------- shot staging
if (SHOT) {
  menuEl.classList.toggle('hidden', SHOT !== 'title');
  if (SHOT === 'foot') {
    // 2-foot.jpg showcases the character-select screen (live turntable + roster card)
    menuEl.classList.add('hidden');
    openSelect('shot');
  }
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
function toggleCam() {
  camMode = camMode === 'third' ? 'first' : 'third';
  hud.showCamMode(camMode === 'first' ? 'FIRST PERSON' : 'THIRD PERSON');
  if (!currentCar) player.group.visible = camMode !== 'first';
}
function updateCamera(dt) {
  const target = currentCar ? currentCar.pos : playerPos;
  const heading = currentCar ? currentCar.heading : playerHeading;
  const moving = currentCar ? Math.abs(currentCar.speed) > 2 : input.isDown('KeyW') || input.isDown('KeyA') || input.isDown('KeyS') || input.isDown('KeyD');
  if (moving) camYaw = lerpAngle(camYaw, heading, Math.min(1, dt * 2.2));
  const yaw = camYaw + input.yawOff;
  const pitch = input.pitch;
  if (camMode === 'first') {
    if (currentCar) {
      // driver-seat view over the hood
      const fx = Math.sin(currentCar.heading), fz = Math.cos(currentCar.heading);
      camera.position.set(target.x + fx * 0.4, 1.18, target.z + fz * 0.4);
      const lyaw = currentCar.heading + input.yawOff * 0.6;
      camera.lookAt(target.x + Math.sin(lyaw) * 10, 1.05 - (pitch - 0.32) * 4, target.z + Math.cos(lyaw) * 10);
    } else {
      camera.position.set(target.x, 1.66, target.z);
      camera.lookAt(target.x + Math.sin(yaw) * 10, 1.66 - (pitch - 0.32) * 6, target.z + Math.cos(yaw) * 10);
    }
    return;
  }
  const dist = currentCar ? Math.max(input.dist, 9.5) : input.dist;
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
  // shadow frustum follows the player so shadows stay crisp everywhere
  if (city.sun) {
    const fp = currentCar ? currentCar.pos : playerPos;
    city.sun.position.set(fp.x + 70, 110, fp.z - 45);
    city.sun.target.position.set(fp.x, 0, fp.z);
    city.sun.target.updateMatrixWorld();
  }
  hurtCooldown = Math.max(0, hurtCooldown - dt);
  crimeCooldown = Math.max(0, crimeCooldown - dt);

  updateFps(dt);
  if (mode === 'intro') {
    introT += dt;
    // logo hold, then loading captions crossfade over the live scene, bar fills
    const cap = INTRO_CAPTIONS[Math.min(INTRO_CAPTIONS.length - 1, Math.floor(Math.max(0, introT - 2.2) / 1.1))];
    const capEl = $('intro-caption'); if (capEl && introT > 2.2) capEl.textContent = cap;
    const barEl = $('intro-bar'); if (barEl) barEl.style.width = Math.min(100, (introT / 6.4) * 100) + '%';
    introEl.style.background = introT < 2.2 ? '#14101f' : 'rgba(20,16,31,0.25)';
    // flyover glide: over the water toward the peninsula skyline
    const k = Math.min(1, Math.max(0, (introT - 1.6) / 5.2));
    const e = 1 - Math.pow(1 - k, 3);
    camera.position.set(260 - e * 120, 34 - e * 10, 170 - e * 85);
    camera.lookAt(30, 12, -10);
    player.setPose(dt, 0);
    if (introT >= 6.8) finishIntro();
    renderFrame(); input.endFrame(); return;
  }
  if (mode === 'select') {
    // live turntable: the actual rig rotates on the spot, camera close
    const gp = player.group.position;
    hud.drawMinimap({ traffic, police, playerPos: { x: gp.x, z: gp.z }, playerHeading: 0, marker: null });
    player.group.rotation.y += dt * 0.9;
    player.setPose(dt, 0);
    camera.position.set(gp.x + 2.4, 1.5, gp.z + 3.1);
    camera.lookAt(gp.x, 1.05, gp.z);
    renderFrame(); input.endFrame(); return;
  }
  if (mode === 'beat') {
    player.setPose(dt, 0);
    renderFrame(); input.endFrame(); return;
  }
  if (mode === 'shop') {
    const s = SHOPS.find((x) => x.id === currentInterior);
    if (s) {
      camera.position.set(s.room.x + 3.4, 2.1, s.room.z + 7.6);
      camera.lookAt(s.room.x, 1, s.room.z - 1);
    }
    player.group.position.set(playerPos.x, 0, playerPos.z);
    player.setPose(dt, 0);
    renderFrame(); input.endFrame(); return;
  }
  if (mode === 'menu') {
    // slow cinematic orbit over the bay
    const a = t * 0.05;
    camera.position.set(120 + Math.sin(a) * 55, 26 + Math.sin(t * 0.13) * 4, 70 + Math.cos(a) * 55);
    camera.lookAt(-20, 8, -10);
    player.group.position.set(playerPos.x, 0, playerPos.z);
    player.setPose(dt, 0);
    beacon.visible = false;
    renderFrame();
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
    renderFrame();
    input.endFrame();
    return;
  }
  if (mode === 'pause' || mode === 'wasted') { renderFrame(); input.endFrame(); return; }

  // -------------------------------------------------------------- play mode
  if (input.consumePress('KeyV')) toggleCam();
  if (input.consumePress('KeyC')) toggleCompanion();
  if (input.consumePress('F3')) { fpsShow = !fpsShow; $('fps-chip').style.display = fpsShow ? 'block' : 'none'; }
  updateCompanion(dt);
  updateWildlife(dt);
  if (input.consumePress('KeyP') || input.consumePress('Escape')) {
    mode = 'pause'; pauseEl.classList.remove('hidden');
    $('pause-stats').textContent = `${state.rank} · $${state.money} · Respect ${state.respect} · ${state.progressText()} · ${Math.round(fpsNow)} FPS`;
    input.endFrame(); renderFrame(); return;
  }

  const focusPos = currentCar ? currentCar.pos : playerPos;

  // ----- on foot
  if (!currentCar) {
    const fwd = input.axis('KeyS', 'KeyW') + input.axis('ArrowDown', 'ArrowUp');
    const str = input.axis('KeyA', 'KeyD') + input.axis('ArrowLeft', 'ArrowRight');
    const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const speed = (sprint ? CONFIG.SPRINT_SPEED : CONFIG.WALK_SPEED) * charDef().runMul;
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
    const shop = nearestShop();
    const nearDog = Math.hypot(playerPos.x - dogPos.x, playerPos.z - dogPos.z) < 3.4;
    hud.showPrompt(near ? 'F — enter car' : shop ? `E — Masuk ${shop.name}` : nearDog ? 'E — Pet the dog ❤' : null);
    if (near && (input.consumePress('KeyF') || input.consumePress('KeyE'))) enterCar(near);
    else if (shop && input.consumePress('KeyE')) enterInterior(shop.id);
    else if (nearDog && input.consumePress('KeyE')) petDog();
  } else {
    // ----- driving
    hud.showPrompt(null);
    const inp = {
      throttle: input.axis('KeyS', 'KeyW') + input.axis('ArrowDown', 'ArrowUp'),
      steer: -(input.axis('KeyA', 'KeyD') + input.axis('ArrowLeft', 'ArrowRight')) * charDef().handlingMul,
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
    // stuck against a channel bank (target across the water)? repick locally
    ped.stuckT = (ped.stuckT || 0) + dt;
    if (ped.stuckT > 3) {
      const moved = Math.hypot(ped.pos.x - (ped.lastX ?? ped.pos.x), ped.pos.z - (ped.lastZ ?? ped.pos.z));
      ped.lastX = ped.pos.x; ped.lastZ = ped.pos.z; ped.stuckT = 0;
      if (moved < 0.4 && distT >= 1.5) ped.target = { x: clamp(ped.pos.x + (rng() - 0.5) * 50, -168, 140), z: clamp(ped.pos.z + (rng() - 0.5) * 50, -168, 168) };
    }
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
  if (!markerPos && state.jobAvailable) markerPos = giverLoc(state.jobIndex);
  if (markerPos) {
    beacon.visible = true;
    beacon.position.set(markerPos.x, 0, markerPos.z);
    gem.rotation.y += dt * 2; gem.position.y = 10.5 + Math.sin(t * 2.4) * 0.5;
    beam.material.opacity = 0.24 + Math.sin(t * 3.2) * 0.08;
    if (state.activeJob < 0 && state.jobAvailable) {
      const d = Math.hypot(focusPos.x - markerPos.x, focusPos.z - markerPos.z);
      if (d < 5.5) { const ji = state.jobIndex; if (state.startJob(ji)) { audio.jingle(true); showCine(JOBS[ji].giver, JOBS[ji].intro); } }
    }
  } else beacon.visible = false;

  // ----- health / wasted
  if (elapsed - lastHurt > 5 && health < charDef().healthMax) health = Math.min(charDef().healthMax, health + dt * 3);
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
  renderFrame();
  input.endFrame();
}
frame();
