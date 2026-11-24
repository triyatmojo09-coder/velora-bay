// VELORA BAY — anime character rig: larger head, slim tall body, layered swaying
// hair, blinking eyes, fluttering scarf + jacket flaps, fully damped fluid animation.
import * as THREE from 'three';
import { toonMat } from './config.js';
const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
const sph = (r, mat, w = 12, h = 9) => new THREE.Mesh(new THREE.SphereGeometry(r, w, h), mat);
const damp = (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt));
export function buildHuman({ shirt = 0x2ec4b6, sleeves = 0xff5d8f, pants = 0x2b2b3a, skin = 0xf2c49b, cap = 0x3a2e4f, hair = null, capOn = false, beard = false, chain = false, hairLen = 0.6, buildW = 1, shoeCol = null } = {}) {
  const g = new THREE.Group();
  const mShirt = toonMat(shirt), mSleeve = toonMat(sleeves), mPants = toonMat(pants);
  // contrasting shoes: explicit colour, else a tasteful complement of the shirt
  const mSkin = toonMat(skin), mHair = toonMat(hair ?? cap), mShoe = toonMat(shoeCol ?? (shirt === 0xffffff || shirt === 0xf2f2f2 ? 0xe84a3c : 0xffffff)), mDark = toonMat(0x2b2135);
  const mBelt = toonMat(0x4a3220), mGold = toonMat(0xffc94d), mTrim = toonMat(sleeves === shirt ? 0xffffff : sleeves);
  const hips = new THREE.Group(); hips.position.y = 1.02; g.add(hips);
  const pelvis = box(0.36, 0.22, 0.24, mPants); pelvis.scale.x = buildW; hips.add(pelvis);
  // belt with gold buckle around the waist
  const belt = box(0.38, 0.07, 0.26, mBelt); belt.scale.x = buildW; belt.position.y = 0.10; hips.add(belt);
  const buckle = box(0.09, 0.05, 0.02, mGold); buckle.position.set(0, 0.10, 0.14); hips.add(buckle);
  const torso = new THREE.Group(); torso.position.y = 0.10; hips.add(torso);
  const chest = box(0.40, 0.52, 0.24, mShirt); chest.position.y = 0.28; chest.scale.x = buildW; torso.add(chest);
  // shirt placket stripe + pocket hint so the torso is not a flat slab
  const placket = box(0.05, 0.44, 0.015, mTrim); placket.position.set(0, 0.28, 0.125); torso.add(placket);
  const pocket = box(0.10, 0.09, 0.015, mTrim); pocket.position.set(-0.11, 0.38, 0.125); torso.add(pocket);
  if (chain) { const ch = box(0.17, 0.045, 0.02, toonMat(0xffc94d)); ch.position.set(0, 0.44, 0.135); ch.rotation.x = 0.25; torso.add(ch); }
  // necklace hint for everyone (thin chain + pendant) — subtle, under the scarf line
  { const nk = box(0.13, 0.03, 0.015, mGold); nk.position.set(0, 0.50, 0.125); nk.rotation.x = 0.3; torso.add(nk); }
  torso.userData.buildW = buildW;
  const flaps = [];
  for (const s of [-1, 1]) { const pivot = new THREE.Group(); pivot.position.set(s * 0.11, 0.06, -0.13); torso.add(pivot); const flap = box(0.18, 0.30, 0.03, mSleeve); flap.position.y = -0.15; pivot.add(flap); flaps.push(pivot); }
  const headG = new THREE.Group(); headG.position.y = 0.60; torso.add(headG);
  const head = sph(0.21, mSkin); head.scale.set(0.92, 1.05, 0.95); head.position.y = 0.20; headG.add(head);
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = box(0.035, 0.075, 0.012, mDark); e.position.set(s * 0.075, 0.22, 0.185); headG.add(e); eyes.push(e);
    const blush = box(0.05, 0.018, 0.01, toonMat(0xff9d9d)); blush.position.set(s * 0.125, 0.13, 0.175); headG.add(blush);
  }
  const mouth = box(0.05, 0.012, 0.01, mDark); mouth.position.set(0, 0.10, 0.19); headG.add(mouth);
  if (beard) { const bd = box(0.20, 0.13, 0.05, toonMat(0xb8b8b8)); bd.position.set(0, 0.03, 0.17); headG.add(bd); }
  if (capOn) {
    const capTop = box(0.36, 0.09, 0.36, mHair); capTop.position.set(0, 0.40, -0.01); headG.add(capTop);
    const brimB = box(0.34, 0.05, 0.20, mHair); brimB.position.set(0, 0.36, -0.26); headG.add(brimB); // backwards cap
  }
  const hairG = new THREE.Group(); headG.add(hairG);
  const crown = sph(0.225, mHair); crown.scale.set(0.98, 1.0, 0.98); crown.position.set(0, 0.27, -0.02); hairG.add(crown);
  const fringe = box(0.34, 0.10, 0.06, mHair); fringe.position.set(0, 0.33, 0.16); fringe.rotation.x = 0.35; hairG.add(fringe);
  const backHair = sph(0.20, mHair); backHair.scale.set(0.95, 0.7 + hairLen * 1.1, 0.7); backHair.position.set(0, 0.10 - hairLen * 0.08, -0.10); hairG.add(backHair);
  for (const s of [-1, 1]) { const lock = box(0.07, 0.16 + hairLen * 0.30, 0.07, mHair); lock.position.set(s * 0.19, 0.14 - hairLen * 0.08, 0.03); hairG.add(lock); }
  const tailSegs = []; let tailParent = new THREE.Group(); tailParent.position.set(0, 0.38, -0.16); hairG.add(tailParent);
  for (let i = 0; i < 3; i++) { const seg = sph(0.085 - i * 0.018, mHair, 9, 7); seg.position.y = -0.10; seg.visible = hairLen > 0.4; tailParent.add(seg); const next = new THREE.Group(); next.position.y = -0.16; tailParent.add(next); tailSegs.push(tailParent); tailParent = next; }
  const scarfMat = toonMat(0xff5d8f);
  const band = box(0.30, 0.09, 0.30, scarfMat); band.position.y = 0.56; torso.add(band);
  const scarfSegs = []; let sp = new THREE.Group(); sp.position.set(0, 0.54, -0.16); torso.add(sp);
  for (let i = 0; i < 3; i++) { const seg = box(0.16 - i * 0.02, 0.20, 0.025, scarfMat); seg.position.y = -0.10; sp.add(seg); const next = new THREE.Group(); next.position.y = -0.19; sp.add(next); scarfSegs.push(sp); sp = next; }
  const rimMat = new THREE.MeshBasicMaterial({ color: 0xffd9a8, side: THREE.BackSide, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
  const rim = sph(0.225, rimMat, 10, 8); rim.scale.set(1.02, 1.12, 1.02); rim.position.copy(head.position); headG.add(rim);
  function arm(side) {
    const sh = new THREE.Group(); sh.position.set(side * 0.26 * buildW, 0.50, 0); torso.add(sh);
    const upper = box(0.11, 0.32, 0.11, mSleeve); upper.position.y = -0.16; sh.add(upper);
    // sleeve trim band at the cuff edge
    const trim = box(0.12, 0.06, 0.12, mTrim); trim.position.y = -0.30; sh.add(trim);
    const el = new THREE.Group(); el.position.y = -0.32; sh.add(el);
    const fore = box(0.095, 0.30, 0.095, mSkin); fore.position.y = -0.15; el.add(fore);
    const hand = sph(0.055, mSkin, 8, 6); hand.position.y = -0.33; el.add(hand);
    if (side > 0) { // watch hint on the right wrist
      const watch = box(0.105, 0.05, 0.105, mDark); watch.position.y = -0.27; el.add(watch);
      const faceW = box(0.05, 0.02, 0.05, mGold); faceW.position.y = -0.245; el.add(faceW);
    }
    return { sh, el };
  }
  function leg(side) {
    const hip = new THREE.Group(); hip.position.set(side * 0.10, -0.06, 0); hips.add(hip);
    const thigh = box(0.135, 0.46, 0.145, mPants); thigh.position.y = -0.23; hip.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -0.46; hip.add(knee);
    const shin = box(0.11, 0.40, 0.12, mSkin); shin.position.y = -0.20; knee.add(shin);
    const shoe = box(0.13, 0.08, 0.27, mShoe); shoe.position.set(0, -0.42, 0.05); knee.add(shoe);
    // white sole stripe under the contrasting shoe
    const sole = box(0.135, 0.03, 0.28, toonMat(0xf2f2f2)); sole.position.set(0, -0.465, 0.05); knee.add(sole);
    return { hip, knee };
  }
  const armL = arm(-1), armR = arm(1); const legL = leg(-1), legR = leg(1);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), new THREE.MeshBasicMaterial({ color: 0x402030, transparent: true, opacity: 0.25, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; g.add(shadow);
  g.traverse((o) => { if (o.isMesh && o !== shadow) o.castShadow = true; });
  return { group: g, hips, torso, headG, armL, armR, legL, legR, hairG, tailSegs, scarfSegs, flaps, eyes };
}
export class Human {
  constructor(opts) { const parts = buildHuman(opts); this.group = parts.group; this.p = parts; this.phase = 0; this.driving = false; this.breath = Math.random() * 6; this.smooth = 0; this.prevSmooth = 0; this.squash = 0; this.hairLag = 0; this.hairVel = 0; this.blinkT = 1 + Math.random() * 3; }
  setArmsDriving(on) { this.driving = on; }
  // locked-character select preview: darken the whole rig to a silhouette
  setSilhouette(on) {
    this.group.traverse((o) => {
      if (!o.isMesh || !o.material || !o.material.color) return;
      if (o.userData.origColor === undefined) o.userData.origColor = o.material.color.getHex();
      o.material.color.setHex(on ? 0x23202e : o.userData.origColor);
    });
  }
  setPose(dt, speedNorm) {
    const p = this.p; dt = Math.min(dt, 0.05); this.breath += dt;
    this.prevSmooth = this.smooth; this.smooth = damp(this.smooth, speedNorm, 8, dt);
    const sN = this.smooth; const accel = (this.smooth - this.prevSmooth) / Math.max(dt, 1e-4);
    this.squash = damp(this.squash, THREE.MathUtils.clamp(-accel * 0.06, -0.10, 0.12), 10, dt);
    const sq = 1 + this.squash; this.group.scale.set(1 - this.squash * 0.6, sq, 1 - this.squash * 0.6);
    const target = -sN * 0.55 + Math.sin(this.breath * 2.1) * 0.05;
    this.hairVel += ((target - this.hairLag) * 42 - this.hairVel * 9) * dt; this.hairLag += this.hairVel * dt;
    p.tailSegs.forEach((seg, i) => { seg.rotation.x = this.hairLag * (0.55 + i * 0.3) + Math.sin(this.breath * 3 + i * 0.9) * 0.06; seg.rotation.z = Math.sin(this.breath * 1.7 + i) * 0.07 * (1 + sN); });
    p.scarfSegs.forEach((seg, i) => { seg.rotation.x = -0.25 - sN * 0.85 + Math.sin(this.breath * 4.2 + i * 1.1) * (0.10 + sN * 0.22) + this.hairLag * 0.4; seg.rotation.z = Math.sin(this.breath * 2.6 + i * 0.8) * 0.10; });
    p.flaps.forEach((f, i) => { f.rotation.x = -sN * 0.5 + Math.sin(this.breath * 3.4 + i * 1.7) * (0.08 + sN * 0.2); });
    this.blinkT -= dt; if (this.blinkT < -0.12) this.blinkT = 1.6 + Math.random() * 3.2;
    const eyeS = this.blinkT < 0 ? 0.12 : 1; p.eyes.forEach((e) => { e.scale.y = damp(e.scale.y, eyeS, 30, dt); });
    if (this.driving) {
      p.armL.sh.rotation.set(damp(p.armL.sh.rotation.x, -0.95, 12, dt), 0, 0.25); p.armR.sh.rotation.set(damp(p.armR.sh.rotation.x, -0.95, 12, dt), 0, -0.25);
      p.armL.el.rotation.x = p.armR.el.rotation.x = -0.25;
      p.legL.hip.rotation.x = p.legR.hip.rotation.x = -1.2; p.legL.knee.rotation.x = p.legR.knee.rotation.x = 1.1;
      p.hips.position.y = damp(p.hips.position.y, 0.66, 12, dt); return;
    }
    if (sN > 0.04) {
      this.phase += dt * (5 + sN * 8) * (0.4 + sN * 0.6);
      const s = Math.sin(this.phase), amp = 0.2 + sN * 0.55, k = 14;
      p.legL.hip.rotation.x = damp(p.legL.hip.rotation.x, s * amp, k, dt); p.legR.hip.rotation.x = damp(p.legR.hip.rotation.x, -s * amp, k, dt);
      p.legL.knee.rotation.x = damp(p.legL.knee.rotation.x, Math.max(0, -s) * 0.8 * (0.4 + sN), k, dt); p.legR.knee.rotation.x = damp(p.legR.knee.rotation.x, Math.max(0, s) * 0.8 * (0.4 + sN), k, dt);
      p.armL.sh.rotation.x = damp(p.armL.sh.rotation.x, -s * amp * 0.85, k, dt); p.armR.sh.rotation.x = damp(p.armR.sh.rotation.x, s * amp * 0.85, k, dt);
      p.armL.sh.rotation.z = damp(p.armL.sh.rotation.z, 0.10 + sN * 0.12, k, dt); p.armR.sh.rotation.z = damp(p.armR.sh.rotation.z, -0.10 - sN * 0.12, k, dt);
      p.armL.el.rotation.x = -0.35 - Math.max(0, -s) * 0.35; p.armR.el.rotation.x = -0.35 - Math.max(0, s) * 0.35;
      p.hips.position.y = 1.02 + Math.abs(Math.cos(this.phase)) * 0.045 - sN * 0.05;
      p.torso.rotation.x = damp(p.torso.rotation.x, 0.08 + sN * 0.16, 8, dt); p.torso.rotation.y = damp(p.torso.rotation.y, s * 0.08, 8, dt); p.torso.rotation.z = damp(p.torso.rotation.z, Math.sin(this.phase) * 0.04, 8, dt);
      p.headG.rotation.x = damp(p.headG.rotation.x, -sN * 0.08, 8, dt);
    } else {
      const b = Math.sin(this.breath * 1.5), k = 7;
      p.legL.hip.rotation.x = damp(p.legL.hip.rotation.x, 0, k, dt); p.legR.hip.rotation.x = damp(p.legR.hip.rotation.x, 0, k, dt);
      p.legL.knee.rotation.x = damp(p.legL.knee.rotation.x, 0.03, k, dt); p.legR.knee.rotation.x = damp(p.legR.knee.rotation.x, 0.03, k, dt);
      p.armL.sh.rotation.x = damp(p.armL.sh.rotation.x, b * 0.045, k, dt); p.armR.sh.rotation.x = damp(p.armR.sh.rotation.x, -b * 0.045, k, dt);
      p.armL.sh.rotation.z = damp(p.armL.sh.rotation.z, 0.07 + b * 0.015, k, dt); p.armR.sh.rotation.z = damp(p.armR.sh.rotation.z, -0.07 - b * 0.015, k, dt);
      p.armL.el.rotation.x = p.armR.el.rotation.x = -0.14;
      p.torso.rotation.x = damp(p.torso.rotation.x, 0.02 + b * 0.012, k, dt); p.torso.rotation.y = damp(p.torso.rotation.y, Math.sin(this.breath * 0.4) * 0.05, k, dt); p.torso.rotation.z = damp(p.torso.rotation.z, 0, k, dt);
      p.hips.position.y = 1.02 + b * 0.012; p.headG.rotation.y = damp(p.headG.rotation.y, Math.sin(this.breath * 0.33) * 0.14, 3, dt);
    }
  }
}
