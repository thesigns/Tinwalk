// Developer mode (?debug): shows GPS diagnostics, lets the player set their
// position by tapping the map, and can speed up game time.

import { enableDebugClock, resetTime, setTimeSpeed, timeOffset, timeSpeed } from './clock.js';
import { isSettingOn, saveSetting } from './settings.js';

export const isDebug = new URLSearchParams(location.search).has('debug');

if (isDebug) enableDebugClock();

// Map center used until the first position is known (Warsaw).
export const DEBUG_START = { lat: 52.2297, lon: 21.0122 };

const BAR_SETTING = 'tinwalk.debugBar';

export class DebugPanel {
  // describeGame() returns a one-line summary of the game state around the player.
  // onTimeChange() is called after the game clock was changed.
  constructor(root, tracker, describeGame, onTimeChange) {
    this.root = root;
    this.tracker = tracker;
    this.describeGame = describeGame;
    this.fields = Object.fromEntries(
      [...root.querySelectorAll('[data-field]')].map((element) => [element.dataset.field, element]),
    );
    this.useGpsButton = root.querySelector('#use-gps');
    this.useGpsButton.addEventListener('click', () => tracker.useGps());
    this.speedButtons = [...root.querySelectorAll('[data-speed]')];
    for (const button of this.speedButtons) {
      button.addEventListener('click', () => {
        setTimeSpeed(Number(button.dataset.speed));
        onTimeChange();
      });
    }
    root.querySelector('#reset-time').addEventListener('click', () => {
      resetTime();
      onTimeChange();
    });

    // Hiding the panel only declutters the screen: debug mode keeps working.
    this.enabled = isSettingOn(BAR_SETTING);
    root.hidden = !this.enabled;
    // Reading ages and game time change even when nothing else happens.
    setInterval(() => this.update(), 1000);
  }

  // Same interface as sound and haptics, so the menu switch can drive it.
  setEnabled(enabled) {
    this.enabled = enabled;
    saveSetting(BAR_SETTING, enabled);
    this.root.hidden = !enabled;
  }

  update() {
    const { position, lastReading, stats, manual, signal } = this.tracker;
    this.fields.source.textContent = manual ? 'Manual' : 'GPS';
    this.fields.signal.textContent = signal;
    this.fields.position.textContent = position
      ? `${position.lat.toFixed(5)}, ${position.lon.toFixed(5)} (±${Math.round(position.accuracy)} m)`
      : '—';
    this.fields['last-reading'].textContent = lastReading
      ? `${formatAge(Date.now() - lastReading.timestamp)}, ±${Math.round(lastReading.accuracy)} m`
      : '—';
    this.fields.stats.textContent =
      `${stats.received} received · ${stats.accepted} accepted · ${stats.poor} poor · ${stats.stale} stale`;
    this.fields.game.textContent = this.describeGame();
    this.fields.time.textContent = `${timeSpeed()}× speed, ${formatOffset(timeOffset())} ahead`;
    this.useGpsButton.hidden = !manual;
    for (const button of this.speedButtons) button.classList.toggle('active', Number(button.dataset.speed) === timeSpeed());
  }
}

function formatAge(ms) {
  return `${Math.round(ms / 1000)} s ago`;
}

function formatOffset(ms) {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
}
