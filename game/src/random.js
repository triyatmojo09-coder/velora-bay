// Seeded randomness for Velora Bay (mulberry32). A fixed seed rebuilds the exact same city and
// stages the exact same screenshot scenes, which is what makes ?shot= captures repeatable.
// Gameplay runs use a time-based seed; screenshot runs pass their seed in the URL.

export function createRandom(seed) {
  let a = seed | 0;
  function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    /** Float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** Integer in [min, max], both ends included. */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    chance(p) {
      return next() < p;
    },
    /** A fresh independent stream derived from this one, so layout and traffic never interleave. */
    fork() {
      return createRandom(Math.floor(next() * 4294967296));
    },
  };
}
