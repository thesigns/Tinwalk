// Draws the map on a canvas: north-up, centered on a given point, in Web Mercator.
// Handles zooming (pinch, mouse wheel, zoomBy) and reports single taps via onTap.

import { SEARCH_INFLUENCE, SEARCH_RADIUS, searchWeight } from './game.js';
import { fromMercator, mercatorUnitsPerMeter, toMercator } from './geo.js';
import { TerrainTiles } from './terrain-tiles.js';
import { settlementsIn } from './terrain.js';

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
// Grid on which the outline of searched areas is traced.
const OUTLINE_CELL_PX = 5;
// Pencil wobble along that outline, in pixels and in meters of its period.
const WOBBLE_PX = 1.4;
const WOBBLE_PERIOD_METERS = 190;
const LABEL_FONT = '800 17px "Big Shoulders Stencil", Impact, sans-serif';
// Settlement names are printed on the map, larger for larger settlements.
const PLACE_FONT_SIZES = [13, 19];
const PLACE_FONT = (size) => `800 ${size}px "Big Shoulders Stencil", Impact, sans-serif`;
// The shelter icon from the SVG sprite, in its 24x24 box.
const HUT_ICON = new Path2D('M3 11.5 12 4l9 7.5M5.5 10v10.5h13V10M10 20.5V15h4v5.5');

// Kept in sync with the palette in style.css.
const COLORS = {
  paper: '#ece0c0',
  ink: '#33281c',
  paint: '#b4432b',
  paintLight: '#d9654a',
  paintDark: '#82301c',
  greenLight: '#82b453',
  greenDark: '#3a5f1d',
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
    this.effects = []; // short animations drawn over the map
    this.searchedOutline = null; // { key, contours }, traced for the last view
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
  //   player: { position, good, canSearch } | null,
  //   shelter: { lat, lon, name, radius } | null,
  //   searchedAreas: [{ lat, lon, searchedAt }],
  // }
  render(scene) {
    this.scene = scene;
    const { ctx } = this;
    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(0, 0, this.width, this.height);
    this.updateScale();
    if (!scene.center) {
      // Nothing to animate over; let anyone waiting for an effect carry on.
      for (const effect of this.effects) effect.resolve();
      this.effects = [];
      return;
    }

    const complete = this.drawTerrain(scene.center);
    if (!complete) this.requestFrame();
    this.drawPlaceNames(scene.center);
    this.drawSearchedAreas(scene.center, scene.searchedAreas);
    if (scene.shelter) this.drawShelter(scene.center, scene.shelter);
    this.drawEffects();
    if (scene.player) this.drawPlayer(scene.center, scene.player);
  }

  requestFrame() {
    if (this.pendingFrame) return;
    this.pendingFrame = requestAnimationFrame(() => {
      this.pendingFrame = null;
      this.render(this.scene);
    });
  }

  // Plays a short animation on the map and resolves when it ends.
  // draw(progress) is called every frame, with progress going from 0 to 1.
  animate(duration, draw) {
    return new Promise((resolve) => {
      this.effects.push({ start: performance.now(), duration, draw, resolve });
      this.requestFrame();
    });
  }

  drawEffects() {
    const time = performance.now();
    this.effects = this.effects.filter((effect) => {
      const progress = Math.min(1, (time - effect.start) / effect.duration);
      effect.draw(progress);
      if (progress < 1) return true;
      effect.resolve();
      return false;
    });
    if (this.effects.length > 0) this.requestFrame();
  }

  // A red pencil circling the area being searched.
  playSweep(point, radiusMeters, duration) {
    return this.animate(duration, (progress) => {
      const { ctx } = this;
      const { x, y } = this.toScreen(this.scene.center, point);
      const radius = radiusMeters / this.metersPerPixel;
      const eased = progress < 0.5 ? 2 * progress ** 2 : 1 - (-2 * progress + 2) ** 2 / 2;
      const start = -Math.PI / 2;
      const end = start + eased * Math.PI * 2;

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = COLORS.searchedFill;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, radius, start, end);
      ctx.strokeStyle = COLORS.pencil;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x + Math.cos(end) * radius, y + Math.sin(end) * radius, 4, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.pencil;
      ctx.fill();
    });
  }

  // Ink rings spreading out from a point, e.g. when the shelter is stamped onto the map.
  playRipple(point, radiusMeters, duration) {
    return this.animate(duration, (progress) => {
      const { ctx } = this;
      const { x, y } = this.toScreen(this.scene.center, point);
      const radius = Math.max(radiusMeters / this.metersPerPixel, 20);
      for (const delay of [0, 0.25]) {
        const ring = Math.max(0, (progress - delay) / (1 - delay));
        if (ring <= 0 || ring >= 1) continue;
        ctx.beginPath();
        ctx.arc(x, y, radius * (1 + 0.6 * (1 - (1 - ring) ** 3)), 0, Math.PI * 2);
        ctx.globalAlpha = 1 - ring;
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 1 + 3 * (1 - ring);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
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

  // Settlement names, printed in ink over the middle of each settlement.
  // They are drawn here rather than into the terrain tiles, so they use the
  // web font once it loads and stay the same size at every zoom.
  drawPlaceNames(center) {
    const { ctx, width, height } = this;
    const c = toMercator(center);
    const units = this.unitsPerPixel(center);
    const halfWidth = (width / 2) * units;
    const halfHeight = (height / 2) * units;
    const settlements = settlementsIn(c.x - halfWidth, c.y - halfHeight, c.x + halfWidth, c.y + halfHeight);
    if (settlements.length === 0) return;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.letterSpacing = '0.08em';
    for (const settlement of settlements) {
      const x = width / 2 + (settlement.x - c.x) / units;
      const y = height / 2 - (settlement.y - c.y) / units;
      const [smallest, largest] = PLACE_FONT_SIZES;
      ctx.font = PLACE_FONT(Math.round(smallest + (largest - smallest) * settlement.size));
      const label = settlement.name.toUpperCase();
      ctx.strokeStyle = COLORS.paper;
      ctx.lineWidth = 4;
      ctx.strokeText(label, x, y);
      ctx.fillStyle = COLORS.ink;
      ctx.fillText(label, x, y);
    }
    ctx.restore();
  }

  // Searched areas are crossed out in red pencil: they merge into blobs with a
  // wobbly outline and hatching, and each search point gets an X.
  drawSearchedAreas(center, areas) {
    if (areas.length === 0) return;
    const { ctx, width, height } = this;
    const metersPerPixel = this.metersPerPixel;
    const points = areas.map((area) => this.toScreen(center, area));
    // Animations redraw the map every frame, mostly without moving it.
    const key = [center.lat, center.lon, metersPerPixel, width, height, ...areas.map((area) => area.searchedAt)].join();
    if (this.searchedOutline?.key !== key) {
      this.searchedOutline = { key, contours: traceSearchedOutline(points, metersPerPixel, width, height) };
    }
    const { contours } = this.searchedOutline;

    // Hatching and wobble are pinned to the world, so they don't slide
    // under the outline as the map moves with the player.
    const c = toMercator(center);
    const units = this.unitsPerPixel(center);
    const worldX = c.x / units - width / 2;
    const worldY = -c.y / units - height / 2;

    const outline = new Path2D();
    for (const contour of contours) addPolygon(outline, contour);

    ctx.save();
    ctx.fillStyle = COLORS.searchedFill;
    ctx.fill(outline, 'evenodd');
    ctx.clip(outline, 'evenodd');
    ctx.strokeStyle = COLORS.pencilFaint;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    const phase = HATCH_SPACING_PX - (((worldX + worldY) % HATCH_SPACING_PX) + HATCH_SPACING_PX) % HATCH_SPACING_PX;
    for (let k = phase; k < width + height; k += HATCH_SPACING_PX) {
      ctx.moveTo(k, 0);
      ctx.lineTo(k - height, height);
    }
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = COLORS.pencil;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const wavesPerPixel = (2 * Math.PI * metersPerPixel) / WOBBLE_PERIOD_METERS;
    for (const [pass, lineWidth] of [[0, 2.2], [1, 1.2]]) {
      const wobbled = new Path2D();
      for (const contour of contours) {
        addPolygon(
          wobbled,
          contour.map(({ x, y }) => ({
            x: x + WOBBLE_PX * Math.sin((worldY + y) * wavesPerPixel + pass * 2.1) + pass,
            y: y + WOBBLE_PX * Math.sin((worldX + x) * wavesPerPixel * 1.3 + pass * 1.3) + pass,
          })),
        );
      }
      ctx.lineWidth = lineWidth;
      ctx.stroke(wobbled);
    }

    const arm = Math.min(9, (0.35 * SEARCH_RADIUS) / metersPerPixel);
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const { x, y } of points) {
      ctx.moveTo(x - arm, y - arm);
      ctx.lineTo(x + arm, y + arm);
      ctx.moveTo(x + arm, y - arm);
      ctx.lineTo(x - arm, y + arm);
    }
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

  // The player: a pin stuck into the map, with the GPS accuracy around it.
  // Green where the player can search, red where they can't, grey without a good signal.
  drawPlayer(center, { position, good, canSearch }) {
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
    const [light, dark] = !good
      ? [COLORS.grey, COLORS.greyDark]
      : canSearch
        ? [COLORS.greenLight, COLORS.greenDark]
        : [COLORS.paintLight, COLORS.paintDark];
    gradient.addColorStop(0, light);
    gradient.addColorStop(1, dark);
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

function addPolygon(path, points) {
  points.forEach(({ x, y }, index) => (index === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
  path.closePath();
}

// Marching squares: which cell edges the outline crosses, by which corners of
// the cell are inside (1: top left, 2: top right, 4: bottom right, 8: bottom
// left). Edges are 0: top, 1: right, 2: bottom, 3: left. The two saddle cases
// (5 and 10) depend on the middle of the cell and are resolved separately.
const CELL_SEGMENTS = [
  [], [[3, 0]], [[0, 1]], [[3, 1]], [[1, 2]], null, [[0, 2]], [[3, 2]],
  [[2, 3]], [[0, 2]], null, [[1, 2]], [[3, 1]], [[0, 1]], [[3, 0]], [],
];

// Traces the outline of searched areas around the given screen points, where
// their influences add up to 1 (see searchWeight). Returns closed polygons in
// screen pixels; holes are polygons too, so fill them with the even-odd rule.
function traceSearchedOutline(points, metersPerPixel, width, height) {
  const cell = OUTLINE_CELL_PX;
  // The grid reaches past the screen and its border stays empty, so every
  // outline closes, off-screen where it runs into the border.
  const left = -2 * cell;
  const top = -2 * cell;
  const columns = Math.ceil((width + 4 * cell) / cell) + 1;
  const rows = Math.ceil((height + 4 * cell) / cell) + 1;
  const field = new Float32Array(columns * rows);
  const reach = SEARCH_INFLUENCE / metersPerPixel;
  const metersSquaredPerPixel = metersPerPixel ** 2;

  for (const point of points) {
    const i0 = Math.max(1, Math.floor((point.x - reach - left) / cell));
    const i1 = Math.min(columns - 2, Math.ceil((point.x + reach - left) / cell));
    const j0 = Math.max(1, Math.floor((point.y - reach - top) / cell));
    const j1 = Math.min(rows - 2, Math.ceil((point.y + reach - top) / cell));
    for (let j = j0; j <= j1; j++) {
      const dy = top + j * cell - point.y;
      for (let i = i0; i <= i1; i++) {
        const dx = left + i * cell - point.x;
        field[j * columns + i] += searchWeight((dx * dx + dy * dy) * metersSquaredPerPixel);
      }
    }
  }

  // Where the outline crosses each grid edge, keyed by the edge, and which
  // crossings the outline connects it to.
  const crossings = new Map();
  const links = new Map();
  const value = (i, j) => field[j * columns + i];
  const crossing = (edge, i, j) => {
    // Horizontal edges get even keys, vertical ones odd keys.
    const horizontal = edge === 0 || edge === 2;
    const ei = edge === 1 ? i + 1 : i;
    const ej = edge === 2 ? j + 1 : j;
    const key = 2 * (ej * columns + ei) + (horizontal ? 0 : 1);
    if (!crossings.has(key)) {
      const a = value(ei, ej);
      const b = horizontal ? value(ei + 1, ej) : value(ei, ej + 1);
      const t = (1 - a) / (b - a);
      crossings.set(key, {
        x: left + (ei + (horizontal ? t : 0)) * cell,
        y: top + (ej + (horizontal ? 0 : t)) * cell,
      });
    }
    return key;
  };
  const link = (a, b) => {
    if (!links.has(a)) links.set(a, []);
    if (!links.has(b)) links.set(b, []);
    links.get(a).push(b);
    links.get(b).push(a);
  };

  const inside = new Uint8Array(field.length);
  for (let k = 0; k < field.length; k++) inside[k] = field[k] >= 1 ? 1 : 0;
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < columns - 1; i++) {
      const k = j * columns + i;
      const index = inside[k] | (inside[k + 1] << 1) | (inside[k + columns + 1] << 2) | (inside[k + columns] << 3);
      if (index === 0 || index === 15) continue;
      let segments = CELL_SEGMENTS[index];
      if (!segments) {
        const middleInside = (field[k] + field[k + 1] + field[k + columns + 1] + field[k + columns]) / 4 >= 1;
        // Separate the two outside corners if the middle is inside, the two inside ones otherwise.
        const cutTopRight = (index === 5) === middleInside;
        segments = cutTopRight ? [[0, 1], [2, 3]] : [[3, 0], [1, 2]];
      }
      for (const [a, b] of segments) link(crossing(a, i, j), crossing(b, i, j));
    }
  }

  // Every crossing is shared by two neighboring cells, so following the links
  // walks around a closed outline.
  const contours = [];
  const visited = new Set();
  for (const start of links.keys()) {
    if (visited.has(start)) continue;
    const contour = [];
    let previous = null;
    let current = start;
    while (!visited.has(current)) {
      visited.add(current);
      contour.push(crossings.get(current));
      const [a, b] = links.get(current);
      const next = a === previous ? b : a;
      previous = current;
      current = next;
    }
    contours.push(contour);
  }
  return contours;
}
