[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/triyatmojo09-coder/velora-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/triyatmojo09-coder/velora-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# VELORA BAY — Every Tide Brings Trouble

A **full 3D third-person open-world crime game**, rebuilt from scratch on Three.js
(vendored under `game/vendor/` — no downloads, no network, fully offline). You walk,
sprint, carjack and drive through a sunset-drenched coastal city of pastel towers,
glowing windows, neon signs, palm-lined streets, a beach and a pier — while the VBPD
watches, pursues, and rams.

**Art direction — golden hour in a Vice city.** A gradient dusk sky with fog, a low
orange sun, emissive lit windows on every tower, neon signage (Disco Marina, Casino
Azul, Hotel Solana, Pizza Sol, Velora Motors), animated teal bay water, blob shadows
instead of shadow maps for speed, and a DOM HUD in Anton + Rajdhani (both bundled
locally) with a live canvas minimap.

## What's in the game

- **A real 3D city** — a 7×7 street grid (~360 m across) of city blocks with sidewalk
  aprons, crosswalks, lane dashes, streetlights, ~46 street palms plus beach palms,
  hundreds of collidable buildings, a sand beach, animated water and a wooden pier.
- **Third-person on foot** — an articulated low-poly character with a procedural walk
  cycle, sprint, idle breathing and a driving pose; orbit camera with mouse drag,
  wheel zoom and auto-follow that eases in behind you as you move.
- **Driving & carjacking** — arcade car physics (acceleration, drift handbrake,
  AABB collision push-out, spinning/steering wheels) across your own car, 10 AI
  traffic cars looping the grid, and ~14 parked cars. Walk up to **any** car and
  press F to take it — if someone sees you, that's a crime.
- **The VBPD wanted system, 0–5 stars** — witnessed carjacks, collisions and
  pedestrian strikes add heat; up to 4 police units spawn and pursue with ramming
  AI and flashing red/blue lightbars. Break line of sight for 12 seconds and a star
  fades. Get wrecked and you're **WASTED** — you wake up at the hospital, poorer.
- **Three story jobs** at the gold beacon — *Marina Run* (a timed pier pickup and
  downtown delivery, $400), *Checkpoint Rush* (six checkpoints against the clock,
  $600), and *Heat Escape* (reach 3 stars, then lose the heat completely, $800).
- **Respect ranks** — Nobody → Runner → Wheelman → Hustler → Fixer → Shot Caller →
  Underboss → Kingpin of Velora, tracked in the HUD; progress autosaves to
  `localStorage` after every job (Continue on the title screen).
- **Pedestrians** — ten citizens wander the sidewalks, and scatter when a fast car
  comes at them.
- **Synthesized sound** — a WebAudio engine voice tied to speed, distance-based
  two-tone sirens, success/fail jingles and crash thuds. No audio files.
- **HUD & minimap** — cash, respect bar and rank, wanted stars, the game clock, job
  timer, objective banner, interaction prompts, and a minimap with streets, water,
  traffic, police blips and the pulsing gold job marker.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Walk / drive |
| Shift | Sprint |
| F / E | Enter / exit any car |
| Space | Handbrake |
| Mouse drag | Orbit camera |
| Mouse wheel | Camera zoom |
| P / Esc | Pause |

## Run it

```sh
node serve.ts            # serves game/ on http://localhost:8080
```

Then open <http://localhost:8080> in a desktop browser. The game runs entirely from
static files — it works offline, and progress is kept in `localStorage`.

For the make.fun hand-in, `node main.ts` verifies the entry and writes the dossier to
`/output` (or `$MAKEFUN_OUTPUT_DIR`).

## Screenshots

1. `screenshots/1-title.jpg` — the title screen over downtown at sunset (cover)
2. `screenshots/2-foot.jpg` — on foot at the crosswalk, first job on the HUD
3. `screenshots/3-chase.jpg` — a three-star VBPD pursuit through downtown
4. `screenshots/4-vista.jpg` — the shoreline: water, sand, palms and the skyline

Every scene is a real frame of the running game, staged deterministically through
`?shot=<scene>&seed=<n>` (see `game/src/shots.js` and `shots.json`).
