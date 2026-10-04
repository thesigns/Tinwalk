// Renders terrain into cached square tiles, so the map doesn't redraw every icon each frame.
//
// Tiles live on zoom levels: on level L one tile pixel covers 2^L Mercator units
// and a tile is TILE_SIZE pixels wide. The map picks the level closest to its
// current scale and stretches the tiles slightly to fit.

import { hash } from './noise.js';
import { BIOMES, BLOCK_LENGTH, BLOCK_WIDTH, biomeAt, blocksOf, fromGrid, groundShadeAt, isEmptyLot, landAt, settlementsIn } from './terrain.js';

export const TILE_SIZE = 256;
const GROUND_STEP = 4; // tile pixels between ground color samples
const ICON_CELL = 22; // tile pixels between possible icon positions
// Ground along biome borders is darkened, like a hand-tinted map.
const BORDER_SHADE = 0.84;
// Ruined buildings fill each block but its share of the streets around it.
// Every few streets is a wider main road.
const STREET_INSET = 10;
const MAIN_ROAD_INSET = 22;
const MAIN_ROAD_EVERY = 4;
// Buildings come in a few shades, so blocks don't look like floor tiles.
const BUILDING_SHADES = [0.83, 0.86, 0.9];
const MIN_CACHED_TILES = 48;
// The cache holds several screens of tiles, so zooming back and forth doesn't re-render them.
const CACHED_SCREENS = 3;
const MAX_PIXEL_RATIO = 2;

export class TerrainTiles {
  constructor() {
    this.cache = new Map(); // key -> canvas, oldest first
    this.capacity = MIN_CACHED_TILES;
    this.pixelRatio = 1;
    const samples = TILE_SIZE / GROUND_STEP + 1;
    this.groundCanvas = document.createElement('canvas');
    this.groundCanvas.width = samples;
    this.groundCanvas.height = samples;
    this.groundCtx = this.groundCanvas.getContext('2d');
  }

  static levelFor(unitsPerPixel) {
    return Math.round(Math.log2(unitsPerPixel));
  }

  static worldSize(level) {
    return TILE_SIZE * 2 ** level;
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

  // Samples ground colors on a coarse grid that includes the tile edges, and
  // stretches it with smoothing, so neighboring tiles blend without seams.
  drawGround(ctx, left, top, unitsPerPixel) {
    const samples = this.groundCanvas.width;
    const image = this.groundCtx.createImageData(samples, samples);
    const step = GROUND_STEP * unitsPerPixel;

    // Biomes on a grid one sample larger on each side, so samples on the tile
    // edge know their outside neighbors and borders match across tiles.
    const span = samples + 2;
    const biomes = new Array(span * span);
    for (let row = 0; row < span; row++) {
      for (let col = 0; col < span; col++) {
        biomes[row * span + col] = landAt(left + (col - 1) * step, top - (row - 1) * step);
      }
    }

    for (let row = 0; row < samples; row++) {
      for (let col = 0; col < samples; col++) {
        const center = (row + 1) * span + col + 1;
        const biome = biomes[center];
        const onBorder =
          biomes[center - 1] !== biome ||
          biomes[center + 1] !== biome ||
          biomes[center - span] !== biome ||
          biomes[center + span] !== biome;
        const shade = groundShadeAt(left + col * step, top - row * step) * (onBorder ? BORDER_SHADE : 1);
        const i = (row * samples + col) * 4;
        image.data[i] = Math.min(255, biome.color[0] * shade);
        image.data[i + 1] = Math.min(255, biome.color[1] * shade);
        image.data[i + 2] = Math.min(255, biome.color[2] * shade);
        image.data[i + 3] = 255;
      }
    }
    this.groundCtx.putImageData(image, 0, 0);
    ctx.imageSmoothingEnabled = true;
    // Source offset by half a pixel puts the sample centers exactly on the tile edges.
    ctx.drawImage(this.groundCanvas, 0.5, 0.5, samples - 1, samples - 1, 0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  // Settlements are drawn as shapes on top of the ground, not sampled like
  // it, so their blocks and streets stay crisp at every zoom level.
  drawSettlements(ctx, level, left, top, unitsPerPixel) {
    const size = TerrainTiles.worldSize(level);
    const margin = 2 * BLOCK_LENGTH;
    const inset = (index) => (((index % MAIN_ROAD_EVERY) + MAIN_ROAD_EVERY) % MAIN_ROAD_EVERY === 0 ? MAIN_ROAD_INSET : STREET_INSET);
    const [r, g, b] = BIOMES.ruins.color;
    const shaded = (factor) => `rgb(${r * factor}, ${g * factor}, ${b * factor})`;

    for (const settlement of settlementsIn(left, top - size, left + size, top)) {
      const blocks = blocksOf(settlement);
      const corner = (u, v) => {
        const { x, y } = fromGrid(settlement, u, v);
        return [(x - left) / unitsPerPixel, (top - y) / unitsPerPixel];
      };
      const addQuad = (path, u0, v0, u1, v1) => {
        path.moveTo(...corner(u0, v0));
        path.lineTo(...corner(u1, v0));
        path.lineTo(...corner(u1, v1));
        path.lineTo(...corner(u0, v1));
        path.closePath();
      };
      const ground = new Path2D();
      const buildings = BUILDING_SHADES.map(() => new Path2D());
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
          const shade = Math.floor(hash(i, j, settlement.seed + 1) * BUILDING_SHADES.length);
          addQuad(buildings[shade], u0 + inset(i), v0 + inset(j), u1 - inset(i + 1), v1 - inset(j + 1));
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
      ctx.strokeStyle = shaded(BORDER_SHADE);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.stroke(outline);
    }
  }

  // Icons sit at jittered points of a grid fixed in the world, so an icon near
  // a tile edge is drawn identically by both tiles it overlaps.
  drawIcons(ctx, level, left, top, unitsPerPixel) {
    const cell = ICON_CELL * unitsPerPixel;
    const size = TerrainTiles.worldSize(level);
    const salt = level * 16;
    const minX = Math.floor(left / cell) - 1;
    const maxX = Math.floor((left + size) / cell) + 1;
    const minY = Math.floor((top - size) / cell) - 1;
    const maxY = Math.floor(top / cell) + 1;

    // North to south, so icons further south overlap the ones behind them.
    for (let cy = maxY; cy >= minY; cy--) {
      for (let cx = minX; cx <= maxX; cx++) {
        const x = (cx + hash(cx, cy, salt + 1)) * cell;
        const y = (cy + hash(cx, cy, salt + 2)) * cell;
        const biome = biomeAt(x, y);
        if (hash(cx, cy, salt + 3) >= biome.iconDensity) continue;
        const iconSize = biome.iconSize * (0.8 + 0.4 * hash(cx, cy, salt + 4));
        biome.drawIcon(ctx, (x - left) / unitsPerPixel, (top - y) / unitsPerPixel, iconSize, hash(cx, cy, salt + 5));
      }
    }
  }
}
