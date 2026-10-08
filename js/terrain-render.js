// Draws one terrain tile: shaded relief, forests and towns, like the world
// map of an old post-apocalyptic game seen through grainy aerial film.
//
// Pure drawing on a 2D context, with no DOM, so it runs both in the tile
// workers (terrain-worker.js) and, where workers can't draw, on the page.
//
// Tiles live on zoom levels: on level L one tile pixel covers 2^L Web
// Mercator units, and tile (tx, ty) covers x from tx to tx + 1 and y from ty
// to ty + 1 tiles, y growing to the north. The ground is sampled every few
// pixels: heights give the shading, the forest field and the towns the
// colors, and every pixel then gets its own grain. Towns are drawn over it
// as shapes, blended so the land's relief shows through them.

import { buildingsOf, ROOF_TONES } from './buildings.js';
import { hash } from './noise.js';
import { fringe, heightAt, setReliefSeed, slowLandAt } from './relief.js';
import { forestField, ruinsIn, setWorld, toWorld } from './terrain.js';

export const TILE_SIZE = 256;
// Tile pixels between ground samples. Finer looks sharper but costs the
// square of it.
const SAMPLE_STEP = 2;
// Samples between points of the coarse grid that carries the land's slow
// parts: the forest field, the towns, where the ranges are.
const COARSE_STEP = 4;
const SLOW_FIELDS = ['forest', 'town', 'mountain', 'base', 'warpX', 'warpY', 'badlands', 'tone'];

// The light comes from the north-west, as on most shaded maps, so hills
// read as raised rather than sunken.
const LIGHT_AZIMUTH = (315 * Math.PI) / 180;
const LIGHT_ELEVATION = (38 * Math.PI) / 180;
const LIGHT = {
  x: Math.sin(LIGHT_AZIMUTH) * Math.cos(LIGHT_ELEVATION),
  y: Math.cos(LIGHT_AZIMUTH) * Math.cos(LIGHT_ELEVATION),
  z: Math.sin(LIGHT_ELEVATION),
};
// How much steeper slopes look than they are, and how much light reaches
// slopes facing away from it.
const EXAGGERATION = 0.8;
const AMBIENT = 0.28;
const MAX_SHADE = 1.35;
// Film grain, and the coarser grain of a forest's crowns, in color levels.
const GRAIN = 0.09 * 255;
const FOREST_GRAIN = 85;
// Both come from tables of this many pixels square, repeated: random grain
// doesn't show where it repeats, and a table is much faster than hashing
// every pixel of every tile.
const GRAIN_SIZE = 512;
const filmGrain = new Float32Array(GRAIN_SIZE * GRAIN_SIZE);
const crownGrain = new Float32Array(GRAIN_SIZE * GRAIN_SIZE);
for (let y = 0; y < GRAIN_SIZE; y++) {
  for (let x = 0; x < GRAIN_SIZE; x++) {
    const i = y * GRAIN_SIZE + x;
    filmGrain[i] = (hash(x, y, 77) - 0.5) * GRAIN;
    // A forest's crowns and the gaps between them: coarser and darker.
    crownGrain[i] = (hash(x >> 1, y >> 1, 78) + 0.6 * hash(x, y, 79) - 0.95) * FOREST_GRAIN;
  }
}

// Washed-out greys and browns, slightly cool.
const COLORS = {
  dust: [196, 190, 180],
  dustDark: [168, 158, 142],
  rock: [128, 100, 78],
  crest: [228, 226, 220],
  forestDark: [56, 60, 48],
  forestLight: [92, 96, 74],
  town: [110, 106, 100],
  roof: [170, 168, 164],
};
const TINT = [0.98, 1, 1.04];
const SATURATION = 0.8;

// Towns multiply the ground: streets darken it most, blocks in a few
// shades less, buildings cast shadows and rubble lies in heaps.
const STREET_SHADE = 150 / 255;
const BLOCK_SHADES = [0.78, 0.84, 0.9, 0.95].map((shade) => shade * 0.92);
const BUILDING_SHADOW_SHADE = 0.5;
const RUBBLE_SHADE = 0.7;
const SHADOW_LENGTH = 0.9;
const ROOF_ALPHA = 0.75;
// Below this many tile pixels per world unit, houses are smaller than a
// pixel and only the blocks are drawn.
const MIN_BUILDING_SCALE = 0.1;
// Shadows of tall buildings reach into neighboring tiles.
const RUINS_MARGIN = 80;

// Sets the world for this thread's terrain: its biomes and its relief.
export function setTerrainWorld(settings) {
  setWorld(settings);
  if (settings) setReliefSeed(settings.seed);
}

export function renderTile(ctx, level, tx, ty, ratio) {
  const units = 2 ** level;
  const size = TILE_SIZE * units;
  const left = tx * size;
  const top = (ty + 1) * size;
  // World units grow linearly with Mercator x, and over a tile very nearly
  // linearly with Mercator y, so a tile maps to the world by scaling alone.
  // The corners are exact, so neighboring tiles meet without seams.
  const corner = toWorld(left, top);
  const opposite = toWorld(left + size, top - size);
  const tile = {
    x: corner.x,
    y: corner.y,
    scaleX: (opposite.x - corner.x) / TILE_SIZE,
    scaleY: (corner.y - opposite.y) / TILE_SIZE,
  };
  drawGround(ctx, tile);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  drawTowns(ctx, tile);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

function smooth(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
}

function graded(r, g, b) {
  const luminance = 0.3 * r + 0.59 * g + 0.11 * b;
  return [
    (luminance + (r - luminance) * SATURATION) * TINT[0],
    (luminance + (g - luminance) * SATURATION) * TINT[1],
    (luminance + (b - luminance) * SATURATION) * TINT[2],
  ];
}

function drawGround(ctx, tile) {
  // Samples across the tile, edges included, plus a ring for the slopes.
  const count = TILE_SIZE / SAMPLE_STEP + 1;
  const span = count + 2;
  const stepX = SAMPLE_STEP * tile.scaleX;
  const stepY = SAMPLE_STEP * tile.scaleY;
  const minWavelength = 2 * Math.max(stepX, stepY);
  const town = townMask(tile, span);

  // The slow parts on the coarse grid, which covers the samples and their ring.
  const coarseSpan = Math.ceil((span - 1) / COARSE_STEP) + 1;
  const slowFields = Object.fromEntries(SLOW_FIELDS.map((name) => [name, new Float32Array(coarseSpan * coarseSpan)]));
  const land = {};
  for (let row = 0; row < coarseSpan; row++) {
    const y = tile.y - (row * COARSE_STEP - 1) * stepY;
    for (let col = 0; col < coarseSpan; col++) {
      const x = tile.x + (col * COARSE_STEP - 1) * stepX;
      const k = row * coarseSpan + col;
      slowLandAt(x, y, minWavelength, land);
      land.forest = forestField(x, y);
      for (const name of SLOW_FIELDS) slowFields[name][k] = land[name];
    }
  }

  const heights = new Float32Array(span * span);
  const forests = new Float32Array(span * span);
  const mountains = new Float32Array(span * span);
  const ridges = new Float32Array(span * span);
  const towns = new Float32Array(span * span);
  const tones = new Float32Array(span * span);
  for (let row = 0; row < span; row++) {
    const y = tile.y - (row - 1) * stepY;
    const cy = row / COARSE_STEP;
    const r0 = Math.min(coarseSpan - 2, Math.floor(cy));
    const fy = cy - r0;
    for (let col = 0; col < span; col++) {
      const x = tile.x + (col - 1) * stepX;
      const cx = col / COARSE_STEP;
      const c0 = Math.min(coarseSpan - 2, Math.floor(cx));
      const fx = cx - c0;
      const k00 = r0 * coarseSpan + c0;
      const k01 = k00 + coarseSpan;
      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;
      const lerp = (field) => field[k00] * w00 + field[k00 + 1] * w10 + field[k01] * w01 + field[k01 + 1] * w11;
      land.forest = lerp(slowFields.forest);
      land.town = lerp(slowFields.town);
      land.mountain = lerp(slowFields.mountain);
      land.base = lerp(slowFields.base);
      land.warpX = lerp(slowFields.warpX);
      land.warpY = lerp(slowFields.warpY);
      land.badlands = lerp(slowFields.badlands);
      land.tone = lerp(slowFields.tone);
      const k = row * span + col;
      // Towns clear the forest: none grows between the houses.
      const forest = smooth((land.forest + fringe(x, y, minWavelength)) / 0.007 + 0.5) * (1 - town[k]);
      forests[k] = forest;
      heights[k] = heightAt(x, y, minWavelength, forest, land);
      mountains[k] = land.mountain;
      ridges[k] = land.ridge;
      towns[k] = land.town;
      tones[k] = land.tone;
    }
  }

  // Colors per sample, interpolated per pixel below.
  const reds = new Float32Array(count * count);
  const greens = new Float32Array(count * count);
  const blues = new Float32Array(count * count);
  const canopy = new Float32Array(count * count);
  const blend = (color, target, amount) => {
    color[0] += (target[0] - color[0]) * amount;
    color[1] += (target[1] - color[1]) * amount;
    color[2] += (target[2] - color[2]) * amount;
  };
  const color = [0, 0, 0];
  const forestColor = [0, 0, 0];
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      const k = (row + 1) * span + col + 1;
      // Rows run south, so the sample to the north is a row up.
      const dhdx = (heights[k + 1] - heights[k - 1]) / (2 * stepX);
      const dhdy = (heights[k - span] - heights[k + span]) / (2 * stepY);
      const nx = -dhdx * EXAGGERATION;
      const ny = -dhdy * EXAGGERATION;
      const lambert = (nx * LIGHT.x + ny * LIGHT.y + LIGHT.z) / Math.sqrt(nx * nx + ny * ny + 1) / LIGHT.z;
      const slope = Math.sqrt(dhdx * dhdx + dhdy * dhdy) * EXAGGERATION;
      const mountain = mountains[k];
      const ridge = ridges[k];
      const forest = forests[k];
      const tone = tones[k];

      // Dust in lighter and darker patches, rock on the slopes, pale crests.
      const t = 0.5 + 0.5 * tone;
      color[0] = COLORS.dust[0] + (COLORS.dustDark[0] - COLORS.dust[0]) * t;
      color[1] = COLORS.dust[1] + (COLORS.dustDark[1] - COLORS.dust[1]) * t;
      color[2] = COLORS.dust[2] + (COLORS.dustDark[2] - COLORS.dust[2]) * t;
      blend(color, COLORS.rock, smooth(slope * 1.2) * (0.35 + 0.65 * mountain));
      blend(color, COLORS.crest, smooth((ridge - 0.45) / 0.4) * mountain * 0.45);
      if (forest > 0) {
        const mottle = smooth(0.5 + 0.8 * tone);
        for (let i = 0; i < 3; i++) {
          forestColor[i] = COLORS.forestDark[i] + (COLORS.forestLight[i] - COLORS.forestDark[i]) * mottle;
        }
        blend(color, forestColor, forest);
      }
      if (towns[k] > 0) blend(color, COLORS.town, towns[k] * 0.3);
      // Valleys among the ranges lie in shadow, but some light always comes back.
      const occlusion = 1 - 0.3 * mountain * (1 - ridge) ** 2;
      const shade = Math.min(MAX_SHADE, (AMBIENT + (1 - AMBIENT) * Math.max(0, lambert)) * occlusion);
      const [r, g, b] = graded(color[0] * shade, color[1] * shade, color[2] * shade);
      const i = row * count + col;
      reds[i] = r;
      greens[i] = g;
      blues[i] = b;
      canopy[i] = forest;
    }
  }

  const pixelsWide = ctx.canvas.width;
  const image = ctx.createImageData(pixelsWide, pixelsWide);
  // Little-endian RGBA: one write per pixel.
  const pixels = new Uint32Array(image.data.buffer);
  const scale = TILE_SIZE / pixelsWide / SAMPLE_STEP;
  for (let y = 0; y < pixelsWide; y++) {
    const sy = (y + 0.5) * scale;
    const row = Math.min(count - 2, Math.floor(sy));
    const fy = sy - row;
    for (let x = 0; x < pixelsWide; x++) {
      const sx = (x + 0.5) * scale;
      const col = Math.min(count - 2, Math.floor(sx));
      const fx = sx - col;
      const a = row * count + col;
      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;
      const grainIndex = (y % GRAIN_SIZE) * GRAIN_SIZE + (x % GRAIN_SIZE);
      let grain = filmGrain[grainIndex];
      const crowns = canopy[a] * w00 + canopy[a + 1] * w10 + canopy[a + count] * w01 + canopy[a + count + 1] * w11;
      if (crowns > 0.01) grain += crownGrain[grainIndex] * crowns;
      let r = reds[a] * w00 + reds[a + 1] * w10 + reds[a + count] * w01 + reds[a + count + 1] * w11 + grain;
      let g = greens[a] * w00 + greens[a + 1] * w10 + greens[a + count] * w01 + greens[a + count + 1] * w11 + grain;
      let b = blues[a] * w00 + blues[a + 1] * w10 + blues[a + count] * w01 + blues[a + count + 1] * w11 + grain;
      r = r < 0 ? 0 : r > 255 ? 255 : r;
      g = g < 0 ? 0 : g > 255 ? 255 : g;
      b = b < 0 ? 0 : b > 255 ? 255 : b;
      pixels[y * pixelsWide + x] = (255 << 24) | (b << 16) | (g << 8) | r;
    }
  }
  ctx.putImageData(image, 0, 0);
}

let maskCanvas = null;
let maskContext = null;

function createCanvas(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

// How much of each ground sample lies in a town's blocks or streets, from 0
// to 1: the town's plan rasterized at the samples, which is far cheaper than
// asking for every sample which block it falls in.
function townMask(tile, span) {
  const mask = new Float32Array(span * span);
  const stepX = SAMPLE_STEP * tile.scaleX;
  const stepY = SAMPLE_STEP * tile.scaleY;
  const blocks = ruinsIn(tile.x - 2 * stepX, tile.y - span * stepY, tile.x + span * stepX, tile.y + 2 * stepY);
  if (blocks.length === 0) return mask;
  if (maskCanvas?.width !== span) {
    maskCanvas = createCanvas(span, span);
    maskContext = maskCanvas.getContext('2d', { willReadFrequently: true });
  }
  maskContext.clearRect(0, 0, span, span);
  maskContext.beginPath();
  for (const block of blocks) {
    block.ground.forEach(([x, y], index) => {
      // Sample (col, row) lies in the middle of mask pixel (col, row).
      const px = (x - tile.x) / stepX + 1.5;
      const py = (tile.y - y) / stepY + 1.5;
      if (index === 0) maskContext.moveTo(px, py);
      else maskContext.lineTo(px, py);
    });
    maskContext.closePath();
  }
  maskContext.fill();
  const data = maskContext.getImageData(0, 0, span, span).data;
  for (let i = 0; i < span * span; i++) mask[i] = data[i * 4 + 3] / 255;
  return mask;
}

function drawTowns(ctx, tile) {
  const extent = TILE_SIZE * tile.scaleX;
  const blocks = ruinsIn(tile.x - RUINS_MARGIN, tile.y - extent - RUINS_MARGIN, tile.x + extent + RUINS_MARGIN, tile.y + RUINS_MARGIN);
  if (blocks.length === 0) return;
  const trace = (points, dx = 0, dy = 0) => {
    points.forEach(([x, y], index) => {
      const px = (x - tile.x) / tile.scaleX + dx;
      const py = (tile.y - y) / tile.scaleY + dy;
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
  };
  const fillAll = (style, shapes) => {
    if (shapes.length === 0) return;
    ctx.fillStyle = style;
    ctx.beginPath();
    for (const shape of shapes) trace(...shape);
    ctx.fill();
  };
  const shade = (factor) => {
    const [r, g, b] = TINT.map((tint) => Math.round(255 * factor * tint));
    return `rgb(${r}, ${g}, ${b})`;
  };

  // First the town takes the ground's hue away, so no forest green or rust
  // shows between the houses; then it darkens it by multiplying, which keeps
  // the relief and the grain underneath.
  const streets = blocks.map((block) => [block.ground]);
  const [tr, tg, tb] = COLORS.town.map((value, i) => Math.round(value * TINT[i]));
  ctx.globalCompositeOperation = 'color';
  fillAll(`rgb(${tr}, ${tg}, ${tb})`, streets);
  ctx.globalCompositeOperation = 'multiply';
  fillAll(shade(STREET_SHADE), streets);
  BLOCK_SHADES.forEach((factor, index) => {
    const shapes = blocks
      .filter((block) => block.block && Math.floor(block.shade * BLOCK_SHADES.length) === index)
      .map((block) => [block.block]);
    fillAll(shade(factor), shapes);
  });

  const scale = 1 / tile.scaleX;
  if (scale < MIN_BUILDING_SCALE) return;
  // Shadows fall away from the light: to the south-east, down and right.
  const shadowX = -LIGHT.x / Math.hypot(LIGHT.x, LIGHT.y);
  const shadowY = LIGHT.y / Math.hypot(LIGHT.x, LIGHT.y);
  const shadows = [];
  const rubble = [];
  const roofs = ROOF_TONES.map(() => []);
  for (const block of blocks) {
    for (const building of buildingsOf(block)) {
      if (building.rubble) {
        rubble.push([building.points]);
        continue;
      }
      const length = building.height * SHADOW_LENGTH * scale;
      if (length > 0.25) {
        shadows.push([building.points, shadowX * length, shadowY * length]);
        // A long shadow would come loose from a small building without its middle.
        if (length > 1.5) shadows.push([building.points, shadowX * length * 0.5, shadowY * length * 0.5]);
      }
      roofs[building.roof].push([building.points]);
    }
  }
  fillAll(shade(BUILDING_SHADOW_SHADE), shadows);
  fillAll(shade(RUBBLE_SHADE), rubble);
  ctx.globalCompositeOperation = 'source-over';
  ROOF_TONES.forEach(([brightness, rust], index) => {
    const [r, g, b] = graded(
      COLORS.roof[0] * brightness + rust * 14,
      COLORS.roof[1] * brightness + rust * 3,
      COLORS.roof[2] * brightness - rust * 6,
    );
    fillAll(`rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${ROOF_ALPHA})`, roofs[index]);
  });
}
