// Procedural terrain: which biome is where, and the settlements' plans.
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
// remains of settlements, scattered over the world one per cell at most, laid
// out in districts, each with a street grid of its own (see below).
//
// Plains cover about half of the world, forests and ruins a quarter each. A
// straight 3 km walk crosses about 6 borders between them.
//
// Radiation is a separate, invisible layer over the biomes: patches of fallout
// covering about a fifth of the world, regardless of the biome underneath.

import { EARTH_RADIUS, MERCATOR_RADIUS, fromMercator, toMercator } from './geo.js';
import { createSimplex, hash } from './noise.js';
import { area, bisect, containsAll, inset, intersect, middleOf } from './polygon.js';

// The terrain was tuned in Mercator units at 52°N, where one is ~0.62 m, so
// that is the length of a world unit everywhere.
export const WORLD_UNIT_METERS = Math.cos((52 * Math.PI) / 180);

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

// Each cell of this grid may hold one settlement, somewhere in its middle.
const SETTLEMENT_CELL = 3000;
const SETTLEMENT_CHANCE = 0.8;
const SETTLEMENT_MIN_RADIUS = 300;
const SETTLEMENT_MAX_RADIUS = 1500;
// The edge of a settlement wanders in and out by this fraction of its radius.
const EDGE_RAGGEDNESS = 0.3;
const EDGE_FREQUENCY = 1 / 700;
// Districts (~400 m across) are the Voronoi cells of one site per cell of this grid.
const DISTRICT_CELL = 650;
// City blocks (~90 x 60 m), each with its share of the surrounding streets.
const BLOCK_LENGTH = 150;
const BLOCK_WIDTH = 100;
// Half widths: avenues run between districts, streets between blocks.
const AVENUE = 16;
const STREET = 10;
// A block cut down by an avenue to less than this share stays open ground.
const MIN_BLOCK_SHARE = 0.2;
// How far beyond a settlement's edge the land still feels its nearness.
const TOWN_FRINGE = 500;

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
  districtCache.clear();
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

// A Map key for a pair of grid indices, without building a string.
function cellKey(i, j) {
  return i * 1048576 + j;
}

// Hash salts differ from world to world, so settlements do too.
function salted(salt) {
  return world.salt ^ salt;
}

export const BIOMES = {
  plains: { name: 'plains', label: 'Plains' },
  forest: { name: 'forest', label: 'Forest' },
  ruins: { name: 'ruins', label: 'Ruins' },
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

// At a world point: positive in forests, negative on plains, and changing
// smoothly, so the map can sample it sparsely and still draw a clean edge.
export function forestField(x, y) {
  const fx = x * FOREST_FREQUENCY - 391.5;
  const fy = y * FOREST_FREQUENCY + 145.2;
  // Domain warping bends the noise, so forests don't come out as round blobs.
  const wx = fx + FOREST_WARP * noise(fx + 11.3, fy - 4.1);
  const wy = fy + FOREST_WARP * noise(fx - 21.9, fy + 8.4);
  return fbm(wx, wy, 3) - FOREST_THRESHOLD;
}

export function biomeAt(mx, my) {
  const { x, y } = toWorld(mx, my);
  if (ruinedBlockAt(x, y)) return BIOMES.ruins;
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

// Settlements
//
// A settlement is a center and a radius. Its ruins are laid out in
// districts: the cells of a Voronoi diagram over one site per DISTRICT_CELL,
// each district with a street grid at an angle of its own and avenues along
// its edges, so blocks cut by a district's edge come out irregular. A block
// is ruins when its middle lies inside a settlement, which gives towns ragged
// edges, and towns that grow into each other share districts. Every block
// depends only on nearby sites, so tiles can be drawn one at a time.

const settlementCache = new Map();
const MAX_CACHED_SETTLEMENTS = 4096;

// The settlement in a grid cell, or null: { x, y, radius }, in world units.
function settlementIn(cx, cy) {
  const key = cellKey(cx, cy);
  if (settlementCache.has(key)) return settlementCache.get(key);
  let settlement = null;
  if (hash(cx, cy, salted(701)) < SETTLEMENT_CHANCE) {
    const size = hash(cx, cy, salted(704));
    settlement = {
      x: (cx + 0.15 + 0.7 * hash(cx, cy, salted(702))) * SETTLEMENT_CELL,
      y: (cy + 0.15 + 0.7 * hash(cx, cy, salted(703))) * SETTLEMENT_CELL,
      radius: SETTLEMENT_MIN_RADIUS + (SETTLEMENT_MAX_RADIUS - SETTLEMENT_MIN_RADIUS) * size,
    };
  }
  if (settlementCache.size >= MAX_CACHED_SETTLEMENTS) settlementCache.clear();
  settlementCache.set(key, settlement);
  return settlement;
}

// Settlements whose ruins could reach within `reach` of a world point.
function settlementsNear(x, y, reach) {
  const found = [];
  const cx = Math.floor(x / SETTLEMENT_CELL);
  const cy = Math.floor(y / SETTLEMENT_CELL);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const settlement = settlementIn(cx + dx, cy + dy);
      if (settlement && Math.hypot(x - settlement.x, y - settlement.y) < settlement.radius * (1 + EDGE_RAGGEDNESS) + reach) {
        found.push(settlement);
      }
    }
  }
  return found;
}

// How much a world point belongs to a town, for the map's relief: 1 well
// inside a settlement, falling smoothly to 0 a little beyond its edge.
export function nearTown(x, y) {
  let nearest = 0;
  for (const settlement of settlementsNear(x, y, TOWN_FRINGE)) {
    const distance = Math.hypot(x - settlement.x, y - settlement.y);
    const outer = settlement.radius * (1 + EDGE_RAGGEDNESS) + TOWN_FRINGE;
    const inner = settlement.radius * 0.7;
    const t = Math.min(1, Math.max(0, (outer - distance) / (outer - inner)));
    nearest = Math.max(nearest, t * t * (3 - 2 * t));
  }
  return nearest;
}

// Which of the candidate settlements a world point lies in, or null. Where
// settlements meet, the nearer edge wins.
function settlementCovering(x, y, candidates) {
  let best = null;
  let bestScore = Infinity;
  for (const settlement of candidates) {
    const distance = Math.hypot(x - settlement.x, y - settlement.y);
    if (distance > settlement.radius * (1 + EDGE_RAGGEDNESS)) continue;
    const edge = settlement.radius * (1 + EDGE_RAGGEDNESS * noise(x * EDGE_FREQUENCY + 7.7, y * EDGE_FREQUENCY - 3.3));
    if (distance >= edge) continue;
    const score = distance - settlement.radius;
    if (score < bestScore) {
      bestScore = score;
      best = settlement;
    }
  }
  return best;
}

// Districts

const districtCache = new Map();
const MAX_CACHED_DISTRICTS = 2048;

// The district whose site lies in a grid cell: { x, y, i, j, cos, sin, blocks },
// with blocks filled in by blocksOf().
function districtIn(i, j) {
  const key = cellKey(i, j);
  let district = districtCache.get(key);
  if (!district) {
    const angle = hash(i, j, salted(903)) * Math.PI;
    district = {
      x: (i + 0.2 + 0.6 * hash(i, j, salted(901))) * DISTRICT_CELL,
      y: (j + 0.2 + 0.6 * hash(i, j, salted(902))) * DISTRICT_CELL,
      i,
      j,
      cos: Math.cos(angle),
      sin: Math.sin(angle),
      blocks: null,
    };
    if (districtCache.size >= MAX_CACHED_DISTRICTS) districtCache.clear();
    districtCache.set(key, district);
  }
  return district;
}

// The district a world point lies in: the one with the nearest site.
function districtAt(x, y) {
  const i = Math.floor(x / DISTRICT_CELL);
  const j = Math.floor(y / DISTRICT_CELL);
  let best = null;
  let bestDistance = Infinity;
  for (let dj = -2; dj <= 2; dj++) {
    for (let di = -2; di <= 2; di++) {
      const district = districtIn(i + di, j + dj);
      const distance = (district.x - x) ** 2 + (district.y - y) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = district;
      }
    }
  }
  return best;
}

function toGrid(district, x, y) {
  const dx = x - district.x;
  const dy = y - district.y;
  return [dx * district.cos + dy * district.sin, -dx * district.sin + dy * district.cos];
}

// A point of a district's street grid in world units: u runs along the
// blocks, v across them.
export function fromGrid(district, u, v) {
  return [district.x + u * district.cos - v * district.sin, district.y + u * district.sin + v * district.cos];
}

function gridRectangle(district, u0, v0, u1, v1) {
  return [fromGrid(district, u0, v0), fromGrid(district, u1, v0), fromGrid(district, u1, v1), fromGrid(district, u0, v1)];
}

// The district's ruined blocks by cellKey() of their grid indices, computed once:
// { ground, block, shade, box, district, u0, v0, u1, v1, density }, in world
// units. ground is the block with its share of the streets, cut to the
// district; block is what stands between the streets, or null where an
// avenue left too little of it. u0..u1 and v0..v1 are the block's whole
// rectangle on the district's grid (see fromGrid), before any cutting, and
// density goes from 1 in the middle of its town to 0 on the edge.
function blocksOf(district) {
  if (district.blocks) return district.blocks;
  // Most districts are out in the country: skip them without laying out a grid.
  const reach = 2 * DISTRICT_CELL;
  const candidates = settlementsNear(district.x, district.y, reach);
  district.blocks = new Map();
  if (candidates.length === 0) return district.blocks;
  // The Voronoi cell: a square cut by the bisectors to the sites around.
  let cell = [
    [district.x - reach, district.y - reach],
    [district.x + reach, district.y - reach],
    [district.x + reach, district.y + reach],
    [district.x - reach, district.y + reach],
  ];
  for (let dj = -2; dj <= 2; dj++) {
    for (let di = -2; di <= 2; di++) {
      if (di || dj) cell = bisect(cell, district, districtIn(district.i + di, district.j + dj));
    }
  }
  const inner = inset(cell, AVENUE);
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const [x, y] of cell) {
    const [u, v] = toGrid(district, x, y);
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }
  const blocks = district.blocks;
  for (let gj = Math.floor(minV / BLOCK_WIDTH); gj <= Math.floor(maxV / BLOCK_WIDTH); gj++) {
    for (let gi = Math.floor(minU / BLOCK_LENGTH); gi <= Math.floor(maxU / BLOCK_LENGTH); gi++) {
      const u0 = gi * BLOCK_LENGTH;
      const v0 = gj * BLOCK_WIDTH;
      const [mx, my] = fromGrid(district, u0 + BLOCK_LENGTH / 2, v0 + BLOCK_WIDTH / 2);
      if (!candidates.some((s) => Math.hypot(mx - s.x, my - s.y) < s.radius * (1 + EDGE_RAGGEDNESS) + BLOCK_LENGTH)) continue;
      // Most blocks lie wholly inside the district and need no cutting.
      const rectangle = gridRectangle(district, u0, v0, u0 + BLOCK_LENGTH, v0 + BLOCK_WIDTH);
      const ground = containsAll(cell, rectangle) ? rectangle : intersect(rectangle, cell);
      if (ground.length < 3) continue;
      const [cx, cy] = middleOf(ground);
      const settlement = settlementCovering(cx, cy, candidates);
      if (!settlement) continue;
      const full = gridRectangle(district, u0 + STREET, v0 + STREET, u0 + BLOCK_LENGTH - STREET, v0 + BLOCK_WIDTH - STREET);
      const block = inner.length < 3 ? [] : containsAll(inner, full) ? full : intersect(full, inner);
      const xs = ground.map(([x]) => x);
      const ys = ground.map(([, y]) => y);
      blocks.set(cellKey(gi, gj), {
        ground,
        block: block.length >= 3 && Math.abs(area(block)) > MIN_BLOCK_SHARE * Math.abs(area(full)) ? block : null,
        // From 0 to 1, so the map can tell blocks apart by their shade.
        shade: hash(district.i * 1024 + gi, district.j * 1024 + gj, salted(920)),
        box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
        district,
        u0: u0 + STREET,
        v0: v0 + STREET,
        u1: u0 + BLOCK_LENGTH - STREET,
        v1: v0 + BLOCK_WIDTH - STREET,
        density: Math.max(0, 1 - Math.hypot(cx - settlement.x, cy - settlement.y) / (settlement.radius * (1 + EDGE_RAGGEDNESS))),
      });
    }
  }
  return blocks;
}

// The ruined block at a world point, streets included, or undefined.
function ruinedBlockAt(x, y) {
  const district = districtAt(x, y);
  const [u, v] = toGrid(district, x, y);
  return blocksOf(district).get(cellKey(Math.floor(u / BLOCK_LENGTH), Math.floor(v / BLOCK_WIDTH)));
}

// Ruined blocks that may show inside a rectangle of world units.
export function ruinsIn(minX, minY, maxX, maxY) {
  const found = [];
  for (let j = Math.floor(minY / DISTRICT_CELL) - 1; j <= Math.floor(maxY / DISTRICT_CELL) + 1; j++) {
    for (let i = Math.floor(minX / DISTRICT_CELL) - 1; i <= Math.floor(maxX / DISTRICT_CELL) + 1; i++) {
      for (const block of blocksOf(districtIn(i, j)).values()) {
        const [x0, y0, x1, y1] = block.box;
        if (x1 >= minX && x0 <= maxX && y1 >= minY && y0 <= maxY) found.push(block);
      }
    }
  }
  return found;
}
