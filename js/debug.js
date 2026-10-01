// Developer mode (?debug): shows GPS diagnostics and lets the player set their position by tapping the map.

export const isDebug = new URLSearchParams(location.search).has('debug');

// Map center used until the first position is known (Warsaw).
export const DEBUG_START = { lat: 52.2297, lon: 21.0122 };

export class DebugPanel {
  constructor(root, tracker) {
    this.root = root;
    this.tracker = tracker;
    this.fields = Object.fromEntries(
      [...root.querySelectorAll('[data-field]')].map((element) => [element.dataset.field, element]),
    );
    this.useGpsButton = root.querySelector('#use-gps');
    this.useGpsButton.addEventListener('click', () => tracker.useGps());

    root.hidden = false;
    // Reading ages change even when no new readings arrive.
    setInterval(() => this.update(), 1000);
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
    this.useGpsButton.hidden = !manual;
  }
}

function formatAge(ms) {
  return `${Math.round(ms / 1000)} s ago`;
}
