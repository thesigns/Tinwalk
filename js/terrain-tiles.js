// Renders terrain into cached square tiles, so the map doesn't redraw every icon each frame.
//
// Tiles live on zoom levels: on level L one tile pixel covers 2^L Mercator units
// and a tile is TILE_SIZE pixels wide. The map picks the level closest to its
// current scale and stretches the tiles slightly to fit.

import { hash } from './noise.js';
import {
  BIOMES,
  forestFieldAt,
  fromWorld,
  ruinsIn,
  toWorld,
  worldScale,
} from './terrain.js';

export const TILE_SIZE = 256;
const GROUND_STEP = 4; // tile pixels between ground samples
// Forests carry the topographic map's signs, a circle (broadleaf) or a
// chevron (conifer), on a staggered grid this many tile pixels apart, kept
// this far from the forest's edge.
const SIGN_SPACING = 12;
const SIGN_MARGIN = 4;
const SIGN_INK = '#5d6e47';
// Streets are dark; blocks come in many lighter shades of grey, so a town
// doesn't look like floor tiles.
const STREET_SHADE = 0.72;
const BLOCK_SHADES = [0.92, 0.96, 0.99, 1.02, 1.05, 1.08, 1.12];
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
    // Signs go under the ruins, which cover any that fall inside a town.
    this.drawForestSigns(ctx, level, left, top, unitsPerPixel);
    this.drawRuins(ctx, level, left, top, unitsPerPixel);

    this.cache.set(`${level}/${tx}/${ty}`, canvas);
    while (this.cache.size > this.capacity) this.cache.delete(this.cache.keys().next().value);
    return canvas;
  }

  // Samples the forest field on a coarse grid that includes
  // the tile edges, then interpolates them for every tile pixel and only then
  // tells forest from plains. Borders come out smooth and sharp, and
  // neighboring tiles meet without seams. On dense screens the result is
  // scaled up, which keeps the per-pixel work down.
  drawGround(ctx, left, top, unitsPerPixel) {
    const samples = TILE_SIZE / GROUND_STEP + 1;
    const step = GROUND_STEP * unitsPerPixel;
    const field = new Float32Array(samples * samples);
    for (let row = 0; row < samples; row++) {
      for (let col = 0; col < samples; col++) {
        const x = left + col * step;
        const y = top - row * step;
        field[row * samples + col] = forestFieldAt(x, y);
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
        // Far from any border, the cell is plain ground.
        const steepest = Math.max(Math.abs(f10 - f00), Math.abs(f11 - f01), Math.abs(f01 - f00), Math.abs(f11 - f10));
        const nearest = Math.min(Math.abs(f00), Math.abs(f10), Math.abs(f01), Math.abs(f11));
        const sameSide = (f00 > 0) === (f10 > 0) && (f00 > 0) === (f01 > 0) && (f00 > 0) === (f11 > 0);
        // A pixel and a half of antialiasing, plus slack for the field's curve.
        const uniform = sameSide && nearest > (steepest * 3) / GROUND_STEP;
        const coverage = f00 > 0 ? 1 : 0;

        for (let y = 0; y < GROUND_STEP; y++) {
          const ty = (y + 0.5) / GROUND_STEP;
          const fieldLeft = f00 + (f01 - f00) * ty;
          const fieldRight = f10 + (f11 - f10) * ty;
          let i = (row * GROUND_STEP + y) * TILE_SIZE + col * GROUND_STEP;
          for (let x = 0; x < GROUND_STEP; x++, i++) {
            const tx = (x + 0.5) / GROUND_STEP;
            if (uniform) {
              pixels[i] = colorOf(coverage, 1);
              continue;
            }
            const f = fieldLeft + (fieldRight - fieldLeft) * tx;
            // Distance to the border in pixels, from the field's slope here.
            const dx = (fieldRight - fieldLeft) / GROUND_STEP;
            const dy = (f01 - f00 + (f11 - f01 - f10 + f00) * tx) / GROUND_STEP;
            const slope = Math.sqrt(dx * dx + dy * dy);
            const distance = slope > 0 ? f / slope : f > 0 ? Infinity : -Infinity;
            pixels[i] = colorOf(Math.min(1, Math.max(0, 0.5 + distance)), 1);
          }
        }
      }
    }
    this.groundCtx.putImageData(groundImage, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.groundCanvas, 0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  // Ruins are drawn as shapes on top of the ground, not sampled like it, so
  // their blocks and streets stay crisp at every zoom level.
  drawRuins(ctx, level, left, top, unitsPerPixel) {
    const size = TerrainTiles.worldSize(level);
    const [r, g, b] = BIOMES.ruins.color;
    const shaded = (factor) => `rgb(${r * factor}, ${g * factor}, ${b * factor})`;
    const toTile = ([x, y]) => {
      const point = fromWorld(x, y);
      return [(point.x - left) / unitsPerPixel, (top - point.y) / unitsPerPixel];
    };
    const addPolygon = (path, points) => {
      points.forEach((point, index) => (index === 0 ? path.moveTo(...toTile(point)) : path.lineTo(...toTile(point))));
      path.closePath();
    };

    // The dark streets around the blocks on a town's edge are its outline,
    // and unlike a stroke they keep their width at every zoom level.
    const ground = new Path2D();
    const blocks = BLOCK_SHADES.map(() => new Path2D());
    for (const block of ruinsIn(left, top - size, left + size, top)) {
      addPolygon(ground, block.ground);
      if (block.block) addPolygon(blocks[Math.floor(block.shade * BLOCK_SHADES.length)], block.block);
    }
    ctx.fillStyle = shaded(STREET_SHADE);
    ctx.fill(ground);
    BLOCK_SHADES.forEach((shade, index) => {
      ctx.fillStyle = shaded(shade);
      ctx.fill(blocks[index]);
    });
  }

  // The signs sit on a staggered grid fixed in the world, so a sign near a
  // tile edge is drawn the same by both tiles, and players in the same world
  // see the same forest.
  drawForestSigns(ctx, level, left, top, unitsPerPixel) {
    const cell = SIGN_SPACING * unitsPerPixel * worldScale();
    const margin = SIGN_MARGIN * unitsPerPixel;
    const size = TerrainTiles.worldSize(level);
    const topLeft = toWorld(left, top);
    const bottomRight = toWorld(left + size, top - size);
    ctx.strokeStyle = SIGN_INK;
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let row = Math.floor(bottomRight.y / cell) - 1; row <= Math.floor(topLeft.y / cell) + 1; row++) {
      const shift = row % 2 === 0 ? 0 : 0.5;
      for (let col = Math.floor(topLeft.x / cell) - 1; col <= Math.floor(bottomRight.x / cell) + 1; col++) {
        const { x, y } = fromWorld((col + shift) * cell, row * cell);
        // Signs stay clear of the edge, so the forest's outline stays clean.
        const around = [[0, 0], [margin, 0], [-margin, 0], [0, margin], [0, -margin]];
        if (!around.every(([dx, dy]) => forestFieldAt(x + dx, y + dy) > 0)) continue;
        const px = (x - left) / unitsPerPixel;
        const py = (top - y) / unitsPerPixel;
        ctx.beginPath();
        if (hash(col, row, level * 16 + 400) < 0.5) {
          ctx.arc(px, py, 2.1, 0, Math.PI * 2);
        } else {
          ctx.moveTo(px - 2.4, py + 1.4);
          ctx.lineTo(px, py - 1.8);
          ctx.lineTo(px + 2.4, py + 1.4);
        }
        ctx.stroke();
      }
    }
  }
}
