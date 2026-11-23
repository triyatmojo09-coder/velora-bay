// VELORA BAY — playable roster (all original characters). Stats are real:
// runMul foot speed, decayMul wanted-decay speed, heatGainMul crime heat,
// healthMax, startMoney, payoutMul job rewards, carMul top speed, handlingMul steering.
export const ROSTER = [
  {
    id: 'dario', name: 'Dario Vale', role: 'Street-racer wannabe in a backwards cap — balanced all-rounder.',
    stats: { FOOT: 3, DRIVE: 3, HEAT: 3 },
    runMul: 1, decayMul: 1, heatGainMul: 1, healthMax: 100, startMoney: 250, payoutMul: 1, carMul: 1, handlingMul: 1,
    unlock: null, unlockText: '',
    style: { shirt: 0xf2f2f2, sleeves: 0xd99a6c, pants: 0x3a6ea8, skin: 0xd99a6c, hair: 0x2b2135, capOn: true, hairLen: 0.2, buildW: 1.05 },
  },
  {
    id: 'sela', name: 'Sela Marín', role: 'Night courier with long dark waves — fastest feet in the bay, heat fades fast.',
    stats: { FOOT: 5, DRIVE: 3, HEAT: 5 },
    runMul: 1.25, decayMul: 1.7, heatGainMul: 0.85, healthMax: 100, startMoney: 250, payoutMul: 1, carMul: 1, handlingMul: 1,
    unlock: { kind: 'mission', job: 2 }, unlockText: "Terkunci — selesaikan quest Bab 1 'The Middleman'",
    style: { shirt: 0xff5d8f, sleeves: 0xff5d8f, pants: 0x2b4a7a, skin: 0xe8b088, hair: 0x2a1a2e, hairLen: 1, buildW: 0.92 },
  },
  {
    id: 'bimo', name: 'Bimo Hartono', role: 'Loud-shirt fixer — built like a fridge, shrugs off damage and heat.',
    stats: { FOOT: 2, DRIVE: 3, HEAT: 4 },
    runMul: 0.92, decayMul: 1, heatGainMul: 0.55, healthMax: 170, startMoney: 250, payoutMul: 1, carMul: 1, handlingMul: 1,
    unlock: { kind: 'mission', job: 1 }, unlockText: "Terkunci — selesaikan quest 'Loud Shirt, Big Favour'",
    style: { shirt: 0xff8a3c, sleeves: 0x7ed491, pants: 0x8a6844, skin: 0xb87a4e, hair: 0x1c1c26, hairLen: 0.3, buildW: 1.32 },
  },
  {
    id: 'raka', name: 'Raka Pradana', role: 'Casino mogul in a sharp suit and gold chain — starts rich, jobs pay +25%.',
    stats: { FOOT: 3, DRIVE: 3, HEAT: 3 },
    runMul: 1, decayMul: 1, heatGainMul: 1, healthMax: 100, startMoney: 900, payoutMul: 1.25, carMul: 1, handlingMul: 1,
    unlock: { kind: 'mission', job: 5 }, unlockText: "Terkunci — selesaikan quest 'Casino Chips'",
    style: { shirt: 0x2b2b3a, sleeves: 0x2b2b3a, pants: 0x1c1c26, skin: 0xd99a6c, hair: 0x1c1c26, chain: true, hairLen: 0.15, buildW: 1.0 },
  },
  {
    id: 'haris', name: "Haris 'Pakde' Wira", role: 'Grey-bearded dock mechanic — any car sings in his hands.',
    stats: { FOOT: 2, DRIVE: 5, HEAT: 3 },
    runMul: 0.95, decayMul: 1, heatGainMul: 1, healthMax: 110, startMoney: 250, payoutMul: 1, carMul: 1.16, handlingMul: 1.3,
    unlock: { kind: 'mission', job: 8 }, unlockText: "Terkunci — selesaikan quest 'Prep: Wheels'",
    style: { shirt: 0x7a8a99, sleeves: 0x7a8a99, pants: 0x554a63, skin: 0xb87a4e, hair: 0xb8b8b8, beard: true, hairLen: 0.25, buildW: 1.08 },
  },
];
export const charById = (id) => ROSTER.find((c) => c.id === id) || ROSTER[0];
