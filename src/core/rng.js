/**
 * Deterministic pseudo-random numbers.
 *
 * Every planet texture, moon orbit and star position is generated from a seed
 * so the universe looks identical on every device and every reload. Caleb's
 * Jupiter should have the same red spot as Brandon's.
 */

/** mulberry32 — small, fast, good enough for visuals. Returns () => [0, 1). */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Turn a string into a 32-bit seed (FNV-1a). */
export function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Random float in [min, max). */
export const rndRange = (rng, min, max) => min + rng() * (max - min);

/** Random integer in [min, max]. */
export const rndInt = (rng, min, max) => Math.floor(min + rng() * (max - min + 1));

/** Uniformly distributed point on the unit sphere. */
export function rndOnSphere(rng) {
  const u = rng() * 2 - 1;
  const theta = rng() * Math.PI * 2;
  const r = Math.sqrt(Math.max(0, 1 - u * u));
  return { x: r * Math.cos(theta), y: u, z: r * Math.sin(theta) };
}
