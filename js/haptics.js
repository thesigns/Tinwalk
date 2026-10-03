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
  defeat: [120, 60, 120],
  flee: [15, 40, 15, 40, 15],
  craft: [20, 60, 20, 60, 30],
  heal: [20, 80, 40],
  manual: [30, 50, 30],
};

export const canVibrate = typeof navigator.vibrate === 'function';

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
}
