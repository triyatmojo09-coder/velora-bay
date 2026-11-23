// Velora Bay's simulation: the player on foot and behind the wheel, traffic and pedestrians,
// the VBPD's pursuit machine (patrol cars, roadblocks, a helicopter), hitscan combat, car
// damage and explosions, the wanted system, and the shop/service logic. No drawing and no DOM
// here except through the state the renderer reads; missions.js drives the story on top.
import { WORLD, WEAPONS, WEAPON_ORDER, CAR_TYPES, CAR_COLORS, SPORTS_COLORS, STAR_THRESHOLDS, rankFor } from './config.js';

export function dist(x0, y0, x1, y1) {
  return Math.hypot(x1 - x0, y1 - y0);
}

export function angleDiff(a, b) {
  return ((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

let nextId = 1;

export function createWorld(rng, city) {
  const state = {
    t: 0,
    clock: 18 * 60 + 10, // the day starts at dusk, 18:10
    rng,
    city,
    audio: null,
    player: {
      x: 430, y: 2025, angle: 0, vx: 0, vy: 0, walk: 0, fireCd: 0, bustedT: 0,
      hp: 100, armor: 0, cash: 250, respect: 0,
      weapons: { fist: true, pistol: true, smg: false, shotgun: false },
      ammo: { pistol: 48, smg: 0, shotgun: 0 },
      weapon: 'pistol',
      car: null, dead: false,
    },
    cars: [],
    peds: [],
    tracers: [],
    flashes: [],
    parts: [],
    skids: [],
    booms: [],
    heli: null,
    roadblocks: [],
    wanted: { heat: 0, stars: 0, seenT: 99, floor: 0 },
    dialogue: null,
    objective: null,
    banner: null,
    district: '',
    districtT: -10,
    prompt: '',
    shop: null,
    saveRequest: false,
    consumedInteract: false,
    gameOver: null,
    starFlashT: 0,
    policeSpawnCd: 0,
    blockCd: 14,
    trafficCd: 0,
    pedCd: 0,
    stats: { shots: 0, hits: 0, carsStolen: 0, pedsDown: 0, carsWrecked: 0, jobsDone: 0, racesWon: 0, taxiFares: 0, earned: 0 },
    flags: {},
    mission: null,
    race: null,
    taxi: null,
    camShake: 0,
    /** Headlight cones at dusk: on by default, toggled with the L key (see input/main). */
    headlightsOn: true,
  };

  // ---------- spawning ----------

  function spawnCar(type, x, y, angle, opts = {}) {
    const spec = CAR_TYPES[type];
    const car = {
      id: nextId++,
      type,
      kind: opts.kind ?? 'traffic',
      x, y, angle, vx: 0, vy: 0, speed: 0, steerVis: 0,
      color: opts.color ?? (type === 'police' ? '#e8ecf2' : type === 'taxi' ? '#e8b13a' : type === 'sports' ? rng.pick(SPORTS_COLORS) : rng.pick(CAR_COLORS)),
      hp: opts.hp ?? spec.hp,
      maxHp: spec.hp,
      driver: opts.driver ?? false,
      driverColor: rng.pick(CAR_COLORS),
      dead: false, boomT: 0, fireT: 0, smokeT: 0,
      ai: opts.ai ?? null,
      fireCd: rng.range(0.4, 1.2),
      copOut: false,
      missionTag: opts.missionTag ?? null,
      noDespawn: opts.noDespawn ?? false,
    };
    state.cars.push(car);
    return car;
  }

  function spawnPed(x, y, kind = 'civ', opts = {}) {
    const ped = {
      id: nextId++,
      x, y, angle: rng.range(0, Math.PI * 2), vx: 0, vy: 0,
      hp: kind === 'cop' ? 80 : kind === 'gang' ? 70 : 50,
      maxHp: kind === 'cop' ? 80 : kind === 'gang' ? 70 : 50,
      kind,
      name: opts.name ?? null,
      shirt: opts.shirt ?? rng.pick(['#ff6b57', '#19b5a6', '#ffc53d', '#ff8fb2', '#f4ead5', '#ff5d8f', '#4cc9f0', '#ffb26b']),
      pants: rng.pick(['#2c3242', '#f4ead5', '#3a6ea5', '#22303c', '#e88ca0']),
      state: 'walk',
      tx: x, ty: y, targetT: 0, fleeT: 0, fireCd: rng.range(0.5, 1.5),
      walk: rng.range(0, 6),
      dead: false, deadT: 0,
      car: null, // the car this ped drives / rides in
      hail: false,
    };
    state.peds.push(ped);
    return ped;
  }

  // Parked cars: parking-lot rows plus a scatter of street parking, placed once at build time.
  for (const cell of city.cells) {
    if (cell.kind !== 'parking') continue;
    const cols = Math.max(2, Math.floor(cell.w / 95));
    const rows = Math.max(2, Math.floor(cell.h / 120));
    for (let a = 0; a < cols; a += 1) {
      for (let b = 0; b < rows; b += 1) {
        if (!rng.chance(0.55)) continue;
        const type = rng.pick(['compact', 'sedan', 'sedan', 'suv', 'sports']);
        spawnCar(type, cell.x + 55 + a * 95, cell.y + 60 + b * 120, Math.PI / 2, { kind: 'parked' });
      }
    }
  }
  for (let i = 0; i < 26; i += 1) {
    const onV = rng.chance(0.5);
    const road = onV ? rng.pick([520, 1160, 1800, 2440, 3080, 3720]) : rng.pick([480, 1100, 1720, 2340, 2960]);
    const along = rng.range(200, onV ? WORLD.h - 200 : WORLD.w - 400);
    const side = rng.chance(0.5) ? -72 : 72;
    const x = onV ? road + side : along;
    const y = onV ? along : road + side;
    if (city.pointInBuilding(x, y, 26)) continue;
    spawnCar(rng.pick(['compact', 'sedan', 'suv', 'van']), x, y, onV ? 0 : Math.PI / 2, { kind: 'parked' });
  }

  // ---------- economy & respect ----------

  function addCash(amount) {
    state.player.cash += amount;
    if (amount > 0) state.stats.earned += amount;
    if (amount > 0 && state.audio) state.audio.cash();
  }

  function addRespect(amount) {
    const before = rankFor(state.player.respect).title;
    state.player.respect += amount;
    const after = rankFor(state.player.respect);
    if (after.title !== before) {
      setBanner('RESPECT — ' + after.title.toUpperCase(), `Rank up: you are now a ${after.title} in Velora Bay`);
      if (state.audio) state.audio.jobDone();
    }
  }

  function setBanner(title, sub = '', dur = 3.2) {
    state.banner = { title, sub, t: state.t, dur };
  }

  // ---------- crime & wanted ----------

  function witnessed(x, y, radius = 320) {
    for (const ped of state.peds) {
      if (ped.dead) continue;
      if (dist(x, y, ped.x, ped.y) < radius) return true;
    }
    for (const car of state.cars) {
      if (car.kind === 'police' && !car.dead && dist(x, y, car.x, car.y) < 480) return true;
    }
    return state.heli !== null && dist(x, y, state.heli.x, state.heli.y) < 560;
  }

  function crime(points, x = state.player.x, y = state.player.y) {
    const seen = witnessed(x, y);
    state.wanted.heat += seen ? points : points * 0.25;
    if (seen) state.wanted.seenT = 0;
  }

  function starsFor(heat) {
    let stars = 0;
    for (let i = 1; i <= 5; i += 1) if (heat >= STAR_THRESHOLDS[i]) stars = i;
    return stars;
  }

  // ---------- damage & explosions ----------

  function damagePlayer(amount) {
    const p = state.player;
    if (p.dead || state.gameOver !== null) return;
    let rest = amount;
    if (p.armor > 0) {
      const absorbed = Math.min(p.armor, amount * 0.65);
      p.armor -= absorbed;
      rest = amount - absorbed;
    }
    p.hp -= rest;
    state.camShake = Math.min(10, state.camShake + amount * 0.12);
    if (p.hp <= 0) {
      p.hp = 0;
      p.dead = true;
      state.gameOver = 'wasted';
    }
  }

  function damagePed(ped, amount, byPlayer, kx = 0, ky = 0) {
    if (ped.dead) return;
    ped.hp -= amount;
    ped.vx += kx;
    ped.vy += ky;
    spawnParts(ped.x, ped.y, 5, '#b8b0a4', 90, 0.35);
    if (ped.hp <= 0) {
      ped.dead = true;
      ped.deadT = 0;
      if (byPlayer) {
        state.stats.pedsDown += 1;
        if (ped.kind === 'cop') crime(70, ped.x, ped.y);
        else if (ped.kind === 'gang') crime(8, ped.x, ped.y);
        else crime(35, ped.x, ped.y);
        if (ped.kind === 'civ') addRespect(2);
      }
    } else if (ped.kind === 'civ') {
      ped.state = 'flee';
      ped.fleeT = 3;
    } else if (byPlayer && (ped.kind === 'cop' || ped.kind === 'gang')) {
      ped.state = 'attack';
    }
  }

  function damageCar(car, amount, byPlayer) {
    if (car.dead) return;
    car.hp -= amount;
    if (car.hp <= 0) {
      car.dead = true;
      car.boomT = 0.38;
      if (byPlayer) {
        state.stats.carsWrecked += 1;
        if (car.kind === 'police') crime(55, car.x, car.y);
      }
    }
  }

  function explode(x, y, radius = 130) {
    state.booms.push({ x, y, t: 0, life: 0.38, r: radius });
    state.camShake = Math.min(14, state.camShake + 8);
    if (state.audio) state.audio.explosion();
    spawnParts(x, y, 26, '#ff9a3c', 320, 0.5);
    spawnParts(x, y, 18, '#e5534b', 240, 0.4);
    spawnParts(x, y, 16, '#555a60', 130, 1.1);
    for (const car of state.cars) {
      const d = dist(x, y, car.x, car.y);
      if (d < radius + 30 && !car.dead) damageCar(car, 130 * (1 - d / (radius + 60)), true);
    }
    for (const ped of state.peds) {
      const d = dist(x, y, ped.x, ped.y);
      if (d < radius && !ped.dead) damagePed(ped, 90 * (1 - d / radius), true, (ped.x - x) * 2.2, (ped.y - y) * 2.2);
    }
    const p = state.player;
    if (p.car === null) {
      const d = dist(x, y, p.x, p.y);
      if (d < radius) damagePlayer(70 * (1 - d / radius));
    }
    crime(30, x, y);
  }

  function spawnParts(x, y, n, color, speed, life) {
    for (let i = 0; i < n; i += 1) {
      if (state.parts.length > 420) return;
      const a = rng.range(0, Math.PI * 2);
      const s = rng.range(speed * 0.25, speed);
      state.parts.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        t: 0, life: rng.range(life * 0.5, life), size: rng.range(2, 5),
        color, grav: 0, drag: 2.2,
      });
    }
  }

  function spawnSmoke(x, y, dark) {
    if (state.parts.length > 420) return;
    state.parts.push({
      x: x + rng.range(-6, 6), y: y + rng.range(-6, 6),
      vx: rng.range(-8, 8), vy: rng.range(-34, -18),
      t: 0, life: rng.range(0.7, 1.3), size: rng.range(5, 10),
      color: dark ? '#3c4046' : '#9aa0a3', grav: -30, drag: 0.4,
    });
  }

  // ---------- shooting ----------

  function pointInCar(car, x, y, pad = 3) {
    const spec = CAR_TYPES[car.type];
    const dx = x - car.x;
    const dy = y - car.y;
    const cos = Math.cos(-car.angle);
    const sin = Math.sin(-car.angle);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    return Math.abs(lx) < spec.l / 2 + pad && Math.abs(ly) < spec.w / 2 + pad;
  }

  /** One hitscan ray. faction 'player' hunts peds and cars; 'enemy' hunts the player (and Dex). */
  function shootRay(sx, sy, angle, wkey, faction) {
    const w = WEAPONS[wkey];
    let ex = sx + Math.cos(angle) * w.range;
    let ey = sy + Math.sin(angle) * w.range;
    const steps = Math.ceil(w.range / 12);
    let hitSomething = false;
    for (let i = 1; i <= steps; i += 1) {
      const px = sx + Math.cos(angle) * i * 12;
      const py = sy + Math.sin(angle) * i * 12;
      if (city.pointInBuilding(px, py, 0)) {
        ex = px;
        ey = py;
        hitSomething = true;
        spawnParts(px, py, 3, '#d8cf9f', 70, 0.25);
        break;
      }
      if (faction === 'player') {
        let hit = false;
        for (const ped of state.peds) {
          if (ped.dead || ped.car !== null) continue;
          if (dist(px, py, ped.x, ped.y) < 14) {
            damagePed(ped, w.dmg, true, Math.cos(angle) * 60, Math.sin(angle) * 60);
            ex = px;
            ey = py;
            hit = true;
            break;
          }
        }
        if (!hit) {
          for (const car of state.cars) {
            if (car === state.player.car) continue;
            if (pointInCar(car, px, py)) {
              damageCar(car, w.dmg, true);
              ex = px;
              ey = py;
              hit = true;
              spawnParts(px, py, 4, '#ffd76a', 90, 0.2);
              break;
            }
          }
        }
        if (hit) {
          hitSomething = true;
          break;
        }
      } else {
        // Enemy fire: the player on foot, the player's car, or a named escort target.
        const p = state.player;
        if (p.car !== null) {
          if (pointInCar(p.car, px, py)) {
            damageCar(p.car, w.dmg * 0.8, false);
            ex = px;
            ey = py;
            hitSomething = true;
            break;
          }
        } else if (dist(px, py, p.x, p.y) < 15) {
          damagePlayer(w.dmg * 0.55);
          ex = px;
          ey = py;
          hitSomething = true;
          break;
        }
        for (const ped of state.peds) {
          if (ped.dead || ped.kind !== 'dex') continue;
          if (dist(px, py, ped.x, ped.y) < 14) {
            damagePed(ped, w.dmg, false, Math.cos(angle) * 50, Math.sin(angle) * 50);
            ex = px;
            ey = py;
            hitSomething = true;
            break;
          }
        }
        if (hitSomething) break;
      }
    }
    state.tracers.push({ x1: sx, y1: sy, x2: ex, y2: ey, t: 0, life: 0.08, color: faction === 'player' ? '#ffe9a8' : '#ff9a7a' });
    return hitSomething;
  }

  function fireWeapon(shooter, sx, sy, angle, wkey, faction) {
    const w = WEAPONS[wkey];
    let anyHit = false;
    for (let i = 0; i < w.pellets; i += 1) {
      const a = angle + (w.spread > 0 ? rng.range(-w.spread, w.spread) : 0);
      if (shootRay(sx, sy, a, wkey, faction)) anyHit = true;
    }
    state.flashes.push({ x: sx + Math.cos(angle) * 14, y: sy + Math.sin(angle) * 14, t: 0, life: 0.05, r: wkey === 'shotgun' ? 16 : 10 });
    if (faction === 'player') {
      state.stats.shots += 1;
      if (anyHit) state.stats.hits += 1;
      crime(13, sx, sy);
      alertPeds(sx, sy, 260);
    }
    if (state.audio) state.audio.shot(wkey);
    return anyHit;
  }

  function alertPeds(x, y, radius) {
    for (const ped of state.peds) {
      if (ped.dead || ped.kind !== 'civ') continue;
      if (dist(x, y, ped.x, ped.y) < radius) {
        ped.state = 'flee';
        ped.fleeT = rng.range(2, 4);
        ped.tx = ped.x + (ped.x - x) * 1.6;
        ped.ty = ped.y + (ped.y - y) * 1.6;
      }
    }
  }

  function meleeSwing() {
    const p = state.player;
    let hit = false;
    for (const ped of state.peds) {
      if (ped.dead || ped.car !== null) continue;
      const d = dist(p.x, p.y, ped.x, ped.y);
      if (d < 58 && Math.abs(angleDiff(Math.atan2(ped.y - p.y, ped.x - p.x), p.angle)) < 1.0) {
        damagePed(ped, WEAPONS.fist.dmg, true, Math.cos(p.angle) * 130, Math.sin(p.angle) * 130);
        hit = true;
      }
    }
    for (const car of state.cars) {
      if (car === p.car) continue;
      if (dist(p.x, p.y, car.x, car.y) < 66 && pointInCar(car, p.x + Math.cos(p.angle) * 30, p.y + Math.sin(p.angle) * 30, 8)) {
        damageCar(car, 5, true);
        hit = true;
      }
    }
    if (hit && state.audio) state.audio.punch();
    if (hit) crime(16);
    return hit;
  }

  // ---------- car physics (shared by the player and every AI driver) ----------

  function stepCarPhysics(car, throttle, steer, hand, dt) {
    const spec = CAR_TYPES[car.type];
    const fx = Math.cos(car.angle);
    const fy = Math.sin(car.angle);
    let vf = car.vx * fx + car.vy * fy;
    let vr = car.vx * -fy + car.vy * fx;
    const ground = city.groundAt(car.x, car.y);
    const surf = ground === 'road' || ground === 'pier' || ground === 'lot' ? 1 : 0.55;
    const maxF = spec.maxSpeed * surf * (car.hp < 30 ? 0.55 : 1);
    car.steerVis += (steer - car.steerVis) * Math.min(1, dt * 10);
    const authority = clamp(Math.abs(vf) / 90, 0, 1) * (hand ? 1.45 : 1);
    if (Math.abs(vf) > 4) car.angle += steer * 2.3 * authority * dt * (vf < 0 ? -1 : 1);
    if (throttle > 0) {
      if (vf < maxF) vf += spec.accel * throttle * dt;
    } else if (throttle < 0) {
      if (vf > 12) vf += spec.accel * 1.6 * throttle * dt;
      else if (vf > -105 * surf) vf += spec.accel * 0.7 * throttle * dt;
    }
    vf *= Math.max(0, 1 - 0.45 * dt);
    if (hand) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 200 * dt);
    if (vf > maxF) vf = Math.max(maxF, vf - 200 * dt);
    const grip = spec.grip * (hand ? 0.22 : 1);
    vr *= Math.exp(-grip * dt);
    const nfx = Math.cos(car.angle);
    const nfy = Math.sin(car.angle);
    car.vx = nfx * vf + -nfy * vr;
    car.vy = nfy * vf + nfx * vr;
    car.speed = vf;
    car.x += car.vx * dt;
    car.y += car.vy * dt;
    // Skid marks and tyre smoke while the back end steps out.
    if (Math.abs(vr) > 52 && Math.abs(vf) > 70 && !car.dead) {
      const bx = car.x - nfx * spec.l * 0.32;
      const by = car.y - nfy * spec.l * 0.32;
      const ox = -nfy * spec.w * 0.36;
      const oy = nfx * spec.w * 0.36;
      if (car.lastSkid) {
        state.skids.push({ x1: car.lastSkid.x + ox, y1: car.lastSkid.y + oy, x2: bx + ox, y2: by + oy, a: 0.5 });
        state.skids.push({ x1: car.lastSkid.x - ox, y1: car.lastSkid.y - oy, x2: bx - ox, y2: by - oy, a: 0.5 });
        if (state.skids.length > 800) state.skids.splice(0, state.skids.length - 800);
      }
      car.lastSkid = { x: bx, y: by };
      if (rng.chance(0.25)) spawnSmoke(bx, by, true);
    } else {
      car.lastSkid = null;
    }
    // Buildings: probe the nose and tail, push the whole car out, pay for the impact.
    const impactSpeed = Math.hypot(car.vx, car.vy);
    for (const s of [-0.32, 0.32]) {
      const px = car.x + nfx * spec.l * s;
      const py = car.y + nfy * spec.l * s;
      const fixed = city.collideCircle(px, py, spec.w * 0.52);
      const dx = fixed.x - px;
      const dy = fixed.y - py;
      if (Math.abs(dx) + Math.abs(dy) > 0.4) {
        car.x += dx;
        car.y += dy;
        if (impactSpeed > 140) {
          damageCar(car, (impactSpeed - 130) * 0.085, false);
          if (car === state.player.car || impactSpeed > 240) {
            if (state.audio) state.audio.crash(impactSpeed > 250);
            spawnParts(car.x + nfx * spec.l * s, car.y + nfy * spec.l * s, 7, '#ffd76a', 130, 0.3);
          }
          state.camShake = Math.min(10, state.camShake + impactSpeed * 0.012);
        }
        car.vx *= 0.42;
        car.vy *= 0.42;
        car.speed *= 0.42;
      }
    }
  }

  // ---------- drivers ----------

  function trafficInit(car) {
    let bestV = null;
    let bestH = null;
    for (const vx of [520, 1160, 1800, 2440, 3080, 3720, 4360]) if (bestV === null || Math.abs(car.x - vx) < Math.abs(car.x - bestV)) bestV = vx;
    for (const hy of [480, 1100, 1720, 2340, 2960, 3520]) if (bestH === null || Math.abs(car.y - hy) < Math.abs(car.y - bestH)) bestH = hy;
    if (Math.abs(car.x - bestV) <= Math.abs(car.y - bestH)) {
      return { axis: 'v', c: bestV, dir: Math.sin(car.angle) >= 0 ? 1 : -1, stuckT: 0, revT: 0 };
    }
    return { axis: 'h', c: bestH, dir: Math.cos(car.angle) >= 0 ? 1 : -1, stuckT: 0, revT: 0 };
  }

  function obstacleAhead(car, reach) {
    const fx = Math.cos(car.angle);
    const fy = Math.sin(car.angle);
    const px = car.x + fx * reach;
    const py = car.y + fy * reach;
    for (const other of state.cars) {
      if (other === car || other.dead) continue;
      if (dist(px, py, other.x, other.y) < 44) return true;
    }
    for (const ped of state.peds) {
      if (ped.dead || ped.car !== null) continue;
      if (dist(px, py, ped.x, ped.y) < 34) return true;
    }
    const p = state.player;
    if (p.car === null && dist(px, py, p.x, p.y) < 36) return true;
    return false;
  }

  function driveTraffic(car, dt) {
    if (car.ai === null || car.ai.axis === undefined) car.ai = trafficInit(car);
    const ai = car.ai;
    // Turn at intersections: when the crossing road is close, sometimes take it.
    const cross = ai.axis === 'v' ? [480, 1100, 1720, 2340, 2960, 3520] : [520, 1160, 1800, 2440, 3080, 3720, 4360];
    const along = ai.axis === 'v' ? car.y : car.x;
    for (const c of cross) {
      if (Math.abs(along - c) < 26 && rng.chance(0.012)) {
        ai.axis = ai.axis === 'v' ? 'h' : 'v';
        ai.c = c;
        ai.dir = rng.chance(0.5) ? 1 : -1;
        break;
      }
    }
    const fwd = ai.axis === 'v' ? { x: 0, y: ai.dir } : { x: ai.dir, y: 0 };
    const right = { x: -fwd.y, y: fwd.x };
    const laneC = ai.c + (ai.axis === 'v' ? right.x * 42 : right.y * 42);
    const tx = ai.axis === 'v' ? laneC : car.x + ai.dir * 340;
    const ty = ai.axis === 'v' ? car.y + ai.dir * 340 : laneC;
    const desired = Math.atan2(ty - car.y, tx - car.x);
    const steer = clamp(angleDiff(desired, car.angle) * 2.1, -1, 1);
    let throttle = 0.72;
    if (Math.abs(angleDiff(desired, car.angle)) > 0.9) throttle = 0.3;
    if (obstacleAhead(car, 84)) throttle = car.speed > 24 ? -0.85 : 0;
    else if (obstacleAhead(car, 150)) throttle = Math.min(throttle, 0.25);
    return { throttle, steer, hand: false };
  }

  function driveFree(car, tx, ty, dt, speedScale = 1) {
    const ai = car.ai ?? (car.ai = { stuckT: 0, revT: 0 });
    const desired = Math.atan2(ty - car.y, tx - car.x);
    const diff = angleDiff(desired, car.angle);
    let steer = clamp(diff * 2.3, -1, 1);
    // If a building blocks the nose, commit to steering around it on one side.
    const fx = Math.cos(car.angle);
    const fy = Math.sin(car.angle);
    if (city.pointInBuilding(car.x + fx * 86, car.y + fy * 86, 6)) {
      if (!ai.avoidDir) ai.avoidDir = rng.chance(0.5) ? 1 : -1;
      steer = ai.avoidDir;
    } else {
      ai.avoidDir = 0;
    }
    let throttle = Math.abs(diff) > 1.15 ? 0.35 : 1;
    throttle *= speedScale;
    if (Math.abs(car.speed) < 10) ai.stuckT += dt;
    else ai.stuckT = 0;
    if (ai.revT > 0) {
      ai.revT -= dt;
      return { throttle: -0.8, steer: -steer, hand: false };
    }
    if (ai.stuckT > 1.5) {
      ai.stuckT = 0;
      ai.revT = 0.7;
    }
    return { throttle, steer, hand: false };
  }

  // ---------- the player ----------

  function playerFire(angle) {
    const p = state.player;
    const w = WEAPONS[p.weapon];
    if (p.fireCd > 0) return;
    if (w.melee) {
      meleeSwing();
      p.fireCd = w.rate;
      return;
    }
    if ((p.ammo[p.weapon] ?? 0) <= 0) {
      if (state.audio) state.audio.dryFire();
      p.fireCd = 0.25;
      return;
    }
    p.ammo[p.weapon] -= 1;
    p.fireCd = w.rate;
    const ox = p.car !== null ? p.car.x : p.x + Math.cos(angle) * 15;
    const oy = p.car !== null ? p.car.y : p.y + Math.sin(angle) * 15;
    fireWeapon(p, ox, oy, angle, p.weapon, 'player');
  }

  function nearestEnterableCar() {
    const p = state.player;
    let best = null;
    let bestD = 58;
    for (const car of state.cars) {
      if (car.dead) continue;
      const d = dist(p.x, p.y, car.x, car.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function enterCar(car) {
    const p = state.player;
    if (car.driver) {
      // Carjacking: the driver comes out the hard way.
      const driver = spawnPed(car.x + Math.cos(car.angle + Math.PI / 2) * 26, car.y + Math.sin(car.angle + Math.PI / 2) * 26, 'civ', { shirt: car.driverColor });
      driver.state = 'flee';
      driver.fleeT = 4;
      driver.tx = driver.x - Math.cos(car.angle) * 200;
      driver.ty = driver.y - Math.sin(car.angle) * 200;
      car.driver = false;
      state.stats.carsStolen += 1;
      crime(car.kind === 'police' ? 42 : 18, car.x, car.y);
      if (state.audio) state.audio.crash(false);
    } else if (car.kind === 'parked' || car.kind === 'traffic') {
      state.stats.carsStolen += 1;
      crime(7, car.x, car.y);
    }
    car.prevKind = car.kind;
    car.kind = 'player';
    car.ai = null;
    p.car = car;
    p.bustedT = 0;
  }

  function exitCar() {
    const p = state.player;
    const car = p.car;
    if (car === null) return;
    const side = Math.PI / 2;
    let px = car.x + Math.cos(car.angle + side) * (CAR_TYPES[car.type].w / 2 + 18);
    let py = car.y + Math.sin(car.angle + side) * (CAR_TYPES[car.type].w / 2 + 18);
    const fixed = city.collideCircle(px, py, 12);
    p.x = fixed.x;
    p.y = fixed.y;
    p.car = null;
    car.kind = car.prevKind === 'traffic' || car.prevKind === undefined ? 'parked' : car.prevKind;
    car.prevKind = undefined;
  }

  function stepPlayer(dt, ctl) {
    const p = state.player;
    p.fireCd = Math.max(0, p.fireCd - dt);
    if (p.car !== null) {
      const car = p.car;
      stepCarPhysics(car, -ctl.my, ctl.mx, ctl.hand, dt);
      p.x = car.x;
      p.y = car.y;
      p.angle = Math.atan2(ctl.aimY - car.y, ctl.aimX - car.x);
      if (ctl.fire && !WEAPONS[p.weapon].melee) playerFire(p.angle);
      if (ctl.interact2) exitCar();
      return;
    }
    const len = Math.hypot(ctl.mx, ctl.my);
    const speed = ctl.sprint ? 268 : 172;
    if (len > 0.01) {
      const nx = (ctl.mx / len) * speed;
      const ny = (ctl.my / len) * speed;
      const moved = city.collideCircle(p.x + nx * dt, p.y + ny * dt, 12);
      p.x = moved.x;
      p.y = moved.y;
      p.walk += speed * dt / 24;
    }
    p.angle = Math.atan2(ctl.aimY - p.y, ctl.aimX - p.x);
    if (ctl.fire) playerFire(p.angle);
    if (ctl.interact) handleInteract();
  }

  function poiNear(id, radius) {
    const poi = city.pois.find((q) => q.id === id);
    return poi !== undefined && dist(state.player.x, state.player.y, poi.door.x, poi.door.y) < radius ? poi : null;
  }

  function handleInteract() {
    const p = state.player;
    if (p.car !== null) return;
    const car = nearestEnterableCar();
    if (car !== null && Math.abs(car.speed) < 85) {
      enterCar(car);
      state.consumedInteract = true;
      return;
    }
    if (poiNear('gunshop', 50)) {
      state.shop = { kind: 'gun', sel: 0, msg: 'Welcome to Harbor Arms. Cash only.' };
      state.consumedInteract = true;
      if (state.audio) state.audio.click();
      return;
    }
    if (poiNear('safehouse', 50)) {
      p.hp = 100;
      state.saveRequest = true;
      setBanner('SAFEHOUSE', 'Rested, healed, and the game is saved');
      state.consumedInteract = true;
      if (state.audio) state.audio.confirm();
    }
  }

  function computePrompt() {
    const p = state.player;
    if (state.dialogue !== null || state.shop !== null) {
      state.prompt = '';
      return;
    }
    if (p.car !== null) {
      const garage = city.pois.find((q) => q.id === 'garage');
      if (garage.lot && p.x > garage.lot.x && p.x < garage.lot.x + garage.lot.w && p.y > garage.lot.y && p.y < garage.lot.y + garage.lot.h) {
        state.prompt = 'E — Velora Auto Works: repairs, paint, lay low';
        return;
      }
      state.prompt = 'F — Exit vehicle';
      return;
    }
    const car = nearestEnterableCar();
    if (car !== null) {
      if (Math.abs(car.speed) >= 85) state.prompt = 'Too fast to grab';
      else if (car.driver) state.prompt = `E — Pull the driver out (${CAR_TYPES[car.type].name})`;
      else state.prompt = `E — Enter ${CAR_TYPES[car.type].name}`;
      return;
    }
    if (poiNear('gunshop', 50)) {
      state.prompt = 'E — Harbor Arms gun shop';
      return;
    }
    if (poiNear('safehouse', 50)) {
      state.prompt = 'E — Rest & save at the safehouse';
      return;
    }
    if (poiNear('garage', 60)) {
      state.prompt = 'Bring a car into the yellow bay for service';
      return;
    }
    state.prompt = '';
  }

  // ---------- cars, peds, police ----------

  function stepCars(dt) {
    const p = state.player;
    for (const car of state.cars) {
      if (car.removeMe) continue;
      if (car.dead) {
        car.vx *= 0.9;
        car.vy *= 0.9;
        car.x += car.vx * dt;
        car.y += car.vy * dt;
        car.speed = 0;
        if (car.boomT > 0) {
          car.boomT -= dt;
          if (car.boomT <= 0 && !car.exploded) {
            car.exploded = true;
            if (p.car === car) {
              exitCar();
              damagePlayer(26);
            }
            explode(car.x, car.y, 135);
          }
        }
        car.fireT -= dt;
        if (car.fireT <= 0 && car.exploded) {
          car.fireT = 0.09;
          spawnParts(car.x + rng.range(-12, 12), car.y + rng.range(-8, 8), 1, rng.pick(['#ff9a3c', '#e5534b', '#ffd76a']), 60, 0.4);
        }
        continue;
      }
      if (car.hp < 55) {
        car.smokeT -= dt;
        if (car.smokeT <= 0) {
          car.smokeT = car.hp < 28 ? 0.06 : 0.16;
          spawnSmoke(car.x, car.y, car.hp < 28);
        }
      }
      let ctl = null;
      if (car.kind === 'player') continue; // stepped with the player
      if (car.kind === 'traffic') ctl = driveTraffic(car, dt);
      else if (car.kind === 'police') {
        if (car.ai?.holdPosition && state.wanted.stars > 0) ctl = { throttle: 0, steer: 0, hand: true };
        else if (state.wanted.stars === 0) ctl = driveTraffic(car, dt);
        else {
          const tx = p.x + (p.car !== null ? p.car.vx * 0.35 : 0);
          const ty = p.y + (p.car !== null ? p.car.vy * 0.35 : 0);
          ctl = driveFree(car, tx, ty, dt, 1.02);
          if (p.car === null && dist(car.x, car.y, p.x, p.y) < 130 && Math.abs(car.speed) < 46 && state.wanted.stars >= 2 && !car.copOut) {
            car.copOut = true;
            const cop = spawnPed(car.x + 24, car.y, 'cop');
            cop.state = 'attack';
          }
        }
      } else if (car.kind === 'gang' || car.kind === 'racer') {
        ctl = driveFree(car, car.ai?.tx ?? p.x, car.ai?.ty ?? p.y, dt, car.ai?.speedScale ?? 1);
        if (car.kind === 'gang') {
          car.fireCd -= dt;
          const d = dist(car.x, car.y, p.x, p.y);
          if (car.fireCd <= 0 && d < 400 && city.losClear(car.x, car.y, p.x, p.y)) {
            car.fireCd = rng.range(0.5, 1.1);
            fireWeapon(car, car.x, car.y, Math.atan2(p.y - car.y, p.x - car.x) + rng.range(-0.09, 0.09), 'smg', 'enemy');
          }
        }
      } else if (car.kind === 'target') {
        const ai = car.ai ?? {};
        const pts = ai.routePts ?? [];
        const target = pts[ai.ri ?? 0];
        if (target === undefined) {
          ctl = { throttle: 0, steer: 0, hand: true };
          car.parkedDone = true;
        } else {
          ctl = driveFree(car, target.x, target.y, dt, ai.speedScale ?? 0.8);
          if (dist(car.x, car.y, target.x, target.y) < 95) ai.ri = (ai.ri ?? 0) + 1;
        }
        car.ai = ai;
      } else if (car.kind === 'parked') {
        if (Math.hypot(car.vx, car.vy) > 2) stepCarPhysics(car, 0, 0, true, dt);
        continue;
      }
      if (ctl !== null) stepCarPhysics(car, ctl.throttle, ctl.steer, ctl.hand, dt);
    }
    // Car against car.
    for (let i = 0; i < state.cars.length; i += 1) {
      const a = state.cars[i];
      if (a.removeMe) continue;
      for (let j = i + 1; j < state.cars.length; j += 1) {
        const b = state.cars[j];
        if (b.removeMe) continue;
        const ra = CAR_TYPES[a.type].l * 0.42;
        const rb = CAR_TYPES[b.type].l * 0.42;
        const d = dist(a.x, a.y, b.x, b.y);
        if (d === 0 || d >= ra + rb) continue;
        const nx = (b.x - a.x) / d;
        const ny = (b.y - a.y) / d;
        const overlap = (ra + rb - d) / 2;
        if (!a.dead) {
          a.x -= nx * overlap;
          a.y -= ny * overlap;
        }
        if (!b.dead) {
          b.x += nx * overlap;
          b.y += ny * overlap;
        }
        const closing = Math.abs((a.vx - b.vx) * nx + (a.vy - b.vy) * ny);
        const swap = (a.vx * nx + a.vy * ny + b.vx * nx + b.vy * ny) / 2;
        if (!a.dead) {
          a.vx += (swap - (a.vx * nx + a.vy * ny)) * nx * 1.4;
          a.vy += (swap - (a.vx * nx + a.vy * ny)) * ny * 1.4;
        }
        if (!b.dead) {
          b.vx += (swap - (b.vx * nx + b.vy * ny)) * nx * 1.4;
          b.vy += (swap - (b.vx * nx + b.vy * ny)) * ny * 1.4;
        }
        if (closing > 95) {
          const dmg = (closing - 85) * 0.09;
          damageCar(a, dmg, b === p.car);
          damageCar(b, dmg, a === p.car);
          if (a === p.car || b === p.car) {
            if (state.audio) state.audio.crash(closing > 230);
            state.camShake = Math.min(10, state.camShake + closing * 0.014);
            const other = a === p.car ? b : a;
            if (other.kind === 'police') crime(24, other.x, other.y);
          }
        }
      }
    }
    // Cars against pedestrians.
    for (const car of state.cars) {
      if (car.removeMe || car.dead || Math.abs(car.speed) < 42) continue;
      for (const ped of state.peds) {
        if (ped.dead || ped.car !== null) continue;
        if (pointInCar(car, ped.x, ped.y, 2)) {
          const dmg = clamp(Math.abs(car.speed) * 0.24, 12, 95);
          damagePed(ped, dmg, car === p.car, car.vx * 0.7, car.vy * 0.7);
          car.vx *= 0.86;
          car.vy *= 0.86;
          if (car === p.car && state.audio) state.audio.crash(false);
        }
      }
      const pl = state.player;
      if (car !== pl.car && pl.car === null && pointInCar(car, pl.x, pl.y, 2)) {
        damagePlayer(clamp(Math.abs(car.speed) * 0.16, 6, 55));
        pl.x += car.vx * 0.06;
        pl.y += car.vy * 0.06;
      }
    }
  }

  function movePed(ped, tx, ty, speed, dt) {
    const d = dist(ped.x, ped.y, tx, ty);
    if (d < 4) return true;
    const vx = ((tx - ped.x) / d) * speed;
    const vy = ((ty - ped.y) / d) * speed;
    const moved = city.collideCircle(ped.x + vx * dt, ped.y + vy * dt, 11);
    ped.x = moved.x;
    ped.y = moved.y;
    ped.angle = Math.atan2(vy, vx);
    ped.walk += speed * dt / 22;
    return d < 16;
  }

  function stepPeds(dt) {
    const p = state.player;
    for (const ped of state.peds) {
      if (ped.dead) {
        ped.deadT += dt;
        continue;
      }
      if (ped.car !== null) {
        ped.x = ped.car.x;
        ped.y = ped.car.y;
        continue;
      }
      ped.fireCd = Math.max(0, ped.fireCd - dt);
      if (ped.kind === 'gang' && ped.state === 'guard') {
        // Posted guards hold their ground until trouble comes to them.
        const d = dist(ped.x, ped.y, p.x, p.y);
        if (d < 430) {
          ped.state = 'attack';
        } else {
          continue;
        }
      }
      if (ped.kind === 'cop' || (ped.kind === 'gang' && ped.state === 'attack')) {
        const target = ped.kind === 'gang' && ped.targetPed && !ped.targetPed.dead ? ped.targetPed : p;
        const tp = target === p && p.car !== null ? p.car : target;
        const d = dist(ped.x, ped.y, tp.x, tp.y);
        const want = ped.kind === 'cop' ? 30 : 230;
        if (d > want + 14) movePed(ped, tp.x, tp.y, ped.kind === 'cop' ? 158 : 148, dt);
        else if (d < want - 30) movePed(ped, ped.x + (ped.x - tp.x), ped.y + (ped.y - tp.y), 90, dt);
        else ped.angle = Math.atan2(tp.y - ped.y, tp.x - ped.x);
        const canShoot = ped.kind === 'cop' ? state.wanted.stars >= 3 : true;
        if (canShoot && ped.fireCd <= 0 && d < 410 && city.losClear(ped.x, ped.y, tp.x, tp.y)) {
          ped.fireCd = rng.range(0.75, 1.5);
          fireWeapon(ped, ped.x, ped.y, Math.atan2(tp.y - ped.y, tp.x - ped.x) + rng.range(-0.08, 0.08), ped.kind === 'gang' ? 'smg' : 'pistol', 'enemy');
        }
        continue;
      }
      if (ped.kind === 'dex' || ped.state === 'follow') {
        const d = dist(ped.x, ped.y, p.x, p.y);
        if (d > 58) movePed(ped, p.x, p.y, d > 260 ? 235 : 165, dt);
        else ped.angle = p.angle;
        continue;
      }
      if (ped.kind === 'named') {
        if (dist(ped.x, ped.y, p.x, p.y) < 130) ped.angle = Math.atan2(p.y - ped.y, p.x - ped.x);
        continue;
      }
      // Civilians: wander the sidewalks, run from trouble.
      if (ped.state === 'flee') {
        ped.fleeT -= dt;
        movePed(ped, ped.tx, ped.ty, 152, dt);
        if (ped.fleeT <= 0) ped.state = 'walk';
        continue;
      }
      ped.targetT -= dt;
      const arrived = movePed(ped, ped.tx, ped.ty, 64, dt);
      if (arrived || ped.targetT <= 0) {
        ped.targetT = rng.range(4, 9);
        for (let tries = 0; tries < 6; tries += 1) {
          const nx = ped.x + rng.range(-320, 320);
          const ny = ped.y + rng.range(-320, 320);
          const g = city.groundAt(nx, ny);
          if (g !== 'building' && g !== 'water') {
            ped.tx = nx;
            ped.ty = ny;
            break;
          }
        }
      }
      // Dodge a car bearing down on them.
      for (const car of state.cars) {
        if (car.dead || Math.abs(car.speed) < 90) continue;
        if (dist(ped.x, ped.y, car.x + car.vx * 0.4, car.y + car.vy * 0.4) < 52) {
          ped.state = 'flee';
          ped.fleeT = 1.2;
          ped.tx = ped.x - car.vy * 0.4 + rng.range(-40, 40);
          ped.ty = ped.y + car.vx * 0.4 + rng.range(-40, 40);
          break;
        }
      }
    }
  }

  function policeSpawnPoint() {
    const p = state.player;
    const a = rng.range(0, Math.PI * 2);
    const raw = { x: p.x + Math.cos(a) * rng.range(700, 880), y: p.y + Math.sin(a) * rng.range(700, 880) };
    const road = city.nearestRoadPoint(clamp(raw.x, 60, WORLD.w - 60), clamp(raw.y, 60, WORLD.h - 60));
    return road;
  }

  function stepPolice(dt) {
    const p = state.player;
    const w = state.wanted;
    state.policeSpawnCd = Math.max(0, state.policeSpawnCd - dt);
    const desired = [0, 2, 3, 5, 6, 8][w.stars];
    let count = 0;
    for (const car of state.cars) if (car.kind === 'police' && !car.dead) count += 1;
    if (w.stars > 0 && count < desired && state.policeSpawnCd <= 0) {
      state.policeSpawnCd = 1.4;
      const s = policeSpawnPoint();
      if (dist(s.x, s.y, p.x, p.y) > 480) {
        const car = spawnCar('police', s.x, s.y, Math.atan2(p.y - s.y, p.x - s.x), { kind: 'police', driver: true });
        car.driverColor = '#274b73';
      }
    }
    // Roadblocks at three stars and up, thrown across the road ahead of a driving player.
    state.blockCd -= dt;
    if (w.stars >= 3 && state.blockCd <= 0 && p.car !== null) {
      state.blockCd = rng.range(17, 28);
      const ahead = { x: p.car.x + Math.cos(p.car.angle) * 660, y: p.car.y + Math.sin(p.car.angle) * 660 };
      const node = city.nodes[city.nearestNode(clamp(ahead.x, 0, WORLD.w), clamp(ahead.y, 0, WORLD.h))];
      if (dist(node.x, node.y, p.x, p.y) > 400) {
        const perp = p.car.angle + Math.PI / 2;
        const blockCars = [];
        for (const off of [-36, 36]) {
          const car = spawnCar('police', node.x + Math.cos(perp) * off, node.y + Math.sin(perp) * off, perp + rng.range(-0.2, 0.2), { kind: 'police', driver: false });
          car.ai = { stuckT: 0, revT: 0, holdPosition: true };
          blockCars.push(car);
        }
        const blockPeds = [];
        for (const off of [-70, 70]) {
          const cop = spawnPed(node.x + Math.cos(perp) * off, node.y + Math.sin(perp) * off, 'cop');
          cop.state = 'attack';
          blockPeds.push(cop);
        }
        state.roadblocks.push({ x: node.x, y: node.y, cars: blockCars, peds: blockPeds });
      }
    }
    for (const block of state.roadblocks) {
      if (dist(block.x, block.y, p.x, p.y) > 1200) {
        for (const car of block.cars) if (!car.dead && car.kind === 'police') car.removeMe = true;
        for (const ped of block.peds) if (!ped.dead) ped.removeMe = true;
        block.gone = true;
      }
    }
    state.roadblocks = state.roadblocks.filter((b) => !b.gone);
    // The helicopter: it does not shoot, it watches — and while it watches, heat never cools.
    if (w.stars >= 4) {
      if (state.heli === null) state.heli = { x: p.x + 640, y: p.y - 460, angle: 0, rotor: 0 };
      const h = state.heli;
      const ax = p.x + Math.cos(state.t * 0.33) * 130;
      const ay = p.y + Math.sin(state.t * 0.33) * 130 - 30;
      const d = dist(h.x, h.y, ax, ay);
      if (d > 8) {
        const sp = Math.min(330, d * 1.6);
        h.x += ((ax - h.x) / d) * sp * dt;
        h.y += ((ay - h.y) / d) * sp * dt;
        h.angle = Math.atan2(ay - h.y, ax - h.x);
      }
      h.rotor += dt * 41;
    } else if (state.heli !== null) {
      const h = state.heli;
      h.x += 330 * dt;
      h.y -= 190 * dt;
      h.rotor += dt * 41;
      if (dist(h.x, h.y, p.x, p.y) > 1500) state.heli = null;
    }
  }

  function stepWanted(dt) {
    const p = state.player;
    const w = state.wanted;
    let seen = false;
    for (const car of state.cars) {
      if (car.kind !== 'police' || car.dead) continue;
      const d = dist(car.x, car.y, p.x, p.y);
      if (d < 175 || (d < 470 && city.losClear(car.x, car.y, p.x, p.y))) {
        seen = true;
        break;
      }
    }
    if (!seen) {
      for (const ped of state.peds) {
        if (ped.kind !== 'cop' || ped.dead) continue;
        const d = dist(ped.x, ped.y, p.x, p.y);
        if (d < 150 || (d < 390 && city.losClear(ped.x, ped.y, p.x, p.y))) {
          seen = true;
          break;
        }
      }
    }
    if (!seen && state.heli !== null && w.stars >= 4 && dist(state.heli.x, state.heli.y, p.x, p.y) < 580) seen = true;
    if (seen) w.seenT = 0;
    else w.seenT += dt;
    if (w.seenT > 5 && w.stars > 0) w.heat = Math.max(0, w.heat - dt * (w.stars >= 3 ? 2.6 : 5.5));
    if (w.floor > 0) w.heat = Math.max(w.heat, w.floor);
    const stars = starsFor(w.heat);
    if (stars > w.stars) {
      if (state.audio) state.audio.starUp();
      state.starFlashT = 1.6;
    }
    w.stars = stars;
    // Busted: an officer close to a slow or on-foot player for too long ends the run.
    if (state.gameOver === null) {
      let threat = false;
      for (const ped of state.peds) {
        if (ped.kind !== 'cop' || ped.dead) continue;
        const d = p.car !== null ? dist(ped.x, ped.y, p.car.x, p.car.y) : dist(ped.x, ped.y, p.x, p.y);
        if (d < (p.car !== null ? 48 : 34)) {
          threat = true;
          break;
        }
      }
      const slowEnough = p.car !== null ? Math.abs(p.car.speed) < 30 : Math.hypot(ctl_last.mx, ctl_last.my) < 0.1;
      if (threat && slowEnough && w.stars > 0) p.bustedT += dt;
      else p.bustedT = Math.max(0, p.bustedT - dt * 1.6);
      if (p.bustedT > 2.2) {
        state.gameOver = 'busted';
        if (state.audio) state.audio.jobFail();
      }
    }
  }

  let ctl_last = { mx: 0, my: 0 };

  // ---------- ambient life ----------

  function stepAmbient(dt) {
    const p = state.player;
    state.trafficCd = Math.max(0, state.trafficCd - dt);
    let traffic = 0;
    for (const car of state.cars) if (car.kind === 'traffic') traffic += 1;
    if (traffic < 13 && state.trafficCd <= 0) {
      state.trafficCd = 0.5;
      const a = rng.range(0, Math.PI * 2);
      const raw = { x: p.x + Math.cos(a) * rng.range(660, 980), y: p.y + Math.sin(a) * rng.range(660, 980) };
      if (raw.x > 40 && raw.x < WORLD.w - 40 && raw.y > 40 && raw.y < WORLD.h - 40) {
        const road = city.nearestRoadPoint(raw.x, raw.y);
        const type = rng.pick(['sedan', 'compact', 'suv', 'van', 'sedan', 'compact', 'taxi']);
        const car = spawnCar(type, road.x, road.y, rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), { kind: 'traffic', driver: true });
        car.ai = trafficInit(car);
      }
    }
    state.pedCd = Math.max(0, state.pedCd - dt);
    let near = 0;
    for (const ped of state.peds) if (ped.kind === 'civ' && dist(ped.x, ped.y, p.x, p.y) < 900) near += 1;
    if (near < 30 && state.pedCd <= 0) {
      state.pedCd = 0.4;
      for (let tries = 0; tries < 6; tries += 1) {
        const a = rng.range(0, Math.PI * 2);
        const nx = p.x + Math.cos(a) * rng.range(420, 760);
        const ny = p.y + Math.sin(a) * rng.range(420, 760);
        const g = city.groundAt(nx, ny);
        if (g === 'sidewalk' || g === 'grass' || g === 'lot' || g === 'sand') {
          spawnPed(nx, ny, 'civ');
          break;
        }
      }
    }
    // Cleanup: far traffic, old bodies, distant police when the heat is off.
    for (const car of state.cars) {
      const d = dist(car.x, car.y, p.x, p.y);
      if (car.kind === 'traffic' && d > 1500) car.removeMe = true;
      if (car.kind === 'police' && d > 1600 && state.wanted.stars === 0) car.removeMe = true;
    }
    for (const ped of state.peds) {
      const d = dist(ped.x, ped.y, p.x, p.y);
      if (ped.kind === 'civ' && d > 1100) ped.removeMe = true;
      if (ped.dead && ped.deadT > 26) ped.removeMe = true;
    }
    state.cars = state.cars.filter((c) => !c.removeMe);
    state.peds = state.peds.filter((q) => !q.removeMe);
  }

  function stepFx(dt) {
    for (const tr of state.tracers) tr.t += dt;
    state.tracers = state.tracers.filter((tr) => tr.t < tr.life);
    for (const f of state.flashes) f.t += dt;
    state.flashes = state.flashes.filter((f) => f.t < f.life);
    for (const part of state.parts) {
      part.t += dt;
      part.vy += (part.grav ?? 0) * dt;
      part.vx *= Math.exp(-(part.drag ?? 0) * dt);
      part.vy *= Math.exp(-(part.drag ?? 0) * dt);
      part.x += part.vx * dt;
      part.y += part.vy * dt;
    }
    state.parts = state.parts.filter((part) => part.t < part.life);
    for (const skid of state.skids) skid.a -= dt * 0.016;
    state.skids = state.skids.filter((s) => s.a > 0.03);
    for (const boom of state.booms) boom.t += dt;
    state.booms = state.booms.filter((b) => b.t < b.life);
    state.camShake = Math.max(0, state.camShake - dt * 22);
    state.starFlashT = Math.max(0, state.starFlashT - dt);
  }

  // ---------- the step ----------

  function step(dt, ctl) {
    ctl_last = ctl;
    state.t += dt;
    state.clock = (state.clock + dt) % 1440;
    const district = city.districtAt(state.player.x, state.player.y);
    if (district !== state.district) {
      state.district = district;
      state.districtT = state.t;
    }
    stepPlayer(dt, ctl);
    stepCars(dt);
    stepPeds(dt);
    stepPolice(dt);
    stepWanted(dt);
    stepAmbient(dt);
    stepFx(dt);
    computePrompt();
    // Garage service is an in-car interaction on the bay.
    const p = state.player;
    if (ctl.interact && p.car !== null && state.shop === null) {
      const garage = city.pois.find((q) => q.id === 'garage');
      if (garage.lot && p.x > garage.lot.x && p.x < garage.lot.x + garage.lot.w && p.y > garage.lot.y && p.y < garage.lot.y + garage.lot.h) {
        state.shop = { kind: 'garage', sel: 0, msg: 'Velora Auto Works. What does she need?' };
        state.consumedInteract = true;
        if (state.audio) state.audio.click();
      }
    }
  }

  function respawn(kind) {
    const p = state.player;
    const poi = city.pois.find((q) => q.id === (kind === 'wasted' ? 'hospital' : 'police'));
    const fee = kind === 'wasted' ? Math.min(p.cash, 120 + Math.floor(p.cash * 0.06)) : Math.min(p.cash, 180);
    p.cash -= fee;
    p.hp = 100;
    p.armor = 0;
    p.dead = false;
    p.bustedT = 0;
    p.car = null;
    p.x = poi.door.x + 16;
    p.y = poi.door.y + 14;
    state.wanted.heat = 0;
    state.wanted.stars = 0;
    state.wanted.floor = 0;
    state.gameOver = null;
    for (const car of state.cars) {
      if (car.kind === 'police' && dist(car.x, car.y, p.x, p.y) < 700) car.removeMe = true;
    }
    for (const ped of state.peds) {
      if (ped.kind === 'cop' && dist(ped.x, ped.y, p.x, p.y) < 500) ped.removeMe = true;
    }
    return fee;
  }

  // ---------- shops ----------

  function buildShopItems(kind) {
    const p = state.player;
    const items = [];
    if (kind === 'gun') {
      for (const key of ['pistol', 'smg', 'shotgun']) {
        const w = WEAPONS[key];
        const lock = key === 'smg' ? 250 : key === 'shotgun' ? 450 : 0;
        if (!p.weapons[key]) {
          items.push({
            label: `Buy ${w.name}`,
            price: w.price,
            note: lock > 0 && p.respect < lock ? `Needs respect ${lock}` : 'Yours to keep',
            disabled: p.cash < w.price || p.respect < lock,
            run() {
              p.cash -= w.price;
              p.weapons[key] = true;
              p.ammo[key] = (p.ammo[key] ?? 0) + w.pack;
              p.weapon = key;
              return `${w.name} bought, with ${w.pack} rounds.`;
            },
          });
        } else {
          items.push({
            label: `${w.name} ammo ×${w.pack}`,
            price: w.ammoPrice,
            note: `You carry ${p.ammo[key] ?? 0}`,
            disabled: p.cash < w.ammoPrice,
            run() {
              p.cash -= w.ammoPrice;
              p.ammo[key] = (p.ammo[key] ?? 0) + w.pack;
              return `${w.pack} rounds added.`;
            },
          });
        }
      }
      items.push({
        label: 'Body armor',
        price: 250,
        note: p.armor >= 100 ? 'Already at full armor' : 'Soaks up gunfire',
        disabled: p.cash < 250 || p.armor >= 100,
        run() {
          p.cash -= 250;
          p.armor = 100;
          return 'Armor fitted. Stay sharp out there.';
        },
      });
    } else {
      const car = p.car;
      if (car !== null) {
        const missing = Math.ceil(car.maxHp - car.hp);
        items.push({
          label: 'Full repair',
          price: Math.max(0, missing * 2),
          note: missing <= 0 ? 'She is already whole' : `Restores ${missing} damage`,
          disabled: missing <= 0 || p.cash < missing * 2,
          run() {
            p.cash -= missing * 2;
            car.hp = car.maxHp;
            car.dead = false;
            return 'Good as new. Dex sends his regards.';
          },
        });
        items.push({
          label: 'Respray',
          price: 80,
          note: 'A new colour fools a tired eye',
          disabled: p.cash < 80,
          run() {
            p.cash -= 80;
            car.color = state.rng.pick(CAR_COLORS.concat(SPORTS_COLORS));
            if (state.wanted.seenT > 2) state.wanted.heat = Math.max(0, state.wanted.heat - 34);
            return 'New paint, lower profile.';
          },
        });
      }
      items.push({
        label: 'Lay low (lose heat)',
        price: 120,
        note: state.wanted.stars === 0 ? 'No heat to lose' : 'Only works while no cop is watching',
        disabled: p.cash < 120 || state.wanted.stars === 0 || state.wanted.seenT < 2,
        run() {
          p.cash -= 120;
          state.wanted.heat = Math.max(0, state.wanted.heat - 65);
          return 'You waited it out in the back room.';
        },
      });
    }
    items.push({ label: 'Leave', price: 0, note: '', disabled: false, run: () => 'close' });
    return items;
  }

  Object.assign(state, {
    spawnCar, spawnPed, addCash, addRespect, setBanner, crime, witnessed,
    damagePlayer, damagePed, damageCar, explode, spawnParts, fireWeapon, meleeSwing, alertPeds, pointInCar,
    step, respawn, buildShopItems, exitCar, trafficInit,
  });

  return state;
}
