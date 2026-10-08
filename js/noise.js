// Deterministic noise for terrain: 2D simplex noise and integer hashing.

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const GRADIENTS = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

// Small seeded PRNG, used only to shuffle the permutation table.
function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Returns noise(x, y) in roughly [-1, 1]. The same seed always gives the same noise.
export function createSimplex(seed) {
  const random = mulberry32(seed);
  const table = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [table[i], table[j]] = [table[j], table[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = table[i & 255];
  // Each corner's gradient, looked up once here rather than on every call.
  // The arithmetic below is the same as with GRADIENTS, so the noise, and
  // every world built on it, comes out exactly the same.
  const gradientX = new Float64Array(512);
  const gradientY = new Float64Array(512);
  for (let i = 0; i < 512; i++) {
    gradientX[i] = GRADIENTS[perm[i] & 7][0];
    gradientY[i] = GRADIENTS[perm[i] & 7][1];
  }

  return function noise(x, y) {
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const x0 = x - (i - t);
    const y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = 1 - i1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    let n0 = 0;
    let n1 = 0;
    let n2 = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      const g = ii + perm[jj];
      t0 *= t0;
      n0 = t0 * t0 * (gradientX[g] * x0 + gradientY[g] * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      const g = ii + i1 + perm[jj + j1];
      t1 *= t1;
      n1 = t1 * t1 * (gradientX[g] * x1 + gradientY[g] * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      const g = ii + 1 + perm[jj + 1];
      t2 *= t2;
      n2 = t2 * t2 * (gradientX[g] * x2 + gradientY[g] * y2);
    }
    return 70 * (n0 + n1 + n2);
  };
}

// Hashes integer coordinates and a salt into a number in [0, 1).
export function hash(x, y, salt) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
