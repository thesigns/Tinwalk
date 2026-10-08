// The buildings of a ruined block, for the map: laid out once per block from
// its hash, never with Math.random, so everyone in a world sees the same town.
//
// Downtown has big, tall buildings; towards the edge of town they turn into
// small houses with yards behind them. Now and then a hall fills a whole
// block, and some buildings have fallen into rubble.

import { hash } from './noise.js';
import { containsAll } from './polygon.js';
import { fromGrid } from './terrain.js';

// Roofs: brightness, and a hint of rust on the last one.
export const ROOF_TONES = [[0.62, 0], [0.75, 0], [0.88, 0], [1, 0], [1.1, 0], [0.8, 1]];
const GREY_ROOFS = [1, 2, 3];
const RUBBLE_SHARE = 0.14;

const cache = new WeakMap();

// [{ points, height, roof, rubble }], points in world units, height in world
// units too (for the shadow), roof an index into ROOF_TONES.
export function buildingsOf(block) {
  let list = cache.get(block);
  if (list) return list;
  list = [];
  cache.set(block, list);
  if (!block.block) return list;

  const { district, u0, v0, u1, v1, density } = block;
  const seed = Math.floor(block.shade * 1e9);
  let salt = 0;
  const random = () => hash(seed, salt++, 1301);
  const corners = (a0, b0, a1, b1) => [[a0, b0], [a1, b0], [a1, b1], [a0, b1]].map(([u, v]) => fromGrid(district, u, v));
  // Blocks cut by an avenue or a district's edge keep only what fits inside.
  const whole = containsAll(block.block, corners(u0, v0, u1, v1));
  const fits = (points) => whole || containsAll(block.block, points);

  const kind = random();
  if (kind > 0.93) {
    // A hall or a warehouse over most of the block.
    const margin = 5 + random() * 6;
    const points = corners(u0 + margin, v0 + margin, u1 - margin, v1 - margin);
    const roof = GREY_ROOFS[Math.floor(random() * GREY_ROOFS.length)];
    if (fits(points)) list.push({ points, height: 8 + random() * 6, roof, rubble: random() < RUBBLE_SHARE });
    return list;
  }

  const downtown = density > 0.6 && kind < 0.7;
  const lot = downtown ? 26 + random() * 20 : density > 0.3 ? 15 + random() * 8 : 10 + random() * 5;
  const builtUp = 0.45 + 0.45 * density;
  const tall = downtown ? 18 + 40 * density : density > 0.3 ? 8 : 4;
  const rows = Math.max(1, Math.round((v1 - v0) / lot));
  const rowDepth = (v1 - v0) / rows;
  for (let row = 0; row < rows; row++) {
    let u = u0;
    while (u < u1 - 4) {
      const width = Math.min(lot * (0.7 + random() * 0.6), u1 - u);
      if (random() < builtUp) {
        const gap = 1.5 + random() * 2.5;
        const w = (width - 2 * gap) * (0.6 + 0.4 * random());
        const d = (rowDepth - 2 * gap) * (0.55 + 0.45 * random());
        const bu = u + gap + random() * (width - 2 * gap - w);
        // Buildings stand at the street, their yards behind them.
        const bv = row === 0 ? v0 + gap
          : row === rows - 1 ? v1 - gap - d
            : v0 + row * rowDepth + gap + random() * (rowDepth - 2 * gap - d);
        const points = corners(bu, bv, bu + w, bv + d);
        if (w > 2 && d > 2 && fits(points)) {
          list.push({
            points,
            height: tall * (0.5 + random()),
            roof: Math.floor(random() * ROOF_TONES.length),
            rubble: random() < RUBBLE_SHARE,
          });
        }
      }
      u += width;
    }
  }
  return list;
}
