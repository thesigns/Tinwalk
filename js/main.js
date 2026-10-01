import { now } from './clock.js';
import { DEBUG_START, DebugPanel, isDebug } from './debug.js';
import {
  RESOURCES,
  SEARCH_RADIUS,
  SHELTER_RADIUS,
  activeSearchedAreas,
  backpackCapacity,
  canUnload,
  createShelter,
  isInShelter,
  pruneSearchedAreas,
  search,
  searchBlocker,
  takeSurvivor,
  totalResources,
  unload,
} from './game.js';
import { averagePosition, distanceMeters } from './geo.js';
import { LocationTracker } from './gps.js';
import { MapView } from './map.js';
import { exportState, loadState, parseSave, requestPersistentStorage, saveState } from './state.js';

const SHELTER_LOCATING_MS = 10_000;
const ZOOM_STEP = 1.5;
const TOAST_DURATION_MS = 4_000;
// Frequent enough for searched areas to expire smoothly when debug time runs fast.
const TICK_MS = 1_000;
const WELCOMED_KEY = 'tinwalk.welcomed';

const POOR_SIGNAL_HINT = 'Waiting for a better GPS signal…';
const ACTION_ICONS = { locating: 'locate', create: 'shelter', search: 'search', unload: 'unload' };
const SVG_NS = 'http://www.w3.org/2000/svg';
const SEARCH_BLOCKER_HINTS = {
  shelter: 'Too close to your shelter',
  searched: 'This area has already been searched',
};

const $ = (id) => document.getElementById(id);
const ui = {
  backpack: $('backpack-status'),
  backpackGauge: $('backpack-gauge'),
  companion: $('companion-status'),
  companionName: $('companion-name'),
  gpsHud: $('gps-hud'),
  gps: $('gps-status'),
  signalBars: [...document.querySelectorAll('.signal-bars i')],
  toast: $('toast'),
  toastIcon: $('toast-icon'),
  toastText: $('toast-text'),
  actionHint: $('action-hint'),
  actionButton: $('action-button'),
  actionIcon: $('action-icon'),
  actionLabel: $('action-label'),
  shelterButton: $('shelter-button'),
  deniedScreen: $('denied-screen'),
  nameDialog: $('name-dialog'),
  shelterName: $('shelter-name'),
  survivorDialog: $('survivor-dialog'),
  survivorName: $('survivor-name'),
  shelterPanel: $('shelter-panel'),
  shelterPanelName: $('shelter-panel-name'),
  shelterStorage: $('shelter-storage'),
  shelterSurvivorCount: $('shelter-survivor-count'),
  shelterSurvivorNames: $('shelter-survivor-names'),
  shelterNoSurvivors: $('shelter-no-survivors'),
  scaleLabel: $('scale-label'),
  scaleLine: $('scale-line'),
  welcomeScreen: $('welcome-screen'),
  menuDialog: $('menu-dialog'),
  importInput: $('import-input'),
  importDialog: $('import-dialog'),
};

const state = loadState();
const tracker = new LocationTracker();
const mapView = new MapView($('map'));
const debugPanel = isDebug ? new DebugPanel($('debug-panel'), tracker, describeGame, tick) : null;

let started = false; // location tracking starts only after the welcome screen
let inShelter = false;
let locatingShelter = false;
let toastTimer = null;

function update() {
  inShelter = isInShelter(state.shelter, tracker.position, inShelter);
  renderStatus();
  renderActions();
  renderMap();
  // In debug mode the game can be played without GPS.
  ui.deniedScreen.hidden = isDebug || tracker.signal !== 'denied';
  debugPanel?.update();
}

// Searched areas expire over time even when nothing else happens.
function tick() {
  if (pruneSearchedAreas(state, now())) saveState(state);
  update();
}

function saveAndUpdate() {
  saveState(state);
  update();
}

function renderStatus() {
  const load = totalResources(state.backpack);
  const capacity = backpackCapacity(state);
  ui.backpack.textContent = `${load}/${capacity}`;
  ui.backpackGauge.style.width = `${(100 * load) / capacity}%`;
  ui.backpackGauge.classList.toggle('full', load >= capacity);

  ui.companion.hidden = !state.companion;
  ui.companionName.textContent = state.companion?.name ?? '';

  const { bars, label, description } = gpsStatus();
  ui.signalBars.forEach((bar, index) => bar.classList.toggle('on', index < bars));
  ui.gps.textContent = label;
  ui.gpsHud.classList.toggle('good', tracker.hasGoodSignal);
  ui.gpsHud.classList.toggle('bad', !tracker.hasGoodSignal);
  ui.gpsHud.setAttribute('aria-label', description);
}

// Signal bars (0-4), a short label for the status bar and a full description.
function gpsStatus() {
  const accuracy = (reading) => Math.round(reading.accuracy);
  switch (tracker.signal) {
    case 'good': {
      if (tracker.manual) return { bars: 4, label: 'Manual', description: 'GPS: manual position' };
      const meters = accuracy(tracker.position);
      const bars = meters <= 10 ? 4 : meters <= 20 ? 3 : 2;
      return { bars, label: `±${meters} m`, description: `GPS signal good, ±${meters} m` };
    }
    case 'poor': {
      const meters = accuracy(tracker.lastReading);
      return { bars: 1, label: `±${meters} m`, description: `Waiting for a better GPS signal (±${meters} m)` };
    }
    case 'searching':
      return { bars: 0, label: 'GPS…', description: 'Waiting for GPS signal' };
    case 'unavailable':
      return { bars: 0, label: 'No GPS', description: 'No GPS signal' };
    case 'denied':
      return { bars: 0, label: 'No GPS', description: 'Location access denied' };
  }
}

// The single context-dependent action: { id, label, enabled, hint }.
function currentAction() {
  const good = tracker.hasGoodSignal;
  const signalHint = good ? null : POOR_SIGNAL_HINT;

  if (locatingShelter) {
    const accuracy = tracker.position ? ` ±${Math.round(tracker.position.accuracy)} m` : '';
    return { id: 'locating', label: 'Locating…', enabled: false, hint: `Locating your shelter…${accuracy}` };
  }
  if (!state.shelter) {
    return { id: 'create', label: 'Create a Shelter', enabled: good, hint: signalHint };
  }
  if (inShelter) {
    const empty = !canUnload(state);
    return {
      id: 'unload',
      label: 'Unload',
      enabled: good && !empty,
      hint: signalHint ?? (empty ? 'Your backpack is empty' : null),
    };
  }
  const blocker = good ? searchBlocker(state, tracker.position, now()) : null;
  return {
    id: 'search',
    label: 'Search area',
    enabled: good && !blocker,
    hint: signalHint ?? SEARCH_BLOCKER_HINTS[blocker] ?? null,
  };
}

function renderActions() {
  const action = currentAction();
  ui.actionLabel.textContent = action.label;
  ui.actionIcon.setAttribute('href', `#i-${ACTION_ICONS[action.id]}`);
  ui.actionButton.classList.toggle('locating', action.id === 'locating');
  ui.actionButton.disabled = !action.enabled;
  ui.actionButton.dataset.action = action.id;
  ui.actionHint.textContent = action.hint ?? '';
  ui.actionHint.hidden = !action.hint;
  ui.shelterButton.hidden = !state.shelter;
}

function renderMap() {
  const { position } = tracker;
  mapView.render({
    center: position ?? state.shelter ?? (isDebug ? DEBUG_START : null),
    player: position ? { position, good: tracker.hasGoodSignal } : null,
    shelter: state.shelter && { ...state.shelter, radius: SHELTER_RADIUS },
    searchedAreas: activeSearchedAreas(state, now()).map((area) => ({ ...area, radius: SEARCH_RADIUS })),
  });
}

function iconElement(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

// Shows a short note above the actions, optionally with an icon name (e.g. 'food').
function showToast(text, icon = null) {
  ui.toastText.textContent = text;
  ui.toastIcon.hidden = !icon;
  if (icon) ui.toastIcon.firstElementChild.setAttribute('href', `#i-${icon}`);
  // Restart the entrance animation when one note replaces another.
  ui.toast.hidden = true;
  void ui.toast.offsetWidth;
  ui.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (ui.toast.hidden = true), TOAST_DURATION_MS);
}

// Opens a modal dialog and resolves with the value of the button that closed it.
function ask(dialog) {
  dialog.returnValue = '';
  dialog.showModal();
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue), { once: true });
  });
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

// GPS is weakest indoors, where shelters are usually created, so the center
// is averaged from the readings collected over a few seconds.
function locateShelter() {
  const readings = [tracker.position];
  if (tracker.manual) return Promise.resolve(averagePosition(readings));

  const collect = () => readings.push(tracker.position);
  tracker.addEventListener('reading', collect);
  return new Promise((resolve) => {
    setTimeout(() => {
      tracker.removeEventListener('reading', collect);
      resolve(averagePosition(readings));
    }, SHELTER_LOCATING_MS);
  });
}

async function createShelterAction() {
  locatingShelter = true;
  update();
  const position = await locateShelter();
  locatingShelter = false;
  update();

  ui.shelterName.value = '';
  if ((await ask(ui.nameDialog)) !== 'create') return;
  createShelter(state, position, ui.shelterName.value, now());
  saveAndUpdate();
  showToast(`${state.shelter.name} is your shelter now`, 'shelter');
}

async function searchAction() {
  const { resource, found, carried, survivor } = search(state, tracker.position, now());
  saveAndUpdate();

  let message = `You've found ${found} ${resource.label}`;
  if (carried === 0) message += ', but your backpack is full';
  else if (carried < found) message += `, but could only carry ${carried}`;
  showToast(message, resource.id);

  if (!survivor) return;
  ui.survivorName.textContent = survivor;
  if ((await ask(ui.survivorDialog)) === 'take') {
    takeSurvivor(state, survivor);
    saveAndUpdate();
    showToast(`${survivor} is coming with you`, 'survivor');
  } else {
    showToast(`You left ${survivor} behind`, 'survivor');
  }
}

function unloadAction() {
  const { items, survivor } = unload(state);
  saveAndUpdate();
  const messages = [];
  if (items > 0) messages.push(`Unloaded ${plural(items, 'item')}`);
  if (survivor) messages.push(`${survivor} moved into ${state.shelter.name}`);
  showToast(messages.join('. '), 'unload');
}

function openShelterPanel() {
  const { shelter } = state;
  ui.shelterPanelName.textContent = shelter.name;
  ui.shelterStorage.replaceChildren(
    ...RESOURCES.map(({ id, label }) => {
      const tile = document.createElement('li');
      const count = document.createElement('span');
      count.className = 'resource-count';
      count.textContent = shelter.storage[id];
      const name = document.createElement('span');
      name.className = 'resource-label';
      name.textContent = label;
      tile.append(iconElement(id), count, name);
      return tile;
    }),
  );
  ui.shelterSurvivorCount.textContent = shelter.survivors.length;
  ui.shelterSurvivorNames.replaceChildren(
    ...shelter.survivors.map(({ name }) => {
      const tag = document.createElement('li');
      tag.textContent = name;
      return tag;
    }),
  );
  ui.shelterNoSurvivors.hidden = shelter.survivors.length > 0;
  ui.shelterPanel.showModal();
}

function describeGame() {
  const { position } = tracker;
  if (!position) return '—';
  const zone = inShelter ? 'In shelter' : 'Wasteland';
  const distance = state.shelter ? `, ${Math.round(distanceMeters(state.shelter, position))} m from shelter` : '';
  return `${zone}${distance}, ${plural(activeSearchedAreas(state, now()).length, 'searched area')}`;
}

function exportSave() {
  const date = new Date().toLocaleDateString('sv'); // YYYY-MM-DD
  const blob = new Blob([exportState(state)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `tinwalk-save-${date}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function importSave(file) {
  const result = parseSave(await file.text());
  if (result.error) {
    showToast(result.error);
    return;
  }
  if ((await ask(ui.importDialog)) !== 'import') return;
  // Other code holds a reference to `state`, so its contents are replaced in place.
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, result.state);
  inShelter = false;
  saveAndUpdate();
  showToast('Save imported', 'import');
}

function hasBeenWelcomed() {
  try {
    return localStorage.getItem(WELCOMED_KEY) === '1';
  } catch {
    return false;
  }
}

// The browser asks for location permission here, after the player knows why.
function startTracking() {
  started = true;
  ui.welcomeScreen.hidden = true;
  tracker.start();
}

const ACTIONS = { create: createShelterAction, search: searchAction, unload: unloadAction };

ui.actionButton.addEventListener('click', () => {
  // Re-check, since the situation may have changed since the button was rendered.
  const action = currentAction();
  if (action.enabled) ACTIONS[action.id]();
});
ui.shelterButton.addEventListener('click', openShelterPanel);
$('retry-location').addEventListener('click', () => tracker.start());
$('zoom-in').addEventListener('click', () => mapView.zoomBy(1 / ZOOM_STEP));
$('zoom-out').addEventListener('click', () => mapView.zoomBy(ZOOM_STEP));
mapView.onScaleChange = (meters, pixels) => {
  ui.scaleLabel.textContent = meters >= 1000 ? `${meters / 1000} km` : `${meters} m`;
  ui.scaleLine.style.width = `${pixels}px`;
};
// Map labels are drawn with the web fonts, so redraw once they have loaded.
document.fonts?.ready.then(update);

$('start-button').addEventListener('click', () => {
  try {
    localStorage.setItem(WELCOMED_KEY, '1');
  } catch (error) {
    console.warn('Could not remember the welcome screen', error);
  }
  startTracking();
});

$('menu-button').addEventListener('click', () => ui.menuDialog.showModal());
$('menu-close').addEventListener('click', () => ui.menuDialog.close());
$('export-button').addEventListener('click', () => {
  ui.menuDialog.close();
  exportSave();
});
$('import-button').addEventListener('click', () => {
  // Open the file picker while still handling the tap, or browsers may block it.
  ui.importInput.click();
  ui.menuDialog.close();
});
ui.importInput.addEventListener('change', () => {
  const [file] = ui.importInput.files;
  ui.importInput.value = '';
  if (file) importSave(file);
});

// Enter in the name field should create the shelter, not hit the first (Cancel) button.
ui.shelterName.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  ui.nameDialog.close('create');
});
// The player has to choose whether to take the survivor.
ui.survivorDialog.addEventListener('cancel', (event) => event.preventDefault());

tracker.addEventListener('change', update);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) tracker.stop();
  else if (started) tracker.resume();
});

if (isDebug) mapView.onTap = (point) => tracker.setManualPosition(point);

setInterval(tick, TICK_MS);

requestPersistentStorage();
tick();
if (hasBeenWelcomed()) startTracking();
else ui.welcomeScreen.hidden = false;
