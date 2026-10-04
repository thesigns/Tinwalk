// Procedural terrain: which biome is where, its ground color and its icons.
// Everything is a pure function of Web Mercator coordinates, so the same
// place on Earth always looks the same.
//
// Plains are the open ground everywhere. Forests grow where a warped noise
// field is high, so they get ragged edges, bays and clearings. Ruins are the
// remains of settlements: blocks of a street grid around a center, scattered
// over the world one settlement per cell at most.
//
// Plains cover about half of the world, forests and ruins a quarter each. A
// straight 3 km walk crosses about 6 borders between them.

import { createSimplex, hash } from './noise.js';

const noise = createSimplex(20261001);

// Sizes are in Mercator units. One Mercator unit is ~0.62 m at 52°N.
const FOREST_FREQUENCY = 1 / 3200;
const FOREST_WARP = 0.4;
// Forests cover about a third of the land outside settlements.
const FOREST_THRESHOLD = 0.154;
const DETAIL_FREQUENCY = 1 / 90;
const DETAIL_STRENGTH = 0.06;

// Each cell of this grid may hold one settlement, somewhere in its middle.
const SETTLEMENT_CELL = 3000;
const SETTLEMENT_CHANCE = 0.8;
const SETTLEMENT_MIN_RADIUS = 300;
const SETTLEMENT_MAX_RADIUS = 1500;
// City blocks (~90 x 60 m), each with its share of the surrounding streets.
export const BLOCK_LENGTH = 150;
export const BLOCK_WIDTH = 100;
// The edge of a settlement wanders in and out by this fraction of its radius.
const EDGE_RAGGEDNESS = 0.3;
const EDGE_FREQUENCY = 1 / 700;
// Some blocks inside a settlement are empty lots: still ruins, just with no building.
const EMPTY_LOT_CHANCE = 0.07;

const INK = '#5b4a35';

export const BIOMES = {
  plains: { name: 'plains', label: 'Plains', color: [214, 204, 159], iconDensity: 0.1, iconSize: 7, drawIcon: drawGrass },
  forest: { name: 'forest', label: 'Forest', color: [170, 184, 136], iconDensity: 0.75, iconSize: 13, drawIcon: drawTree },
  ruins: { name: 'ruins', label: 'Ruins', color: [190, 183, 168], iconDensity: 0.35, iconSize: 14, drawIcon: drawRuin },
};

// Octaves of noise, each half the size and 0.45 times as strong, in roughly [-1, 1].
function fbm(x, y, octaves) {
  let sum = 0;
  let amplitude = 1;
  let total = 0;
  for (let octave = 0; octave < octaves; octave++) {
    sum += amplitude * noise(x * 2 ** octave + 31.7 * octave, y * 2 ** octave - 17.3 * octave);
    total += amplitude;
    amplitude *= 0.45;
  }
  return sum / total;
}

// Positive in forests, negative on plains, and changing smoothly, so the
// map can interpolate it and draw sharp borders from a few samples.
export function forestFieldAt(x, y) {
  const fx = x * FOREST_FREQUENCY - 391.5;
  const fy = y * FOREST_FREQUENCY + 145.2;
  // Domain warping bends the noise, so forests don't come out as round blobs.
  const wx = fx + FOREST_WARP * noise(fx + 11.3, fy - 4.1);
  const wy = fy + FOREST_WARP * noise(fx - 21.9, fy + 8.4);
  return fbm(wx, wy, 3) - FOREST_THRESHOLD;
}

// Forest or plains, ignoring settlements.
export function landAt(x, y) {
  return forestFieldAt(x, y) > 0 ? BIOMES.forest : BIOMES.plains;
}

export function biomeAt(x, y) {
  return blockAt(x, y) ? BIOMES.ruins : landAt(x, y);
}

// Brightness factor around 1, for a little small-scale variation inside a biome.
export function groundShadeAt(x, y) {
  return 1 + DETAIL_STRENGTH * noise(x * DETAIL_FREQUENCY, y * DETAIL_FREQUENCY);
}

// Settlements

const settlementCache = new Map();
const MAX_CACHED_SETTLEMENTS = 4096;

// The settlement in a grid cell, or null:
// { x, y, radius, reach, cos, sin, seed, cx, cy, blocks }, with blocks filled in by blocksOf().
// Its street grid is rotated by an angle of its own; block (i, j) spans
// [i, i + 1] block lengths by [j, j + 1] block widths in the grid's coordinates.
function settlementIn(cx, cy) {
  const key = `${cx},${cy}`;
  if (settlementCache.has(key)) return settlementCache.get(key);
  let settlement = null;
  if (hash(cx, cy, 701) < SETTLEMENT_CHANCE) {
    const radius = SETTLEMENT_MIN_RADIUS + (SETTLEMENT_MAX_RADIUS - SETTLEMENT_MIN_RADIUS) * hash(cx, cy, 704);
    const angle = hash(cx, cy, 705) * (Math.PI / 2);
    settlement = {
      x: (cx + 0.15 + 0.7 * hash(cx, cy, 702)) * SETTLEMENT_CELL,
      y: (cy + 0.15 + 0.7 * hash(cx, cy, 703)) * SETTLEMENT_CELL,
      radius,
      reach: radius * (1 + EDGE_RAGGEDNESS) + 2 * BLOCK_LENGTH,
      cos: Math.cos(angle),
      sin: Math.sin(angle),
      seed: Math.floor(hash(cx, cy, 706) * 1e6),
      cx,
      cy,
      blocks: null,
    };
  }
  if (settlementCache.size >= MAX_CACHED_SETTLEMENTS) settlementCache.clear();
  settlementCache.set(key, settlement);
  return settlement;
}

// World coordinates of a point given in a settlement's street grid.
export function fromGrid(settlement, u, v) {
  return {
    x: settlement.x + u * settlement.cos - v * settlement.sin,
    y: settlement.y + u * settlement.sin + v * settlement.cos,
  };
}

// Settlements whose blocks could meet this one's.
function neighborsOf(settlement) {
  const neighbors = [];
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const other = (dx || dy) && settlementIn(settlement.cx + dx, settlement.cy + dy);
      if (other && Math.hypot(other.x - settlement.x, other.y - settlement.y) < settlement.reach + other.reach) {
        neighbors.push(other);
      }
    }
  }
  return neighbors;
}

// Where settlements grow into each other, each block goes to the one whose
// edge is nearer, so they meet like districts of one town, each with its own
// street grid.
function isBlock(settlement, neighbors, i, j) {
  const u = (i + 0.5) * BLOCK_LENGTH;
  const v = (j + 0.5) * BLOCK_WIDTH;
  const { x, y } = fromGrid(settlement, u, v);
  const distance = Math.hypot(u, v);
  const edge = settlement.radius * (1 + EDGE_RAGGEDNESS * noise(x * EDGE_FREQUENCY + 7.7, y * EDGE_FREQUENCY - 3.3));
  if (distance >= edge) return false;
  return neighbors.every((other) => Math.hypot(x - other.x, y - other.y) - other.radius > distance - settlement.radius);
}

export function isEmptyLot(settlement, i, j) {
  return hash(i, j, settlement.seed) < EMPTY_LOT_CHANCE;
}

// The settlement's blocks, computed once: { list: [[i, j]], has(i, j) }.
export function blocksOf(settlement) {
  if (!settlement.blocks) {
    const keys = new Set();
    const list = [];
    const neighbors = neighborsOf(settlement);
    const columns = Math.ceil(settlement.reach / BLOCK_LENGTH);
    const rows = Math.ceil(settlement.reach / BLOCK_WIDTH);
    for (let j = -rows; j < rows; j++) {
      for (let i = -columns; i < columns; i++) {
        if (!isBlock(settlement, neighbors, i, j)) continue;
        keys.add(`${i},${j}`);
        list.push([i, j]);
      }
    }
    settlement.blocks = { list, has: (i, j) => keys.has(`${i},${j}`) };
  }
  return settlement.blocks;
}

// Settlements that may have blocks inside the given rectangle.
export function settlementsIn(minX, minY, maxX, maxY) {
  const found = [];
  for (let cy = Math.floor(minY / SETTLEMENT_CELL) - 1; cy <= Math.floor(maxY / SETTLEMENT_CELL) + 1; cy++) {
    for (let cx = Math.floor(minX / SETTLEMENT_CELL) - 1; cx <= Math.floor(maxX / SETTLEMENT_CELL) + 1; cx++) {
      const settlement = settlementIn(cx, cy);
      if (
        settlement &&
        settlement.x + settlement.reach > minX &&
        settlement.x - settlement.reach < maxX &&
        settlement.y + settlement.reach > minY &&
        settlement.y - settlement.reach < maxY
      ) {
        found.push(settlement);
      }
    }
  }
  return found;
}

// Whether the point is in a block of some settlement, streets included.
function blockAt(x, y) {
  const cx = Math.floor(x / SETTLEMENT_CELL);
  const cy = Math.floor(y / SETTLEMENT_CELL);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const settlement = settlementIn(cx + dx, cy + dy);
      if (!settlement) continue;
      const ox = x - settlement.x;
      const oy = y - settlement.y;
      if (ox * ox + oy * oy > settlement.reach ** 2) continue;
      const u = ox * settlement.cos + oy * settlement.sin;
      const v = -ox * settlement.sin + oy * settlement.cos;
      if (blocksOf(settlement).has(Math.floor(u / BLOCK_LENGTH), Math.floor(v / BLOCK_WIDTH))) return true;
    }
  }
  return false;
}

// Icons are drawn with their base at (x, y), extending upward, `size` pixels tall.
// `variant` is a number in [0, 1) used to vary their look.

function startIcon(ctx, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  ctx.lineWidth = 1.2 / size;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
}

function drawGrass(ctx, x, y, size) {
  startIcon(ctx, x, y, size);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-0.35, -0.7);
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -1);
  ctx.moveTo(0, 0);
  ctx.lineTo(0.35, -0.7);
  ctx.stroke();
  ctx.restore();
}

function drawTree(ctx, x, y, size, variant) {
  startIcon(ctx, x, y, size);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -0.4);
  ctx.stroke();
  ctx.beginPath();
  if (variant < 0.5) {
    ctx.arc(0, -0.65, 0.33, 0, Math.PI * 2);
    ctx.fillStyle = '#7d9a58';
  } else {
    ctx.moveTo(-0.32, -0.25);
    ctx.lineTo(0.32, -0.25);
    ctx.lineTo(0, -1);
    ctx.closePath();
    ctx.fillStyle = '#62804a';
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawRuin(ctx, x, y, size, variant) {
  startIcon(ctx, x, y, size);
  if (variant < 0.5) ctx.scale(-1, 1);
  ctx.beginPath();
  ctx.moveTo(-0.4, 0);
  ctx.lineTo(-0.4, -0.85);
  ctx.lineTo(-0.1, -0.85);
  ctx.lineTo(0, -0.6);
  ctx.lineTo(0.15, -0.72);
  ctx.lineTo(0.4, -0.45);
  ctx.lineTo(0.4, 0);
  ctx.closePath();
  ctx.fillStyle = '#9b958b';
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.fillRect(-0.27, -0.6, 0.16, 0.16);
  ctx.fillRect(-0.27, -0.3, 0.16, 0.16);
  ctx.restore();
}
