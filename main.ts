// Velora Bay's gta6-01 entry (Node 22, standard library only). The game is this directory's
// game/ folder — plain static files a desktop browser loads fully offline (game/index.html and
// its ES modules; every picture is drawn on a canvas and every sound is synthesized with
// WebAudio). The only binary assets are the bundled Anton / Rajdhani woff2 faces under
// game/fonts/, verified below like the modules, so the page never fetches a font at runtime.
// This program hands the entry in: it first walks game/ and screenshots/ and verifies the
// entry is whole (the page, its module graph, its fonts, four screenshots inside the scorer's
// size cap), then copies both folders to /output and writes /output/dossier.json, the summary
// the judge reads, with the vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** The game's module graph, in load order — every file the page needs to boot offline. */
const GAME_MODULES = [
  'index.html',
  'src/config.js',
  'src/random.js',
  'src/city.js',
  'src/world.js',
  'src/missions.js',
  'src/audio.js',
  'src/input.js',
  'src/render.js',
  'src/shots.js',
  'src/main.js',
];

/** Bundled typefaces the page loads from game/fonts/ — required, like any module. */
const GAME_FONTS = ['fonts/anton-latin.woff2', 'fonts/rajdhani-600-latin.woff2'];

/** The four screenshots, cover first, matching shots.json. */
const SCREENSHOTS = ['1-title.jpg', '2-chase.jpg', '3-mission.jpg', '4-city.jpg'];

/** The scorer refuses any single screenshot over 256 KiB; the entry checks itself first. */
const SCREENSHOT_MAX_BYTES = 262144;

function listFiles(root, prefix = '') {
  const found = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) found.push(...listFiles(join(root, entry.name), rel));
    else found.push(rel);
  }
  return found;
}

/**
 * Verify the entry before handing it in: every module present and non-empty, every screenshot
 * present and inside the cap. Returns a one-line inventory for the run log.
 */
function verifyEntry(gameDir, shotsDir) {
  const problems = [];
  for (const rel of [...GAME_MODULES, ...GAME_FONTS]) {
    const file = join(gameDir, rel);
    if (!existsSync(file) || statSync(file).size === 0) problems.push(`missing game/${rel}`);
  }
  for (const name of SCREENSHOTS) {
    const file = join(shotsDir, name);
    if (!existsSync(file)) problems.push(`missing screenshots/${name}`);
    else if (statSync(file).size > SCREENSHOT_MAX_BYTES) problems.push(`screenshots/${name} exceeds 256 KiB`);
  }
  if (problems.length > 0) throw new Error(`Velora Bay entry is incomplete: ${problems.join('; ')}`);
  const files = listFiles(gameDir);
  const bytes = files.reduce((sum, rel) => sum + statSync(join(gameDir, rel)).size, 0);
  return `${files.length} game files, ${(bytes / 1024).toFixed(1)} KiB, ${SCREENSHOTS.length} screenshots verified`;
}

console.log(`Velora Bay: ${verifyEntry(join(here, 'game'), join(here, 'screenshots'))}`);

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
