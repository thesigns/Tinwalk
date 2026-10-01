// Draws the map on a canvas: north-up, centered on a given point, in Web Mercator.

import { fromMercator, mercatorUnitsPerMeter, toMercator } from './geo.js';

const VIEW_WIDTH_METERS = 1500;
const GRID_STEP_METERS = 100;
const GRID_MAJOR_EVERY = 5;
const SCALE_BAR_LENGTHS = [50, 100, 200, 500, 1000, 2000, 5000];

const COLORS = {
  ground: '#d8ccb0',
  grid: 'rgba(90, 70, 40, 0.10)',
  gridMajor: 'rgba(90, 70, 40, 0.22)',
  player: '#d42a1c',
  playerOutline: '#ffffff',
  accuracy: 'rgba(212, 42, 28, 0.15)',
  accuracyOutline: 'rgba(212, 42, 28, 0.5)',
  scaleBar: '#3b3226',
  shelter: 'rgba(58, 110, 64, 0.20)',
  shelterOutline: '#3a6e40',
  shelterLabel: '#1f3d23',
  labelHalo: 'rgba(255, 255, 255, 0.8)',
  searched: 'rgba(110, 80, 40, 0.12)',
  searchedOutline: 'rgba(110, 80, 40, 0.55)',
};

export class MapView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scene = null;
    this.resize();
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
  }

  get metersPerPixel() {
    return VIEW_WIDTH_METERS / Math.min(this.width, this.height);
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

    this.drawGrid(scene.center);
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

  // The grid is anchored to the world, so it moves as the player walks.
  drawGrid(center) {
    const { ctx, width, height } = this;
    const c = toMercator(center);
    const units = this.unitsPerPixel(center);
    const step = GRID_STEP_METERS * mercatorUnitsPerMeter(center.lat);
    const left = c.x - (width / 2) * units;
    const top = c.y + (height / 2) * units;

    ctx.lineWidth = 1;
    for (let i = Math.ceil(left / step); i * step <= left + width * units; i++) {
      const x = (i * step - left) / units;
      ctx.strokeStyle = i % GRID_MAJOR_EVERY === 0 ? COLORS.gridMajor : COLORS.grid;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let i = Math.floor(top / step); i * step >= top - height * units; i--) {
      const y = (top - i * step) / units;
      ctx.strokeStyle = i % GRID_MAJOR_EVERY === 0 ? COLORS.gridMajor : COLORS.grid;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
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

    ctx.fillStyle = COLORS.scaleBar;
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(meters >= 1000 ? `${meters / 1000} km` : `${meters} m`, x, y - 8);
  }
}
