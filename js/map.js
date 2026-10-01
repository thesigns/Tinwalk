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

const COLORS = {
  ground: '#d8ccb0',
  player: '#d42a1c',
  playerOutline: '#ffffff',
  accuracy: 'rgba(212, 42, 28, 0.15)',
  accuracyOutline: 'rgba(212, 42, 28, 0.5)',
  scaleBar: '#3b3226',
  shelter: 'rgba(58, 110, 64, 0.20)',
  shelterOutline: '#3a6e40',
  shelterLabel: '#1f3d23',
  labelHalo: 'rgba(255, 255, 255, 0.8)',
  searched: 'rgba(90, 60, 30, 0.16)',
  searchedOutline: 'rgba(80, 55, 25, 0.75)',
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
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, 0, this.width, this.height);
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
    this.drawScaleBar();
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

    for (let ty = Math.floor(top / tileWorld); ty >= Math.floor((top - height * units) / tileWorld); ty--) {
      for (let tx = Math.floor(left / tileWorld); tx <= Math.floor((left + width * units) / tileWorld); tx++) {
        let tile = this.tiles.get(level, tx, ty);
        if (!tile) {
          if (performance.now() > deadline) {
            complete = false;
            continue;
          }
          tile = this.tiles.render(level, tx, ty);
        }
        // Rounded edges, so neighboring tiles meet without hairline gaps.
        const x0 = Math.round((tx * tileWorld - left) / units);
        const x1 = Math.round(((tx + 1) * tileWorld - left) / units);
        const y0 = Math.round((top - (ty + 1) * tileWorld) / units);
        const y1 = Math.round((top - ty * tileWorld) / units);
        ctx.drawImage(tile, x0, y0, x1 - x0, y1 - y0);
      }
    }
    return complete;
  }

  drawSearchedArea(center, area) {
    const { ctx } = this;
    const { x, y } = this.toScreen(center, area);
    ctx.beginPath();
    ctx.arc(x, y, area.radius / this.metersPerPixel, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.searched;
    ctx.fill();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = COLORS.searchedOutline;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawShelter(center, shelter) {
    const { ctx } = this;
    const { x, y } = this.toScreen(center, shelter);
    const radius = shelter.radius / this.metersPerPixel;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.shelter;
    ctx.fill();
    ctx.strokeStyle = COLORS.shelterOutline;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineJoin = 'round';
    // Above the circle, so it doesn't cover the player standing inside.
    const labelY = y - radius - 4;
    ctx.strokeStyle = COLORS.labelHalo;
    ctx.lineWidth = 4;
    ctx.strokeText(shelter.name, x, labelY);
    ctx.fillStyle = COLORS.shelterLabel;
    ctx.fillText(shelter.name, x, labelY);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  drawPlayer(center, { position, good }) {
    const { ctx } = this;
    const { x, y } = this.toScreen(center, position);
    ctx.globalAlpha = good ? 1 : 0.45;

    ctx.beginPath();
    ctx.arc(x, y, position.accuracy / this.metersPerPixel, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.accuracy;
    ctx.fill();
    ctx.strokeStyle = COLORS.accuracyOutline;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.player;
    ctx.fill();
    ctx.strokeStyle = COLORS.playerOutline;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.globalAlpha = 1;
  }

  drawScaleBar() {
    const { ctx } = this;
    const maxMeters = this.width * 0.3 * this.metersPerPixel;
    const meters = SCALE_BAR_LENGTHS.filter((length) => length <= maxMeters).at(-1) ?? SCALE_BAR_LENGTHS[0];
    const length = meters / this.metersPerPixel;
    const x = 16;
    const y = this.height - 24;

    ctx.strokeStyle = COLORS.scaleBar;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x, y);
    ctx.lineTo(x + length, y);
    ctx.lineTo(x + length, y - 5);
    ctx.stroke();

    const label = meters >= 1000 ? `${meters / 1000} km` : `${meters} m`;
    ctx.font = '12px system-ui, sans-serif';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = COLORS.labelHalo;
    ctx.lineWidth = 3;
    ctx.strokeText(label, x, y - 8);
    ctx.fillStyle = COLORS.scaleBar;
    ctx.fillText(label, x, y - 8);
  }
}
