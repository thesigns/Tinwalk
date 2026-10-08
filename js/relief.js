// Relief: a height field over the world, for the map's hill shading. It is
// only drawn and never changes the rules: biomes stay where terrain.js puts
// them.
//
// The map pretends to show a much larger land than the walk covers, like the
// world map of an old game: mountain ranges of eroded ridges rise wherever a
// slow field says so, broad dusty basins with patches of badlands lie between
// them, and towns sit on flattened ground. Forests hide most of the ridges
// under their canopy and stand a little above the land, so their edges catch
// the light. Heights and sizes are in world units, like the rest of the
// terrain, and the field is a pure function of the world, so players who
// share a World ID see the same mountains.
//
// The parts that change only over hundreds of meters (see slowLandAt) can be
// worked out on a coarse grid and interpolated; heightAt adds the fine detail.

import { createSimplex, hash } from './noise.js';
import { nearTown } from './terrain.js';

let ridges = createSimplex(20261011);
let slow = createSimplex(20261012);
let fine = createSimplex(20261013);

// Where ranges rise: a slow field, so they come and go every few kilometers.
const RANGE_FREQUENCY = 1 / 9000;
const RANGE_OFFSET = -0.05;
const RANGE_WIDTH = 0.5;
// Ridged noise: the longest ridges, their height and how much each finer
// octave adds. Warping bends them, so they don't run in parallel worms.
const RIDGE_WAVELENGTH = 1100;
const RIDGE_HEIGHT = 230;
const RIDGE_GAIN = 0.56;
const RIDGE_WARP = 0.35;
const WARP_FREQUENCY = 1 / (RIDGE_WAVELENGTH * 2.5);
const SWELL_HEIGHT = 45;
const HILL_HEIGHT = 40;
const BADLANDS_HEIGHT = 9;
// The canopy: its height above the ground, the bumps of groves and crowns,
// and how much of the ridges underneath it hides.
const FOREST_HEIGHT = 10;
const CANOPY_HEIGHT = 7;
const FOREST_COVER = 0.85;

export function setReliefSeed(seed) {
  ridges = createSimplex(Math.floor(hash(seed, 11, 709) * 4294967296));
  slow = createSimplex(Math.floor(hash(seed, 12, 709) * 4294967296));
  fine = createSimplex(Math.floor(hash(seed, 13, 709) * 4294967296));
}

function smooth(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
}

// The slow parts of the land at a world point, written into `land`:
//   town: nearTown(), 1 in a town and 0 out in the country,
//   mountain: 0 in the basins, 1 in the ranges,
//   base: the height of broad swells and rolling hills,
//   warpX, warpY: how far the ridges are pushed aside,
//   badlands: where gullies cut the basins, from 0 to 1,
//   tone: lighter (-1) or darker (1) ground.
export function slowLandAt(x, y, minWavelength, land) {
  const town = nearTown(x, y);
  const m = slow(x * RANGE_FREQUENCY + 50.1, y * RANGE_FREQUENCY - 20.7) * 0.65 +
    slow(x * RANGE_FREQUENCY * 2.7 - 11.4, y * RANGE_FREQUENCY * 2.7 + 7.9) * 0.35;
  const mountain = smooth((m - RANGE_OFFSET) / RANGE_WIDTH) * (1 - town * 0.95);
  let base = SWELL_HEIGHT * slow(x / 5000 + 3.3, y / 5000 - 8.1);
  if (minWavelength < 1200) base += HILL_HEIGHT * (0.3 + mountain) * slow(x / 1200 - 7.7, y / 1200 + 2.2);
  land.town = town;
  land.mountain = mountain;
  land.base = base;
  land.warpX = RIDGE_WARP * RIDGE_WAVELENGTH * slow(x * WARP_FREQUENCY + 1.7, y * WARP_FREQUENCY - 9.2);
  land.warpY = RIDGE_WARP * RIDGE_WAVELENGTH * slow(x * WARP_FREQUENCY - 4.4, y * WARP_FREQUENCY + 6.6);
  land.badlands = smooth((slow(x / 2600 - 14.2, y / 2600 + 6.3) + 0.1) / 0.6) * (1 - town);
  land.tone = slow(x / 1500 + 12.5, y / 1500 - 3.1) * 0.6 + slow(x / 400 - 6.2, y / 400 + 1.9) * 0.4;
}

// A ragged fringe for a forest's edge, added to the forest field.
export function fringe(x, y, minWavelength) {
  let f = 0.012 * fine(x / 90 + 17.3, y / 90 - 5.1);
  if (minWavelength < 50) f += 0.006 * fine(x / 25 - 2.9, y / 25 + 8.8);
  return f;
}

// The height at a world point, given its slow land (see slowLandAt) and how
// much of it is forest, from 0 to 1. Octaves shorter than minWavelength are
// skipped: the map can't show them, and they cost the most. Also sets
// land.ridge, from 0 in the valleys to 1 on the crests, for coloring them.
export function heightAt(x, y, minWavelength, forest, land) {
  let h = land.base;

  // Gullies and low ridges, only in patches, so the basins keep open stretches.
  if (minWavelength < 400 && land.badlands > 0) {
    const g = 1 - Math.abs(fine(x / 420 + 9.9, y / 420 - 1.2));
    let gullies = g * g;
    if (minWavelength < 120) {
      const g2 = 1 - Math.abs(fine(x / 130 - 3.3, y / 130 + 4.4));
      gullies += 0.45 * g2 * g2 * gullies;
    }
    h += BADLANDS_HEIGHT * gullies * land.badlands;
  }

  land.ridge = 0;
  if (land.mountain > 0.002) {
    const wx = x + land.warpX;
    const wy = y + land.warpY;
    let frequency = 1 / RIDGE_WAVELENGTH;
    let amplitude = 1;
    // Each octave is weighted by the one before, so the finest detail runs
    // along the crests and the valleys stay smooth, like eroded rock.
    let weight = 1;
    let sum = 0;
    let total = 0;
    for (let octave = 0; octave < 10 && 1 / frequency >= minWavelength; octave++) {
      let n = 1 - Math.abs(ridges(wx * frequency + octave * 13.1, wy * frequency - octave * 7.7));
      n *= n;
      sum += n * amplitude * weight;
      total += amplitude;
      weight = Math.min(1, Math.max(0.15, n * 1.6));
      amplitude *= RIDGE_GAIN;
      frequency *= 2.07;
    }
    land.ridge = total ? sum / total : 0;
    h += sum * RIDGE_HEIGHT * land.mountain * (1 - FOREST_COVER * forest);
  }

  if (forest > 0) {
    let canopy = FOREST_HEIGHT;
    if (minWavelength < 140) canopy += 0.6 * CANOPY_HEIGHT * fine(x / 60 - 31.7, y / 60 + 12.9);
    if (minWavelength < 36) canopy += 0.5 * CANOPY_HEIGHT * Math.abs(fine(x / 15 + 4.1, y / 15 - 9.3));
    h += canopy * forest;
  }
  return h * (1 - land.town * 0.85);
}
