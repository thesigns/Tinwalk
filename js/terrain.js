// Procedural terrain: which biome is where, its ground color and its icons.
//
// The terrain belongs to a world: a World ID, which seeds the noise and the
// settlements, and the point where the game began, which is the world's
// center. Inside a world everything is a pure function of the position
// relative to that center, measured in world units of fixed length, so
// players who share a World ID get the same land around their starting
// points wherever they are on Earth. The exported functions take Web Mercator
// coordinates, like the map, and convert them.
//
// Plains are the open ground everywhere. Forests grow where a warped noise
// field is high, so they get ragged edges, bays and clearings. Ruins are the
// remains of settlements: blocks of a street grid around a center, scattered
// over the world one settlement per cell at most.
//
// Plains cover about half of the world, forests and ruins a quarter each. A
// straight 3 km walk crosses about 6 borders between them.
//
// Radiation is a separate, invisible layer over the biomes: patches of fallout
// covering about a fifth of the world, regardless of the biome underneath.

import { EARTH_RADIUS, MERCATOR_RADIUS, fromMercator, toMercator } from './geo.js';
import { SETTLEMENT_NAME_ENDS, SETTLEMENT_NAME_STARTS } from './names.js';
import { createSimplex, hash } from './noise.js';

// The terrain was tuned in Mercator units at 52°N, where one is ~0.62 m, so
// that is the length of a world unit everywhere.
const WORLD_UNIT_METERS = Math.cos((52 * Math.PI) / 180);

// World units per degree of latitude.
const UNITS_PER_DEGREE = (EARTH_RADIUS * Math.PI) / 180 / WORLD_UNIT_METERS;

// The current world: its center, world units per degree of latitude and of
// longitude there, world units per Mercator unit, and a salt for the
// settlement hashes. Until the game sets one, the terrain is laid out around
// 0°N 0°E with the default seed.
let world = { lat: 0, lon: 0, perLat: UNITS_PER_DEGREE, perLon: UNITS_PER_DEGREE, scale: 1, salt: 0 };
let worldSet = false;
let noise = createSimplex(20261001);
let radiationNoise = createSimplex(20261005);

// Sizes are in world units.
const FOREST_FREQUENCY = 1 / 3200;
const FOREST_WARP = 0.4;
// Forests cover about a third of the land outside settlements.
const FOREST_THRESHOLD = 0.154;
// Broad and faint, so it livens up the ground without looking like stains.
const DETAIL_FREQUENCY = 1 / 600;
const DETAIL_STRENGTH = 0.03;

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

// Patches of a few hundred meters to a kilometer, like forests. The threshold
// makes them cover about 20% of the world; intensity reaches 1 in their hottest
// cores, RADIATION_RANGE above the threshold.
const RADIATION_FREQUENCY = 1 / 3200;
const RADIATION_WARP = 0.4;
const RADIATION_THRESHOLD = 0.305;
const RADIATION_RANGE = 0.3;

// A 32-bit seed from a World ID. Letter case and surrounding spaces don't
// matter, so an ID read aloud or typed on another phone gives the same world.
export function worldSeed(id) {
  let h = 0x811c9dc5;
  for (const char of id.trim().toLowerCase()) {
    h = Math.imul(h ^ char.codePointAt(0), 0x01000193);
  }
  return Math.floor(hash(h, 0, 709) * 4294967296);
}

// Sets the world the terrain belongs to: { seed, origin: { lat, lon } }, or
// null until the game knows it.
export function setWorld(settings) {
  settlementCache.clear();
  worldSet = Boolean(settings);
  if (!settings) return;
  const { seed, origin } = settings;
  const cos = Math.cos((origin.lat * Math.PI) / 180);
  world = {
    lat: origin.lat,
    lon: origin.lon,
    perLat: UNITS_PER_DEGREE,
    // Meridians close in towards the poles; world units don't shrink with them.
    perLon: UNITS_PER_DEGREE * cos,
    scale: (cos * EARTH_RADIUS) / MERCATOR_RADIUS / WORLD_UNIT_METERS,
    salt: Math.floor(hash(seed, 3, 709) * 4294967296) | 0,
  };
  noise = createSimplex(Math.floor(hash(seed, 1, 709) * 4294967296));
  radiationNoise = createSimplex(Math.floor(hash(seed, 2, 709) * 4294967296));
}

export function hasWorld() {
  return worldSet;
}

// World units per Mercator unit, near the center.
export function worldScale() {
  return world.scale;
}

// World coordinates of a Mercator point: meters east and north of the center
// (as world units), along the ground rather than on the map. Over a walk of a
// few kilometers this keeps the land identical at any latitude.
export function toWorld(x, y) {
  const { lat, lon } = fromMercator({ x, y });
  return { x: (lon - world.lon) * world.perLon, y: (lat - world.lat) * world.perLat };
}

export function fromWorld(x, y) {
  return toMercator({ lat: world.lat + y / world.perLat, lon: world.lon + x / world.perLon });
}

// Hash salts differ from world to world, so settlements do too.
function salted(salt) {
  return world.salt ^ salt;
}

const INK = '#5b4a35';
const GRASS_INK = 'rgba(91, 74, 53, 0.55)';

export const BIOMES = {
  plains: { name: 'plains', label: 'Plains', color: [214, 204, 159], iconDensity: 0.1, iconSize: 7, drawIcon: drawGrass },
  forest: { name: 'forest', label: 'Forest', color: [170, 184, 136], iconDensity: 0.75, iconSize: 13, drawIcon: drawTree },
  // Ruins have no icons: their buildings are drawn with the settlement plan.
  ruins: { name: 'ruins', label: 'Ruins', color: [190, 183, 168], iconDensity: 0 },
};

// Octaves of noise, each half the size and 0.45 times as strong, in roughly [-1, 1].
function fbm(x, y, octaves, source = noise) {
  let sum = 0;
  let amplitude = 1;
  let total = 0;
  for (let octave = 0; octave < octaves; octave++) {
    sum += amplitude * source(x * 2 ** octave + 31.7 * octave, y * 2 ** octave - 17.3 * octave);
    total += amplitude;
    amplitude *= 0.45;
  }
  return sum / total;
}

// Positive in forests, negative on plains, and changing smoothly, so the
// map can interpolate it and draw sharp borders from a few samples.
export function forestFieldAt(mx, my) {
  const { x, y } = toWorld(mx, my);
  return forestField(x, y);
}

function forestField(x, y) {
  const fx = x * FOREST_FREQUENCY - 391.5;
  const fy = y * FOREST_FREQUENCY + 145.2;
  // Domain warping bends the noise, so forests don't come out as round blobs.
  const wx = fx + FOREST_WARP * noise(fx + 11.3, fy - 4.1);
  const wy = fy + FOREST_WARP * noise(fx - 21.9, fy + 8.4);
  return fbm(wx, wy, 3) - FOREST_THRESHOLD;
}

export function biomeAt(mx, my) {
  const { x, y } = toWorld(mx, my);
  if (settlementAtWorld(x, y)) return BIOMES.ruins;
  return forestField(x, y) > 0 ? BIOMES.forest : BIOMES.plains;
}

// How radioactive a place is: 0 outside the fallout, rising towards 1 deeper in.
export function radiationAt(mx, my) {
  const { x, y } = toWorld(mx, my);
  const fx = x * RADIATION_FREQUENCY + 211.7;
  const fy = y * RADIATION_FREQUENCY - 87.3;
  // Warped like forests, so the patches aren't round blobs.
  const wx = fx + RADIATION_WARP * radiationNoise(fx + 5.2, fy - 13.6);
  const wy = fy + RADIATION_WARP * radiationNoise(fx - 9.8, fy + 2.7);
  const level = fbm(wx, wy, 3, radiationNoise) - RADIATION_THRESHOLD;
  return level > 0 ? Math.min(1, level / RADIATION_RANGE) : 0;
}

// Brightness factor around 1, for a little small-scale variation inside a biome.
export function groundShadeAt(mx, my) {
  const { x, y } = toWorld(mx, my);
  return 1 + DETAIL_STRENGTH * noise(x * DETAIL_FREQUENCY, y * DETAIL_FREQUENCY);
}

// Settlements

const settlementCache = new Map();
const MAX_CACHED_SETTLEMENTS = 4096;

// The settlement in a grid cell, or null:
// { name, x, y, radius, reach, cos, sin, seed, cx, cy, blocks }, with blocks
// filled in by blocksOf(). Positions and sizes are in world units.
// Its street grid is rotated by an angle of its own; block (i, j) spans
// [i, i + 1] block lengths by [j, j + 1] block widths in the grid's coordinates.
function settlementIn(cx, cy) {
  const key = `${cx},${cy}`;
  if (settlementCache.has(key)) return settlementCache.get(key);
  let settlement = null;
  if (hash(cx, cy, salted(701)) < SETTLEMENT_CHANCE) {
    const size = hash(cx, cy, salted(704));
    const radius = SETTLEMENT_MIN_RADIUS + (SETTLEMENT_MAX_RADIUS - SETTLEMENT_MIN_RADIUS) * size;
    const angle = hash(cx, cy, salted(705)) * (Math.PI / 2);
    const start = SETTLEMENT_NAME_STARTS[Math.floor(hash(cx, cy, salted(707)) * SETTLEMENT_NAME_STARTS.length)];
    const end = SETTLEMENT_NAME_ENDS[Math.floor(hash(cx, cy, salted(708)) * SETTLEMENT_NAME_ENDS.length)];
    settlement = {
      name: start + end,
      x: (cx + 0.15 + 0.7 * hash(cx, cy, salted(702))) * SETTLEMENT_CELL,
      y: (cy + 0.15 + 0.7 * hash(cx, cy, salted(703))) * SETTLEMENT_CELL,
      radius,
      reach: radius * (1 + EDGE_RAGGEDNESS) + 2 * BLOCK_LENGTH,
      cos: Math.cos(angle),
      sin: Math.sin(angle),
      seed: Math.floor(hash(cx, cy, salted(706)) * 1e6),
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
function gridToWorld(settlement, u, v) {
  return {
    x: settlement.x + u * settlement.cos - v * settlement.sin,
    y: settlement.y + u * settlement.sin + v * settlement.cos,
  };
}

// Mercator coordinates of a point given in a settlement's street grid, for drawing.
export function fromGrid(settlement, u, v) {
  const { x, y } = gridToWorld(settlement, u, v);
  return fromWorld(x, y);
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
  const { x, y } = gridToWorld(settlement, u, v);
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

// Settlements that may have blocks inside the given Mercator rectangle.
export function settlementsIn(minMX, minMY, maxMX, maxMY) {
  const { x: minX, y: minY } = toWorld(minMX, minMY);
  const { x: maxX, y: maxY } = toWorld(maxMX, maxMY);
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

// The settlement with a block at the point, streets included, or null.
export function settlementAt(mx, my) {
  const { x, y } = toWorld(mx, my);
  return settlementAtWorld(x, y);
}

function settlementAtWorld(x, y) {
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
      if (blocksOf(settlement).has(Math.floor(u / BLOCK_LENGTH), Math.floor(v / BLOCK_WIDTH))) return settlement;
    }
  }
  return null;
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

// The meadow sign of topographic maps: upright strokes on a short ground line.
function drawGrass(ctx, x, y, size) {
  startIcon(ctx, x, y, size);
  ctx.strokeStyle = GRASS_INK;
  ctx.beginPath();
  ctx.moveTo(-0.5, 0);
  ctx.lineTo(0.5, 0);
  ctx.moveTo(-0.25, 0);
  ctx.lineTo(-0.25, -0.55);
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -0.85);
  ctx.moveTo(0.25, 0);
  ctx.lineTo(0.25, -0.55);
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
