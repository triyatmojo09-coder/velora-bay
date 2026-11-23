// VELORA BAY 3D — city builder: grid streets, pastel tower blocks with glowing windows,
// neon signs, palms, streetlights, beach, pier and animated bay water. Sunset grade throughout.
import * as THREE from 'three';
import { CONFIG, PALETTE, toonMat, CHANNELS, inChannel } from './config.js';

function facadeTextures() {
  // FOUR facade variants: facade (light walls, dark windows) + emissive
  // (black, only the lit windows) so windows glow at dusk without any image assets.
  // Large windows (4x8 grid) and varied lit ratios so buildings do not read
  // as a dense checkerboard.
  const W = 128, H = 256, cols = 3, rows = 5;
  const wallBases = ['#fff6ea', '#ffefe0', '#f2fbf5', '#fff8ec'];
  const litRatios = [0.10, 0.16, 0.24, 0.32];
  const unlitCols = ['#a8c8d8', '#9fb8cc', '#b8c4d8', '#a8c8d8'];
  const litCols = ['#ffe9a8', '#ffd98a', '#fff3c4'];
  const mk = (c) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; };
  const variants = [];
  for (let v = 0; v < 4; v++) {
    const face = document.createElement('canvas'); face.width = W; face.height = H;
    const glow = document.createElement('canvas'); glow.width = W; glow.height = H;
    const f = face.getContext('2d'), g = glow.getContext('2d');
    f.fillStyle = wallBases[v]; f.fillRect(0, 0, W, H);
    g.fillStyle = '#000000'; g.fillRect(0, 0, W, H);
    let s = 7 + v * 7919;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const cw = W / cols, ch = H / rows;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      if (rnd() < 0.42) continue; // sparse: most of the wall stays soft blank pastel
      const lit = rnd() < litRatios[v] * 2.2;
      const px = x * cw + 8, py = y * ch + 9, pw = cw - 16, ph = ch - 18;
      if (lit) {
        const lc = litCols[Math.floor(rnd() * litCols.length)];
        f.fillStyle = lc;
        f.fillRect(px, py, pw, ph);
        // slight per-window brightness variation on the glow map
        const bright = 0.8 + rnd() * 0.35;
        const num = parseInt(lc.slice(1), 16);
        const r = Math.min(255, Math.round(((num >> 16) & 255) * bright));
        const gg = Math.min(255, Math.round(((num >> 8) & 255) * bright));
        const b = Math.min(255, Math.round((num & 255) * bright));
        g.fillStyle = `rgb(${r},${gg},${b})`;
        g.fillRect(px, py, pw, ph);
      } else {
        f.fillStyle = unlitCols[Math.floor(rnd() * unlitCols.length)];
        f.fillRect(px, py, pw, ph);
      }
    }
    variants.push({ face: mk(face), glow: mk(glow) });
  }
  return variants;
}

function neonTexture(text, color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const x = c.getContext('2d');
  x.fillStyle = '#160f26'; x.fillRect(0, 0, 512, 96);
  x.font = '64px Cinzel, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
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
  const facades = facadeTextures();

  // --- sky, fog, lights -------------------------------------------------
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 150, 560);
  const gradC = document.createElement('canvas'); gradC.width = 4; gradC.height = 256;
  const gx = gradC.getContext('2d');
  const grad = gx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#2f9be8'); grad.addColorStop(0.34, '#79c4ec'); grad.addColorStop(0.58, '#f2c4d4'); grad.addColorStop(0.8, '#ffd9a8'); grad.addColorStop(1, '#fff0c8');
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

  scene.add(new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 1.6));
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.2);
  sun.position.set(120, 140, -80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -70; sun.shadow.camera.right = 70; sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 420; sun.shadow.bias = -0.0006;
  scene.add(sun); scene.add(sun.target);
  scene.add(new THREE.AmbientLight(0xffe8c8, 0.5));

  // --- ground ------------------------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshLambertMaterial({ color: PALETTE.ground }),
  );
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; ground.receiveShadow = true;
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
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x8a7468 });
  let neonIdx = 0;
  const neonSigns = [];
  for (const bx of CONFIG.BLOCK_CENTERS) {
    for (const bz of CONFIG.BLOCK_CENTERS) {
      if (bx >= 135) continue; // east strip is beachfront promenade, no towers
      if (bz === 81 && bx >= 27) continue; // south bay inlet — open water
      if (bz === -81 && bx >= 81) continue; // north canal — open water
      const walk = new THREE.Mesh(walkGeo, walkMat);
      walk.position.set(bx, 0.06, bz); group.add(walk);
      const lots = [[-10.5, -10.5], [10.5, -10.5], [-10.5, 10.5], [10.5, 10.5]];
      const count = 1 + Math.floor(rng() * 4);
      for (let i = 0; i < count; i++) {
        const [lx, lz] = lots[i];
        const w = 13 + rng() * 5, d = 13 + rng() * 5;
        const downtown = Math.abs(bx) < 60 && Math.abs(bz) < 60;
        const peninsula = bx >= 81 && Math.abs(bz) <= 27; // tallest glass cluster, between the channels
        const residential = bx <= -81; // greener, lower west edge
        const h = peninsula ? 36 + rng() * 26 : downtown ? 22 + rng() * 23 : residential ? 6 + rng() * 8 : 8 + rng() * 20;
        const glassTints = [0x9fd8e8, 0x7ec8e8, 0xbde8ff, 0xe8f4ff, 0xa8e6e0];
        const tint = peninsula
          ? glassTints[Math.floor(rng() * glassTints.length)]
          : PALETTE.buildingPastels[Math.floor(rng() * PALETTE.buildingPastels.length)];
        const variant = facades[Math.floor(rng() * facades.length)];
        const repY = Math.max(1, Math.round(h / 16));
        const faceT = variant.face.clone(); faceT.needsUpdate = true; faceT.repeat.set(2, repY);
        const glowT = variant.glow.clone(); glowT.needsUpdate = true; glowT.repeat.set(2, repY);
        const mat = new THREE.MeshLambertMaterial({
          color: tint, map: faceT, emissive: 0xffffff, emissiveMap: glowT, emissiveIntensity: 0.55,
        });
        const shape = rng();
        let b;
        if (shape < 0.14) {
          // cylindrical tower
          b = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.36, w * 0.42, h, 14), mat);
          b.position.set(bx + lx, h / 2 + 0.15, bz + lz);
        } else {
          b = new THREE.Mesh(boxGeo, [mat, mat, roofMat, roofMat, mat, mat]);
          b.scale.set(w, h, d);
          b.position.set(bx + lx, h / 2 + 0.15, bz + lz);
        }
        b.castShadow = true; b.receiveShadow = true;
        group.add(b);
        colliders.push({ minX: bx + lx - w / 2, maxX: bx + lx + w / 2, minZ: bz + lz - d / 2, maxZ: bz + lz + d / 2 });
        // varied silhouettes: setback tier, sloped prism roof, or rooftop box
        const sil = rng();
        if (sil < 0.38) {
          const tier = new THREE.Mesh(boxGeo, [mat, mat, roofMat, roofMat, mat, mat]);
          const th = 3 + rng() * 6;
          tier.scale.set(w * 0.62, th, d * 0.62); tier.position.set(bx + lx, h + th / 2 + 0.15, bz + lz);
          tier.castShadow = true; group.add(tier);
        } else if (sil < 0.68) {
          const prism = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 1, 1, 4, 1), roofMat);
          prism.scale.set(w * 0.52, 2.6 + rng() * 2, d * 0.52); prism.rotation.y = Math.PI / 4;
          prism.position.set(bx + lx, h + 1.5, bz + lz); prism.castShadow = true; group.add(prism);
        } else if (rng() < 0.6) {
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
  for (let i = 0; i < 22; i++) {
    const px2 = 152 + rng() * 18, pz2 = -170 + rng() * 340;
    if (inChannel(px2, pz2)) continue;
    palm(px2, pz2, (rng() - 0.5) * 0.3);
  }

  // --- fuller trees, grass patches, flowers, drifting clouds ----------------
  const leafMats = [toonMat(0x5ec97a), toonMat(0x7ed491), toonMat(0xffb8c8)];
  const blobGeo = new THREE.SphereGeometry(1, 10, 8);
  function leafyTree(x, z) {
    const t = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 2.4, 6), trunkMat); trunk.position.y = 1.2; t.add(trunk);
    const lm = leafMats[Math.floor(rng() * leafMats.length)];
    for (let i = 0; i < 5; i++) {
      const blob = new THREE.Mesh(blobGeo, lm);
      const a = (i / 5) * 6.28, r = i === 0 ? 0 : 0.95;
      blob.position.set(Math.cos(a) * r, 3 + (i === 0 ? 0.8 : rng() * 0.5), Math.sin(a) * r);
      blob.scale.setScalar(0.95 + rng() * 0.55); blob.castShadow = true; t.add(blob);
    }
    t.position.set(x, 0, z); group.add(t);
  }
  for (let i = 0; i < 42; i++) {
    const westBias = [-135, -81, -135, -81, -27, 27];
    const bx = westBias[Math.floor(rng() * westBias.length)], bz = CONFIG.BLOCK_CENTERS[Math.floor(rng() * CONFIG.BLOCK_CENTERS.length)];
    if (bz === 81 && bx >= 27) continue;
    leafyTree(bx + (rng() - 0.5) * 34, bz + (rng() - 0.5) * 34);
  }
  const grassMat = toonMat(0x8fd67a);
  const flowerMats = [toonMat(0xff5d8f), toonMat(0xffc94d), toonMat(0xffffff), toonMat(0xb388eb)];
  for (let i = 0; i < 40; i++) {
    const gx2 = -165 + rng() * 310, gz2 = -165 + rng() * 330;
    if (inChannel(gx2, gz2)) continue;
    const patch = new THREE.Mesh(new THREE.CircleGeometry(1.6 + rng() * 2.4, 10), grassMat);
    patch.rotation.x = -Math.PI / 2; patch.position.set(gx2, 0.045, gz2); group.add(patch);
    for (let f = 0; f < 4; f++) {
      const dot = new THREE.Mesh(blobGeo, flowerMats[Math.floor(rng() * flowerMats.length)]);
      dot.scale.setScalar(0.13); dot.position.set(gx2 + (rng() - 0.5) * 3, 0.18, gz2 + (rng() - 0.5) * 3); group.add(dot);
    }
  }
  const clouds = [];
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, fog: false });
  for (let i = 0; i < 9; i++) {
    const cl = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const s = new THREE.Mesh(blobGeo, cloudMat);
      s.position.set(j * 2.6 - 4, (rng() - 0.5) * 1.2, (rng() - 0.5) * 2);
      s.scale.set(2.2 + rng() * 1.4, 1.5 + rng() * 0.7, 1.9 + rng() * 0.6); cl.add(s);
    }
    cl.position.set(-260 + rng() * 520, 62 + rng() * 38, -240 + rng() * 480);
    group.add(cl); clouds.push(cl);
  }

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
    color: PALETTE.water, transparent: true, opacity: 0.86, shininess: 160, specular: 0xfff0c8,
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
  // --- beachfront hotels: white/cream mid-rises along the ocean strip --------
  {
    const hotelTints = [0xffffff, 0xfff3e0, 0xffe9ec, 0xe8f4ff, 0xfff8d6];
    for (const bz of CONFIG.BLOCK_CENTERS) {
      if (bz === 81 || bz === -81) continue; // channel rows
      const peninsulaRow = Math.abs(bz) <= 27;
      const hh = peninsulaRow ? 19 + rng() * 9 : 12 + rng() * 9;
      const hw = 15, hd = 24 + rng() * 8;
      const variant = facades[Math.floor(rng() * facades.length)];
      const faceT = variant.face.clone(); faceT.needsUpdate = true; faceT.repeat.set(2, Math.max(1, Math.round(hh / 16)));
      const glowT = variant.glow.clone(); glowT.needsUpdate = true; glowT.repeat.set(2, Math.max(1, Math.round(hh / 16)));
      const hm = new THREE.MeshLambertMaterial({ color: hotelTints[Math.floor(rng() * hotelTints.length)], map: faceT, emissive: 0xffffff, emissiveMap: glowT, emissiveIntensity: 0.5 });
      const hotel = new THREE.Mesh(boxGeo, [hm, hm, roofMat, roofMat, hm, hm]);
      hotel.scale.set(hw, hh, hd); hotel.position.set(145, hh / 2 + 0.15, bz);
      hotel.castShadow = true; hotel.receiveShadow = true; group.add(hotel);
      colliders.push({ minX: 145 - hw / 2, maxX: 145 + hw / 2, minZ: bz - hd / 2, maxZ: bz + hd / 2 });
    }
  }

  // --- inlet channels: water, concrete banks, bridges, reflection streaks ---
  const streaks = [];
  {
    const bankMat = new THREE.MeshLambertMaterial({ color: 0xe8dcc8 });
    const deckMat = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt });
    const railMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const streakCols = [0xffd98a, 0xffffff, 0x7ec8e8, 0xffb8c8, 0xffe9a8];
    for (const ch of CHANNELS) {
      const len = ch.maxX - ch.minX, wid = ch.maxZ - ch.minZ, cx = (ch.minX + ch.maxX) / 2, cz = (ch.minZ + ch.maxZ) / 2;
      const cw = new THREE.Mesh(new THREE.PlaneGeometry(len, wid), waterMat);
      cw.rotation.x = -Math.PI / 2; cw.position.set(cx, 0.1, cz); group.add(cw);
      for (const edge of [ch.minZ - 0.7, ch.maxZ + 0.7]) {
        const bank = new THREE.Mesh(new THREE.BoxGeometry(len, 0.55, 1.4), bankMat);
        bank.position.set(cx, 0.24, edge); group.add(bank);
      }
      for (const bx2 of ch.bridges) {
        const deck = new THREE.Mesh(new THREE.BoxGeometry(16.5, 0.14, wid + 12), deckMat);
        deck.position.set(bx2, 0.03, cz); deck.receiveShadow = true; group.add(deck);
        for (const s of [-1, 1]) {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.75, wid + 12), railMat);
          rail.position.set(bx2 + s * 7.9, 0.5, cz); group.add(rail);
          const py = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 2.2, 8), bankMat);
          py.position.set(bx2 + s * 5, -0.4, cz); group.add(py);
        }
      }
      // fake reflection streaks dancing on the channel water
      for (let i = 0; i < 16; i++) {
        const st = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
          new THREE.MeshBasicMaterial({ color: streakCols[Math.floor(rng() * streakCols.length)], transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }));
        st.rotation.x = -Math.PI / 2;
        st.position.set(ch.minX + 8 + rng() * (len - 16), 0.17, ch.minZ + 3 + rng() * (wid - 6));
        st.scale.set(10 + rng() * 18, 0.9 + rng() * 1.1, 1);
        group.add(st); streaks.push({ m: st.material, base: 0.16 + rng() * 0.2, ph: rng() * 6 });
      }
    }
    // ocean streaks: skyline reflections east of the peninsula + sun glint path
    for (let i = 0; i < 26; i++) {
      const st = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ color: streakCols[Math.floor(rng() * streakCols.length)], transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
      st.rotation.x = -Math.PI / 2;
      const glint = i >= 18;
      st.position.set(glint ? 190 + rng() * 90 : 184 + rng() * 42, 0.17, glint ? -20 - rng() * 90 : -70 + rng() * 150);
      st.scale.set(1 + rng() * 1.4, 7 + rng() * 11, 1);
      if (glint) st.rotation.z = 0.45;
      group.add(st); streaks.push({ m: st.material, base: 0.18 + rng() * 0.22, ph: rng() * 6 });
    }
  }

  scene.add(group);

  let t = 0;
  function update(dt) {
    t += dt;
    water.position.y = 0.12 + Math.sin(t * 0.7) * 0.05;
    waterMat.opacity = 0.82 + Math.sin(t * 0.45) * 0.05;
    waterMat.specular.setHSL(0.09, 0.7, 0.55 + Math.sin(t * 1.3) * 0.18); // animated shimmer
    for (const cl of clouds) { cl.position.x += dt * 1.1; if (cl.position.x > 300) cl.position.x = -300; }
    for (let i = 0; i < streaks.length; i++) streaks[i].m.opacity = streaks[i].base * (0.72 + 0.28 * Math.sin(t * 1.4 + streaks[i].ph));
    for (let i = 0; i < neonSigns.length; i++) {
      neonSigns[i].material.color.setScalar(0.92 + 0.08 * Math.sin(t * 7 + i * 2.4));
    }
  }
  return { group, colliders, water, update, sun };
}
