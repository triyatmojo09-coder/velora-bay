// The story of Velora Bay: eight jobs for fixer Marla Voss and mechanic Dex Ibarra that take Ray
// Solano from nobody to kingpin, plus street races and taxi work. The director below runs the
// active job's phase machine, keeps the objective marker and GPS route fresh, and pays out cash
// and respect. All people, crews and places are invented for this game.
import { STAR_THRESHOLDS } from './config.js';
import { dist } from './world.js';

export const JOB_DEFS = [
  { id: 'wheels', name: 'First Wheels', giver: 'club', giverName: 'Marla Voss', cash: 450, respect: 80 },
  { id: 'hotproperty', name: 'Hot Property', giver: 'club', giverName: 'Marla Voss', cash: 800, respect: 120 },
  { id: 'tailspin', name: 'Tail Spin', giver: 'garage', giverName: 'Dex Ibarra', cash: 950, respect: 130 },
  { id: 'convoy', name: 'Convoy Trouble', giver: 'club', giverName: 'Marla Voss', cash: 1200, respect: 160 },
  { id: 'harborrun', name: 'Harbor Run', giver: 'garage', giverName: 'Dex Ibarra', cash: 1400, respect: 170 },
  { id: 'bodyguard', name: 'Bodyguard', giver: 'garage', giverName: 'Dex Ibarra', cash: 1600, respect: 190 },
  { id: 'streetking', name: 'Street King', giver: 'club', giverName: 'Marla Voss', cash: 1800, respect: 200 },
  { id: 'lastnight', name: 'Last Night in Velora', giver: 'club', giverName: 'Marla Voss', cash: 3500, respect: 300 },
];

const INTROS = {
  wheels: [
    { who: 'MARLA', text: 'Ray Solano. Heard you can drive and keep your mouth shut. Both are rare in Velora Bay.' },
    { who: 'RAY', text: 'Depends what the tide brings in, Marla.' },
    { who: 'MARLA', text: 'A package, at the end of the middle marina pier. Pick it up, bring it to the Old Town drop. Quiet and quick.' },
    { who: 'MARLA', text: 'Do it clean and there will be more work. Do it loud... there will be different work.' },
  ],
  hotproperty: [
    { who: 'MARLA', text: 'A gold Vantara GT sits in a Palm Heights driveway, bought with money that was meant for my people.' },
    { who: 'MARLA', text: 'Take it. Bring it to Dex at Velora Auto Works. The VBPD will notice — that is the point. Nobody steals from the Eel twice.' },
  ],
  tailspin: [
    { who: 'DEX', text: 'Corsairs run a courier out of Portside every night. Same grey Meridian, same route.' },
    { who: 'DEX', text: 'Tail him. Close enough to keep him, far enough to stay a ghost. When he parks, lift the briefcase and bring it home.' },
  ],
  convoy: [
    { who: 'MARLA', text: 'Vex Moretti is moving his whole winter take through my city in one van. One. Van.' },
    { who: 'MARLA', text: 'Ram it until it stops, take the cargo, then lose the law and come home. Make him feel it, Ray.' },
  ],
  harborrun: [
    { who: 'DEX', text: 'Crate at the Portside dock, buyer waiting at the Marina Pavilion. Four minutes, and every cop in the bay will smell it.' },
    { who: 'DEX', text: 'Roadblocks, the helicopter, the works. You are the only driver I trust with this. No pressure.' },
  ],
  bodyguard: [
    { who: 'DEX', text: 'My sister testifies against the Corsairs on Monday. They know where I live, so tonight I sleep at her place in Palm Heights.' },
    { who: 'DEX', text: 'Drive me there, Ray. If anything with a Corsair flag comes near this car, it comes through you first.' },
  ],
  streetking: [
    { who: 'MARLA', text: 'Three crews think they own the Marina Mile. Tonight we correct them: a checkpoint race, winner takes the street.' },
    { who: 'MARLA', text: 'Bring a fast car and finish first. Second place is just the fastest loser, and I do not pay losers.' },
  ],
  lastnight: [
    { who: 'MARLA', text: 'Moretti is moving everything — money, deeds, names — in one armored Vault Hauler out of Portside tonight.' },
    { who: 'MARLA', text: 'Take it from his guards, drive it through whatever the VBPD throws at you, and park it at my door.' },
    { who: 'MARLA', text: 'Do this, and Velora Bay is ours. Fail, and we were never friends. Go, Kingpin.' },
  ],
};

const OUTROS = {
  wheels: [
    { who: 'MARLA', text: 'Clean and quick, as promised. You just became interesting, Ray Solano.' },
  ],
  hotproperty: [
    { who: 'DEX', text: 'She is beautiful. And very, very stolen. Marla says the message has been received across the bay.' },
  ],
  tailspin: [
    { who: 'DEX', text: 'Ledger, routes, names... this is the Corsairs whole playbook. Beautiful driving, ghost.' },
  ],
  convoy: [
    { who: 'MARLA', text: 'Moretti is screaming into a telephone right now. Music. Take this — you have earned every cent.' },
  ],
  harborrun: [
    { who: 'DEX', text: 'Four minutes. Through THAT. Remind me never to bet against you, hermano.' },
  ],
  bodyguard: [
    { who: 'DEX', text: 'Alive, unshot, and only mildly terrified. My sister makes tea. You... you get paid like family.' },
  ],
  streetking: [
    { who: 'MARLA', text: 'First place, and not close. The Mile is ours — the whole bay heard those engines tonight.' },
  ],
  lastnight: [
    { who: 'MARLA', text: 'The Hauler, the money, the names. Moretti is finished, and Velora Bay has a new story to tell.' },
    { who: 'MARLA', text: 'Whatever you want in this city, Ray — it is yours. Kingpin of Velora.' },
  ],
};

export const RACE_DEFS = [
  {
    id: 'marina-mile', name: 'Marina Mile', entry: 100, prize: 650, respect: 60,
    start: { x: 4360, y: 640 },
    checkpoints: [
      { x: 4360, y: 1100 }, { x: 4360, y: 1720 }, { x: 3720, y: 1720 }, { x: 3720, y: 2340 },
      { x: 4360, y: 2340 }, { x: 4360, y: 2960 }, { x: 3720, y: 2960 }, { x: 4360, y: 3520 },
    ],
  },
  {
    id: 'downtown-circuit', name: 'Downtown Circuit', entry: 100, prize: 650, respect: 60,
    start: { x: 1800, y: 620 },
    checkpoints: [
      { x: 2440, y: 480 }, { x: 3080, y: 480 }, { x: 3080, y: 1100 }, { x: 2440, y: 1100 },
      { x: 2440, y: 1720 }, { x: 1800, y: 1720 }, { x: 1160, y: 1100 }, { x: 1800, y: 480 },
    ],
  },
];

export function createDirector(state) {
  const city = state.city;
  const rng = state.rng;
  let routeT = 0;

  function poi(id) {
    return city.pois.find((q) => q.id === id);
  }

  function dialogue(lines, onDone) {
    state.dialogue = { lines, i: 0, onDone: onDone ?? null };
    if (state.audio) state.audio.click();
  }

  function setObjective(x, y, label) {
    state.objective = { x, y, label, route: city.route(state.player.x, state.player.y, x, y) };
    routeT = 0;
  }

  function refreshRoute(dt) {
    routeT -= dt;
    if (state.objective !== null && routeT <= 0) {
      routeT = 1.4;
      state.objective.route = city.route(state.player.x, state.player.y, state.objective.x, state.objective.y);
    }
  }

  function completeJob(job) {
    const def = job.def;
    dialogue(OUTROS[def.id], () => {
      state.addCash(def.cash);
      state.addRespect(def.respect);
      state.stats.jobsDone += 1;
      state.flags.jobIndex = (state.flags.jobIndex ?? 0) + 1;
      state.wanted.floor = 0;
      state.saveRequest = true;
      state.setBanner('JOB COMPLETE — ' + def.name.toUpperCase(), `+$${def.cash} · +${def.respect} respect`);
      if (state.audio) state.audio.jobDone();
    });
    state.mission = null;
    state.objective = null;
  }

  function failJob(job, why) {
    state.wanted.floor = 0;
    state.mission = null;
    state.objective = null;
    state.setBanner('JOB FAILED', why + ' — go back to try again');
    if (state.audio) state.audio.jobFail();
  }

  // ---------- individual jobs ----------

  function startJob(def) {
    const job = { def, phase: 'main', data: {} };
    dialogue(INTROS[def.id], () => {
      state.mission = job;
      setupJob(job);
    });
  }

  function setupJob(job) {
    const p = state.player;
    switch (job.def.id) {
      case 'wheels':
        job.phase = 'pickup';
        setObjective(4952, 1830, 'Pick up the package at the pier end');
        break;
      case 'hotproperty': {
        const car = state.spawnCar('sports', 845, 800, 0.35, { kind: 'parked', color: '#e8b13a', noDespawn: true });
        car.missionTag = 'hotcar';
        job.data.car = car;
        job.phase = 'steal';
        setObjective(car.x, car.y, 'Steal the gold Vantara GT');
        break;
      }
      case 'tailspin': {
        const routePts = [
          { x: 3080, y: 2960 }, { x: 3080, y: 2340 }, { x: 3720, y: 2340 }, { x: 3720, y: 2960 },
          { x: 4360, y: 2960 }, { x: 4360, y: 3520 }, { x: 3720, y: 3520 }, { x: 3400, y: 3180 },
        ];
        const car = state.spawnCar('sedan', 3400, 3100, 0, { kind: 'target', color: '#8a8f98', driver: true, noDespawn: true });
        car.ai = { routePts, ri: 0, speedScale: 0.6, stuckT: 0, revT: 0 };
        car.missionTag = 'courier';
        job.data.car = car;
        job.data.spot = 0;
        job.data.loseT = 0;
        job.phase = 'tail';
        setObjective(car.x, car.y, 'Tail the courier — stay close, stay unseen');
        break;
      }
      case 'convoy': {
        const routePts = [
          { x: 3720, y: 3520 }, { x: 3720, y: 2960 }, { x: 3080, y: 2960 }, { x: 3080, y: 2340 },
          { x: 2440, y: 2340 }, { x: 2440, y: 2960 }, { x: 1800, y: 2960 }, { x: 1800, y: 3520 },
          { x: 2440, y: 3520 }, { x: 3080, y: 3520 }, { x: 3720, y: 3520 }, { x: 4360, y: 3520 },
        ];
        const van = state.spawnCar('van', 4360, 3440, Math.PI, { kind: 'target', color: '#3a3f46', driver: true, noDespawn: true });
        van.ai = { routePts, ri: 0, speedScale: 0.72, stuckT: 0, revT: 0 };
        van.missionTag = 'convoy';
        job.data.car = van;
        job.phase = 'ram';
        setObjective(van.x, van.y, 'Ram the Corsair van until it stops');
        break;
      }
      case 'harborrun':
        job.phase = 'pickup';
        setObjective(4200, 3300, 'Collect the crate at the Portside dock');
        break;
      case 'bodyguard': {
        const dex = state.spawnPed(poi('garage').door.x + 20, poi('garage').door.y, 'dex', { name: 'DEX', shirt: '#f2c94c' });
        dex.hp = 170;
        dex.maxHp = 170;
        job.data.dex = dex;
        job.data.ambush = 0;
        job.phase = 'drive';
        setObjective(330, 330, "Drive Dex to his sister's place in Palm Heights");
        break;
      }
      case 'streetking': {
        job.phase = 'togrid';
        setObjective(RACE_DEFS[0].start.x, RACE_DEFS[0].start.y, 'Get to the Marina Mile start — bring a fast car');
        break;
      }
      case 'lastnight': {
        const truck = state.spawnCar('truck', 3900, 3250, -0.4, { kind: 'parked', color: '#4a4f57', noDespawn: true });
        truck.missionTag = 'vault';
        job.data.car = truck;
        job.data.guards = [];
        for (const off of [[-70, -50], [70, -40], [-60, 60], [80, 55]]) {
          const guard = state.spawnPed(truck.x + off[0], truck.y + off[1], 'gang');
          guard.state = 'guard';
          job.data.guards.push(guard);
        }
        job.phase = 'steal';
        setObjective(truck.x, truck.y, 'Steal the Vault Hauler from the Corsair guards');
        break;
      }
      default:
        break;
    }
    void p;
  }

  function updateJob(job, dt) {
    const p = state.player;
    const d = job.data;
    switch (job.def.id) {
      case 'wheels': {
        if (job.phase === 'pickup') {
          if (dist(p.x, p.y, 4952, 1830) < 52) {
            job.phase = 'deliver';
            state.setBanner('PACKAGE ON BOARD', 'Take it to the Old Town drop');
            if (state.audio) state.audio.pickup();
            setObjective(880, 2620, 'Deliver the package to the Old Town drop');
          }
        } else if (dist(p.x, p.y, 880, 2620) < 52) completeJob(job);
        break;
      }
      case 'hotproperty': {
        const car = d.car;
        if (car === undefined || car.removeMe) {
          failJob(job, 'The Vantara is gone');
          break;
        }
        if (job.phase === 'steal') {
          setObjective(car.x, car.y, 'Steal the gold Vantara GT');
          if (p.car === car) {
            job.phase = 'deliver';
            state.wanted.floor = STAR_THRESHOLDS[2];
            state.setBanner('HOT PROPERTY', 'The VBPD is awake — get it to the Auto Works');
          }
        } else {
          if (p.car === car) state.wanted.floor = STAR_THRESHOLDS[2];
          const lot = poi('garage').lot;
          if (p.car === car && p.x > lot.x && p.x < lot.x + lot.w && p.y > lot.y && p.y < lot.y + lot.h) {
            state.wanted.floor = 0;
            car.kind = 'parked';
            completeJob(job);
          } else {
            setObjective(poi('garage').door.x, poi('garage').door.y, 'Deliver the Vantara to Velora Auto Works');
          }
        }
        break;
      }
      case 'tailspin': {
        const car = d.car;
        if (car === undefined || car.dead || car.removeMe) {
          failJob(job, 'The courier is wrecked');
          break;
        }
        if (job.phase === 'tail') {
          const gap = dist(p.x, p.y, car.x, car.y);
          setObjective(car.x, car.y, gap < 85 ? 'TOO CLOSE — back off!' : 'Tail the courier — stay close, stay unseen');
          if (gap < 85) d.spot = (d.spot ?? 0) + dt / 2.0;
          else if (gap > 330) d.loseT = (d.loseT ?? 0) + dt;
          else {
            d.spot = Math.max(0, (d.spot ?? 0) - dt / 3);
            d.loseT = 0;
          }
          if ((d.spot ?? 0) >= 1) {
            failJob(job, 'The courier spotted you');
            break;
          }
          if ((d.loseT ?? 0) > 6) {
            failJob(job, 'You lost the courier');
            break;
          }
          if (car.parkedDone) {
            job.phase = 'grab';
            state.setBanner('HE PARKED', 'Take the briefcase from the Meridian');
          }
        } else if (job.phase === 'grab') {
          setObjective(car.x, car.y, 'Take the briefcase from the Meridian');
          if (p.car === null && dist(p.x, p.y, car.x, car.y) < 44) {
            job.phase = 'return';
            if (state.audio) state.audio.pickup();
            state.setBanner('BRIEFCASE IN HAND', 'Bring it back to Dex');
            setObjective(poi('garage').door.x, poi('garage').door.y, 'Bring the briefcase to Dex');
          }
        } else if (dist(p.x, p.y, poi('garage').door.x, poi('garage').door.y) < 56) completeJob(job);
        break;
      }
      case 'convoy': {
        const van = d.car;
        if (van === undefined || van.removeMe) {
          failJob(job, 'The van is gone');
          break;
        }
        if (job.phase === 'ram') {
          setObjective(van.x, van.y, 'Ram the Corsair van until it stops');
          if (van.hp <= 55 || van.dead) {
            if (van.ai) van.ai.routePts = [];
            job.phase = 'loot';
            state.setBanner('VAN STOPPED', 'Grab the cargo from the back');
          }
        } else if (job.phase === 'loot') {
          setObjective(van.x, van.y, 'Take the cargo from the van');
          if (p.car === null && dist(p.x, p.y, van.x, van.y) < 48) {
            job.phase = 'escape';
            state.wanted.floor = STAR_THRESHOLDS[3];
            if (state.audio) state.audio.pickup();
            state.setBanner('CARGO YOURS', 'Lose the heat, then get to the Gilded Eel');
            setObjective(poi('club').door.x, poi('club').door.y, 'Lose the heat, then reach the Gilded Eel');
          }
        } else if (job.phase === 'escape') {
          if (state.wanted.seenT > 4) {
            state.wanted.floor = 0;
            job.phase = 'return';
            state.setBanner('HEAT LOST', 'Now get to the Gilded Eel');
          }
        } else if (dist(p.x, p.y, poi('club').door.x, poi('club').door.y) < 56 && state.wanted.stars === 0) completeJob(job);
        break;
      }
      case 'harborrun': {
        if (job.phase === 'pickup') {
          if (dist(p.x, p.y, 4200, 3300) < 56) {
            job.phase = 'deliver';
            d.timeLeft = 240;
            state.wanted.floor = STAR_THRESHOLDS[3];
            state.setBanner('CRATE LOADED', 'Four minutes to the Marina Pavilion — go!');
            if (state.audio) state.audio.pickup();
          }
        } else {
          d.timeLeft -= dt;
          const left = Math.max(0, Math.ceil(d.timeLeft));
          setObjective(poi('marina').door.x, poi('marina').door.y, `Deliver to the Marina Pavilion — ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} left`);
          if (d.timeLeft <= 0) {
            state.wanted.floor = 0;
            failJob(job, 'The buyer left');
            break;
          }
          if (dist(p.x, p.y, poi('marina').door.x, poi('marina').door.y) < 60) {
            state.wanted.floor = 0;
            completeJob(job);
          }
        }
        break;
      }
      case 'bodyguard': {
        const dex = d.dex;
        if (dex === undefined || dex.dead) {
          failJob(job, 'Dex did not make it');
          break;
        }
        // Dex rides along when Ray drives, and sticks close on foot otherwise.
        if (p.car !== null && dex.car === null && dist(dex.x, dex.y, p.car.x, p.car.y) < 84) dex.car = p.car;
        if (p.car === null && dex.car !== null) {
          dex.car = null;
          dex.x = p.x + 26;
          dex.y = p.y;
        }
        const triggers = [{ x: 1800, y: 1100 }, { x: 1160, y: 480 }];
        if ((d.ambush ?? 0) < triggers.length) {
          const trg = triggers[d.ambush];
          if (dist(p.x, p.y, trg.x, trg.y) < 330) {
            d.ambush += 1;
            state.setBanner('AMBUSH!', 'Corsairs — keep Dex breathing!');
            for (const off of [[240, -60], [-240, 80]]) {
              const car = state.spawnCar('suv', trg.x + off[0], trg.y + off[1], 0, { kind: 'gang', color: '#3a3f46', driver: true });
              car.ai = { tx: p.x, ty: p.y, stuckT: 0, revT: 0, speedScale: 0.97 };
            }
          }
        }
        for (const car of state.cars) {
          if (car.kind === 'gang' && car.ai) {
            car.ai.tx = p.x;
            car.ai.ty = p.y;
          }
        }
        if (dist(p.x, p.y, 330, 330) < 70 && (dex.car === p.car || dist(dex.x, dex.y, 330, 330) < 110)) completeJob(job);
        break;
      }
      case 'streetking': {
        if (job.phase === 'togrid') {
          if (p.car !== null && dist(p.x, p.y, RACE_DEFS[0].start.x, RACE_DEFS[0].start.y) < 70) {
            startRace(RACE_DEFS[0], 3, (place) => {
              if (place === 1) completeJob(job);
              else failJob(job, `You finished #${place} — Marla only pays winners`);
            });
            job.phase = 'racing';
          }
        }
        break;
      }
      case 'lastnight': {
        const truck = d.car;
        if (truck === undefined || truck.removeMe) {
          failJob(job, 'The Vault Hauler is gone');
          break;
        }
        if (job.phase === 'steal') {
          setObjective(truck.x, truck.y, 'Steal the Vault Hauler from the Corsair guards');
          if (p.car === truck) {
            job.phase = 'deliver';
            state.wanted.floor = STAR_THRESHOLDS[5];
            state.setBanner('THE VAULT IS YOURS', 'Every cop in Velora is coming. Drive.');
          }
        } else {
          if (p.car === truck) state.wanted.floor = STAR_THRESHOLDS[5];
          setObjective(poi('club').door.x, poi('club').door.y, 'Deliver the Vault Hauler to the Gilded Eel');
          if (p.car === truck && dist(p.x, p.y, poi('club').door.x, poi('club').door.y) < 84) {
            state.wanted.floor = 0;
            truck.kind = 'parked';
            state.flags.storyDone = true;
            completeJob(job);
          }
        }
        break;
      }
      default:
        break;
    }
  }

  // ---------- races ----------

  function startRace(def, opponents, onDone) {
    const p = state.player;
    const racers = [];
    for (let i = 0; i < opponents; i += 1) {
      const car = state.spawnCar(i === 0 ? 'sports' : 'sedan', def.start.x + (i + 1) * 54, def.start.y + (i % 2 === 0 ? 40 : -40), -Math.PI / 2, { kind: 'racer', driver: true });
      car.ai = { tx: def.checkpoints[0].x, ty: def.checkpoints[0].y, stuckT: 0, revT: 0, speedScale: 0.93 + i * 0.02 };
      racers.push({ car, cp: 0, finished: false, place: 0 });
    }
    state.race = {
      def, racers, onDone,
      playerCp: 0, playerDone: false, places: 0,
      countT: 3.2, started: false,
    };
    state.setBanner(def.name.toUpperCase(), 'First to the last checkpoint takes the street');
  }

  function updateRace(dt) {
    const race = state.race;
    if (race === null) return;
    const p = state.player;
    if (race.countT > 0) {
      race.countT -= dt;
      for (const r of race.racers) {
        r.car.ai.tx = r.car.x;
        r.car.ai.ty = r.car.y;
      }
      if (race.countT <= 0) {
        race.started = true;
        state.setBanner('GO!', race.def.name);
        if (state.audio) state.audio.confirm();
      }
      return;
    }
    const cps = race.def.checkpoints;
    // Player progress.
    if (!race.playerDone && race.playerCp < cps.length) {
      const cp = cps[race.playerCp];
      setObjective(cp.x, cp.y, `${race.def.name} — checkpoint ${race.playerCp + 1}/${cps.length} · you are ${currentPlace(race)}${suffix(currentPlace(race))}`);
      if (p.car !== null && dist(p.x, p.y, cp.x, cp.y) < 95) {
        race.playerCp += 1;
        if (state.audio) state.audio.pickup();
        if (race.playerCp >= cps.length) {
          race.playerDone = true;
          race.places += 1;
          finishRace(race, race.places);
          return;
        }
      }
    }
    // Rivals.
    for (const r of race.racers) {
      if (r.finished) continue;
      const cp = cps[r.cp];
      if (cp === undefined) {
        r.finished = true;
        race.places += 1;
        r.place = race.places;
        continue;
      }
      // Rubber-banding: rivals breathe down your neck but rarely run away with it.
      const playerScore = race.playerCp + (race.playerDone ? 100 : 0);
      const myScore = r.cp;
      r.car.ai.tx = cp.x;
      r.car.ai.ty = cp.y;
      r.car.ai.speedScale = myScore < playerScore ? 1.0 : myScore > playerScore ? 0.88 : 0.94;
      if (dist(r.car.x, r.car.y, cp.x, cp.y) < 95) r.cp += 1;
      if (r.car.dead) {
        r.finished = true;
        race.places += 1;
        r.place = race.places;
      }
    }
  }

  function currentPlace(race) {
    let place = 1;
    for (const r of race.racers) {
      if (r.cp > race.playerCp) place += 1;
    }
    return place;
  }

  function suffix(n) {
    return n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
  }

  function finishRace(race, playerPlace) {
    for (const r of race.racers) {
      if (!r.car.dead) {
        r.car.kind = 'traffic';
        r.car.ai = null;
      }
    }
    state.race = null;
    state.objective = null;
    race.onDone(playerPlace);
  }

  // ---------- taxi work ----------

  function updateTaxi(dt, ctl) {
    const p = state.player;
    const taxi = state.taxi;
    if (taxi === null) {
      if (state.mission === null && state.race === null && p.car !== null && state.dialogue === null) {
        state.flags.taxiT = (state.flags.taxiT ?? 12) - dt;
        if (state.flags.taxiT <= 0) {
          state.flags.taxiT = rng.range(16, 30);
          let best = null;
          let bestD = 560;
          for (const ped of state.peds) {
            if (ped.kind !== 'civ' || ped.dead || ped.car !== null) continue;
            const dd = dist(p.x, p.y, ped.x, ped.y);
            if (dd < bestD) {
              bestD = dd;
              best = ped;
            }
          }
          if (best !== null) {
            best.hail = true;
            state.taxi = { phase: 'pickup', ped: best };
            state.setBanner('FARE HAILING', 'Pick up the glowing passenger', 2.2);
          }
        }
      }
      return;
    }
    const ped = taxi.ped;
    if (ped === undefined || ped.dead || ped.removeMe) {
      state.taxi = null;
      return;
    }
    if (taxi.phase === 'pickup') {
      if (p.car === null || dist(p.x, p.y, ped.x, ped.y) > 700) {
        ped.hail = false;
        state.taxi = null;
        return;
      }
      setObjective(ped.x, ped.y, 'Pick up your fare');
      if (dist(p.x, p.y, ped.x, ped.y) < 40 && Math.abs(p.car.speed) < 26) {
        ped.hail = false;
        ped.car = p.car;
        taxi.phase = 'dropoff';
        taxi.startHp = p.car.hp;
        const dest = city.nearestRoadPoint(p.x + rng.range(-1700, 1700), p.y + rng.range(-1700, 1700));
        taxi.dest = { x: clampWorld(dest.x), y: clampWorld(dest.y) };
        taxi.fare = 40 + Math.round(dist(p.x, p.y, taxi.dest.x, taxi.dest.y) / 12);
        state.setBanner('FARE ON BOARD', 'Mind the paint — tips follow smooth rides', 2.4);
        if (state.audio) state.audio.pickup();
      }
    } else {
      setObjective(taxi.dest.x, taxi.dest.y, `Drop off your fare — $${taxi.fare} on the meter`);
      if (p.car === null) {
        ped.car = null;
        state.taxi = null;
        state.objective = null;
        return;
      }
      if (dist(p.x, p.y, taxi.dest.x, taxi.dest.y) < 52 && Math.abs(p.car.speed) < 30) {
        ped.car = null;
        ped.x = p.x + 30;
        ped.y = p.y + 10;
        const tip = p.car.hp >= (taxi.startHp ?? 0) - 4 ? 25 : 0;
        state.addCash(taxi.fare + tip);
        state.addRespect(5);
        state.stats.taxiFares += 1;
        state.setBanner('FARE PAID', `+$${taxi.fare + tip}${tip > 0 ? ' (smooth-ride tip included)' : ''}`, 2.6);
        state.taxi = null;
        state.objective = null;
      }
    }
    void ctl;
  }

  function clampWorld(v) {
    return Math.max(80, Math.min(5120, v));
  }

  // ---------- the director's per-frame update ----------

  function update(dt, ctl) {
    refreshRoute(dt);
    if (state.dialogue !== null || state.shop !== null || state.gameOver !== null) return;
    if (state.race !== null) {
      updateRace(dt);
      return;
    }
    if (state.mission !== null) {
      updateJob(state.mission, dt);
      return;
    }
    updateTaxi(dt, ctl);
    if (state.taxi !== null) return;
    // Offer the next story job at its giver's door, and the street races at their start lines.
    const p = state.player;
    const idx = state.flags.jobIndex ?? 0;
    if (idx < JOB_DEFS.length) {
      const def = JOB_DEFS[idx];
      const door = poi(def.giver).door;
      setObjective(door.x, door.y, `Story: ${def.name} — meet ${def.giverName}`);
      if (p.car === null && dist(p.x, p.y, door.x, door.y) < 52) {
        state.prompt = `E — Talk to ${def.giverName} (${def.name})`;
        if (ctl.interact && !state.consumedInteract) {
          state.consumedInteract = true;
          startJob(def);
        }
      }
    }
    if (p.car !== null) {
      for (const def of RACE_DEFS) {
        if (dist(p.x, p.y, def.start.x, def.start.y) < 62) {
          state.prompt = `E — Enter the ${def.name} ($${def.entry}, winner takes $${def.prize})`;
          if (ctl.interact && !state.consumedInteract) {
            state.consumedInteract = true;
            if (p.cash < def.entry) {
              state.setBanner('NOT ENOUGH CASH', `The ${def.name} needs a $${def.entry} stake`, 2.2);
            } else {
              p.cash -= def.entry;
              startRace(def, 2, (place) => {
                if (place === 1) {
                  state.addCash(def.prize);
                  state.addRespect(def.respect);
                  state.stats.racesWon += 1;
                  state.setBanner(`${def.name.toUpperCase()} — WON`, `+$${def.prize} · +${def.respect} respect`);
                  if (state.audio) state.audio.jobDone();
                } else {
                  state.setBanner(`${def.name.toUpperCase()} — #${place}`, 'The street keeps the stake this time');
                  if (state.audio) state.audio.jobFail();
                }
              });
            }
          }
        }
      }
    }
  }

  return {
    update,
    dialogue,
    get jobsTotal() {
      return JOB_DEFS.length;
    },
  };
}
