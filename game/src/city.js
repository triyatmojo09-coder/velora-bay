// VELORA BAY 3D — city builder: grid streets, pastel tower blocks with glowing windows,
// neon signs, palms, streetlights, beach, pier and animated bay water. Sunset grade throughout.
import * as THREE from 'three';
import { CONFIG, PALETTE, toonMat, CHANNELS, inChannel } from './config.js';

function facadeTextures() {
  // SIXTEEN facade variants (anti-slop detail pass): each variant has its own
  // seeded layout — different column/row counts, window sizes, lit ratios,
  // whole dark floors, wide-vs-narrow windows and wall tones — so adjacent
  // buildings never share a window pattern. Facade (lit+unlit on wall) plus
  // emissive (black, lit windows only) so windows glow at dusk.
  const W = 128, H = 256;
  const wallBases = ['#ffeeda', '#ffe6cf', '#e2f7e9', '#ffefd4', '#fff3e0', '#e8f4ff', '#ffe9ec', '#f4ecd8', '#e6f7f0', '#fdf0d5', '#ffe4c8', '#eef6e6', '#fdeeda', '#e3eefc', '#fff6da', '#f9e8d8'];
  const unlitCols = ['#6fa8c4', '#5f96bd', '#7fa6c9', '#4f7fa6', '#8fb8d4', '#5a8ab0'];
  const litCols = ['#ffe9a8', '#ffd98a', '#fff3c4', '#ffca7a'];
  const mk = (c) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; };
  const variants = [];
  for (let v = 0; v < 16; v++) {
    const face = document.createElement('canvas'); face.width = W; face.height = H;
    const glow = document.createElement('canvas'); glow.width = W; glow.height = H;
    const f = face.getContext('2d'), g = glow.getContext('2d');
    f.fillStyle = wallBases[v]; f.fillRect(0, 0, W, H);
    g.fillStyle = '#000000'; g.fillRect(0, 0, W, H);
    let s = 1013 + v * 7919 + v * v * 131;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const cols = 2 + Math.floor(rnd() * 3); // 2..4 columns
    const rows = 4 + Math.floor(rnd() * 4); // 4..7 rows
    const litRatio = 0.08 + rnd() * 0.34;
    const wide = rnd() < 0.35; // some variants use wide picture windows
    const darkFloors = new Set();
    for (let y = 0; y < rows; y++) if (rnd() < 0.16) darkFloors.add(y); // whole floors dark
    const cw = W / cols, ch = H / rows;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      if (rnd() < 0.30) continue; // blank wall patches break the grid
      const insetX = wide ? 4 : 7 + rnd() * 4;
      const insetY = 5 + rnd() * 5;
      const px = x * cw + insetX, py = y * ch + insetY;
      const pw = cw - insetX * 2, ph = ch - insetY * 2;
      const lit = !darkFloors.has(y) && rnd() < litRatio * 2.4;
      if (lit) {
        const lc = litCols[Math.floor(rnd() * litCols.length)];
        f.fillStyle = lc; f.fillRect(px, py, pw, ph);
        const bright = 0.7 + rnd() * 0.5;
        const num = parseInt(lc.slice(1), 16);
        const r = Math.min(255, Math.round(((num >> 16) & 255) * bright));
        const gg = Math.min(255, Math.round(((num >> 8) & 255) * bright));
        const b = Math.min(255, Math.round((num & 255) * bright));
        g.fillStyle = `rgb(${r},${gg},${b})`; g.fillRect(px, py, pw, ph);
        if (rnd() < 0.3) { f.fillStyle = 'rgba(120,80,40,0.35)'; f.fillRect(px + pw / 2 - 1, py, 2, ph); } // mullion hint
      } else {
        f.fillStyle = unlitCols[Math.floor(rnd() * unlitCols.length)];
        f.fillRect(px, py, pw, ph);
        if (rnd() < 0.25) { f.fillStyle = 'rgba(255,255,255,0.35)'; f.fillRect(px, py, pw, 3); } // sill glint
      }
    }
    // subtle horizontal banding so tall repeats do not look tiled
    f.fillStyle = 'rgba(120,80,60,0.10)';
    for (let y = 1; y < rows; y++) f.fillRect(0, y * ch - 1, W, 2);
    variants.push({ face: mk(face), glow: mk(glow) });
  }
  return variants;
}

// Canvas sign texture with neon-glow lettering for shopfronts / billboards.
function signTexture(text, color, bg = '#1d1430', fontPx = 52) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 512, 128);
  x.strokeStyle = color; x.lineWidth = 5; x.strokeRect(8, 8, 496, 112);
  x.font = `900 ${fontPx}px Cinzel, serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = color; x.shadowBlur = 20; x.fillStyle = color;
  x.fillText(text, 256, 68); x.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const SHOPS_SIGNS = [
  ['KAPAL KARAM CAFE', '#2ec4b6'], ['NOODLE LILIN', '#ffc94d'], ['BUNGA BAY FLORIST', '#ff5d8f'],
  ['RAMBUT & RUM', '#7ec8e8'], ['DISKO BAKSO', '#ff8a3c'], ['LAUNDRY LAGUNA', '#b388eb'],
  ['TIKET TERBANG', '#7dff6a'], ['KOPI KARANG', '#ffd98a'], ['SEWA SEPEDA BAY', '#39c2ff'],
  ['GELATO GELOMBANG', '#ff9ebb'], ['BUKU BEKAS BARA', '#ffe9a8'], ['APOTEK OMBAK', '#5fe0d0'],
];
const BILLBOARDS = [
  ['VELORA COLA — RASA OMBAK!', '#ff5d8f'], ['KASINO AZUL — MALAM INI', '#39c2ff'], ['BAY FM 98.7 — MUSIK PANTAI', '#ffc94d'],
];

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
  scene.fog = new THREE.Fog(PALETTE.fog, 420, 1150);
  const gradC = document.createElement('canvas'); gradC.width = 4; gradC.height = 256;
  const gx = gradC.getContext('2d');
  const grad = gx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#1e7cd9'); grad.addColorStop(0.34, '#4fb0ee'); grad.addColorStop(0.58, '#f7a8c4'); grad.addColorStop(0.8, '#ffc98a'); grad.addColorStop(1, '#ffe9b0');
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
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.4);
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
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x7d5f4d });
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
        const glassTints = [0x6fcbe8, 0x3fb6e8, 0x8fd8ff, 0xcfeaff, 0x5fe0d0];
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
        // varied parapet: low / tall / stepped rim around the roof edge
        {
          const pStyle = rng();
          const pH = pStyle < 0.4 ? 0.35 : pStyle < 0.75 ? 0.7 : 1.1;
          const rimMat2 = new THREE.MeshLambertMaterial({ color: tint });
          const rimT = 0.35;
          for (const [rw, rd, ox, oz] of [[w + 0.3, rimT, 0, -d / 2], [w + 0.3, rimT, 0, d / 2], [rimT, d + 0.3, -w / 2, 0], [rimT, d + 0.3, w / 2, 0]]) {
            const rim = new THREE.Mesh(boxGeo, rimMat2);
            rim.scale.set(rw, pH, rd); rim.position.set(bx + lx + ox, h + 0.15 + pH / 2, bz + lz + oz);
            group.add(rim);
          }
          if (pStyle >= 0.75) { // stepped corner caps
            for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
              const cap = new THREE.Mesh(boxGeo, rimMat2);
              cap.scale.set(1.1, 0.55, 1.1); cap.position.set(bx + lx + sx * (w / 2 - 0.3), h + 0.15 + pH + 0.27, bz + lz + sz * (d / 2 - 0.3));
              group.add(cap);
            }
          }
        }
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
        // rooftop props: AC boxes, vents, water towers (hand-dressed skyline)
        {
          const propN = 1 + Math.floor(rng() * 3);
          for (let pi = 0; pi < propN; pi++) {
            const px = bx + lx + (rng() - 0.5) * (w - 5), pz = bz + lz + (rng() - 0.5) * (d - 5);
            const kind = rng();
            if (kind < 0.42) {
              const acb = new THREE.Mesh(boxGeo, roofMat);
              acb.scale.set(1.6 + rng() * 1.6, 0.8 + rng() * 0.7, 1.4 + rng()); acb.position.set(px, h + 0.7, pz);
              acb.rotation.y = rng() * 0.6; group.add(acb);
            } else if (kind < 0.72) {
              const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 1.1, 8), roofMat);
              vent.position.set(px, h + 0.7, pz); group.add(vent);
              const capV = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.22, 8), roofMat);
              capV.position.set(px, h + 1.3, pz); group.add(capV);
            } else if (h > 14) {
              const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 2.1, 10), new THREE.MeshLambertMaterial({ color: 0x9a6a48 }));
              tank.position.set(px, h + 1.9, pz); group.add(tank);
              const cone = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.8, 10), roofMat);
              cone.position.set(px, h + 3.3, pz); group.add(cone);
              for (const [lx2, lz2] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) {
                const leg = new THREE.Mesh(boxGeo, roofMat);
                leg.scale.set(0.16, 0.9, 0.16); leg.position.set(px + lx2, h + 0.45, pz + lz2); group.add(leg);
              }
            }
          }
        }
        // ground-floor storefront on the south face: glass front, striped awning, neon shop sign
        if (h > 7 && rng() < 0.62) {
          const faceZ = bz + lz - d / 2;
          const glassF = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x2a4a5e, emissive: 0xffd98a, emissiveIntensity: 0.28 }));
          glassF.scale.set(Math.min(w * 0.78, 10), 2.5, 0.18); glassF.position.set(bx + lx, 1.45, faceZ - 0.12);
          group.add(glassF);
          const awnCols = [0xff5d8f, 0x2ec4b6, 0xffc94d, 0xff8a3c, 0x7ec8e8];
          const awn = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: awnCols[Math.floor(rng() * awnCols.length)] }));
          awn.scale.set(Math.min(w * 0.82, 10.6), 0.14, 1.7); awn.position.set(bx + lx, 2.95, faceZ - 0.85); awn.rotation.x = -0.32;
          group.add(awn);
          const [shopName, shopCol] = SHOPS_SIGNS[Math.floor(rng() * SHOPS_SIGNS.length)];
          const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 0.8, 10.4), 2.0),
            new THREE.MeshBasicMaterial({ map: signTexture(shopName, shopCol) }));
          sign.position.set(bx + lx, 4.15, faceZ - 0.16); sign.rotation.y = Math.PI;
          group.add(sign); neonSigns.push(sign);
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
    color: PALETTE.water, transparent: true, opacity: 0.92, shininess: 160, specular: 0xfff0c8,
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
    const hotelTints = [0xfff6e8, 0xffe9c4, 0xffd3dc, 0xcfe6ff, 0xfff0a8];
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
      // balconies on the ocean (east) face: slab + railing, staggered per floor
      {
        const balMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const railMat2 = new THREE.MeshLambertMaterial({ color: 0x5a7a8c });
        const floors = Math.floor(hh / 3.1);
        let bs = 31 + bz * 7;
        const brnd = () => { bs = (bs * 16807) % 2147483647; return bs / 2147483647; };
        for (let fl = 1; fl < floors; fl++) {
          for (const off of [-hd * 0.28, 0, hd * 0.28]) {
            if (brnd() < 0.3) continue; // staggered gaps, not a uniform grid
            const slab = new THREE.Mesh(boxGeo, balMat);
            slab.scale.set(1.3, 0.16, 3.4); slab.position.set(145 + hw / 2 + 0.65, fl * 3.1 + 0.4, bz + off);
            group.add(slab);
            const rail = new THREE.Mesh(boxGeo, railMat2);
            rail.scale.set(0.08, 0.55, 3.4); rail.position.set(145 + hw / 2 + 1.28, fl * 3.1 + 0.75, bz + off);
            group.add(rail);
          }
        }
      }
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
        group.add(st); streaks.push({ m: st.material, base: 0.24 + rng() * 0.22, ph: rng() * 6 });
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
      group.add(st); streaks.push({ m: st.material, base: 0.26 + rng() * 0.24, ph: rng() * 6 });
    }
  }

  // --- large original billboards on tall downtown rooftops ------------------
  {
    const spots = [[-27, -27, 34], [27, 27, 40], [-81, 27, 30]];
    BILLBOARDS.forEach(([label, color], i) => {
      const [bx3, bz3, by] = spots[i];
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 7, 8), poleMat);
      pole.position.set(bx3, by, bz3); group.add(pole);
      const board = new THREE.Mesh(new THREE.PlaneGeometry(17, 4.4),
        new THREE.MeshBasicMaterial({ map: signTexture(label, color, '#160f26', 40), side: THREE.DoubleSide }));
      board.position.set(bx3, by + 5.4, bz3); board.rotation.y = i * 0.7 + 0.4;
      group.add(board); neonSigns.push(board);
      const back = new THREE.Mesh(boxGeo, roofMat);
      back.scale.set(17.2, 4.6, 0.25); back.position.copy(board.position); back.rotation.y = board.rotation.y;
      back.translateZ(-0.16); group.add(back);
    });
  }

  // --- street dressing: benches, planters, hydrants, bins, bus stop, papers --
  const boats = [];
  {
    const benchMat = new THREE.MeshLambertMaterial({ color: 0x7a5c3e });
    const metalMat = new THREE.MeshLambertMaterial({ color: 0x4a5a6a });
    const shrubMat = toonMat(0x3f9e57);
    const shrubGeo = new THREE.SphereGeometry(0.55, 8, 6);
    const planterGeo = new THREE.BoxGeometry(1.5, 0.55, 0.7);
    const benchSeatGeo = new THREE.BoxGeometry(2.1, 0.12, 0.55);
    const benchLegGeo = new THREE.BoxGeometry(0.12, 0.45, 0.5);
    // deterministic scatter along sidewalk edges (street centres +/- 9.2)
    let ps = 4242;
    const prnd = () => { ps = (ps * 16807) % 2147483647; return ps / 2147483647; };
    const spots = [];
    for (const c of CONFIG.STREET_CENTERS) {
      for (let d = -150; d <= 150; d += 27) {
        if (CONFIG.STREET_CENTERS.some((s) => Math.abs(d + 6 - s) < 11)) continue;
        spots.push({ x: c + (prnd() < 0.5 ? -9.2 : 9.2), z: d + prnd() * 8, rot: Math.PI / 2 });
        spots.push({ x: d + prnd() * 8, z: c + (prnd() < 0.5 ? -9.2 : 9.2), rot: 0 });
      }
    }
    spots.forEach((sp, i) => {
      if (inChannel(sp.x, sp.z) || sp.x > 140) return;
      const kind = i % 5;
      const g2 = new THREE.Group(); g2.position.set(sp.x, 0.15, sp.z); g2.rotation.y = sp.rot;
      if (kind === 0) { // bench
        const seat = new THREE.Mesh(benchSeatGeo, benchMat); seat.position.y = 0.48; g2.add(seat);
        const back2 = new THREE.Mesh(benchSeatGeo, benchMat); back2.position.set(0, 0.85, -0.24); back2.rotation.x = -0.25; g2.add(back2);
        for (const sx of [-0.85, 0.85]) { const leg = new THREE.Mesh(benchLegGeo, metalMat); leg.position.set(sx, 0.22, 0); g2.add(leg); }
      } else if (kind === 1) { // planter with shrub
        const pl = new THREE.Mesh(planterGeo, new THREE.MeshLambertMaterial({ color: 0xc96f4a })); pl.position.y = 0.28; g2.add(pl);
        const sh = new THREE.Mesh(shrubGeo, shrubMat); sh.position.y = 0.85; sh.scale.set(1.2, 0.8, 0.7); g2.add(sh);
      } else if (kind === 2) { // hydrant
        const hy = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.6, 8), new THREE.MeshLambertMaterial({ color: 0xe84a3c }));
        hy.position.y = 0.3; g2.add(hy);
        const capH = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), metalMat); capH.position.y = 0.62; g2.add(capH);
      } else if (kind === 3) { // trash bin
        const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.85, 10), new THREE.MeshLambertMaterial({ color: 0x3a7d5d }));
        bin.position.y = 0.42; g2.add(bin);
      } else { // newspaper box
        const nb = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.8, 0.45), new THREE.MeshLambertMaterial({ color: [0x39c2ff, 0xffc94d, 0xff5d8f][i % 3] }));
        nb.position.y = 0.4; g2.add(nb);
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.04), new THREE.MeshBasicMaterial({ color: 0xfff6da }));
        win.position.set(0, 0.52, 0.24); g2.add(win);
      }
      group.add(g2);
    });
    // bus-stop shelter on the main east-west avenue
    {
      const sh2 = new THREE.Group(); sh2.position.set(27, 0.15, -9.2);
      const roofS = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.14, 1.7), metalMat); roofS.position.y = 2.5; sh2.add(roofS);
      for (const sx of [-2.4, 2.4]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.5, 6), metalMat); post.position.set(sx, 1.25, -0.6); sh2.add(post); }
      const glassS = new THREE.Mesh(new THREE.BoxGeometry(5.0, 1.7, 0.06), new THREE.MeshLambertMaterial({ color: 0x9fd8e8, transparent: true, opacity: 0.45 }));
      glassS.position.set(0, 1.15, -0.62); sh2.add(glassS);
      const bench2 = new THREE.Mesh(benchSeatGeo, benchMat); bench2.position.set(0, 0.55, -0.3); bench2.scale.x = 2.1; sh2.add(bench2);
      const signB = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.8), new THREE.MeshBasicMaterial({ map: signTexture('BUS — BAY LINE', '#39c2ff', '#1d1430', 44) }));
      signB.position.set(0, 2.0, 0.86); sh2.add(signB);
      group.add(sh2);
    }
    // marina boats bobbing in the south inlet + off the pier
    const hullCols = [0xffffff, 0xff5d8f, 0x39c2ff, 0xffc94d, 0x2ec4b6];
    const boatSpots = [[70, 81], [95, 80], [125, 82], [150, 79], [205, 40], [212, 66]];
    boatSpots.forEach(([bx4, bz4], i) => {
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.8, 1.9), new THREE.MeshLambertMaterial({ color: hullCols[i % hullCols.length] }));
      hull.position.y = 0.35; boat.add(hull);
      const bow = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.95, 1.6, 4), hull.material);
      bow.rotation.z = Math.PI / 2; bow.rotation.y = Math.PI / 4; bow.scale.set(1, 1, 0.55); bow.position.set(3.0, 0.35, 0); boat.add(bow);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.8, 1.4), new THREE.MeshLambertMaterial({ color: 0xffffff }));
      cab.position.set(-0.4, 1.1, 0); boat.add(cab);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.4, 5), metalMat);
      mast.position.set(0.9, 2.2, 0); boat.add(mast);
      boat.position.set(bx4, 0.1, bz4); boat.rotation.y = i * 0.8;
      boat.userData = { baseY: 0.1, ph: i * 1.3, baseRot: boat.rotation.y };
      group.add(boat); boats.push(boat);
    });
    // beach umbrellas + loungers on the sand strip
    const umbCols = [0xff5d8f, 0xffc94d, 0x2ec4b6, 0xff8a3c, 0xb388eb, 0x39c2ff];
    for (let i = 0; i < 14; i++) {
      const ux = 158 + prnd() * 16, uz = -150 + i * 21 + prnd() * 8;
      if (inChannel(ux, uz)) continue;
      const um = new THREE.Group(); um.position.set(ux, 0, uz);
      const poleU = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.1, 5), metalMat); poleU.position.y = 1.05; um.add(poleU);
      const can = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.55, 8), new THREE.MeshLambertMaterial({ color: umbCols[i % umbCols.length] }));
      can.position.y = 2.15; um.add(can);
      const lou = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 1.8), new THREE.MeshLambertMaterial({ color: 0xffffff }));
      lou.position.set(1.2, 0.18, 0.3); lou.rotation.x = -0.18; um.add(lou);
      group.add(um);
    }
  }

  scene.add(group);

  let t = 0;
  function update(dt) {
    t += dt;
    for (const b of boats) {
      b.position.y = b.userData.baseY + Math.sin(t * 1.1 + b.userData.ph) * 0.09;
      b.rotation.z = Math.sin(t * 0.9 + b.userData.ph) * 0.045;
      b.rotation.x = Math.cos(t * 0.7 + b.userData.ph) * 0.03;
    }
    water.position.y = 0.12 + Math.sin(t * 0.7) * 0.05;
    waterMat.opacity = 0.9 + Math.sin(t * 0.45) * 0.04;
    waterMat.specular.setHSL(0.09, 0.7, 0.55 + Math.sin(t * 1.3) * 0.18); // animated shimmer
    for (const cl of clouds) { cl.position.x += dt * 1.1; if (cl.position.x > 300) cl.position.x = -300; }
    for (let i = 0; i < streaks.length; i++) streaks[i].m.opacity = streaks[i].base * (0.72 + 0.28 * Math.sin(t * 1.4 + streaks[i].ph));
    for (let i = 0; i < neonSigns.length; i++) {
      neonSigns[i].material.color.setScalar(0.92 + 0.08 * Math.sin(t * 7 + i * 2.4));
    }
  }
  return { group, colliders, water, update, sun };
}
