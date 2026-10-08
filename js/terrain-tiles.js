// Renders terrain into cached square tiles, so the map doesn't redraw every icon each frame.
//
// Tiles live on zoom levels: on level L one tile pixel covers 2^L Mercator units
// and a tile is TILE_SIZE pixels wide. The map picks the level closest to its
// current scale and stretches the tiles slightly to fit.

import { hash } from './noise.js';
import {
  BIOMES,
  BLOCK_LENGTH,
  BLOCK_WIDTH,
  biomeAt,
  blocksOf,
  forestFieldAt,
  fromGrid,
  fromWorld,
  groundShadeAt,
  isEmptyLot,
  settlementsIn,
  toWorld,
  worldScale,
} from './terrain.js';

export const TILE_SIZE = 256;
const GROUND_STEP = 4; // tile pixels between ground samples
const ICON_CELL = 22; // tile pixels between possible icon positions
// Ground along biome borders is darkened, like a hand-tinted map.
const BORDER_SHADE = 0.84;
const BORDER_WIDTH = 3; // tile pixels on each side of the border
// Ruined buildings fill each block but its share of the streets around it.
// Every few streets is a wider main road.
const STREET_INSET = 10;
const MAIN_ROAD_INSET = 22;
const MAIN_ROAD_EVERY = 4;
// Buildings come in a few shades, so blocks don't look like floor tiles.
const BUILDING_SHADES = [0.83, 0.86, 0.9];
// Up close, blocks are drawn as separate buildings (sizes in Mercator units).
const MAX_UNITS_PER_PIXEL_FOR_BUILDINGS = 2;
const BUILDING_DEPTH = 30;
const BUILDING_MIN_LENGTH = 22;
const BUILDING_MAX_LENGTH = 42;
const BUILDING_GAP = 3;
// Share of buildings that are damaged; some of those have collapsed to rubble.
const BUILDING_RUINED_SHARE = 0.4;
const WALL_SHADE = 0.7;
const MIN_CACHED_TILES = 48;
// The cache holds several screens of tiles, so zooming back and forth doesn't re-render them.
const CACHED_SCREENS = 3;
const MAX_PIXEL_RATIO = 2;

export class TerrainTiles {
  constructor() {
    this.cache = new Map(); // key -> canvas, oldest first
    this.capacity = MIN_CACHED_TILES;
    this.pixelRatio = 1;
    this.groundCanvas = document.createElement('canvas');
    this.groundCanvas.width = this.groundCanvas.height = TILE_SIZE;
    this.groundCtx = this.groundCanvas.getContext('2d');
    this.groundImage = this.groundCtx.createImageData(TILE_SIZE, TILE_SIZE);
  }

  static levelFor(unitsPerPixel) {
    return Math.round(Math.log2(unitsPerPixel));
  }

  static worldSize(level) {
    return TILE_SIZE * 2 ** level;
  }

  // A new world makes every rendered tile wrong.
  clear() {
    this.cache.clear();
  }

  setPixelRatio(ratio) {
    const clamped = Math.min(ratio, MAX_PIXEL_RATIO);
    if (clamped === this.pixelRatio) return;
    this.pixelRatio = clamped;
    this.cache.clear();
  }

  // A cache smaller than the screen would evict tiles that are still visible
  // and re-render them every frame.
  setVisibleCount(count) {
    this.capacity = Math.max(MIN_CACHED_TILES, count * CACHED_SCREENS);
  }

  // Returns the cached tile, or null if it hasn't been rendered yet.
  get(level, tx, ty) {
    const key = `${level}/${tx}/${ty}`;
    const tile = this.cache.get(key);
    if (!tile) return null;
    // Move to the end, so the least recently used tile is evicted first.
    this.cache.delete(key);
    this.cache.set(key, tile);
    return tile;
  }

  render(level, tx, ty) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = TILE_SIZE * this.pixelRatio;
    const ctx = canvas.getContext('2d');
    const unitsPerPixel = 2 ** level;
    const left = tx * TerrainTiles.worldSize(level);
    const top = (ty + 1) * TerrainTiles.worldSize(level);

    this.drawGround(ctx, left, top, unitsPerPixel);
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.drawSettlements(ctx, level, left, top, unitsPerPixel);
    this.drawIcons(ctx, level, left, top, unitsPerPixel);

    this.cache.set(`${level}/${tx}/${ty}`, canvas);
    while (this.cache.size > this.capacity) this.cache.delete(this.cache.keys().next().value);
    return canvas;
  }

  // Samples the forest field and ground shade on a coarse grid that includes
  // the tile edges, then interpolates them for every tile pixel and only then
  // tells forest from plains. Borders come out smooth and sharp, and
  // neighboring tiles meet without seams. On dense screens the result is
  // scaled up, which keeps the per-pixel work down.
  drawGround(ctx, left, top, unitsPerPixel) {
    const samples = TILE_SIZE / GROUND_STEP + 1;
    const step = GROUND_STEP * unitsPerPixel;
    const field = new Float32Array(samples * samples);
    const shades = new Float32Array(samples * samples);
    for (let row = 0; row < samples; row++) {
      for (let col = 0; col < samples; col++) {
        const x = left + col * step;
        const y = top - row * step;
        field[row * samples + col] = forestFieldAt(x, y);
        shades[row * samples + col] = groundShadeAt(x, y);
      }
    }

    const { groundImage } = this;
    // Little-endian RGBA: one write per pixel.
    const pixels = new Uint32Array(groundImage.data.buffer);
    const plains = BIOMES.plains.color;
    const forest = BIOMES.forest.color;
    const colorOf = (coverage, shade) =>
      (255 << 24) |
      ((plains[2] + (forest[2] - plains[2]) * coverage) * shade) << 16 |
      ((plains[1] + (forest[1] - plains[1]) * coverage) * shade) << 8 |
      ((plains[0] + (forest[0] - plains[0]) * coverage) * shade);

    for (let row = 0; row < samples - 1; row++) {
      for (let col = 0; col < samples - 1; col++) {
        const k = row * samples + col;
        const f00 = field[k];
        const f10 = field[k + 1];
        const f01 = field[k + samples];
        const f11 = field[k + samples + 1];
        const s00 = shades[k];
        const s10 = shades[k + 1];
        const s01 = shades[k + samples];
        const s11 = shades[k + samples + 1];
        // Far from any border, the cell is plain ground with shading.
        const steepest = Math.max(Math.abs(f10 - f00), Math.abs(f11 - f01), Math.abs(f01 - f00), Math.abs(f11 - f10));
        const nearest = Math.min(Math.abs(f00), Math.abs(f10), Math.abs(f01), Math.abs(f11));
        const sameSide = (f00 > 0) === (f10 > 0) && (f00 > 0) === (f01 > 0) && (f00 > 0) === (f11 > 0);
        const uniform = sameSide && nearest > (steepest * (BORDER_WIDTH + 2)) / GROUND_STEP;
        const coverage = f00 > 0 ? 1 : 0;

        for (let y = 0; y < GROUND_STEP; y++) {
          const ty = (y + 0.5) / GROUND_STEP;
          const shadeLeft = s00 + (s01 - s00) * ty;
          const shadeRight = s10 + (s11 - s10) * ty;
          const fieldLeft = f00 + (f01 - f00) * ty;
          const fieldRight = f10 + (f11 - f10) * ty;
          let i = (row * GROUND_STEP + y) * TILE_SIZE + col * GROUND_STEP;
          for (let x = 0; x < GROUND_STEP; x++, i++) {
            const tx = (x + 0.5) / GROUND_STEP;
            const shade = shadeLeft + (shadeRight - shadeLeft) * tx;
            if (uniform) {
              pixels[i] = colorOf(coverage, shade);
              continue;
            }
            const f = fieldLeft + (fieldRight - fieldLeft) * tx;
            // Distance to the border in pixels, from the field's slope here.
            const dx = (fieldRight - fieldLeft) / GROUND_STEP;
            const dy = (f01 - f00 + (f11 - f01 - f10 + f00) * tx) / GROUND_STEP;
            const slope = Math.sqrt(dx * dx + dy * dy);
            const distance = slope > 0 ? f / slope : f > 0 ? Infinity : -Infinity;
            const border = Math.max(0, 1 - Math.abs(distance) / BORDER_WIDTH);
            pixels[i] = colorOf(Math.min(1, Math.max(0, 0.5 + distance)), shade * (1 - (1 - BORDER_SHADE) * border));
          }
        }
      }
    }
    this.groundCtx.putImageData(groundImage, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.groundCanvas, 0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  // Settlements are drawn as shapes on top of the ground, not sampled like
  // it, so their blocks and streets stay crisp at every zoom level. Up close,
  // blocks break up into buildings, some of them damaged or collapsed.
  drawSettlements(ctx, level, left, top, unitsPerPixel) {
    const size = TerrainTiles.worldSize(level);
    const margin = 2 * BLOCK_LENGTH;
    const detailed = unitsPerPixel <= MAX_UNITS_PER_PIXEL_FOR_BUILDINGS;
    const inset = (index) => (((index % MAIN_ROAD_EVERY) + MAIN_ROAD_EVERY) % MAIN_ROAD_EVERY === 0 ? MAIN_ROAD_INSET : STREET_INSET);
    const [r, g, b] = BIOMES.ruins.color;
    const shaded = (factor) => `rgb(${r * factor}, ${g * factor}, ${b * factor})`;

    for (const settlement of settlementsIn(left, top - size, left + size, top)) {
      const blocks = blocksOf(settlement);
      const corner = (u, v) => {
        const { x, y } = fromGrid(settlement, u, v);
        return [(x - left) / unitsPerPixel, (top - y) / unitsPerPixel];
      };
      const addPolygon = (path, points) => {
        points.forEach(([u, v], index) => (index === 0 ? path.moveTo(...corner(u, v)) : path.lineTo(...corner(u, v))));
        path.closePath();
      };
      const addQuad = (path, u0, v0, u1, v1) => addPolygon(path, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
      const ground = new Path2D();
      const buildings = BUILDING_SHADES.map(() => new Path2D());
      const walls = new Path2D();
      const rubble = new Path2D();
      const outline = new Path2D();
      for (const [i, j] of blocks.list) {
        const center = fromGrid(settlement, (i + 0.5) * BLOCK_LENGTH, (j + 0.5) * BLOCK_WIDTH);
        if (center.x < left - margin || center.x > left + size + margin) continue;
        if (center.y < top - size - margin || center.y > top + margin) continue;
        const u0 = i * BLOCK_LENGTH;
        const v0 = j * BLOCK_WIDTH;
        const u1 = u0 + BLOCK_LENGTH;
        const v1 = v0 + BLOCK_WIDTH;
        addQuad(ground, u0, v0, u1, v1);
        if (!isEmptyLot(settlement, i, j)) {
          const lot = [u0 + inset(i), v0 + inset(j), u1 - inset(i + 1), v1 - inset(j + 1)];
          if (!detailed) {
            const shade = Math.floor(hash(i, j, settlement.seed + 1) * BUILDING_SHADES.length);
            addQuad(buildings[shade], ...lot);
          } else {
            for (const building of buildingsOf(settlement.seed, i, j, ...lot)) {
              if (building.collapsed) {
                addPolygon(rubble, building.points);
              } else {
                addPolygon(buildings[building.shade], building.points);
                addPolygon(walls, building.points);
              }
            }
          }
        }
        // The settlement's edge: block sides with no block beyond them.
        for (const [di, dj, a, b] of [
          [-1, 0, [u0, v0], [u0, v1]],
          [1, 0, [u1, v0], [u1, v1]],
          [0, -1, [u0, v0], [u1, v0]],
          [0, 1, [u0, v1], [u1, v1]],
        ]) {
          if (blocks.has(i + di, j + dj)) continue;
          outline.moveTo(...corner(...a));
          outline.lineTo(...corner(...b));
        }
      }
      ctx.fillStyle = shaded(1);
      ctx.fill(ground);
      BUILDING_SHADES.forEach((shade, index) => {
        ctx.fillStyle = shaded(shade);
        ctx.fill(buildings[index]);
      });
      if (detailed) {
        ctx.lineWidth = 0.8;
        ctx.lineJoin = 'miter';
        ctx.strokeStyle = shaded(WALL_SHADE);
        ctx.stroke(walls);
        ctx.setLineDash([2, 2]);
        ctx.stroke(rubble);
        ctx.setLineDash([]);
      }
      ctx.strokeStyle = shaded(BORDER_SHADE);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.stroke(outline);
    }
  }

  // Icons sit at jittered points of a grid fixed in the world, so an icon near
  // a tile edge is drawn identically by both tiles it overlaps, and players
  // in the same world see the same trees.
  drawIcons(ctx, level, left, top, unitsPerPixel) {
    const cell = ICON_CELL * unitsPerPixel * worldScale();
    const size = TerrainTiles.worldSize(level);
    const salt = level * 16;
    const topLeft = toWorld(left, top);
    const bottomRight = toWorld(left + size, top - size);
    const minX = Math.floor(topLeft.x / cell) - 1;
    const maxX = Math.floor(bottomRight.x / cell) + 1;
    const minY = Math.floor(bottomRight.y / cell) - 1;
    const maxY = Math.floor(topLeft.y / cell) + 1;

    // North to south, so icons further south overlap the ones behind them.
    for (let cy = maxY; cy >= minY; cy--) {
      for (let cx = minX; cx <= maxX; cx++) {
        const { x, y } = fromWorld((cx + hash(cx, cy, salt + 1)) * cell, (cy + hash(cx, cy, salt + 2)) * cell);
        const biome = biomeAt(x, y);
        if (hash(cx, cy, salt + 3) >= biome.iconDensity) continue;
        const iconSize = biome.iconSize * (0.8 + 0.4 * hash(cx, cy, salt + 4));
        biome.drawIcon(ctx, (x - left) / unitsPerPixel, (top - y) / unitsPerPixel, iconSize, hash(cx, cy, salt + 5));
      }
    }
  }
}

// The buildings of a block: two rows along its long streets, with a yard
// between them. Returns [{ points: [[u, v]], shade, collapsed }] in the
// settlement's grid coordinates; damaged buildings miss a corner.
function buildingsOf(seed, i, j, u0, v0, u1, v1) {
  const buildings = [];
  const depth = Math.min(BUILDING_DEPTH, (v1 - v0) / 2);
  for (const [row, b0, b1] of [[0, v0, v0 + depth], [1, v1 - depth, v1]]) {
    let a = u0;
    for (let n = 0; u1 - a > 1; n++) {
      const random = (salt) => hash(i, 2 * j + row, seed + 16 * n + salt);
      let length = BUILDING_MIN_LENGTH + (BUILDING_MAX_LENGTH - BUILDING_MIN_LENGTH) * random(2);
      // The last building takes up the rest of the row.
      if (u1 - a - length < BUILDING_MIN_LENGTH) length = u1 - a;
      const box = [a + BUILDING_GAP / 2, b0, a + length - BUILDING_GAP / 2, b1];
      a += length;
      const damage = random(3);
      if (damage < BUILDING_RUINED_SHARE * 0.4) {
        buildings.push({ points: rectangle(...box), shade: 0, collapsed: true });
        continue;
      }
      const shade = Math.floor(random(4) * BUILDING_SHADES.length);
      const points = damage < BUILDING_RUINED_SHARE ? withMissingCorner(box, random(5), random(6)) : rectangle(...box);
      buildings.push({ points, shade, collapsed: false });
    }
  }
  return buildings;
}

function rectangle(u0, v0, u1, v1) {
  return [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
}

// An L shape: the box with a bite out of one corner, picked by `which`.
function withMissingCorner([u0, v0, u1, v1], which, size) {
  const cut = 0.35 + 0.25 * size;
  const flipU = which < 0.5;
  const flipV = which % 0.5 < 0.25;
  const shape = [[0, 0], [1, 0], [1, 1 - cut], [1 - cut, 1 - cut], [1 - cut, 1], [0, 1]];
  return shape.map(([a, b]) => [
    flipU ? u1 - a * (u1 - u0) : u0 + a * (u1 - u0),
    flipV ? v1 - b * (v1 - v0) : v0 + b * (v1 - v0),
  ]);
}
