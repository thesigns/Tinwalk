import { now } from './clock.js';
import { DEBUG_START, DebugPanel, isDebug } from './debug.js';
import {
  RESOURCES,
  SEARCH_RADIUS,
  SHELTER_RADIUS,
  SURVIVOR_CAPACITY_BONUS,
  activeSearchedAreas,
  backpackCapacity,
  canUnload,
  createShelter,
  dropResources,
  emptyResources,
  isInShelter,
  pruneSearchedAreas,
  search,
  searchBlocker,
  takeSurvivor,
  totalResources,
  unload,
} from './game.js';
import { flyIcon, iconElement, replayAnimation, wait } from './fx.js';
import { averagePosition, distanceMeters } from './geo.js';
import { LocationTracker } from './gps.js';
import { Haptics, canVibrate } from './haptics.js';
import { MapView } from './map.js';
import { SoundEffects } from './sound.js';
import { exportState, loadState, parseSave, requestPersistentStorage, saveState } from './state.js';

const SHELTER_LOCATING_MS = 10_000;
const SEARCH_ANIMATION_MS = 1_400;
const REWARD_CARD_MS = 1_300;
const RIPPLE_MS = 900;
const ZOOM_STEP = 1.5;
const TOAST_DURATION_MS = 4_000;
// Holding a +/- button in the backpack keeps stepping after a short pause.
const STEP_REPEAT_DELAY_MS = 400;
const STEP_REPEAT_MS = 90;
// Frequent enough for searched areas to expire smoothly when debug time runs fast.
const TICK_MS = 1_000;
const WELCOMED_KEY = 'tinwalk.welcomed';

const POOR_SIGNAL_HINT = 'Waiting for a better GPS signal…';
const ACTION_ICONS = { locating: 'locate', create: 'shelter', search: 'search', searching: 'search', unload: 'unload' };
const SEARCH_BLOCKER_HINTS = {
  shelter: 'Too close to your shelter',
  searched: 'This area has already been searched',
};

const $ = (id) => document.getElementById(id);
const ui = {
  backpackHud: $('backpack-hud'),
  backpackIcon: $('backpack-icon'),
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
  backpackPanel: $('backpack-panel'),
  backpackPanelLoad: $('backpack-panel-load'),
  backpackCompanion: $('backpack-companion'),
  backpackItems: $('backpack-items'),
  backpackEmpty: $('backpack-empty'),
  backpackDropHint: $('backpack-drop-hint'),
  backpackClose: $('backpack-close'),
  backpackDrop: $('backpack-drop'),
  backpackRow: $('backpack-row'),
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
  rewardCard: $('reward-card'),
  rewardMedalIcon: document.querySelector('#reward-medal .icon'),
  rewardIcon: $('reward-icon'),
  rewardAmount: $('reward-amount'),
  rewardName: $('reward-name'),
  rewardNote: $('reward-note'),
  playerPulse: $('player-pulse'),
  soundToggle: $('sound-toggle'),
  vibrationToggle: $('vibration-toggle'),
};

const state = loadState();
const tracker = new LocationTracker();
const mapView = new MapView($('map'));
const debugPanel = isDebug ? new DebugPanel($('debug-panel'), tracker, describeGame, tick) : null;
const sound = new SoundEffects();
const haptics = new Haptics();

let started = false; // location tracking starts only after the welcome screen
let inShelter = false;
let locatingShelter = false;
let searching = false;
// While loot flies into the backpack, the status bar keeps showing the old load.
let holdBackpack = false;
let toastTimer = null;
// Units marked to be dropped in the open backpack panel, by resource id.
let dropping = emptyResources();

// A game event the player should hear and feel, e.g. 'found'.
function feedback(name) {
  sound.play(name);
  haptics.play(name);
}

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
  if (!holdBackpack) {
    const load = totalResources(state.backpack);
    const capacity = backpackCapacity(state);
    ui.backpack.textContent = `${load}/${capacity}`;
    ui.backpackGauge.style.width = `${(100 * load) / capacity}%`;
    ui.backpackGauge.classList.toggle('full', load >= capacity);
    ui.backpackHud.setAttribute('aria-label', `Backpack ${load}/${capacity}`);
  }

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
  if (searching) {
    return { id: 'searching', label: 'Searching…', enabled: false, hint: null };
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
  ui.actionButton.classList.toggle('searching', action.id === 'searching');
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
  // The map is centered on the player, so the pulse can stay in the middle of the screen.
  ui.playerPulse.hidden = !(position && tracker.hasGoodSignal);
}

// Pops up a card for a reward. With flyToBackpack, its icon then flies into the status bar.
async function showReward({ icon, amount, name, note, empty = false, flyToBackpack = false }) {
  ui.rewardIcon.setAttribute('href', `#i-${icon}`);
  ui.rewardAmount.textContent = amount;
  ui.rewardName.textContent = name;
  ui.rewardNote.textContent = note;
  ui.rewardCard.classList.toggle('empty', empty);
  ui.rewardCard.classList.remove('leaving');
  ui.rewardCard.hidden = false;
  await wait(REWARD_CARD_MS);
  ui.rewardCard.classList.add('leaving');
  await Promise.all([flyToBackpack && flyIcon(icon, ui.rewardMedalIcon, ui.backpackIcon), wait(300)]);
  ui.rewardCard.hidden = true;
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
  feedback('stamp');
  mapView.playRipple(state.shelter, SHELTER_RADIUS, RIPPLE_MS);
  showToast(`${state.shelter.name} is your shelter now`, 'shelter');
}

async function searchAction() {
  // The search happens where the player pressed the button, even if they walk on meanwhile.
  const position = tracker.position;
  searching = true;
  update();
  sound.play('search');
  await mapView.playSweep(position, SEARCH_RADIUS, SEARCH_ANIMATION_MS);
  searching = false;

  holdBackpack = true;
  const { resource, found, carried, survivor } = search(state, position, now());
  saveAndUpdate();

  let message = `You've found ${found} ${resource.label}`;
  if (carried === 0) message += ', but your backpack is full';
  else if (carried < found) message += `, but could only carry ${carried}`;
  feedback(carried > 0 ? 'found' : 'full');
  await showReward({
    icon: resource.id,
    amount: carried > 0 ? `+${carried}` : '0',
    name: resource.label,
    note: message,
    empty: carried === 0,
    flyToBackpack: carried > 0,
  });
  holdBackpack = false;
  update();
  if (carried > 0) {
    replayAnimation(ui.backpackHud, 'bump');
    feedback('land');
  }

  if (!survivor) return;
  ui.survivorName.textContent = survivor;
  feedback('survivor');
  if ((await ask(ui.survivorDialog)) === 'take') {
    takeSurvivor(state, survivor);
    saveAndUpdate();
    replayAnimation(ui.companion, 'bump');
    feedback('land');
    showToast(`${survivor} is coming with you`, 'survivor');
  } else {
    showToast(`You left ${survivor} behind`, 'survivor');
  }
}

async function unloadAction() {
  const { items, survivor } = unload(state);
  saveAndUpdate();
  feedback('unload');
  mapView.playRipple(state.shelter, SHELTER_RADIUS, RIPPLE_MS);

  const messages = [];
  if (items > 0) messages.push(`Unloaded ${plural(items, 'item')}`);
  if (survivor) messages.push(`${survivor} moved into ${state.shelter.name}`);
  await showReward(
    items > 0
      ? { icon: 'unload', amount: `+${items}`, name: 'Stored', note: messages.join('. ') }
      : { icon: 'survivor', amount: '', name: survivor, note: messages.join('. ') },
  );
}

// Shows what the player carries and lets them mark supplies to drop.
// Nothing is dropped until they confirm.
async function openBackpackPanel() {
  dropping = emptyResources();
  const carried = RESOURCES.filter(({ id }) => state.backpack[id] > 0);
  ui.backpackItems.replaceChildren(...carried.map(backpackRow));
  ui.backpackEmpty.hidden = carried.length > 0;
  ui.backpackDropHint.hidden = carried.length === 0;
  ui.backpackCompanion.hidden = !state.companion;
  if (state.companion) ui.backpackCompanion.textContent = `${state.companion.name} is with you: +${SURVIVOR_CAPACITY_BONUS} space.`;
  renderBackpackPanel();

  if ((await ask(ui.backpackPanel)) !== 'drop') return;
  const marked = RESOURCES.filter(({ id }) => dropping[id] > 0);
  const dropped = dropResources(state, dropping);
  if (dropped === 0) return;
  saveAndUpdate();
  feedback('drop');
  replayAnimation(ui.backpackHud, 'bump');
  if (marked.length === 1) showToast(`You dropped ${dropped} ${marked[0].label}`, marked[0].id);
  else showToast(`You dropped ${plural(dropped, 'item')}`, 'backpack');
}

function backpackRow({ id, label }) {
  const row = ui.backpackRow.content.firstElementChild.cloneNode(true);
  row.dataset.resource = id;
  row.querySelector('.resource-icon use').setAttribute('href', `#i-${id}`);
  row.querySelector('.resource-name').textContent = label;
  for (const button of row.querySelectorAll('[data-step]')) {
    const step = Number(button.dataset.step);
    button.setAttribute('aria-label', step > 0 ? `Drop one ${label}` : `Keep one more ${label}`);
    holdToRepeat(button, () => {
      const next = dropping[id] + step;
      if (next < 0 || next > state.backpack[id]) return false;
      dropping[id] = next;
      renderBackpackPanel();
      return true;
    });
  }
  return row;
}

function renderBackpackPanel() {
  const capacity = backpackCapacity(state);
  const marked = totalResources(dropping);
  ui.backpackPanelLoad.textContent = `${totalResources(state.backpack) - marked}/${capacity}`;
  for (const row of ui.backpackItems.children) {
    const id = row.dataset.resource;
    const [drop, keep] = row.querySelectorAll('[data-step]');
    row.querySelector('.resource-count').textContent = state.backpack[id] - dropping[id];
    row.querySelector('.drop-count').textContent = dropping[id] > 0 ? `−${dropping[id]}` : '';
    row.classList.toggle('dropping', dropping[id] > 0);
    drop.disabled = dropping[id] >= state.backpack[id];
    keep.disabled = dropping[id] === 0;
  }
  ui.backpackClose.textContent = marked > 0 ? 'Cancel' : 'Close';
  ui.backpackDrop.textContent = `Drop ${marked}`;
  ui.backpackDrop.hidden = marked === 0;
}

// Steps once when pressed, then keeps stepping while held, until `step` returns false.
function holdToRepeat(button, step) {
  let timer = null;
  const stop = () => clearTimeout(timer);
  const repeat = (delay) => {
    timer = setTimeout(() => {
      if (step()) repeat(STEP_REPEAT_MS);
    }, delay);
  };
  button.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    stop();
    if (step()) repeat(STEP_REPEAT_DELAY_MS);
  });
  for (const type of ['pointerup', 'pointerleave', 'pointercancel']) button.addEventListener(type, stop);
  // Keyboard presses arrive as clicks without a pointer (detail 0).
  button.addEventListener('click', (event) => {
    if (event.detail === 0) step();
  });
  // A long press would otherwise open the context menu on touch screens.
  button.addEventListener('contextmenu', (event) => event.preventDefault());
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
ui.backpackHud.addEventListener('click', openBackpackPanel);
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

// Sound and vibration switches in the menu.
function setUpToggle(button, target, preview) {
  const render = () => button.setAttribute('aria-checked', String(target.enabled));
  render();
  button.addEventListener('click', () => {
    target.setEnabled(!target.enabled);
    render();
    if (target.enabled) preview();
  });
}
setUpToggle(ui.soundToggle, sound, () => sound.play('found'));
setUpToggle(ui.vibrationToggle, haptics, () => haptics.play('found'));
ui.vibrationToggle.hidden = !canVibrate;

// Browsers only let audio start after the player taps something.
document.addEventListener('click', () => sound.unlock(), { capture: true });

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
