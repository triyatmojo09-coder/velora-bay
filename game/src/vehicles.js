// VELORA BAY 3D — cars: mesh builder, arcade car physics, traffic AI and police pursuit AI.
import * as THREE from 'three';
import { CONFIG, clamp, angleDiff, collideCircle, toonMat, inChannel } from './config.js';

const CAR_COLORS = [0xe84a6f, 0x3fa7d6, 0xf2b138, 0x7bc950, 0xb388eb, 0xf2f2f2, 0x2ec4b6, 0xe86a3c, 0x8d99ae];

export function buildCar(color, { police = false, taxi = false } = {}) {
  const g = new THREE.Group();
  const paint = toonMat(color);
  const dark = toonMat(0x2b2b3a);
  const glass = toonMat(0x9fd8e8);

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4.3), paint);
  body.position.y = 0.55; g.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 0.7), paint);
  nose.position.set(0, 0.48, 2.3); g.add(nose);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.52, 2.1), glass);
  cabin.position.set(0, 1.05, -0.25); g.add(cabin);
  if (police) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.3, 2.0), toonMat(0xf4f4f4));
    band.position.set(0, 0.58, -0.2); g.add(band);
  }
  if (taxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.34),
      new THREE.MeshBasicMaterial({ color: 0xffd23c }));
    sign.position.set(0, 1.42, -0.25); g.add(sign);
  }
  // lights
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tlMat = new THREE.MeshBasicMaterial({ color: 0xff2a3c });
  for (const sx of [-0.62, 0.62]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.06), hlMat);
    hl.position.set(sx, 0.62, 2.66); g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.06), tlMat);
    tl.position.set(sx, 0.66, -2.16); g.add(tl);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  const wheelPos = [[-0.92, 1.45], [0.92, 1.45], [-0.92, -1.45], [0.92, -1.45]];
  for (let i = 0; i < 4; i++) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.position.set(wheelPos[i][0], 0.36, wheelPos[i][1]);
    g.add(w); wheels.push(w);
  }
  let lightbar = null, lbRed = null, lbBlue = null;
  if (police) {
    lightbar = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.4), dark);
    lightbar.add(base);
    lbRed = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.36), new THREE.MeshBasicMaterial({ color: 0xff2233 }));
    lbRed.position.set(-0.3, 0.12, 0); lightbar.add(lbRed);
    lbBlue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.36), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    lbBlue.position.set(0.3, 0.12, 0); lightbar.add(lbBlue);
    lightbar.position.set(0, 1.38, -0.25);
    g.add(lightbar);
  }
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(2.5, 18),
    new THREE.MeshBasicMaterial({ color: 0x402030, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.04; shadow.scale.set(0.85, 1.7, 1);
  g.add(shadow);
  // rounded roofline hint + cast shadows for a softer anime silhouette
  const roofRound = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), paint);
  roofRound.scale.set(0.95, 0.28, 1.15); roofRound.position.set(0, 1.28, -0.25); g.add(roofRound);
  g.traverse((o) => { if (o.isMesh && o !== shadow) o.castShadow = true; });
  return { group: g, wheels, lbRed, lbBlue };
}

// Arcade car simulation: position/heading/speed with AABB collision push-out.
export class CarSim {
  constructor(x, z, heading, color, opts = {}) {
    const built = buildCar(color, opts);
    this.group = built.group;
    this.wheels = built.wheels;
    this.lbRed = built.lbRed; this.lbBlue = built.lbBlue;
    this.pos = { x, z };
    this.heading = heading;
    this.speed = 0;
    this.steerVis = 0;
    this.maxSpeed = opts.police ? 42 : CONFIG.CAR_MAX_SPEED;
    this.isPolice = !!opts.police;
    this.syncMesh();
  }
  syncMesh() {
    this.group.position.set(this.pos.x, 0, this.pos.z);
    this.group.rotation.y = this.heading;
  }
  // input: {throttle:-1..1, steer:-1..1, handbrake:bool}; returns true if it hit something hard.
  update(input, dt, colliders) {
    const accel = this.isPolice ? 26 : CONFIG.CAR_ACCEL;
    if (input.throttle > 0) this.speed += accel * input.throttle * dt * (1 - Math.max(0, this.speed) / (this.maxSpeed + 14));
    else if (input.throttle < 0) {
      if (this.speed > 0.5) this.speed -= 34 * dt; // brake
      else this.speed += 14 * input.throttle * dt * (1 - Math.max(0, -this.speed) / (CONFIG.CAR_REVERSE + 4));
    } else {
      this.speed -= this.speed * 0.55 * dt; // drag
      if (Math.abs(this.speed) < 0.04) this.speed = 0;
    }
    if (input.handbrake) this.speed -= this.speed * 2.4 * dt;
    this.speed = clamp(this.speed, -CONFIG.CAR_REVERSE, this.maxSpeed);
    const speedNorm = clamp(Math.abs(this.speed) / 12, 0, 1);
    const steerAngle = input.steer * 0.62 * (input.handbrake ? 1.5 : 1);
    if (Math.abs(this.speed) > 0.05) {
      this.heading += steerAngle * (this.speed / 3.4) * dt * (this.speed >= 0 ? 1 : -1) * (0.45 + 0.55 * speedNorm);
    }
    this.steerVis += ((input.steer * 0.45) - this.steerVis) * Math.min(1, dt * 10);
    const nx = this.pos.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.pos.z + Math.cos(this.heading) * this.speed * dt;
    const before = Math.abs(this.speed);
    this.pos.x = nx; this.pos.z = nz;
    const hit = collideCircle(this.pos, 1.7, colliders);
    if (hit && before > 6) { this.speed *= 0.35; this.syncMesh(); return true; }
    if (hit) this.speed *= 0.7;
    // wheel visuals
    const spin = this.speed * dt / 0.36;
    for (let i = 0; i < 4; i++) {
      this.wheels[i].rotation.x += spin;
      if (i < 2) this.wheels[i].rotation.y = this.steerVis;
    }
    this.syncMesh();
    return false;
  }
  flashLightbar(t) {
    if (!this.lbRed) return;
    const on = Math.sin(t * 11) > 0;
    this.lbRed.material.color.setHex(on ? 0xff2233 : 0x551118);
    this.lbBlue.material.color.setHex(on ? 0x112255 : 0x2266ff);
  }
}

// Steer a CarSim toward a world target point; returns the input for CarSim.update.
export function steerTo(sim, tx, tz, dt, opts = {}) {
  const dx = tx - sim.pos.x, dz = tz - sim.pos.z;
  const dist = Math.hypot(dx, dz);
  const targetHeading = Math.atan2(dx, dz);
  const diff = angleDiff(sim.heading, targetHeading);
  const steer = clamp(diff * 1.6, -1, 1);
  let throttle = dist > 4 ? 1 : 0.4;
  if (Math.abs(diff) > 2.2 && sim.speed > 4) throttle = -0.4; // too sharp: brake/reverse a touch
  if (opts.cruise) throttle = Math.min(throttle, opts.cruise);
  if (opts.stopAt && dist < opts.stopAt) throttle = sim.speed > 1 ? -0.6 : 0;
  return { input: { throttle, steer, handbrake: Math.abs(diff) > 1.15 && sim.speed > 13 }, dist };
}

// Traffic car: loops the street grid, turning at intersections, easing off near the player.
export class TrafficCar {
  constructor(x, z, heading, color, rng) {
    this.sim = new CarSim(x, z, heading, color, { taxi: rng() < 0.18 });
    this.rng = rng;
    this.target = null;
    this.pickTarget();
    this.crashCooldown = 0;
  }
  pickTarget() {
    // next waypoint: drive to a far intersection along the current axis, in a driving lane (+3 offset)
    const s = this.sim;
    const centers = CONFIG.STREET_CENTERS;
    const horiz = Math.abs(Math.sin(s.heading)) > 0.7; // moving along x
    if (horiz) {
      const dir = Math.sign(Math.sin(s.heading)) || 1;
      const cz = centers.reduce((a, b) => (Math.abs(b - s.pos.z) < Math.abs(a - s.pos.z) ? b : a));
      const ahead = centers.filter((c) => (c - s.pos.x) * dir > 20);
      const cx = ahead.length ? ahead[Math.floor(this.rng() * ahead.length)] : s.pos.x + dir * 80;
      this.target = { x: cx, z: cz + 3 * dir };
    } else {
      const dir = Math.sign(Math.cos(s.heading)) || 1;
      const cx = centers.reduce((a, b) => (Math.abs(b - s.pos.x) < Math.abs(a - s.pos.x) ? b : a));
      const ahead = centers.filter((c) => (c - s.pos.z) * dir > 20);
      const cz = ahead.length ? ahead[Math.floor(this.rng() * ahead.length)] : s.pos.z + dir * 80;
      this.target = { x: cx - 3 * dir, z: cz };
    }
  }
  update(dt, colliders, playerPos) {
    this.crashCooldown = Math.max(0, this.crashCooldown - dt);
    const { input, dist } = steerTo(this.sim, this.target.x, this.target.z, dt, { cruise: 0.55 });
    if (playerPos) {
      const pd = Math.hypot(playerPos.x - this.sim.pos.x, playerPos.z - this.sim.pos.z);
      if (pd < 9) input.throttle = Math.min(input.throttle, 0.05);
    }
    const crashed = this.sim.update(input, dt, colliders);
    if (dist < 7) this.pickTarget();
    return crashed;
  }
}

export function parkedCars(rng) {
  const cars = [];
  const spots = [];
  for (let i = 0; i < CONFIG.PARKED_COUNT; i++) {
    const vertical = rng() < 0.5;
    const c = CONFIG.STREET_CENTERS[1 + Math.floor(rng() * 5)];
    const along = -150 + rng() * 300;
    if (CONFIG.STREET_CENTERS.some((s) => Math.abs(along - s) < 11)) continue;
    const side = rng() < 0.5 ? -5.4 : 5.4;
    const x = vertical ? c + side : along;
    const z = vertical ? along : c + side;
    if (inChannel(x, z)) continue;
    const heading = vertical ? (side > 0 ? Math.PI : 0) : (side > 0 ? -Math.PI / 2 : Math.PI / 2);
    const color = CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)];
    const sim = new CarSim(x, z, heading, color, { taxi: rng() < 0.15 });
    sim.parked = true;
    cars.push(sim); spots.push(sim);
  }
  return cars;
}

export { CAR_COLORS };
