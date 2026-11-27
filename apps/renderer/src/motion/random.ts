/** Deterministic hash of a seed and integer/string keys to a float in [0, 1). */
export function random(seed: number, ...keys: (number | string)[]): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (const key of keys) {
    const text = String(key);
    for (let i = 0; i < text.length; i++) {
      h = Math.imul(h ^ text.charCodeAt(i), 0x85ebca6b) >>> 0;
      h = (h ^ (h >>> 13)) >>> 0;
    }
    h = Math.imul(h ^ 0x2f, 0xc2b2ae35) >>> 0;
  }
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

export function randomRange(seed: number, min: number, max: number, ...keys: (number | string)[]): number {
  return min + (max - min) * random(seed, ...keys);
}
