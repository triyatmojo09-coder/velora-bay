// Velora Bay itself: a dusk-lit coastal city generated from a seed — six districts on a road
// grid, the marina and beach on the east shore, hand-placed landmarks (safehouse, club, garage,
// gun shop, hospital, police station), collision, and the intersection graph the GPS routes over.
import { WORLD, ROADS_V, ROADS_H, ROAD_W, BEACH_X, WATER_X } from './config.js';

const DISTRICT_STYLES = {
  Downtown: { heights: [90, 180], colors: ['#5a6b7d', '#6b7f95', '#4a5a6e', '#7d8ca3', '#54687e'], lots: 2 },
  Uptown: { heights: [40, 95], colors: ['#8a7f72', '#9c8d7a', '#77685c', '#a08b74'], lots: 3 },
  'Palm Heights': { heights: [16, 38], colors: ['#e0cfa8', '#d9b98c', '#cfe0e8', '#f0e2c4', '#e5d3ae'], lots: 4 },
  'Old Town': { heights: [24, 58], colors: ['#b0724a', '#a25b3f', '#c08552', '#8a4f3a', '#bb7a4e'], lots: 4 },
  Portside: { heights: [28, 55], colors: ['#7a6a55', '#5d6b73', '#8c7a5f', '#6b7c85'], lots: 1 },
  'Marina & Beach': { heights: [30, 80], colors: ['#e8e2d4', '#d4e4ea', '#f2ead8'], lots: 2 },
};

export const POIS = [
  { id: 'safehouse', name: "Ray's Safehouse", sign: 'SAFEHOUSE', color: '#39d353', bx: 250, by: 1980, bw: 130, bh: 90, ht: 30, door: { x: 398, y: 2025 } },
  { id: 'club', name: 'The Gilded Eel', sign: 'THE GILDED EEL', color: '#e5534b', bx: 640, by: 1300, bw: 180, bh: 120, ht: 38, door: { x: 730, y: 1442 } },
  { id: 'garage', name: 'Velora Auto Works', sign: 'AUTO WORKS', color: '#f2c94c', bx: 1960, by: 2500, bw: 240, bh: 110, ht: 34, door: { x: 2080, y: 2690 }, lot: { x: 1940, y: 2630, w: 280, h: 150 } },
  { id: 'gunshop', name: 'Harbor Arms', sign: 'HARBOR ARMS', color: '#4fc3f7', bx: 2560, by: 860, bw: 170, bh: 110, ht: 36, door: { x: 2645, y: 988 } },
  { id: 'hospital', name: 'Velora General', sign: 'HOSPITAL', color: '#e8e8e8', bx: 700, by: 640, bw: 190, bh: 110, ht: 44, door: { x: 795, y: 768 } },
  { id: 'police', name: 'VBPD Central', sign: 'POLICE', color: '#3e6fb0', bx: 2560, by: 1830, bw: 190, bh: 120, ht: 42, door: { x: 2655, y: 1968 } },
  { id: 'marina', name: 'Marina Pavilion', sign: 'MARINA', color: '#2f8f8a', bx: 4620, by: 1900, bw: 130, bh: 80, ht: 26, door: { x: 4655, y: 2002 } },
];

export function districtAt(x, y) {
  if (x >= 4300) return 'Marina & Beach';
  if (x < 1560 && y < 820) return 'Palm Heights';
  if (x >= 980 && x < 3260 && y >= 820 && y < 2680) return 'Downtown';
  if (x < 980 && y >= 820) return 'Old Town';
  if (y >= 2680) return 'Portside';
  return 'Uptown';
}

export function buildCity(rng) {
  const buildings = [];
  const props = [];
  const cells = [];
  const piers = [
    { x: BEACH_X, y: 1453, w: 430, h: 54 },
    { x: BEACH_X, y: 1803, w: 430, h: 54 },
    { x: BEACH_X, y: 2153, w: 430, h: 54 },
  ];
  const boats = [];
  for (let i = 0; i < 7; i += 1) {
    const pier = piers[i % piers.length];
    boats.push({
      x: rng.range(4880, 5030),
      y: pier.y + (i % 2 === 0 ? -34 : pier.h + 34),
      angle: rng.range(-0.15, 0.15),
      len: rng.range(44, 72),
      color: rng.pick(['#e8e8e8', '#c22430', '#28418c', '#e8b13a', '#dfe7ea']),
    });
  }

  // Land cells are the rectangles between road spans.
  const xEdges = [0];
  for (const c of ROADS_V) xEdges.push(c - ROAD_W / 2, c + ROAD_W / 2);
  xEdges.push(WORLD.w);
  const yEdges = [0];
  for (const c of ROADS_H) yEdges.push(c - ROAD_W / 2, c + ROAD_W / 2);
  yEdges.push(WORLD.h);

  const parkPoints = [{ x: 1400, y: 800 }, { x: 2700, y: 2600 }];
  const parkingPoints = [{ x: 2100, y: 1400 }, { x: 800, y: 2600 }, { x: 3350, y: 800 }];
  const poiRects = POIS.map((p) => ({ x: p.bx - 200, y: p.by - 200, w: p.bw + 400, h: p.bh + 400 }));

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  for (let i = 0; i < xEdges.length - 1; i += 2) {
    for (let j = 0; j < yEdges.length - 1; j += 2) {
      const cell = { x: xEdges[i], y: yEdges[j], w: xEdges[i + 1] - xEdges[i], h: yEdges[j + 1] - yEdges[j] };
      const cx = cell.x + cell.w / 2;
      const cy = cell.y + cell.h / 2;
      const district = districtAt(cx, cy);
      cell.district = district;
      if (cell.x >= 4445) {
        cell.kind = 'beach';
        cells.push(cell);
        continue;
      }
      if (parkPoints.some((p) => cx > cell.x && cx < cell.x + cell.w && cy > cell.y && cy < cell.y + cell.h && Math.abs(p.x - cx) < 260 && Math.abs(p.y - cy) < 260)) cell.kind = 'park';
      else if (parkingPoints.some((p) => Math.abs(p.x - cx) < 260 && Math.abs(p.y - cy) < 260)) cell.kind = 'parking';
      else if (poiRects.some((r) => rectsOverlap(cell, r))) cell.kind = 'poi';
      else cell.kind = 'blocks';
      cells.push(cell);
      if (cell.kind === 'park') {
        for (let k = 0; k < 12; k += 1) props.push({ type: 'palm', x: rng.range(cell.x + 30, cell.x + cell.w - 30), y: rng.range(cell.y + 30, cell.y + cell.h - 30) });
        continue;
      }
      if (cell.kind !== 'blocks') continue;
      const style = DISTRICT_STYLES[district];
      const inner = { x: cell.x + 36, y: cell.y + 36, w: cell.w - 72, h: cell.h - 72 };
      if (district === 'Portside') {
        // One or two warehouses, plus shipping containers that double as cover and collision.
        const wide = rng.chance(0.5);
        buildings.push(makeBuilding(rng, inner.x, inner.y, wide ? inner.w : inner.w * 0.55, inner.h * rng.range(0.5, 0.8), style, 'warehouse'));
        for (let k = 0; k < 5; k += 1) {
          const cw = 46;
          const ch = 19;
          const px = rng.range(cell.x + 30, cell.x + cell.w - 30 - cw);
          const py = rng.range(cell.y + 30, cell.y + cell.h - 30 - ch);
          const box = { x: px, y: py, w: cw, h: ch, ht: 13, color: rng.pick(['#a34a2e', '#2e5f8a', '#3f7a4d', '#8a8f98', '#7a3b5e']), roof: '', kind: 'container', details: [] };
          if (!buildings.some((b) => rectsOverlap(box, b))) buildings.push(box);
        }
        for (let k = 0; k < 4; k += 1) props.push({ type: 'crate', x: rng.range(cell.x + 40, cell.x + cell.w - 40), y: rng.range(cell.y + 40, cell.y + cell.h - 40) });
        continue;
      }
      const lots = style.lots;
      const cols = lots <= 2 ? lots : 2;
      const rows = lots <= 2 ? 1 : 2;
      const lotW = inner.w / cols;
      const lotH = inner.h / rows;
      for (let a = 0; a < cols; a += 1) {
        for (let b = 0; b < rows; b += 1) {
          if (!rng.chance(0.86)) continue;
          const pad = rng.range(6, 16);
          buildings.push(makeBuilding(rng, inner.x + a * lotW + pad, inner.y + b * lotH + pad, lotW - pad * 2, lotH - pad * 2, style, 'building'));
        }
      }
      if (district === 'Palm Heights') {
        for (let k = 0; k < 4; k += 1) props.push({ type: 'palm', x: rng.range(cell.x + 16, cell.x + cell.w - 16), y: rng.range(cell.y + 16, cell.y + cell.h - 16) });
      }
    }
  }

  // Landmark buildings sit on top of whatever their cell generated: clear the space, then add.
  for (const poi of POIS) {
    for (let i = buildings.length - 1; i >= 0; i -= 1) {
      const b = buildings[i];
      if (rectsOverlap(b, { x: poi.bx - 26, y: poi.by - 26, w: poi.bw + 52, h: poi.bh + 52 })) buildings.splice(i, 1);
    }
    buildings.push({
      x: poi.bx, y: poi.by, w: poi.bw, h: poi.bh, ht: poi.ht, color: poi.color, roof: '#2c2f36',
      kind: 'poi', poiId: poi.id, sign: poi.sign, details: [],
    });
  }

  // Palms down the beach and lamps along every road.
  for (let y = 120; y < WORLD.h - 80; y += rng.range(110, 170)) {
    if (piers.some((p) => y > p.y - 40 && y < p.y + p.h + 40)) continue;
    props.push({ type: 'palm', x: BEACH_X - rng.range(24, 60), y });
  }
  for (const vx of ROADS_V) {
    for (let y = 140; y < WORLD.h; y += 240) props.push({ type: 'lamp', x: vx + (Math.floor(y / 240) % 2 === 0 ? -ROAD_W / 2 - 10 : ROAD_W / 2 + 10), y });
  }
  for (const hy of ROADS_H) {
    for (let x = 200; x < WORLD.w; x += 260) props.push({ type: 'lamp', x, y: hy + (Math.floor(x / 260) % 2 === 0 ? -ROAD_W / 2 - 10 : ROAD_W / 2 + 10) });
  }

  // The GPS graph: one node per intersection, edges along each road.
  const nodes = [];
  const nodeIndex = new Map();
  for (const vx of ROADS_V) {
    for (const hy of ROADS_H) {
      nodeIndex.set(`${vx},${hy}`, nodes.length);
      nodes.push({ x: vx, y: hy, edges: [] });
    }
  }
  function link(ax, ay, bx, by) {
    const a = nodeIndex.get(`${ax},${ay}`);
    const b = nodeIndex.get(`${bx},${by}`);
    nodes[a].edges.push(b);
    nodes[b].edges.push(a);
  }
  for (let i = 0; i < ROADS_V.length; i += 1) {
    for (let j = 0; j < ROADS_H.length - 1; j += 1) link(ROADS_V[i], ROADS_H[j], ROADS_V[i], ROADS_H[j + 1]);
  }
  for (let j = 0; j < ROADS_H.length; j += 1) {
    for (let i = 0; i < ROADS_V.length - 1; i += 1) link(ROADS_V[i], ROADS_H[j], ROADS_V[i + 1], ROADS_H[j]);
  }

  function nearestNode(x, y) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < nodes.length; i += 1) {
      const d = (nodes[i].x - x) ** 2 + (nodes[i].y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  /** A road-following route from A to B as world points (BFS over intersections). */
  function route(x0, y0, x1, y1) {
    const start = nearestNode(x0, y0);
    const goal = nearestNode(x1, y1);
    const prev = new Array(nodes.length).fill(-1);
    const seen = new Array(nodes.length).fill(false);
    const queue = [start];
    seen[start] = true;
    while (queue.length > 0) {
      const cur = queue.shift();
      if (cur === goal) break;
      for (const next of nodes[cur].edges) {
        if (!seen[next]) {
          seen[next] = true;
          prev[next] = cur;
          queue.push(next);
        }
      }
    }
    const points = [{ x: x0, y: y0 }];
    const chain = [];
    let cur = goal;
    while (cur !== -1) {
      chain.push(nodes[cur]);
      if (cur === start) break;
      cur = prev[cur];
    }
    chain.reverse();
    for (const node of chain) points.push({ x: node.x, y: node.y });
    points.push({ x: x1, y: y1 });
    return points;
  }

  function pointInBuilding(x, y, pad = 0) {
    for (const b of buildings) {
      if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
    }
    return null;
  }

  function onPier(x, y) {
    return piers.some((p) => x >= p.x - 4 && x <= p.x + p.w + 4 && y >= p.y - 4 && y <= p.y + p.h + 4);
  }

  function isWater(x, y) {
    return x > WATER_X && !onPier(x, y);
  }

  function isRoad(x, y) {
    for (const vx of ROADS_V) if (Math.abs(x - vx) <= ROAD_W / 2) return true;
    for (const hy of ROADS_H) if (Math.abs(y - hy) <= ROAD_W / 2) return true;
    return false;
  }

  function groundAt(x, y) {
    if (isWater(x, y)) return 'water';
    if (onPier(x, y)) return 'pier';
    if (x > BEACH_X) return 'sand';
    if (isRoad(x, y)) return 'road';
    if (pointInBuilding(x, y)) return 'building';
    for (const cell of cells) {
      if (x >= cell.x && x <= cell.x + cell.w && y >= cell.y && y <= cell.y + cell.h) {
        if (cell.kind === 'park') return 'grass';
        if (cell.kind === 'parking') return 'lot';
        if (cell.district === 'Palm Heights') return 'grass';
        return 'sidewalk';
      }
    }
    return 'grass';
  }

  /** Push a circle out of every building, keep it in the world and out of the sea. */
  function collideCircle(x, y, r) {
    x = Math.max(r, Math.min(WORLD.w - r, x));
    y = Math.max(r, Math.min(WORLD.h - r, y));
    if (isWater(x, y)) x = Math.min(x, WATER_X - r);
    for (const b of buildings) {
      const cx = Math.max(b.x, Math.min(x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(y, b.y + b.h));
      let dx = x - cx;
      let dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        y = cy + (dy / d) * r;
      } else {
        // Centre inside the box: leave by the shallowest side.
        const left = x - b.x;
        const right = b.x + b.w - x;
        const top = y - b.y;
        const bottom = b.y + b.h - y;
        const min = Math.min(left, right, top, bottom);
        if (min === left) x = b.x - r;
        else if (min === right) x = b.x + b.w + r;
        else if (min === top) y = b.y - r;
        else y = b.y + b.h + r;
      }
    }
    return { x, y };
  }

  /** True when nothing solid stands between the two points (sampled every 36 px). */
  function losClear(x0, y0, x1, y1) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(dist / 36));
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      if (pointInBuilding(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 2)) return false;
    }
    return true;
  }

  function nearestRoadPoint(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const vx of ROADS_V) {
      const d = Math.abs(x - vx);
      if (d < bestD) {
        bestD = d;
        best = { x: vx, y: Math.max(0, Math.min(WORLD.h, y)) };
      }
    }
    for (const hy of ROADS_H) {
      const d = Math.abs(y - hy);
      if (d < bestD) {
        bestD = d;
        best = { x: Math.max(0, Math.min(WORLD.w, x)), y: hy };
      }
    }
    return best;
  }

  return {
    buildings, props, cells, piers, boats, nodes, pois: POIS, districtAt,
    route, nearestNode, pointInBuilding, collideCircle, losClear, isWater, isRoad, groundAt, nearestRoadPoint, onPier,
  };
}

function makeBuilding(rng, x, y, w, h, style, kind) {
  const color = rng.pick(style.colors);
  const details = [];
  const n = rng.int(0, 3);
  for (let i = 0; i < n; i += 1) {
    details.push({ dx: rng.range(0.08, 0.8), dy: rng.range(0.08, 0.8), w: rng.range(0.08, 0.2), h: rng.range(0.08, 0.2) });
  }
  return {
    x, y, w: Math.max(24, w), h: Math.max(24, h),
    ht: rng.range(style.heights[0], style.heights[1]),
    color, roof: shade(color, 18), kind, details,
  };
}

/** Lighten a #rrggbb colour by amt (negative darkens). */
export function shade(hex, amt) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return `rgb(${r},${g},${b})`;
}
