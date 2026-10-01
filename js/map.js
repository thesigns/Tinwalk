// Draws the map on a canvas: north-up, centered on a given point, in Web Mercator.
// Handles zooming (pinch, mouse wheel, zoomBy) and reports single taps via onTap.

import { fromMercator, mercatorUnitsPerMeter, toMercator } from './geo.js';
import { TerrainTiles } from './terrain-tiles.js';

// How many meters the shorter side of the screen covers.
const DEFAULT_VIEW_WIDTH_METERS = 1500;
const MIN_VIEW_WIDTH_METERS = 500;
const MAX_VIEW_WIDTH_METERS = 5000;
const WHEEL_ZOOM_SPEED = 0.0015;
const TAP_TOLERANCE_PX = 10;
// Time per frame spent rendering missing tiles; the rest is drawn in later frames.
const TILE_RENDER_BUDGET_MS = 12;
const SCALE_BAR_LENGTHS = [50, 100, 200, 500, 1000, 2000, 5000];
const MAX_SCALE_BAR_PX = 110;
const HATCH_SPACING_PX = 7;
const LABEL_FONT = '800 17px "Big Shoulders Stencil", Impact, sans-serif';
// The shelter icon from the SVG sprite, in its 24x24 box.
const HUT_ICON = new Path2D('M3 11.5 12 4l9 7.5M5.5 10v10.5h13V10M10 20.5V15h4v5.5');

// Kept in sync with the palette in style.css.
const COLORS = {
  paper: '#ece0c0',
  ink: '#33281c',
  paint: '#b4432b',
  paintLight: '#d9654a',
  paintDark: '#82301c',
  grey: '#a39d90',
  greyDark: '#6b665c',
  tape: 'rgba(236, 226, 190, 0.94)',
  shadow: 'rgba(40, 28, 15, 0.35)',
  accuracy: 'rgba(180, 67, 43, 0.12)',
  accuracyOutline: 'rgba(180, 67, 43, 0.45)',
  shelterFill: 'rgba(51, 40, 28, 0.1)',
  searchedFill: 'rgba(180, 60, 35, 0.07)',
  pencil: 'rgba(170, 45, 25, 0.85)',
  pencilFaint: 'rgba(170, 45, 25, 0.3)',
};

export class MapView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scene = null;
    this.tiles = new TerrainTiles();
    this.viewWidthMeters = DEFAULT_VIEW_WIDTH_METERS;
    this.pendingFrame = null;
    this.onTap = null; // (point: { lat, lon }) => void
    this.onScaleChange = null; // (meters, pixels) => void
    this.scale = null;
    this.resize();
    this.setUpGestures();
    window.addEventListener('resize', () => {
      this.resize();
      if (this.scene) this.render(this.scene);
    });
  }

  resize() {
    const ratio = window.devicePixelRatio || 1;
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.width * ratio);
    this.canvas.height = Math.round(this.height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.tiles.setPixelRatio(ratio);
  }

  get metersPerPixel() {
    return this.viewWidthMeters / Math.min(this.width, this.height);
  }

  zoomBy(factor) {
    this.setViewWidth(this.viewWidthMeters * factor);
  }

  setViewWidth(meters) {
    this.viewWidthMeters = Math.min(MAX_VIEW_WIDTH_METERS, Math.max(MIN_VIEW_WIDTH_METERS, meters));
    if (this.scene) this.render(this.scene);
  }

  setUpGestures() {
    const { canvas } = this;
    const pointers = new Map(); // pointerId -> { x, y }
    let pinch = null; // { distance, viewWidth } when the pinch started
    let tap = null; // where a single pointer went down, while it may still be a tap

    const positionOf = (event) => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const pinchDistance = () => {
      const [a, b] = pointers.values();
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    canvas.addEventListener('pointerdown', (event) => {
      canvas.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, positionOf(event));
      tap = pointers.size === 1 ? positionOf(event) : null;
      if (pointers.size === 2) pinch = { distance: pinchDistance(), viewWidth: this.viewWidthMeters };
    });

    canvas.addEventListener('pointermove', (event) => {
      if (!pointers.has(event.pointerId)) return;
      const point = positionOf(event);
      pointers.set(event.pointerId, point);
      if (tap && Math.hypot(point.x - tap.x, point.y - tap.y) > TAP_TOLERANCE_PX) tap = null;
      const distance = pointers.size === 2 ? pinchDistance() : 0;
      if (pinch && distance > 0) this.setViewWidth((pinch.viewWidth * pinch.distance) / distance);
    });

    const release = (event) => {
      if (!pointers.delete(event.pointerId)) return;
      if (event.type === 'pointerup' && tap && pointers.size === 0) {
        const point = this.screenToLatLon(tap.x, tap.y);
        if (point) this.onTap?.(point);
      }
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) tap = null;
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);

    canvas.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        this.zoomBy(Math.exp(event.deltaY * WHEEL_ZOOM_SPEED));
      },
      { passive: false },
    );
  }

  // scene: {
  //   center: { lat, lon } | null,
  //   player: { position, good } | null,
  //   shelter: { lat, lon, name, radius } | null,
  //   searchedAreas: [{ lat, lon, radius }],
  // }
  render(scene) {
    this.scene = scene;
    const { ctx } = this;
    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(0, 0, this.width, this.height);
    this.updateScale();
    if (!scene.center) return;

    const complete = this.drawTerrain(scene.center);
    if (!complete && !this.pendingFrame) {
      this.pendingFrame = requestAnimationFrame(() => {
        this.pendingFrame = null;
        this.render(this.scene);
      });
    }
    for (const area of scene.searchedAreas) this.drawSearchedArea(scene.center, area);
    if (scene.shelter) this.drawShelter(scene.center, scene.shelter);
    if (scene.player) this.drawPlayer(scene.center, scene.player);
  }

  // Mercator units per screen pixel around the given center.
  unitsPerPixel(center) {
    return this.metersPerPixel * mercatorUnitsPerMeter(center.lat);
  }

  toScreen(center, point) {
    const c = toMercator(center);
    const p = toMercator(point);
    const units = this.unitsPerPixel(center);
    return {
      x: this.width / 2 + (p.x - c.x) / units,
      y: this.height / 2 - (p.y - c.y) / units,
    };
  }

  screenToLatLon(x, y) {
    const center = this.scene?.center;
    if (!center) return null;
    const c = toMercator(center);
    const units = this.unitsPerPixel(center);
    return fromMercator({
      x: c.x + (x - this.width / 2) * units,
      y: c.y - (y - this.height / 2) * units,
    });
  }

  // Draws the terrain tiles covering the screen. Returns false if some tiles
  // weren't rendered yet because the frame's time budget ran out.
  drawTerrain(center) {
    const { ctx, width, height } = this;
    const c = toMercator(center);
    const units = this.unitsPerPixel(center);
    const level = TerrainTiles.levelFor(units);
    const tileWorld = TerrainTiles.worldSize(level);
    const left = c.x - (width / 2) * units;
    const top = c.y + (height / 2) * units;
    const deadline = performance.now() + TILE_RENDER_BUDGET_MS;
    let complete = true;

    const minX = Math.floor(left / tileWorld);
    const maxX = Math.floor((left + width * units) / tileWorld);
    const minY = Math.floor((top - height * units) / tileWorld);
    const maxY = Math.floor(top / tileWorld);
    this.tiles.setVisibleCount((maxX - minX + 1) * (maxY - minY + 1));

    for (let ty = maxY; ty >= minY; ty--) {
      for (let tx = minX; tx <= maxX; tx++) {
        // Rounded edges, so neighboring tiles meet without hairline gaps.
        const x0 = Math.round((tx * tileWorld - left) / units);
        const x1 = Math.round(((tx + 1) * tileWorld - left) / units);
        const y0 = Math.round((top - (ty + 1) * tileWorld) / units);
        const y1 = Math.round((top - ty * tileWorld) / units);
        let tile = this.tiles.get(level, tx, ty);
        if (!tile && performance.now() < deadline) tile = this.tiles.render(level, tx, ty);
        if (tile) {
          ctx.drawImage(tile, x0, y0, x1 - x0, y1 - y0);
        } else {
          complete = false;
          this.drawTileFallback(level, tx, ty, x0, y0, x1 - x0, y1 - y0);
        }
      }
    }
    return complete;
  }

  // Until a tile is rendered, stretches what's cached on the neighboring zoom
  // levels over its place, so zooming doesn't flash empty squares.
  drawTileFallback(level, tx, ty, x, y, width, height) {
    const { ctx } = this;
    const parent = this.tiles.get(level + 1, Math.floor(tx / 2), Math.floor(ty / 2));
    if (parent) {
      const half = parent.width / 2;
      // Tile y grows to the north, canvas y grows downward.
      const sx = (tx - 2 * Math.floor(tx / 2)) * half;
      const sy = (1 - (ty - 2 * Math.floor(ty / 2))) * half;
      ctx.drawImage(parent, sx, sy, half, half, x, y, width, height);
      return;
    }
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const child = this.tiles.get(level - 1, 2 * tx + dx, 2 * ty + dy);
        if (child) ctx.drawImage(child, x + (dx * width) / 2, y + ((1 - dy) * height) / 2, width / 2, height / 2);
      }
    }
  }

  // Searched areas are crossed out in red pencil: a wobbly outline, hatching and an X.
  drawSearchedArea(center, area) {
    const { ctx } = this;
    const { x, y } = this.toScreen(center, area);
    const radius = area.radius / this.metersPerPixel;
    // Each area gets its own wobble, stable between frames.
    const phase = (area.searchedAt % 1000) / 159;

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.searchedFill;
    ctx.fill();
    ctx.clip();
    ctx.strokeStyle = COLORS.pencilFaint;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let offset = -radius * 2; offset < radius * 2; offset += HATCH_SPACING_PX) {
      ctx.moveTo(x + offset - radius, y + radius);
      ctx.lineTo(x + offset + radius, y - radius);
    }
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = COLORS.pencil;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [pass, width] of [[0, 2.2], [1, 1.2]]) {
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let step = 0; step <= 48; step++) {
        const angle = (step / 48) * Math.PI * 2 + pass * 0.4;
        const r = radius + 1.4 * Math.sin(3 * angle + phase + pass) + pass * 1.5;
        const px = x + Math.cos(angle) * r;
        const py = y + Math.sin(angle) * r;
        if (step === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    const arm = Math.min(9, radius * 0.35);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - arm, y - arm);
    ctx.lineTo(x + arm, y + arm);
    ctx.moveTo(x + arm, y - arm);
    ctx.lineTo(x - arm, y + arm);
    ctx.stroke();
  }

  // The shelter: a double ink ring, a stamped hut and its name on a strip of tape.
  drawShelter(center, shelter) {
    const { ctx } = this;
    const { x, y } = this.toScreen(center, shelter);
    const radius = shelter.radius / this.metersPerPixel;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.shelterFill;
    ctx.fill();
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    if (radius > 12) {
      ctx.beginPath();
      ctx.arc(x, y, radius - 4, 0, Math.PI * 2);
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Stamp
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.paper;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.paint;
    ctx.stroke();
    ctx.save();
    ctx.translate(x - 10, y - 10.5);
    ctx.scale(20 / 24, 20 / 24);
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(HUT_ICON);
    ctx.restore();

    // Name on tape, above the circle so it doesn't cover the player standing inside.
    const label = shelter.name.toUpperCase();
    ctx.font = LABEL_FONT;
    const textWidth = ctx.measureText(label).width;
    const labelY = y - Math.max(radius, 18) - 18;
    ctx.save();
    ctx.translate(x, labelY);
    ctx.rotate(-0.03);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = COLORS.tape;
    ctx.fillRect(-textWidth / 2 - 10, -13, textWidth + 20, 26);
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = COLORS.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 1);
    ctx.restore();
  }

  // The player: a red pin stuck into the map, with the GPS accuracy around it.
  drawPlayer(center, { position, good }) {
    const { ctx } = this;
    const { x, y } = this.toScreen(center, position);
    ctx.globalAlpha = good ? 1 : 0.5;

    const accuracy = position.accuracy / this.metersPerPixel;
    if (accuracy > 8) {
      ctx.beginPath();
      ctx.arc(x, y, accuracy, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.accuracy;
      ctx.fill();
      ctx.strokeStyle = COLORS.accuracyOutline;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.ellipse(x + 2, y, 7, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.shadow;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x - 3, y - 7, x - 11, y - 14, x - 11, y - 23);
    ctx.arc(x, y - 23, 11, Math.PI, 0);
    ctx.bezierCurveTo(x + 11, y - 14, x + 3, y - 7, x, y);
    const gradient = ctx.createLinearGradient(x - 11, y - 34, x + 11, y);
    gradient.addColorStop(0, good ? COLORS.paintLight : COLORS.grey);
    gradient.addColorStop(1, good ? COLORS.paintDark : COLORS.greyDark);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y - 23, 4.2, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.paper;
    ctx.fill();

    ctx.globalAlpha = 1;
  }

  // Picks a round scale bar length and reports it when it changes.
  updateScale() {
    const maxMeters = MAX_SCALE_BAR_PX * this.metersPerPixel;
    const meters = SCALE_BAR_LENGTHS.filter((length) => length <= maxMeters).at(-1) ?? SCALE_BAR_LENGTHS[0];
    const pixels = Math.round(meters / this.metersPerPixel);
    if (meters === this.scale?.meters && pixels === this.scale?.pixels) return;
    this.scale = { meters, pixels };
    this.onScaleChange?.(meters, pixels);
  }
}
