// Keeps the map's terrain tiles: asks for the ones the screen needs, caches
// them, and drops the least recently used.
//
// Tiles are drawn by terrain-render.js, in workers where the browser lets a
// worker draw on an OffscreenCanvas, so a slow tile never stalls panning.
// Elsewhere they are drawn on the page, a few per frame. Either way the map
// asks for tiles each frame with want() and flush(), draws whatever is ready,
// and is told by onTile when another one arrives. With workers, the map also
// asks ahead for tiles it may need soon (see MapView.drawTerrain), since
// they cost the page nothing.

import { renderTile, setTerrainWorld, TILE_SIZE } from './terrain-render.js';

export { TILE_SIZE };
const MIN_CACHED_TILES = 48;
// The cache holds the tiles asked for ahead and two screens, so zooming back
// and forth doesn't re-render them. On a sharp screen a tile takes 1 MB, so
// it holds no more than that.
const CACHED_SCREENS = 2;
const MAX_PIXEL_RATIO = 2;
// Phones have several cores; one is left to the page.
const MAX_WORKERS = 4;

export class TerrainTiles {
  // onTile() is called when a tile rendered in a worker arrives.
  constructor(onTile) {
    this.onTile = onTile;
    this.cache = new Map(); // key -> canvas or ImageBitmap, oldest first
    this.capacity = MIN_CACHED_TILES;
    this.pixelRatio = 1;
    this.settings = null;
    // Bumped whenever rendered tiles go stale, so late arrivals are dropped.
    this.generation = 0;
    this.wanted = [];
    this.wantedKeys = new Set();
    this.inFlight = new Set();
    this.workers = startWorkers((worker, message) => this.received(worker, message), () => this.stopWorkers());
    this.idle = [...this.workers];
  }

  // True when tiles are drawn off the page's thread.
  get background() {
    return this.workers.length > 0;
  }

  has(level, tx, ty) {
    return this.cache.has(`${level}/${tx}/${ty}`);
  }

  static levelFor(unitsPerPixel) {
    return Math.round(Math.log2(unitsPerPixel));
  }

  static worldSize(level) {
    return TILE_SIZE * 2 ** level;
  }

  // A new world makes every rendered tile wrong.
  setWorld(settings) {
    this.settings = settings;
    for (const worker of this.workers) worker.postMessage({ type: 'world', settings });
    setTerrainWorld(settings);
    this.clear();
  }

  clear() {
    this.generation++;
    for (const tile of this.cache.values()) tile.close?.();
    this.cache.clear();
    this.inFlight.clear();
    this.wanted = [];
  }

  setPixelRatio(ratio) {
    const clamped = Math.min(ratio, MAX_PIXEL_RATIO);
    if (clamped === this.pixelRatio) return;
    this.pixelRatio = clamped;
    this.clear();
  }

  // A cache smaller than the tiles the map keeps asking for would evict them
  // and render them again every frame: the visible ones and those asked for
  // ahead.
  setVisibleCount(visible, ahead = 0) {
    this.capacity = Math.max(MIN_CACHED_TILES, visible * CACHED_SCREENS + ahead);
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

  // Starts a frame's list of missing tiles.
  beginFrame() {
    this.wanted = [];
    this.wantedKeys = new Set();
  }

  // Asks for a tile, unless it is ready or on its way; tiles with a lower
  // priority come first.
  want(level, tx, ty, priority) {
    const key = `${level}/${tx}/${ty}`;
    if (this.inFlight.has(key) || this.cache.has(key) || this.wantedKeys.has(key)) return;
    this.wantedKeys.add(key);
    this.wanted.push({ key, level, tx, ty, priority });
  }

  // Starts on the frame's missing tiles. Workers take them one at a time;
  // without workers, tiles are drawn here until the deadline. Returns true
  // when the map should draw another frame to carry on.
  flush(deadline) {
    this.wanted.sort((a, b) => a.priority - b.priority);
    if (this.workers.length > 0) {
      this.dispatch();
      return false;
    }
    while (this.wanted.length > 0 && performance.now() < deadline) {
      const { key, level, tx, ty } = this.wanted.shift();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = Math.round(TILE_SIZE * this.pixelRatio);
      renderTile(canvas.getContext('2d'), level, tx, ty, this.pixelRatio);
      this.store(key, canvas);
    }
    return this.wanted.length > 0;
  }

  dispatch() {
    while (this.idle.length > 0 && this.wanted.length > 0) {
      const { key, level, tx, ty } = this.wanted.shift();
      this.inFlight.add(key);
      this.idle.pop().postMessage({
        type: 'render',
        key,
        generation: this.generation,
        level,
        tx,
        ty,
        ratio: this.pixelRatio,
      });
    }
  }

  received(worker, { key, generation, bitmap }) {
    this.idle.push(worker);
    if (generation === this.generation) {
      this.inFlight.delete(key);
      this.store(key, bitmap);
      this.onTile?.();
    } else {
      bitmap.close();
    }
    this.dispatch();
  }

  store(key, tile) {
    this.cache.set(key, tile);
    while (this.cache.size > this.capacity) {
      const oldest = this.cache.keys().next().value;
      this.cache.get(oldest).close?.();
      this.cache.delete(oldest);
    }
  }

  // A worker that fails (an old browser without module workers, say) hands
  // its tiles back to the page.
  stopWorkers() {
    if (this.workers.length === 0) return;
    for (const worker of this.workers) worker.terminate();
    this.workers = [];
    this.idle = [];
    this.inFlight.clear();
    this.onTile?.();
  }
}

// Workers need an OffscreenCanvas with a 2D context (Safari has had one
// since 16.4) and module workers.
function startWorkers(onMessage, onError) {
  try {
    if (typeof OffscreenCanvas === 'undefined' || !new OffscreenCanvas(1, 1).getContext('2d')) return [];
    const count = Math.max(1, Math.min(MAX_WORKERS, (navigator.hardwareConcurrency || 2) - 1));
    return Array.from({ length: count }, () => {
      const worker = new Worker(new URL('./terrain-worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data }) => onMessage(worker, data);
      worker.onerror = onError;
      return worker;
    });
  } catch {
    return [];
  }
}
