// Short vibrations for game events. The Vibration API works on Android;
// iPhone browsers don't support it, so there the setting is hidden.

import { isSettingOn, saveSetting } from './settings.js';

const SETTING_KEY = 'tinwalk.vibration';

// Vibration and pause lengths in ms.
const PATTERNS = {
  found: [25],
  full: [70],
  survivor: [40, 60, 40],
  unload: [20, 40, 20, 40, 50],
  stamp: [70],
  land: [10],
  drop: [30, 40, 15],
  enemy: [80, 50, 80],
  hit: [40],
  flip: [10],
  stalemate: [30, 50, 30],
  defeat: [120, 60, 120],
  flee: [15, 40, 15, 40, 15],
  craft: [20, 60, 20, 60, 30],
  heal: [20, 80, 40],
  manual: [30, 50, 30],
  listen: [10, 300, 10, 500, 10, 400, 10],
  call: [30, 60, 30, 60, 30, 150, 90, 60, 90],
  static: [15],
  lost: [100, 100, 60],
  landmark: [70, 80, 30],
};

export const canVibrate = typeof navigator.vibrate === 'function';

// A phone can't buzz as fast as a Geiger counter clicks, so it ticks slower.
const CRACKLE_MIN_RATE = 3;
const CRACKLE_MAX_RATE = 12;
const CRACKLE_TICK_MS = 8;

export class Haptics {
  constructor() {
    this.enabled = isSettingOn(SETTING_KEY);
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    saveSetting(SETTING_KEY, enabled);
  }

  play(name) {
    if (this.enabled && canVibrate && PATTERNS[name]) navigator.vibrate(PATTERNS[name]);
  }

  // Ticks at random for `duration` seconds, faster the hotter the fallout (0 to 1).
  crackle(intensity, duration) {
    if (!this.enabled || !canVibrate) return;
    const rate = CRACKLE_MIN_RATE + (CRACKLE_MAX_RATE - CRACKLE_MIN_RATE) * intensity;
    const pattern = [];
    for (let elapsed = 0; elapsed < duration * 1000; ) {
      const pause = Math.round((-Math.log(1 - Math.random()) / rate) * 1000);
      pattern.push(pause, CRACKLE_TICK_MS);
      elapsed += pause + CRACKLE_TICK_MS;
    }
    // A pattern starts with a vibration, so a zero-length one goes first.
    navigator.vibrate([0, ...pattern]);
  }
}
