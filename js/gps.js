// Tracks the player's location with the Geolocation API and decides whether
// the signal is good enough for location-dependent actions.
// Fires 'change' on any update and 'reading' when a new position is accepted.

export const MAX_ACCURACY_METERS = 50;
export const MAX_READING_AGE_MS = 30_000;
const RESTART_DELAY_MS = 5_000;
const MANUAL_ACCURACY_METERS = 5;

const WATCH_OPTIONS = { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 };

export class LocationTracker extends EventTarget {
  constructor() {
    super();
    this.position = null; // last accepted reading: { lat, lon, accuracy, timestamp }
    this.lastReading = null; // last raw reading, accepted or not
    this.signal = 'searching'; // 'searching' | 'good' | 'poor' | 'unavailable' | 'denied'
    this.manual = false;
    this.stats = { received: 0, accepted: 0, poor: 0, stale: 0 };
    this.watchId = null;
    this.restartTimer = null;
  }

  get hasGoodSignal() {
    return this.signal === 'good';
  }

  start() {
    this.stop();
    if (!('geolocation' in navigator)) {
      this.setSignal('unavailable');
      return;
    }
    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.handleReading(position),
      (error) => this.handleError(error),
      WATCH_OPTIONS,
    );
  }

  stop() {
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
    clearTimeout(this.restartTimer);
  }

  // The player may have walked far while the page was hidden, so the last
  // position can't be trusted until a fresh reading arrives.
  resume() {
    if (this.manual) return;
    this.setSignal('searching');
    this.start();
  }

  setManualPosition({ lat, lon }) {
    this.stop();
    this.manual = true;
    this.position = { lat, lon, accuracy: MANUAL_ACCURACY_METERS, timestamp: Date.now() };
    this.dispatchEvent(new Event('reading'));
    this.setSignal('good');
  }

  useGps() {
    this.manual = false;
    this.position = null;
    this.setSignal('searching');
    this.start();
  }

  handleReading({ coords, timestamp }) {
    const reading = { lat: coords.latitude, lon: coords.longitude, accuracy: coords.accuracy, timestamp };
    this.lastReading = reading;
    this.stats.received++;

    // GPS timestamps are wall-clock time, so they are compared with Date.now(), not game time.
    if (Date.now() - timestamp > MAX_READING_AGE_MS) {
      this.stats.stale++;
    } else if (coords.accuracy > MAX_ACCURACY_METERS) {
      this.stats.poor++;
      this.signal = 'poor';
    } else {
      this.stats.accepted++;
      this.position = reading;
      this.signal = 'good';
      this.dispatchEvent(new Event('reading'));
    }
    this.notify();
  }

  handleError(error) {
    this.stop();
    if (error.code === error.PERMISSION_DENIED) {
      this.setSignal('denied');
      return;
    }
    this.setSignal('unavailable');
    this.restartTimer = setTimeout(() => this.start(), RESTART_DELAY_MS);
  }

  setSignal(signal) {
    this.signal = signal;
    this.notify();
  }

  notify() {
    this.dispatchEvent(new Event('change'));
  }
}
