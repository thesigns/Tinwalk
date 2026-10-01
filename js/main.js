import { DEBUG_START, DebugPanel, isDebug } from './debug.js';
import { LocationTracker } from './gps.js';
import { MapView } from './map.js';

const mapView = new MapView(document.getElementById('map'));
const gpsStatus = document.getElementById('gps-status');
const deniedScreen = document.getElementById('denied-screen');

const tracker = new LocationTracker(update);
const debugPanel = isDebug ? new DebugPanel(document.getElementById('debug-panel'), tracker) : null;

function update() {
  gpsStatus.textContent = gpsStatusText();
  gpsStatus.className = tracker.hasGoodSignal ? 'good' : 'bad';
  // In debug mode the game can be played without GPS.
  deniedScreen.hidden = isDebug || tracker.signal !== 'denied';

  const { position } = tracker;
  mapView.render({
    center: position ?? (isDebug ? DEBUG_START : null),
    player: position ? { position, good: tracker.hasGoodSignal } : null,
  });
  debugPanel?.update();
}

function gpsStatusText() {
  switch (tracker.signal) {
    case 'good':
      return tracker.manual ? 'GPS: manual position' : `GPS: ±${Math.round(tracker.position.accuracy)} m`;
    case 'poor':
      return `Waiting for a better GPS signal… (±${Math.round(tracker.lastReading.accuracy)} m)`;
    case 'searching':
      return 'Waiting for GPS signal…';
    case 'unavailable':
      return 'No GPS signal';
    case 'denied':
      return 'Location access denied';
  }
}

document.getElementById('retry-location').addEventListener('click', () => tracker.start());

document.addEventListener('visibilitychange', () => {
  if (document.hidden) tracker.stop();
  else tracker.resume();
});

if (isDebug) {
  mapView.canvas.addEventListener('click', (event) => {
    const rect = mapView.canvas.getBoundingClientRect();
    const point = mapView.screenToLatLon(event.clientX - rect.left, event.clientY - rect.top);
    if (point) tracker.setManualPosition(point);
  });
}

update();
tracker.start();
