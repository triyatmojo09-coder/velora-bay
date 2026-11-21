[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/triyatmojo09-coder/velora-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/triyatmojo09-coder/velora-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# VELORA BAY — Every Tide Brings Trouble

A top-down 2D open-world crime game in the spirit of the genre's classics, built from scratch
with plain JavaScript, canvas and WebAudio. No engine, no assets, no network: every building,
car and palm tree is drawn in code, and every sound — engines, sirens, gunfire, three radio
stations — is synthesized live.

You are **Ray Solano**, a driver with a past, washing up in a dusk-lit coastal city of six
districts. Fixer **Marla Voss** (The Gilded Eel club) and mechanic **Dex Ibarra** (Velora Auto
Works) feed you work; the Corsair syndicate and its boss **Vex Moretti** feed you trouble.
Eight story jobs build one arc from nobody to **Kingpin of Velora**.

## What's in the game

- **A living city** — six named districts (Downtown, Uptown, Palm Heights, Old Town, Portside,
  Marina & Beach) on a real road grid with lanes and intersections, sidewalks, hundreds of
  buildings with collision, a beach, a marina with piers and yachts, palms, lamps and props.
  A full day cycle runs from dusk through night to dawn, with lamps and headlights at dark.
- **On foot and behind the wheel** — WASD movement with sprint, mouse aim, enter any car with
  E, arcade driving with drifting, skid marks, damage, smoke, fire and chain-reaction
  explosions. **Carjack** drivers out of stopped cars.
- **The VBPD wanted system, 0–5 stars** — witnessed crimes raise heat; break line of sight and
  it cools. Patrol and pursuit cars with real chase AI, **roadblocks from 3 stars**, foot
  officers who shoot at high stars, and a **police helicopter with a searchlight at 4 stars**
  that keeps you "seen". Get caught slow near an officer and you're **BUSTED**; hit zero
  health and you're **WASTED** — either way you wake up poorer at the hospital or VBPD Central.
- **Combat** — fists, pistol, SMG and scattergun in slots 1–4 with a hold-Q **weapon wheel**,
  ammo, muzzle flashes, tracers and drive-by shooting.
- **Eight story jobs** — a pier pickup and delivery, stealing a gold Vantara GT under a forced
  2-star heat, tailing a Corsair courier without being spotted, ramming a convoy van and
  losing the heat with its cargo, a four-minute harbor run at 3 stars, escorting Dex through
  two ambushes, winning the Marina Mile street race, and stealing an armored Vault Hauler from
  its guards at a forced 5 stars. Dialogue before and after every job, GPS-routed objective
  markers on the minimap.
- **Side work** — two checkpoint **street races** against AI drivers with rubber-banding,
  **taxi fares** from hailing passengers (smooth rides earn tips), and repeatable respect from
  the street.
- **Shops and services** — **Harbor Arms** sells weapons (respect-locked), ammo and armor;
  **Velora Auto Works** repairs, resprays (sheds heat) and lets you lay low; the **safehouse**
  heals and saves. Progress also **autosaves after every job**.
- **Respect ranks** — Nobody → Runner → Wheelman → Hustler → Fixer → Shot Caller → Underboss →
  Kingpin of Velora, tracked in the HUD and the pause screen with full run stats.
- **Radio and sound** — three generative WebAudio stations (Neon FM synthwave, Palma Waves
  chill, Chrome Radio house) on the R key, an engine voice tied to speed, distance-based
  sirens, and synthesized gunfire, crashes and explosions. M mutes.
- **HUD and minimap** — health and armor, cash, weapon and ammo, wanted stars, the clock, the
  current district, mission banners and objective text, and a live minimap with roads, water,
  police blips, your GPS route and the objective marker.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Shift | Sprint |
| Space | Handbrake |
| Mouse | Aim · click to shoot (drive-bys included) |
| E | Enter cars, talk, buy, use services |
| F | Exit car |
| 1–4 or hold Q / Tab | Weapon slots / weapon wheel |
| R | Cycle radio station |
| M | Mute |
| Esc / P | Pause (stats, ranks, save & quit) |

## Run it

```sh
node serve.ts            # serves game/ on http://localhost:8080
```

Then open <http://localhost:8080> in a desktop browser. The game runs entirely from static
files — it works offline, and progress is kept in `localStorage`.

For the make.fun hand-in, `node main.ts` verifies the entry and writes the dossier to
`/output` (or `$MAKEFUN_OUTPUT_DIR`).

## Screenshots

1. `screenshots/1-title.jpg` — the title screen over the marina at dusk (cover)
2. `screenshots/2-chase.jpg` — a four-star VBPD pursuit under the helicopter's light
3. `screenshots/3-mission.jpg` — Marla Voss offers the first job at The Gilded Eel
4. `screenshots/4-city.jpg` — the coast road, marina and downtown at dusk

Every scene is a real frame of the running game, staged deterministically through
`?shot=<scene>&seed=<n>` (see `game/src/shots.js` and `shots.json`).
