// VELORA BAY 3D — articulated low-poly human rig with procedural walk / idle / driving poses.
import * as THREE from 'three';

const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

// Builds a human ~1.8 m tall. Pivot groups: hips at y≈0.95, shoulders, elbows, hip joints.
// shirt/pants/shoes/skin/cap colours are parameters so peds and the player share one rig.
export function buildHuman({ shirt = 0x2ec4b6, sleeves = 0xff5d8f, pants = 0x2b2b3a, skin = 0xd99a6c, cap = 0xffc94d } = {}) {
  const g = new THREE.Group();
  const matShirt = new THREE.MeshLambertMaterial({ color: shirt });
  const matSleeve = new THREE.MeshLambertMaterial({ color: sleeves });
  const matPants = new THREE.MeshLambertMaterial({ color: pants });
  const matSkin = new THREE.MeshLambertMaterial({ color: skin });
  const matCap = new THREE.MeshLambertMaterial({ color: cap });
  const matShoe = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });

  const hips = new THREE.Group(); hips.position.y = 0.98; g.add(hips);
  const pelvis = box(0.42, 0.24, 0.26, matPants); pelvis.position.y = 0.02; hips.add(pelvis);

  const torso = new THREE.Group(); torso.position.y = 0.12; hips.add(torso);
  const chest = box(0.46, 0.58, 0.28, matShirt); chest.position.y = 0.32; torso.add(chest);

  const headG = new THREE.Group(); headG.position.y = 0.68; torso.add(headG);
  const head = box(0.3, 0.34, 0.3, matSkin); head.position.y = 0.2; headG.add(head);
  const capTop = box(0.34, 0.09, 0.34, matCap); capTop.position.y = 0.4; headG.add(capTop);
  const brim = box(0.34, 0.05, 0.22, matCap); brim.position.set(0, 0.35, 0.26); headG.add(brim);

  function arm(side) { // side: -1 left, +1 right
    const sh = new THREE.Group(); sh.position.set(side * 0.3, 0.56, 0); torso.add(sh);
    const upper = box(0.13, 0.36, 0.13, matSleeve); upper.position.y = -0.18; sh.add(upper);
    const el = new THREE.Group(); el.position.y = -0.36; sh.add(el);
    const fore = box(0.11, 0.34, 0.11, matSkin); fore.position.y = -0.17; el.add(fore);
    const hand = box(0.11, 0.1, 0.11, matSkin); hand.position.y = -0.38; el.add(hand);
    return { sh, el };
  }
  function leg(side) {
    const hip = new THREE.Group(); hip.position.set(side * 0.12, -0.08, 0); hips.add(hip);
    const thigh = box(0.16, 0.5, 0.17, matPants); thigh.position.y = -0.25; hip.add(thigh);
    const shin = box(0.13, 0.4, 0.14, matPants); shin.position.y = -0.68; hip.add(shin);
    const shoe = box(0.15, 0.09, 0.3, matShoe); shoe.position.set(0, -0.9, 0.06); hip.add(shoe);
    return hip;
  }
  const armL = arm(-1), armR = arm(1);
  const legL = leg(-1), legR = leg(1);

  // soft blob shadow (fake AO — real shadow maps are off for performance)
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; g.add(shadow);

  return { group: g, hips, torso, headG, armL, armR, legL, legR };
}

export class Human {
  constructor(opts) {
    const parts = buildHuman(opts);
    this.group = parts.group;
    this.p = parts;
    this.phase = 0;
    this.driving = false;
    this.breath = Math.random() * 6;
  }
  setArmsDriving(on) { this.driving = on; }
  // walkPhase advances with distance travelled; speedNorm 0..1 (0 = idle)
  setPose(dt, speedNorm) {
    const p = this.p;
    this.breath += dt;
    if (this.driving) {
      p.armL.sh.rotation.set(-0.95, 0, 0.25); p.armR.sh.rotation.set(-0.95, 0, -0.25);
      p.armL.el.rotation.x = -0.25; p.armR.el.rotation.x = -0.25;
      p.legL.rotation.x = -1.25; p.legR.rotation.x = -1.25;
      p.hips.position.y = 0.62;
      return;
    }
    p.hips.position.y = 0.98;
    if (speedNorm > 0.03) {
      this.phase += dt * (4 + speedNorm * 7);
      const s = Math.sin(this.phase), amp = 0.25 + speedNorm * 0.45;
      p.legL.rotation.x = s * amp;
      p.legR.rotation.x = -s * amp;
      p.armL.sh.rotation.x = -s * amp * 0.8;
      p.armR.sh.rotation.x = s * amp * 0.8;
      p.armL.el.rotation.x = -0.3 - Math.max(0, -s) * 0.3;
      p.armR.el.rotation.x = -0.3 - Math.max(0, s) * 0.3;
      p.hips.position.y = 0.98 + Math.abs(Math.cos(this.phase)) * 0.05;
      p.torso.rotation.x = 0.06 + speedNorm * 0.08;
      p.torso.rotation.y = s * 0.06;
    } else {
      const b = Math.sin(this.breath * 1.6) * 0.02;
      p.legL.rotation.x *= 0.8; p.legR.rotation.x *= 0.8;
      p.armL.sh.rotation.x = b; p.armR.sh.rotation.x = -b;
      p.armL.el.rotation.x = -0.12; p.armR.el.rotation.x = -0.12;
      p.torso.rotation.x = 0.02; p.torso.rotation.y *= 0.9;
      p.hips.position.y = 0.98 + b * 0.4;
    }
  }
}
