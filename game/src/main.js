// Velora Bay's boot and frame loop. The world (world.js) simulates, the director (missions.js)
// stories, the renderer (render.js) draws; this file owns the seams between them: screens and
// menus, dialogue advancing, shop input, the weapon wheel, saving and loading, sound triggers,
// and the ?shot= screenshot mode.
import { SAVE_KEY, MUTE_KEY, WEAPON_ORDER, WEAPONS, STEP } from './config.js';
import { createRandom } from './random.js';
import { buildCity } from './city.js';
import { createWorld, angleDiff, clamp } from './world.js';
import { createDirector } from './missions.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_BUSTED, SCREEN_WASTED } from './render.js';
import { parseShot, stageShot } from './shots.js';

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const shot = parseShot();

/** Load the bundled faces before the first frame, so no screenshot or title ever falls back. */
export const fontsReady = (async () => {
  try {
    await Promise.all([
      document.fonts.load('104px "Anton"'),
      document.fonts.load('500 16px "Rajdhani"'),
      document.fonts.load('600 16px "Rajdhani"'),
      document.fonts.load('700 16px "Rajdhani"'),
    ]);
    await document.fonts.ready;
  } catch {
    /* fonts are bundled locally; a load failure still leaves the @font-face faces to swap in */
  }
})();

const city = buildCity(createRandom(987123));
let state = null;
let director = null;

const audio = createAudio();
try {
  audio.setMuted(window.localStorage.getItem(MUTE_KEY) === '1');
} catch {
  /* storage unavailable: sound simply starts unmuted */
}
const input = createInput(canvas);
const renderer = createRenderer(canvas, city);

function freshWorld() {
  const seed = shot !== null ? shot.seed * 7919 + 13 : Math.floor(Math.random() * 2147483646) + 1;
  state = createWorld(createRandom(seed), city);
  state.audio = audio;
  director = createDirector(state);
}
freshWorld();
if (shot !== null) stageShot(state, director, shot.name);

// ----- saving -----

function hasSave() {
  try {
    return window.localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

function saveGame() {
  const p = state.player;
  const data = {
    v: 1,
    cash: p.cash, respect: p.respect, hp: p.hp, armor: p.armor,
    weapons: p.weapons, ammo: p.ammo, weapon: p.weapon,
    x: p.x, y: p.y, clock: state.clock,
    jobIndex: state.flags.jobIndex ?? 0,
    storyDone: state.flags.storyDone === true,
    stats: state.stats,
  };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable: the run simply is not kept */
  }
}

function loadGame() {
  let data = null;
  try {
    data = JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? 'null');
  } catch {
    data = null;
  }
  if (data === null) return false;
  const p = state.player;
  p.cash = data.cash ?? p.cash;
  p.respect = data.respect ?? 0;
  p.hp = data.hp ?? 100;
  p.armor = data.armor ?? 0;
  p.weapons = { ...p.weapons, ...(data.weapons ?? {}) };
  p.ammo = { ...p.ammo, ...(data.ammo ?? {}) };
  p.weapon = WEAPONS[data.weapon] !== undefined ? data.weapon : 'pistol';
  const placed = city.collideCircle(data.x ?? p.x, data.y ?? p.y, 12);
  p.x = placed.x;
  p.y = placed.y;
  state.clock = data.clock ?? state.clock;
  state.flags.jobIndex = data.jobIndex ?? 0;
  if (data.storyDone) state.flags.storyDone = true;
  state.stats = { ...state.stats, ...(data.stats ?? {}) };
  state.stats.jobsDone = state.flags.jobIndex;
  return true;
}

// ----- screens and menus -----

let screen = shot !== null && shot.name !== 'title' ? SCREEN_PLAY : SCREEN_TITLE;
let menuSel = 0;
let showHow = false;
let feeText = '';
let wheelOpen = false;
let wheelIndex = 0;
let lastView = null;
let shotFrame = 0;
let lastDlg = null;
let lastDlgLine = -1;
let prevScreen = screen;
let prevDialogue = null;
let prevShop = null;

function announce(message) {
  if (status !== null) status.textContent = message;
}

function titleItems() {
  if (showHow) return [{ id: 'back', label: 'BACK' }];
  const items = [{ id: 'new', label: 'NEW GAME' }];
  if (hasSave()) items.push({ id: 'continue', label: 'CONTINUE' });
  else items.push({ id: 'continue', label: 'CONTINUE', disabled: true, sub: 'no save found' });
  items.push({ id: 'how', label: 'HOW TO PLAY' });
  return items;
}

function pauseItems() {
  return [
    { id: 'resume', label: 'RESUME' },
    { id: 'savequit', label: 'SAVE & QUIT TO TITLE' },
  ];
}

function startRun(continued) {
  freshWorld();
  if (continued && !loadGame()) {
    /* the save vanished between menu and click: a fresh run it is */
  }
  state.cameraOverride = null;
  state.camSnap = true;
  screen = SCREEN_PLAY;
  menuSel = 0;
  audio.confirm();
  announce(continued ? 'Continuing in Velora Bay.' : 'A new story begins in Velora Bay.');
}

function activateMenu(id) {
  if (screen === SCREEN_TITLE) {
    if (id === 'new') startRun(false);
    else if (id === 'continue') startRun(true);
    else if (id === 'how') {
      showHow = true;
      menuSel = 0;
      audio.click();
    } else if (id === 'back') {
      showHow = false;
      menuSel = 0;
      audio.click();
    }
  } else if (screen === SCREEN_PAUSED) {
    if (id === 'resume') {
      screen = SCREEN_PLAY;
      audio.click();
    } else if (id === 'savequit') {
      saveGame();
      screen = SCREEN_TITLE;
      menuSel = 0;
      audio.confirm();
      announce('Saved. Back at the title.');
    }
  }
}

/** Keyboard + mouse navigation shared by the title and pause menus. Returns the view's items. */
function menuInput(items) {
  if (input.pressed('ArrowUp') || input.pressed('KeyW')) {
    menuSel = (menuSel + items.length - 1) % items.length;
    audio.click();
  }
  if (input.pressed('ArrowDown') || input.pressed('KeyS')) {
    menuSel = (menuSel + 1) % items.length;
    audio.click();
  }
  if (lastView !== null) {
    for (let i = 0; i < lastView.hot.length; i += 1) {
      const r = lastView.hot[i];
      if (input.mouse.x >= r.x && input.mouse.x <= r.x + r.w && input.mouse.y >= r.y && input.mouse.y <= r.y + r.h) {
        const idx = items.findIndex((it) => it.id === r.id);
        if (idx >= 0) menuSel = idx;
      }
    }
  }
  if (input.pressed('Enter')) {
    const item = items[menuSel];
    if (item !== undefined && !item.disabled) activateMenu(item.id);
  }
}

function menuClick(items) {
  if (lastView === null) return;
  for (const r of lastView.hot) {
    if (input.mouse.x >= r.x && input.mouse.x <= r.x + r.w && input.mouse.y >= r.y && input.mouse.y <= r.y + r.h) {
      const item = items.find((it) => it.id === r.id);
      if (item !== undefined && !item.disabled) activateMenu(item.id);
      return;
    }
  }
}

// ----- dialogue -----

/** While a conversation is up the world holds its breath; only the clock and the typewriter move. */
function dialogueFrame(dt, clicked) {
  state.t += dt;
  state.clock = (state.clock + dt) % 1440;
  const dlg = state.dialogue;
  if (dlg !== lastDlg || dlg.i !== lastDlgLine) {
    dlg.t0 = state.t;
    lastDlg = dlg;
    lastDlgLine = dlg.i;
  }
  const line = dlg.lines[dlg.i];
  const typed = line === undefined || (state.t - (dlg.t0 ?? state.t)) * 60 >= line.text.length;
  if (input.pressed('KeyE') || input.pressed('Enter') || clicked) {
    if (!typed) {
      dlg.t0 = state.t - 10; // first press completes the line
      return;
    }
    audio.click();
    dlg.i += 1;
    if (dlg.i >= dlg.lines.length) {
      const done = dlg.onDone;
      state.dialogue = null;
      lastDlg = null;
      lastDlgLine = -1;
      if (done !== null && done !== undefined) done();
    }
  }
}

// ----- shops -----

let shopItemsCache = [];

function shopFrame() {
  const shop = state.shop;
  shopItemsCache = state.buildShopItems(shop.kind);
  shop.sel = clamp(shop.sel, 0, shopItemsCache.length - 1);
  if (input.pressed('ArrowUp') || input.pressed('KeyW')) {
    shop.sel = (shop.sel + shopItemsCache.length - 1) % shopItemsCache.length;
    audio.click();
  }
  if (input.pressed('ArrowDown') || input.pressed('KeyS')) {
    shop.sel = (shop.sel + 1) % shopItemsCache.length;
    audio.click();
  }
  const buy = (item) => {
    if (item === undefined || item.disabled) return;
    const result = item.run();
    if (result === 'close') {
      state.shop = null;
      audio.click();
    } else {
      shop.msg = result;
      audio.cash();
    }
  };
  if (input.pressed('Enter')) buy(shopItemsCache[shop.sel]);
  if (input.pressed('Escape')) {
    state.shop = null;
    audio.click();
  }
}

function shopClick() {
  // Row geometry mirrors the renderer's shop panel.
  const shop = state.shop;
  const items = shopItemsCache;
  const pw = 640;
  const ph = 130 + items.length * 52 + 60;
  const px = window.innerWidth / 2 - pw / 2;
  const py = window.innerHeight / 2 - ph / 2;
  for (let i = 0; i < items.length; i += 1) {
    const y = py + 108 + i * 52;
    if (input.mouse.x >= px + 22 && input.mouse.x <= px + pw - 22 && input.mouse.y >= y - 21 && input.mouse.y <= y + 21) {
      if (shop.sel === i) {
        const item = items[i];
        if (item !== undefined && !item.disabled) {
          const result = item.run();
          if (result === 'close') state.shop = null;
          else {
            shop.msg = result;
            audio.cash();
          }
        }
      } else {
        shop.sel = i;
        audio.click();
      }
      return;
    }
  }
}

// ----- the frame -----

const ZERO_CTL = { mx: 0, my: 0, sprint: false, hand: false, fire: false, interact: false, interact2: false, aimX: 0, aimY: 0 };
let last = performance.now();
let acc = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = Math.min((now - last) / 1000, 0.1);
  last = now;
  acc += rawDt;
  const clicked = input.takeClick();
  shotFrame += 1;
  if (shot !== null && shotFrame === 45) window.__shotReady = true;

  let shopItems = null;

  if (screen === SCREEN_TITLE) {
    // The city idles behind the logo: traffic flows, lamps warm up, nobody is in trouble yet.
    state.consumedInteract = false;
    if (shot === null || shot.name === 'title') {
      const t = now / 1000;
      state.cameraOverride = { x: 4250 + Math.sin(t * 0.06) * 240, y: 2280 + Math.cos(t * 0.045) * 110, zoom: 0.8 };
    }
    while (acc >= STEP) {
      state.step(STEP, ZERO_CTL);
      acc -= STEP;
    }
    audio.update(state);
    if (shot === null) {
      const items = titleItems();
      menuInput(items);
      if (clicked) menuClick(items);
    }
  } else if (screen === SCREEN_PAUSED) {
    const items = pauseItems();
    menuInput(items);
    if (clicked) menuClick(items);
    if (input.pressed('Escape') || input.pressed('KeyP')) screen = SCREEN_PLAY;
  } else if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
    if (input.pressed('Enter') || clicked) {
      state.respawn(screen === SCREEN_WASTED ? 'wasted' : 'busted');
      state.camSnap = true;
      screen = SCREEN_PLAY;
      audio.confirm();
      announce('Back on the street.');
    }
  } else if (state.dialogue !== null) {
    dialogueFrame(Math.min(rawDt, 0.05), clicked);
  } else if (state.shop !== null) {
    shopFrame();
    shopItems = shopItemsCache;
    if (clicked && state.shop !== null) shopClick();
  } else {
    // Playing.
    if (shot === null && (input.pressed('Escape') || input.pressed('KeyP'))) {
      screen = SCREEN_PAUSED;
      menuSel = 0;
      audio.click();
      announce('Paused.');
    } else {
      playFrame(rawDt);
    }
  }

  // A screen, conversation or shop that just opened starts with a clean input slate.
  if (screen !== prevScreen || (state.dialogue !== null && prevDialogue === null) || (state.shop !== null && prevShop === null)) {
    input.flush();
  }
  prevScreen = screen;
  prevDialogue = state.dialogue;
  prevShop = state.shop;

  const view = {
    screen,
    dt: rawDt,
    tNow: now / 1000,
    menuItems: screen === SCREEN_TITLE ? titleItems() : screen === SCREEN_PAUSED ? pauseItems() : [],
    menuSel,
    shopItems,
    wheel: { open: wheelOpen, index: wheelIndex },
    feeText,
    hot: [],
  };
  renderer.draw(state, view);
  lastView = view;
  if (showHow && screen === SCREEN_TITLE) drawHowTo();
}

function playFrame(rawDt) {
  const p = state.player;
  // The L-key headlight latch lives in input; mirror it onto the world every frame.
  state.headlightsOn = input.toggles.headlights;
  // One-shot keys.
  const ePressed = input.pressed('KeyE') || (shot !== null && shot.name === 'mission' && shotFrame === 6);
  const fPressed = input.pressed('KeyF');
  if (input.pressed('KeyR')) {
    audio.cycleStation();
    state.radioName = audio.stationName();
    state.radioT = state.t;
    audio.click();
  }
  if (input.pressed('KeyM')) {
    audio.setMuted(!audio.muted);
    try {
      window.localStorage.setItem(MUTE_KEY, audio.muted ? '1' : '0');
    } catch {
      /* the mute lasts the session */
    }
  }
  for (let i = 0; i < WEAPON_ORDER.length; i += 1) {
    if (input.pressed('Digit' + (i + 1))) {
      const key = WEAPON_ORDER[i];
      if (p.weapons[key] && p.weapon !== key) {
        p.weapon = key;
        audio.click();
      }
    }
  }
  // The weapon wheel: hold Q or Tab, point, release.
  const wheelHeld = input.down('KeyQ') || input.down('Tab');
  if (wheelHeld && !wheelOpen) {
    wheelOpen = true;
    wheelIndex = WEAPON_ORDER.indexOf(p.weapon);
  } else if (wheelHeld && wheelOpen) {
    const dx = input.mouse.x - window.innerWidth / 2;
    const dy = input.mouse.y - window.innerHeight / 2;
    if (Math.hypot(dx, dy) > 34) {
      const sector = Math.round((Math.atan2(dy, dx) + Math.PI / 2) / (Math.PI / 2));
      wheelIndex = ((sector % 4) + 4) % 4;
    }
  } else if (!wheelHeld && wheelOpen) {
    wheelOpen = false;
    const key = WEAPON_ORDER[wheelIndex];
    if (p.weapons[key] && p.weapon !== key) {
      p.weapon = key;
      audio.confirm();
    }
  }

  const aim = renderer.screenToWorld(input.mouse.x, input.mouse.y);
  const axes = input.moveAxes();
  const ctl = {
    mx: axes.x,
    my: axes.y,
    sprint: input.down('ShiftLeft') || input.down('ShiftRight'),
    hand: input.down('Space'),
    fire: input.mouse.down && !wheelOpen,
    interact: ePressed,
    interact2: fPressed,
    aimX: aim.x,
    aimY: aim.y,
  };
  if (shot !== null && shot.name === 'chase' && p.car !== null) {
    // The screenshot's stunt driver: flat out east along the avenue, holding the lane.
    ctl.my = -1;
    ctl.mx = clamp((1100 - p.car.y) * 0.01 + angleDiff(0, p.car.angle) * 1.6, -1, 1);
    ctl.fire = false;
  }
  if (shot !== null && p.hp < 45) {
    p.hp = 45;
    p.dead = false;
  }

  state.consumedInteract = false;
  let steps = 0;
  acc = Math.min(acc, STEP * 3);
  while (acc >= STEP && steps < 3) {
    state.step(STEP, ctl);
    director.update(STEP, ctl);
    acc -= STEP;
    steps += 1;
  }
  if (steps === 0) {
    state.step(0, ctl);
    director.update(0, ctl);
  }
  audio.update(state);

  if (state.saveRequest) {
    state.saveRequest = false;
    saveGame();
  }
  if (state.gameOver !== null && shot === null) {
    const kind = state.gameOver;
    const fee = kind === 'wasted' ? Math.min(p.cash, 120 + Math.floor(p.cash * 0.06)) : Math.min(p.cash, 180);
    feeText = kind === 'wasted'
      ? `Velora General took $${fee} for the stitches. The bay keeps spinning.`
      : `The VBPD took $${fee} — and impounded your heat.`;
    screen = kind === 'wasted' ? SCREEN_WASTED : SCREEN_BUSTED;
    announce(kind === 'wasted' ? 'Wasted.' : 'Busted.');
  } else if (state.gameOver !== null) {
    state.gameOver = null;
    p.dead = false;
    p.hp = 60;
    p.bustedT = 0;
  }
}

// ----- the how-to-play card, drawn over the title -----

function drawHowTo() {
  const ctx = canvas.getContext('2d');
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(760, vw - 48);
  const h = 402;
  const x = vw / 2 - w / 2;
  const y = vh / 2 - h / 2 + 26;
  ctx.fillStyle = 'rgba(10,12,24,0.94)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,215,106,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const lines = [
    ['HOW TO PLAY', '#ffd76a', 21, 800],
    ['Ray Solano, a driver with a past, takes work from fixer Marla Voss at The Gilded Eel and', 'rgba(255,255,255,0.88)', 14.5, 500],
    ['mechanic Dex Ibarra at Velora Auto Works. Eight story jobs build one arc against the', 'rgba(255,255,255,0.88)', 14.5, 500],
    ['Corsair syndicate and its boss, Vex Moretti — pickups, tails, convoys, an escort, a street', 'rgba(255,255,255,0.88)', 14.5, 500],
    ['race, and one very armored truck.', 'rgba(255,255,255,0.88)', 14.5, 500],
    ['', '', 8, 500],
    ['Move / drive — WASD or arrows · Sprint — Shift · Handbrake — Space', '#ffffff', 15, 600],
    ['Enter cars, talk, use — E · Exit car — F · Aim — mouse · Shoot — click (drive-bys too)', '#ffffff', 15, 600],
    ['Weapons — 1–4, or hold Q / Tab for the wheel · Headlights — L · Radio — R · Mute — M · Pause — Esc / P', '#ffffff', 15, 600],
    ['', '', 8, 500],
    ['Stars are heat: break line of sight and it cools. Roadblocks at 3 stars, the helicopter', 'rgba(255,255,255,0.88)', 14.5, 500],
    ['at 4. Buy guns at Harbor Arms, fix and respray at the Auto Works, rest and save at the', 'rgba(255,255,255,0.88)', 14.5, 500],
    ['safehouse. Fares hail you on the street; two street races run from marked start lines.', 'rgba(255,255,255,0.88)', 14.5, 500],
  ];
  lines.forEach((line, i) => {
    ctx.font = i === 0 ? `${line[2]}px "Anton", "Rajdhani", sans-serif` : `${line[3]} ${line[2]}px "Rajdhani", sans-serif`;
    ctx.fillStyle = line[1];
    ctx.fillText(line[0], x + 30, y + 36 + i * 25.5);
  });
}

window.addEventListener('pointerdown', () => audio.unlock(), { once: false });
window.addEventListener('keydown', () => audio.unlock(), { once: false });
document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === SCREEN_PLAY && shot === null && state.dialogue === null && state.shop === null) {
    screen = SCREEN_PAUSED;
    menuSel = 0;
    announce('Paused.');
  }
});

announce(shot !== null ? 'Velora Bay screenshot scene.' : 'Velora Bay. A new game awaits.');
// First frame waits for the bundled fonts (bounded: a hung load must never black-screen the game).
Promise.race([fontsReady, new Promise((r) => setTimeout(r, 2500))]).then(() => requestAnimationFrame(frame));
