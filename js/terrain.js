// Procedural terrain: which biome is where, its ground color and its icons.
// Everything is a pure function of Web Mercator coordinates, so the same
// place on Earth always looks the same.

import { createSimplex } from './noise.js';

const noise = createSimplex(20261001);

// Noise frequency in Mercator units. One Mercator unit is ~0.62 m at 52°N,
// which gives regions from a few hundred meters to about a kilometer there
// (median ~400 m along a straight walk).
const REGION_FREQUENCY = 1 / 4000;
const DETAIL_FREQUENCY = 1 / 90;
const DETAIL_STRENGTH = 0.06;

const RUINS_THRESHOLD = 0.36;
const HILLS_THRESHOLD = 0.3;
const FOREST_THRESHOLD = 0.15;
const DESERT_THRESHOLD = -0.25;

const INK = '#5b4a35';

export const BIOMES = {
  plains: { name: 'plains', color: [214, 204, 159], iconDensity: 0.1, iconSize: 7, drawIcon: drawGrass },
  forest: { name: 'forest', color: [170, 184, 136], iconDensity: 0.75, iconSize: 13, drawIcon: drawTree },
  desert: { name: 'desert', color: [230, 203, 140], iconDensity: 0.2, iconSize: 12, drawIcon: drawCactus },
  hills: { name: 'hills', color: [197, 174, 134], iconDensity: 0.4, iconSize: 18, drawIcon: drawHill },
  ruins: { name: 'ruins', color: [190, 183, 168], iconDensity: 0.5, iconSize: 14, drawIcon: drawRuin },
};

// Two octaves of noise, in roughly [-1, 1].
function fbm(x, y) {
  return (noise(x, y) + 0.3 * noise(2 * x + 31.7, 2 * y - 17.3)) / 1.3;
}

export function biomeAt(x, y) {
  const fx = x * REGION_FREQUENCY;
  const fy = y * REGION_FREQUENCY;
  if (fbm(fx * 1.3 + 101.1, fy * 1.3 + 53.7) > RUINS_THRESHOLD) return BIOMES.ruins;
  if (fbm(fx + 211.3, fy - 77.9) > HILLS_THRESHOLD) return BIOMES.hills;
  const moisture = fbm(fx - 391.5, fy + 145.2);
  if (moisture > FOREST_THRESHOLD) return BIOMES.forest;
  if (moisture < DESERT_THRESHOLD) return BIOMES.desert;
  return BIOMES.plains;
}

// Brightness factor around 1, for a little small-scale variation inside a biome.
export function groundShadeAt(x, y) {
  return 1 + DETAIL_STRENGTH * noise(x * DETAIL_FREQUENCY, y * DETAIL_FREQUENCY);
}

// Icons are drawn with their base at (x, y), extending upward, `size` pixels tall.
// `variant` is a number in [0, 1) used to vary their look.

function startIcon(ctx, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  ctx.lineWidth = 1.2 / size;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
}

function drawGrass(ctx, x, y, size) {
  startIcon(ctx, x, y, size);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-0.35, -0.7);
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -1);
  ctx.moveTo(0, 0);
  ctx.lineTo(0.35, -0.7);
  ctx.stroke();
  ctx.restore();
}

function drawTree(ctx, x, y, size, variant) {
  startIcon(ctx, x, y, size);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -0.4);
  ctx.stroke();
  ctx.beginPath();
  if (variant < 0.5) {
    ctx.arc(0, -0.65, 0.33, 0, Math.PI * 2);
    ctx.fillStyle = '#7d9a58';
  } else {
    ctx.moveTo(-0.32, -0.25);
    ctx.lineTo(0.32, -0.25);
    ctx.lineTo(0, -1);
    ctx.closePath();
    ctx.fillStyle = '#62804a';
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawCactus(ctx, x, y, size, variant) {
  startIcon(ctx, x, y, size);
  const leftArm = 0.4 + variant * 0.2;
  const rightArm = 0.6 - variant * 0.2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -1);
  ctx.moveTo(0, -leftArm);
  ctx.lineTo(-0.3, -leftArm);
  ctx.lineTo(-0.3, -leftArm - 0.25);
  ctx.moveTo(0, -rightArm);
  ctx.lineTo(0.3, -rightArm);
  ctx.lineTo(0.3, -rightArm - 0.25);
  // An outline: a thick ink stroke with a thinner green stroke on top.
  ctx.lineWidth = 0.24;
  ctx.stroke();
  ctx.lineWidth = 0.24 - 2.4 / size;
  ctx.strokeStyle = '#7f9a52';
  ctx.stroke();
  ctx.restore();
}

function drawHill(ctx, x, y, size) {
  startIcon(ctx, x, y, size);
  ctx.beginPath();
  ctx.moveTo(-0.6, 0);
  ctx.quadraticCurveTo(0, -1.1, 0.6, 0);
  ctx.fillStyle = '#b29871';
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.08, -0.45);
  ctx.quadraticCurveTo(0.3, -0.3, 0.36, -0.1);
  ctx.stroke();
  ctx.restore();
}

function drawRuin(ctx, x, y, size, variant) {
  startIcon(ctx, x, y, size);
  if (variant < 0.5) ctx.scale(-1, 1);
  ctx.beginPath();
  ctx.moveTo(-0.4, 0);
  ctx.lineTo(-0.4, -0.85);
  ctx.lineTo(-0.1, -0.85);
  ctx.lineTo(0, -0.6);
  ctx.lineTo(0.15, -0.72);
  ctx.lineTo(0.4, -0.45);
  ctx.lineTo(0.4, 0);
  ctx.closePath();
  ctx.fillStyle = '#9b958b';
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.fillRect(-0.27, -0.6, 0.16, 0.16);
  ctx.fillRect(-0.27, -0.3, 0.16, 0.16);
  ctx.restore();
}
