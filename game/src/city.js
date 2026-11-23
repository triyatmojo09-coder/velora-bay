// VELORA BAY 3D — city builder: grid streets, pastel tower blocks with glowing windows,
// neon signs, palms, streetlights, beach, pier and animated bay water. Sunset grade throughout.
import * as THREE from 'three';
import { CONFIG, PALETTE } from './config.js';

function facadeTextures() {
  // One shared pair of canvas textures: facade (light walls, dark windows) + emissive
  // (black, only the lit windows) so windows glow at dusk without any image assets.
  const W = 128, H = 256, cols = 6, rows = 14;
  const face = document.createElement('canvas'); face.width = W; face.height = H;
  const glow = document.createElement('canvas'); glow.width = W; glow.height = H;
  const f = face.getContext('2d'), g = glow.getContext('2d');
  f.fillStyle = '#e8e2da'; f.fillRect(0, 0, W, H);
  g.fillStyle = '#000000'; g.fillRect(0, 0, W, H);
  let s = 7;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const cw = W / cols, ch = H / rows;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const lit = rnd() < 0.42;
    const px = x * cw + 3, py = y * ch + 3, pw = cw - 6, ph = ch - 6;
    f.fillStyle = lit ? '#ffd98a' : '#3a3f52';
    f.fillRect(px, py, pw, ph);
    if (lit) { g.fillStyle = rnd() < 0.5 ? '#ffca7a' : '#fff3c4'; g.fillRect(px, py, pw, ph); }
  }
  const mk = (c) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; };
  return { face: mk(face), glow: mk(glow) };
}

function neonTexture(text, color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const x = c.getContext('2d');
  x.fillStyle = '#160f26'; x.fillRect(0, 0, 512, 96);
  x.font = '64px Anton, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = color; x.shadowBlur = 22; x.fillStyle = color;
  x.fillText(text, 256, 52); x.fillText(text, 256, 52);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const NEON = [
  ['DISCO MARINA', '#ff5d8f'], ['CASINO AZUL', '#39c2ff'], ['HOTEL SOLANA', '#ffc94d'],
  ['PIZZA SOL', '#7dff6a'], ['VELORA MOTORS', '#ff8a3c'],
];

export function buildCity(scene, rng) {
  const group = new THREE.Group();
  const colliders = [];
  const { face, glow } = facadeTextures();

  // --- sky, fog, lights -------------------------------------------------
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 60, 420);
  const gradC = document.createElement('canvas'); gradC.width = 4; gradC.height = 256;
  const gx = gradC.getContext('2d');
  const grad = gx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#241640'); grad.addColorStop(0.55, '#6b2d5c'); grad.addColorStop(0.8, '#e2603f'); grad.addColorStop(1, '#ff9a3c');
  gx.fillStyle = grad; gx.fillRect(0, 0, 4, 256);
  const gradTex = new THREE.CanvasTexture(gradC); gradTex.colorSpace = THREE.SRGBColorSpace;
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(600, 24, 12),
    new THREE.MeshBasicMaterial({ map: gradTex, side: THREE.BackSide, fog: false }),
  );
  group.add(skyDome);
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const rg = x.createRadialGradient(64, 64, 4, 64, 64, 64); rg.addColorStop(0, 'rgba(255,190,90,1)'); rg.addColorStop(0.35, 'rgba(255,140,60,0.55)'); rg.addColorStop(1, 'rgba(255,120,50,0)'); x.fillStyle = rg; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })(),
    transparent: true, fog: false, depthWrite: false,
  }));
  sunSprite.scale.set(190, 190, 1); sunSprite.position.set(430, 62, -190);
  group.add(sunSprite);

  scene.add(new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 0.85));
  const sun = new THREE.DirectionalLight(PALETTE.sun, 1.5);
  sun.position.set(180, 90, -120);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x604a7a, 0.5));

  // --- ground ------------------------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshLambertMaterial({ color: PALETTE.ground }),
  );
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05;
  group.add(ground);

  // --- streets ------------------------------------------------------------
  const asphaltMat = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt });
  const streetGeoV = new THREE.PlaneGeometry(CONFIG.STREET_W, 360);
  const streetGeoH = new THREE.PlaneGeometry(360, CONFIG.STREET_W);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8b34a });
  const dashGeo = new THREE.PlaneGeometry(0.35, 3.4);
  for (const c of CONFIG.STREET_CENTERS) {
    const v = new THREE.Mesh(streetGeoV, asphaltMat);
    v.rotation.x = -Math.PI / 2; v.position.set(c, 0.02, 0); group.add(v);
    const h = new THREE.Mesh(streetGeoH, asphaltMat);
    h.rotation.x = -Math.PI / 2; h.position.set(0, 0.021, c); group.add(h);
    for (let d = -170; d <= 170; d += 12) {
      if (CONFIG.STREET_CENTERS.some((s) => Math.abs(d - s) < 10)) continue;
      const dv = new THREE.Mesh(dashGeo, dashMat);
      dv.rotation.x = -Math.PI / 2; dv.position.set(c, 0.035, d); group.add(dv);
      const dh = new THREE.Mesh(dashGeo, dashMat);
      dh.rotation.x = -Math.PI / 2; dh.rotation.z = Math.PI / 2; dh.position.set(d, 0.035, c); group.add(dh);
    }
  }
  // crosswalk stripes at a few intersections
  const cwMat = new THREE.MeshBasicMaterial({ color: 0xcfc8d8 });
  const cwGeo = new THREE.PlaneGeometry(1.1, 5.6);
  for (const ix of [-54, 0, 54]) for (const iz of [-54, 0, 54]) {
    for (let k = -2; k <= 2; k++) {
      const s = new THREE.Mesh(cwGeo, cwMat);
      s.rotation.x = -Math.PI / 2; s.position.set(ix + k * 2.4, 0.04, iz - 9.6); group.add(s);
    }
  }

  // --- blocks: sidewalks + buildings --------------------------------------
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const walkGeo = new THREE.BoxGeometry(CONFIG.BLOCK + 4, 0.22, CONFIG.BLOCK + 4);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x554a63 });
  let neonIdx = 0;
  const neonSigns = [];
  for (const bx of CONFIG.BLOCK_CENTERS) {
    for (const bz of CONFIG.BLOCK_CENTERS) {
      if (bx >= 135) continue; // east strip is beachfront promenade, no towers
      const walk = new THREE.Mesh(walkGeo, walkMat);
      walk.position.set(bx, 0.06, bz); group.add(walk);
      const lots = [[-10.5, -10.5], [10.5, -10.5], [-10.5, 10.5], [10.5, 10.5]];
      const count = 1 + Math.floor(rng() * 4);
      for (let i = 0; i < count; i++) {
        const [lx, lz] = lots[i];
        const w = 13 + rng() * 5, d = 13 + rng() * 5;
        const downtown = Math.abs(bx) < 60 && Math.abs(bz) < 60;
        const h = downtown ? 22 + rng() * 23 : 8 + rng() * 20;
        const tint = PALETTE.buildingPastels[Math.floor(rng() * PALETTE.buildingPastels.length)];
        const repY = Math.max(1, Math.round(h / 11));
        const faceT = face.clone(); faceT.needsUpdate = true; faceT.repeat.set(2, repY);
        const glowT = glow.clone(); glowT.needsUpdate = true; glowT.repeat.set(2, repY);
        const mat = new THREE.MeshPhongMaterial({
          color: tint, map: faceT, emissive: 0xffffff, emissiveMap: glowT, emissiveIntensity: 0.75, shininess: 4,
        });
        const b = new THREE.Mesh(boxGeo, [mat, mat, roofMat, roofMat, mat, mat]);
        b.scale.set(w, h, d);
        b.position.set(bx + lx, h / 2 + 0.15, bz + lz);
        group.add(b);
        colliders.push({ minX: bx + lx - w / 2, maxX: bx + lx + w / 2, minZ: bz + lz - d / 2, maxZ: bz + lz + d / 2 });
        // rooftop box detail
        if (rng() < 0.6) {
          const ac = new THREE.Mesh(boxGeo, roofMat);
          ac.scale.set(3, 1.2, 3); ac.position.set(bx + lx + (rng() - 0.5) * 6, h + 0.7, bz + lz + (rng() - 0.5) * 6);
          group.add(ac);
        }
        // a handful of neon signs on street-facing walls
        if (neonIdx < NEON.length && h > 16 && rng() < 0.4) {
          const [label, color] = NEON[neonIdx++];
          const tex = neonTexture(label, color);
          const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(13, 2.4),
            new THREE.MeshBasicMaterial({ map: tex, transparent: false }),
          );
          sign.position.set(bx + lx, h * 0.62, bz + lz - d / 2 - 0.15);
          sign.rotation.y = Math.PI;
          group.add(sign); neonSigns.push(sign);
          const glowSpr = new THREE.Sprite(new THREE.SpriteMaterial({
            map: tex, color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false,
          }));
          glowSpr.scale.set(20, 4.5, 1); glowSpr.position.copy(sign.position); glowSpr.position.z -= 0.4;
          group.add(glowSpr);
        }
      }
    }
  }

  // --- palms ---------------------------------------------------------------
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6844 });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2e8b57, side: THREE.DoubleSide });
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 5.4, 6);
  const frondGeo = new THREE.ConeGeometry(0.55, 3.6, 4);
  frondGeo.translate(0, 1.8, 0);
  function palm(x, z, lean) {
    const p = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 2.7; trunk.rotation.z = lean; p.add(trunk);
    const topX = -Math.sin(lean) * 5.2;
    for (let i = 0; i < 6; i++) {
      const f = new THREE.Mesh(frondGeo, frondMat);
      const a = (i / 6) * Math.PI * 2;
      f.position.set(topX, 5.35, 0);
      f.rotation.set(Math.cos(a) * 1.15, 0, Math.sin(a) * 1.15 + lean);
      f.scale.set(0.5, 1, 0.16);
      p.add(f);
    }
    p.position.set(x, 0, z);
    p.rotation.y = rng() * Math.PI * 2;
    group.add(p);
  }
  for (let i = 0; i < 46; i++) {
    const along = -170 + rng() * 340;
    const onV = rng() < 0.5;
    const c = CONFIG.STREET_CENTERS[Math.floor(rng() * CONFIG.STREET_CENTERS.length)];
    if (onV) palm(c + (rng() < 0.5 ? -9.5 : 9.5), along, (rng() - 0.5) * 0.16);
    else palm(along, c + (rng() < 0.5 ? -9.5 : 9.5), (rng() - 0.5) * 0.16);
  }
  for (let i = 0; i < 22; i++) palm(152 + rng() * 18, -170 + rng() * 340, (rng() - 0.5) * 0.3);

  // --- streetlights (emissive only) ----------------------------------------
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3c3648 });
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.09, 5.6, 5);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  const lampGeo = new THREE.SphereGeometry(0.32, 8, 6);
  for (const c of [-108, 0, 108]) {
    for (let d = -160; d <= 160; d += 32) {
      for (const off of [-8.6, 8.6]) {
        const pole = new THREE.Mesh(poleGeo, poleMat); pole.position.set(c + off, 2.8, d); group.add(pole);
        const lamp = new THREE.Mesh(lampGeo, lampMat); lamp.position.set(c + off, 5.7, d); group.add(lamp);
        const pole2 = new THREE.Mesh(poleGeo, poleMat); pole2.position.set(d, 2.8, c + off); group.add(pole2);
        const lamp2 = new THREE.Mesh(lampGeo, lampMat); lamp2.position.set(d, 5.7, c + off); group.add(lamp2);
      }
    }
  }

  // --- beach, water, pier ---------------------------------------------------
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 380),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2; sand.position.set(168, 0.03, 0); group.add(sand);

  const waterMat = new THREE.MeshPhongMaterial({
    color: PALETTE.water, transparent: true, opacity: 0.88, shininess: 120, specular: 0xff9a5c,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(320, 420), waterMat);
  water.rotation.x = -Math.PI / 2; water.position.set(CONFIG.WATER_X + 158, 0.12, 0);
  group.add(water);

  const pierMat = new THREE.MeshLambertMaterial({ color: 0x7a5c3e });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(46, 0.7, 7), pierMat);
  pier.position.set(196, 0.75, 54); group.add(pier);
  for (let px = 178; px <= 216; px += 9.5) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.8, 6), pierMat);
    post.position.set(px, 0, 51); group.add(post);
    const post2 = post.clone(); post2.position.z = 57; group.add(post2);
  }
  scene.add(group);

  let t = 0;
  function update(dt) {
    t += dt;
    water.position.y = 0.12 + Math.sin(t * 0.7) * 0.05;
    waterMat.opacity = 0.84 + Math.sin(t * 0.45) * 0.05;
    for (let i = 0; i < neonSigns.length; i++) {
      neonSigns[i].material.color.setScalar(0.92 + 0.08 * Math.sin(t * 7 + i * 2.4));
    }
  }
  return { group, colliders, water, update };
}
