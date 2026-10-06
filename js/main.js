import { now } from './clock.js';
import { DEBUG_START, DebugPanel, isDebug } from './debug.js';
import {
  ENEMIES,
  HUNGER_STAGES,
  ITEMS,
  LANDMARKS,
  MANUALS,
  MANUAL_SIZE,
  RADIO,
  RESOURCES,
  SEARCH_RADIUS,
  STRIKE_CARDS,
  SHELTER_RADIUS,
  VICTORY_LOOT_MULTIPLIER,
  WOUNDED_CAPACITY_BONUS,
  activeSearchedAreas,
  backpackCapacity,
  biomeAtPosition,
  backpackLoad,
  backpackWeapons,
  buildRadio,
  canBuildRadio,
  canCraft,
  canPack,
  canTakeManual,
  canTreat,
  canUnload,
  companionCapacityBonus,
  craft,
  createShelter,
  dropFromBackpack,
  emptyResources,
  expireMission,
  fight,
  finishSearch,
  freeSpace,
  hasGeigerCounter,
  hungerOf,
  isInShelter,
  isMissionLandmark,
  isNight,
  isSick,
  isWounded,
  knownRecipes,
  knowsRadio,
  listen,
  listenBlocker,
  listenReadyAt,
  manualRecipes,
  missionEndsAt,
  nextDaylightChange,
  packItem,
  pruneSearchedAreas,
  radiationAtPosition,
  removeLandmark,
  runAway,
  search,
  searchBlocker,
  settleMeals,
  settlementAtPosition,
  sicknessHealsAt,
  takeManual,
  takeSurvivor,
  totalResources,
  treat,
  unload,
  woundHealsAt,
} from './game.js';
import { flyIcon, iconElement, prefersReducedMotion, replayAnimation, wait } from './fx.js';
import { averagePosition, bearingDegrees, distanceMeters } from './geo.js';
import { LocationTracker } from './gps.js';
import { Haptics, canVibrate } from './haptics.js';
import { MapView } from './map.js';
import { SoundEffects } from './sound.js';
import { STATE_VERSION, createInitialState, exportState, loadState, parseSave, requestPersistentStorage, saveState } from './state.js';
import { APP_UPDATED } from './version.js';

const SHELTER_LOCATING_MS = 10_000;
const SEARCH_ANIMATION_MS = 1_400;
const REWARD_CARD_MS = 1_300;
const RIPPLE_MS = 900;
// How long the radio crackles before the player hears whether anyone called.
const LISTEN_MS = 3_400;
const TOAST_DURATION_MS = 4_000;
// Holding a +/- button in the backpack keeps stepping after a short pause.
const STEP_REPEAT_DELAY_MS = 400;
const STEP_REPEAT_MS = 90;
// How long the Geiger counter crackles at a time.
const CRACKLE_MS = 1_200;
// Rings per second rippling out of the radiation icon at the edge of the
// fallout and in its hottest core.
const RING_MIN_RATE = 0.8;
const RING_MAX_RATE = 5;
// Frequent enough for searched areas to expire smoothly when debug time runs fast.
const TICK_MS = 1_000;
const WELCOMED_KEY = 'tinwalk.welcomed';

const POOR_SIGNAL_HINT = 'Waiting for a better GPS signal…';
const ACTION_ICONS = { locating: 'locate', create: 'shelter', search: 'search', searching: 'search', unload: 'unload' };
// What each hunger stage is called, and what happens when it runs out.
const HUNGER_TEXT = {
  satiated: { label: 'Satiated', next: (hasFood) => (hasFood ? 'eats in' : 'hungry in') },
  hungry: { label: 'Hungry', next: () => 'starving in' },
  starving: { label: 'Starving', next: () => 'leaves in' },
};
const SEARCH_BLOCKER_HINTS = {
  shelter: 'Too close to your shelter',
  searched: 'This area has already been searched',
};
const ENCOUNTER_TEXT = {
  rat: 'A rat jumps out of the rubble at you, teeth bared.',
  'mutated-rat': 'Something rat-shaped and wrong crawls out at you, hissing.',
};
// What the enemy's threat card looks like, by the highest value each line covers.
const THREAT_TEXT = {
  rat: [
    [2, 'Scrawny and limping'],
    [4, 'Hungry and bold'],
    [6, 'Big and cornered'],
  ],
  'mutated-rat': [
    [5, 'Twitching, half blind'],
    [8, 'Covered in glowing sores'],
    [10, 'Huge, foaming at the mouth'],
  ],
};
// How long the strike card takes to turn before the outcome shows.
const CARD_FLIP_MS = 700;
const COMPASS_POINTS = [
  { short: 'N', long: 'north' },
  { short: 'NE', long: 'north-east' },
  { short: 'E', long: 'east' },
  { short: 'SE', long: 'south-east' },
  { short: 'S', long: 'south' },
  { short: 'SW', long: 'south-west' },
  { short: 'W', long: 'west' },
  { short: 'NW', long: 'north-west' },
];

const $ = (id) => document.getElementById(id);
const ui = {
  backpackHud: $('backpack-hud'),
  backpackIcon: $('backpack-icon'),
  backpack: $('backpack-status'),
  backpackGauge: $('backpack-gauge'),
  companion: $('companion-status'),
  companionName: $('companion-name'),
  companionIcon: document.querySelector('#companion-status use'),
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
  survivorNote: $('survivor-note'),
  radioSection: $('radio-section'),
  radioText: $('radio-text'),
  radioListen: $('radio-listen'),
  radioDialog: $('radio-dialog'),
  radioTitle: $('radio-title'),
  radioMessage: $('radio-message'),
  radioNote: $('radio-note'),
  missionNote: $('mission-note'),
  missionTitle: $('mission-title'),
  missionDetail: $('mission-detail'),
  encounterDialog: $('encounter-dialog'),
  encounterTitle: $('encounter-title'),
  encounterIcon: $('encounter-icon'),
  encounterText: $('encounter-text'),
  threatCard: $('threat-card'),
  threatNote: $('threat-note'),
  strikeCard: $('strike-card'),
  strikeNote: $('strike-note'),
  encounterChoices: $('encounter-choices'),
  encounterResult: $('encounter-result'),
  encounterDone: $('encounter-done'),
  encounterOk: $('encounter-ok'),
  manualDialog: $('manual-dialog'),
  manualName: $('manual-name'),
  manualText: $('manual-text'),
  manualNoSpace: $('manual-no-space'),
  manualTake: $('manual-take'),
  manualBackpack: $('manual-backpack'),
  backpackPanel: $('backpack-panel'),
  backpackPanelLoad: $('backpack-panel-load'),
  backpackCompanion: $('backpack-companion'),
  backpackCompanionText: $('backpack-companion-text'),
  backpackTreat: $('backpack-treat'),
  backpackItems: $('backpack-items'),
  backpackEmpty: $('backpack-empty'),
  backpackDropHint: $('backpack-drop-hint'),
  backpackClose: $('backpack-close'),
  backpackDrop: $('backpack-drop'),
  backpackRow: $('backpack-row'),
  shelterPanel: $('shelter-panel'),
  shelterPanelName: $('shelter-panel-name'),
  shelterStorage: $('shelter-storage'),
  shelterItems: $('shelter-items'),
  shelterManuals: $('shelter-manuals'),
  shelterRecipes: $('shelter-recipes'),
  workshopHint: $('workshop-hint'),
  itemRow: $('item-row'),
  shelterSurvivorCount: $('shelter-survivor-count'),
  shelterSurvivorNames: $('shelter-survivor-names'),
  shelterNoSurvivors: $('shelter-no-survivors'),
  survivorBadge: $('survivor-badge'),
  departureDialog: $('departure-dialog'),
  sicknessDialog: $('sickness-dialog'),
  sicknessTitle: $('sickness-title'),
  sicknessText: $('sickness-text'),
  fallout: $('fallout'),
  departureTitle: $('departure-title'),
  departureText: $('departure-text'),
  scaleLabel: $('scale-label'),
  location: $('location'),
  locationLabel: $('location-label'),
  locationPlace: $('location-place'),
  locationDaylight: $('location-daylight'),
  scaleLine: $('scale-line'),
  welcomeScreen: $('welcome-screen'),
  safetyScreen: $('safety-screen'),
  menuDialog: $('menu-dialog'),
  importInput: $('import-input'),
  importDialog: $('import-dialog'),
  resetDialog: $('reset-dialog'),
  landmarkDialog: $('landmark-dialog'),
  landmarkArt: $('landmark-art'),
  landmarkName: $('landmark-name'),
  landmarkVisited: $('landmark-visited'),
  landmarkMission: $('landmark-mission'),
  landmarkRemove: $('landmark-remove'),
  removeLandmarkDialog: $('remove-landmark-dialog'),
  removeLandmarkName: $('remove-landmark-name'),
  rewardCard: $('reward-card'),
  rewardMedalIcon: document.querySelector('#reward-medal .icon'),
  rewardIcon: $('reward-icon'),
  rewardAmount: $('reward-amount'),
  rewardName: $('reward-name'),
  rewardNote: $('reward-note'),
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
let listening = false;
// While loot flies into the backpack, the status bar keeps showing the old load.
let holdBackpack = false;
let toastTimer = null;
// Survivors listed in the open departure dialog.
let departed = [];
// Survivors listed in the open sickness dialog.
let sickened = [];
// How hot the fallout is where the player stands, as the Geiger counter in
// the backpack tells it: 0 when clean or without a counter.
let falloutLevel = 0;
let crackleUntil = 0;
let ringTimer = null;
// What is marked to be dropped in the open backpack panel: resource units by
// id, backpack items and manual ids.
let dropping = { resources: emptyResources(), items: [], manuals: [] };
// Survivor name tags in the shelter panel, kept between renders (see renderSurvivorBadges).
const survivorBadges = new WeakMap();

// A game event the player should hear and feel, e.g. 'found'.
function feedback(name) {
  sound.play(name);
  haptics.play(name);
}

// Rings ripple out of the radiation icon at random, like the counter's clicks,
// and faster the hotter it is, so the icon tells how deep in the fallout the
// player is even with the sound off. They stop once the player is out of it.
function scheduleRing() {
  clearTimeout(ringTimer);
  if (falloutLevel === 0 || prefersReducedMotion()) return;
  const rate = RING_MIN_RATE + (RING_MAX_RATE - RING_MIN_RATE) * falloutLevel;
  const delay = (-Math.log(1 - Math.random()) / rate) * 1000;
  ringTimer = setTimeout(() => {
    if (falloutLevel > 0) {
      const ring = document.createElement('span');
      ring.className = 'fallout-ring';
      ring.addEventListener('animationend', () => ring.remove());
      ui.fallout.append(ring);
    }
    scheduleRing();
  }, delay);
}

// The Geiger counter crackles in the fallout: on the way in, on a search and
// at every tap, faster the hotter it is. Bursts don't overlap.
function crackle() {
  if (falloutLevel === 0 || performance.now() < crackleUntil) return;
  crackleUntil = performance.now() + CRACKLE_MS;
  sound.crackle(falloutLevel, CRACKLE_MS / 1000);
  haptics.crackle(falloutLevel, CRACKLE_MS / 1000);
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

// Searched areas expire, survivors get hungry and rescue missions run out
// even when nothing else happens.
function tick() {
  const time = now();
  const pruned = pruneSearchedAreas(state, time);
  const { meals, left, sickened: sick } = settleMeals(state, time);
  const failed = expireMission(state, time);
  if (pruned || meals > 0 || left.length > 0 || failed) saveState(state);
  if (left.length > 0) showDepartures(left);
  if (sick.length > 0) showSickness(sick);
  if (failed) showLostSignal(failed);
  if (ui.shelterPanel.open) renderShelterPanel();
  update();
}

function saveAndUpdate() {
  saveState(state);
  update();
}

function renderStatus() {
  const time = now();
  if (!holdBackpack) {
    const load = backpackLoad(state);
    const capacity = backpackCapacity(state, time);
    ui.backpack.textContent = `${load}/${capacity}`;
    ui.backpackGauge.style.width = `${(100 * load) / capacity}%`;
    ui.backpackGauge.classList.toggle('full', load >= capacity);
    ui.backpackHud.setAttribute('aria-label', `Backpack ${load}/${capacity}`);
  }

  ui.companion.hidden = !state.companion;
  ui.companionName.textContent = state.companion?.name ?? '';
  const wounded = state.companion !== null && isWounded(state.companion, time);
  ui.companion.classList.toggle('wounded', wounded);
  ui.companionIcon.setAttribute('href', wounded ? '#i-wound' : '#i-survivor');
  ui.companion.setAttribute('aria-label', wounded ? `${state.companion.name}, wounded` : ui.companionName.textContent);

  const { bars, label, description } = gpsStatus();
  ui.signalBars.forEach((bar, index) => bar.classList.toggle('on', index < bars));
  ui.gps.textContent = label;
  ui.gpsHud.classList.toggle('good', tracker.hasGoodSignal);
  ui.gpsHud.classList.toggle('bad', !tracker.hasGoodSignal);
  ui.gpsHud.setAttribute('aria-label', description);

  const { position } = tracker;
  ui.location.hidden = !position;
  if (position) {
    const settlement = inShelter ? null : settlementAtPosition(position);
    ui.locationLabel.textContent = inShelter ? 'Shelter' : biomeAtPosition(position).label;
    ui.locationPlace.hidden = !settlement;
    ui.locationPlace.textContent = settlement?.name ?? '';
    ui.locationDaylight.textContent = describeDaylight(position, time);
    ui.location.classList.toggle('uncertain', !tracker.hasGoodSignal);
  }

  const level = position && hasGeigerCounter(state) ? radiationAtPosition(state, position) : 0;
  const entered = level > 0 && falloutLevel === 0;
  falloutLevel = level;
  ui.fallout.hidden = level === 0;
  if (entered) {
    crackle();
    scheduleRing();
  }

  const { mission } = state;
  ui.missionNote.hidden = !mission;
  if (mission) {
    const { landmark, survivor } = mission;
    const from = position ?? state.shelter;
    ui.missionTitle.textContent = `${survivor} · ${LANDMARKS[landmark.type].label}`;
    ui.missionDetail.textContent =
      `${formatDistance(distanceMeters(from, landmark))} ${compassPoint(from, landmark).short}` +
      ` · ${formatDuration(missionEndsAt(mission) - time)} left`;
  }
}

// "Day · dark in 3 h", so the player can plan a walk around nightfall.
function describeDaylight(position, time) {
  const night = isNight(position, time);
  const change = nextDaylightChange(position, time);
  const phase = night ? 'Night' : 'Day';
  return change === null ? phase : `${phase} · ${night ? 'light' : 'dark'} in ${formatDuration(change - time)}`;
}

function compassPoint(from, to) {
  return COMPASS_POINTS[Math.round(bearingDegrees(from, to) / 45) % COMPASS_POINTS.length];
}

function formatDistance(meters) {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1)} km`;
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
  // Warns about hungry survivors while the player is out on a walk.
  const hunger = worstHunger();
  ui.shelterButton.dataset.hunger = hunger;
  ui.shelterButton.setAttribute('aria-label', hunger === 'satiated' ? 'Shelter' : `Shelter: survivors are ${hunger}`);
}

// The hungriest stage among the shelter's survivors ('satiated' if there are none).
function worstHunger() {
  const time = now();
  const stages = (state.shelter?.survivors ?? []).map((survivor) =>
    HUNGER_STAGES.indexOf(hungerOf(survivor, time).stage),
  );
  return HUNGER_STAGES[Math.max(0, ...stages)];
}

function renderMap() {
  const { position } = tracker;
  const action = currentAction();
  const canSearch = action.id === 'search' && action.enabled;
  mapView.render({
    center: position ?? state.shelter ?? (isDebug ? DEBUG_START : null),
    player: position ? { position, good: tracker.hasGoodSignal, canSearch } : null,
    shelter: state.shelter && { ...state.shelter, radius: SHELTER_RADIUS },
    searchedAreas: activeSearchedAreas(state, now()),
    landmarks: state.landmarks,
    enemies: state.enemies,
    target: state.mission?.landmark ?? null,
  });
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
  crackle();
  await mapView.playSweep(position, SEARCH_RADIUS, SEARCH_ANIMATION_MS);
  searching = false;

  holdBackpack = true;
  const result = search(state, position, now());
  saveAndUpdate();
  let { loot = null, rescued = null } = result;
  let victory = null;
  if (result.encounter) {
    holdBackpack = false;
    update();
    victory = await encounter(result.encounter);
    if (!victory) return;
    holdBackpack = true;
    ({ loot, rescued } = finishSearch(state, position, now(), VICTORY_LOOT_MULTIPLIER));
    saveAndUpdate();
  }

  const { resource, found, carried, manual, landmark, dark, flashlight, geiger } = loot;
  let message = `You've found ${amountOf(resource, found)}`;
  if (carried === 0) message += ', but your backpack is full';
  else if (carried < found) message += `, but could only carry ${carried}`;
  if (geiger) {
    message += `. Your ${ITEMS['geiger-counter'].label} showed everything else here was too hot to keep`;
    message += geiger.wornOut ? ', then went dead.' : '.';
  } else if (flashlight) message += `. Your ${ITEMS.flashlight.label} lit up dark corners${flashlight.wornOut ? ' and went dead' : ''}.`;
  else if (dark) message += '. It was too dark to search well.';
  if (victory) message = `${victory} ${message}`;
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

  if (landmark) await showLandmark(landmark);
  if (rescued) await offerSurvivor(rescued);
  if (manual) await offerManual(manual);
}

// A newly discovered landmark is stamped onto the map.
async function showLandmark(landmark) {
  const { label } = LANDMARKS[landmark.type];
  feedback('landmark');
  mapView.playRipple(landmark, 0, RIPPLE_MS);
  await showReward({
    icon: landmark.type,
    amount: '',
    name: label,
    note: `You've discovered ${withArticle(label)}. It stays on your map.`,
  });
}

// "an Abandoned Mine", "a Farmstead".
function withArticle(label) {
  return `${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label}`;
}

// Shows the enemy's threat card and lets the player pick a weapon from the
// backpack, fight bare-handed or run, then turns their strike card. Returns a
// note for the loot card after a won fight, or null if the search ends here.
async function encounter(encounter) {
  const { enemy, threat, returning } = encounter;
  const { label } = ENEMIES[enemy.type];
  ui.encounterTitle.textContent = `${label}!`;
  ui.encounterIcon.setAttribute('href', `#i-${enemy.type}`);
  ui.encounterText.textContent = returning ? `The ${label} you met here is still around.` : ENCOUNTER_TEXT[enemy.type];
  ui.threatCard.textContent = threat;
  ui.threatNote.textContent = THREAT_TEXT[enemy.type].find(([max]) => threat <= max)[1];
  ui.strikeCard.textContent = '';
  ui.strikeCard.classList.add('face-down');
  ui.strikeNote.textContent = `1–${STRIKE_CARDS} + your weapon`;
  ui.encounterResult.hidden = true;
  ui.encounterDone.hidden = true;
  ui.encounterChoices.hidden = false;
  const choice = new Promise((resolve) => ui.encounterChoices.replaceChildren(...fightChoices(resolve)));
  ui.encounterDialog.showModal();
  feedback('enemy');
  const weapon = await choice;
  ui.encounterChoices.hidden = true;

  if (weapon === 'run') {
    ui.encounterDialog.close();
    const lost = runAway(state, encounter);
    saveAndUpdate();
    feedback('flee');
    const total = totalResources(lost);
    if (total > 0) replayAnimation(ui.backpackHud, 'bump');
    const dropped = total > 0 ? `You ran, dropping ${describeResources(lost)}` : 'You ran and got away';
    showToast(`${dropped}. The ${label} stays on your map.`, enemy.type);
    return null;
  }

  const weaponLabel = weapon && ITEMS[weapon.id].label;
  const { outcome, card, strike, wornOut, lost, wounded } = fight(state, encounter, weapon, now());
  saveAndUpdate();
  ui.strikeCard.classList.remove('face-down');
  ui.strikeCard.textContent = strike;
  ui.strikeNote.textContent = weapon ? `${card} + ${ITEMS[weapon.id].bonus} for the ${weaponLabel}` : `${card}, bare-handed`;
  replayAnimation(ui.strikeCard, 'flip');
  feedback('flip');
  await wait(CARD_FLIP_MS);

  const wornNote = wornOut ? ` Your ${weaponLabel} is worn out.` : '';
  const total = totalResources(lost);
  let note;
  if (outcome === 'won') {
    note = `You fought off the ${label}: double loot!`;
    feedback('hit');
  } else if (outcome === 'stalemate') {
    note = `A stalemate: the ${label} holds its ground and stays on your map. You find nothing here.`;
    feedback('stalemate');
  } else {
    note = `The ${label} got the better of you and stays on your map.`;
    if (total > 0) note += ` You lost ${describeResources(lost)}.`;
    if (wounded) note += ` ${state.companion.name} was wounded.`;
    feedback('defeat');
  }
  ui.encounterResult.textContent = note + wornNote;
  ui.encounterResult.hidden = false;
  ui.encounterDone.hidden = false;
  ui.encounterOk.focus();
  await new Promise((resolve) => ui.encounterDialog.addEventListener('close', resolve, { once: true }));
  if (total > 0) replayAnimation(ui.backpackHud, 'bump');
  if (wounded) replayAnimation(ui.companion, 'bump');
  return outcome === 'won' ? note + wornNote : null;
}

// A button for each weapon in the backpack, bare hands and running away; a
// tap resolves with the weapon, null for bare hands, or 'run'.
function fightChoices(resolve) {
  const choices = [
    ...backpackWeapons(state).map((item) => {
      const { label, bonus, uses } = ITEMS[item.id];
      return { value: item, label, detail: `+${bonus} · ${item.uses}/${uses} uses`, style: 'btn-paint' };
    }),
    { value: null, label: 'Bare hands', detail: '+0', style: 'btn-paint' },
    { value: 'run', label: 'Run', detail: 'drop some supplies', style: 'btn-ink' },
  ];
  return choices.map(({ value, label, detail, style }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `btn ${style}`;
    const name = document.createElement('span');
    name.textContent = label;
    const small = document.createElement('span');
    small.className = 'choice-detail';
    small.textContent = detail;
    button.append(name, small);
    button.addEventListener('click', () => resolve(value), { once: true });
    return button;
  });
}

// "3 Junk and 1 Food", leaving out resources with no units.
function describeResources(amounts) {
  return listNames(RESOURCES.filter(({ id }) => amounts[id] > 0).map((resource) => amountOf(resource, amounts[resource.id])));
}

// "1 Cell", "3 Cells".
function amountOf(resource, count) {
  return `${count} ${count === 1 ? resource.one : resource.label}`;
}

// A crafting cost such as { junk: 10, cells: 1 }: "10 Junk + 1 Cell".
function describeCost(cost) {
  return RESOURCES.filter(({ id }) => cost[id]).map((resource) => amountOf(resource, cost[resource.id])).join(' + ');
}

async function offerSurvivor(survivor) {
  ui.survivorName.textContent = survivor;
  ui.survivorNote.textContent = `Wounded: +${WOUNDED_CAPACITY_BONUS} backpack space until the wound heals.`;
  feedback('survivor');
  if ((await ask(ui.survivorDialog)) === 'take') {
    takeSurvivor(state, survivor, now());
    saveAndUpdate();
    replayAnimation(ui.companion, 'bump');
    feedback('land');
    showToast(`${survivor} is coming with you`, 'survivor');
  } else {
    showToast(`You left ${survivor} behind`, 'survivor');
  }
}

// Offers a found manual. If it doesn't fit, the player can open the backpack
// to drop something, and then gets the offer again.
async function offerManual(id) {
  const { label } = MANUALS[id];
  ui.manualName.textContent = label;
  ui.manualText.textContent =
    `Bring it to your shelter to craft: ${listNames(manualRecipes(id))}. Takes ${MANUAL_SIZE} backpack space.`;
  feedback('manual');
  for (;;) {
    const fits = canTakeManual(state, now());
    ui.manualTake.disabled = !fits;
    ui.manualNoSpace.hidden = fits;
    const answer = ask(ui.manualDialog);
    // Without room, making room is the likely next step, not leaving the manual.
    if (!fits) ui.manualBackpack.focus();
    const choice = await answer;
    if (choice === 'backpack') {
      await openBackpackPanel();
      continue;
    }
    if (choice === 'take' && takeManual(state, id, now())) {
      saveAndUpdate();
      replayAnimation(ui.backpackHud, 'bump');
      feedback('land');
      showToast(`You packed the ${label}`, 'manual');
    } else {
      showToast(`You left the ${label} behind`, 'manual');
    }
    return;
  }
}

async function unloadAction() {
  const { items, manuals, survivor, left, sickened: sick } = unload(state, now());
  saveAndUpdate();
  if (left.length > 0) showDepartures(left);
  if (sick.length > 0) showSickness(sick);
  feedback('unload');
  mapView.playRipple(state.shelter, SHELTER_RADIUS, RIPPLE_MS);

  const messages = [];
  if (items > 0) messages.push(`Unloaded ${plural(items, 'item')}`);
  for (const id of manuals) messages.push(`${MANUALS[id].label} added to the workshop`);
  if (survivor) messages.push(`${survivor} moved into ${state.shelter.name}`);
  const note = messages.join('. ');
  let card = { icon: 'survivor', amount: '', name: survivor, note };
  if (items > 0) card = { icon: 'unload', amount: `+${items}`, name: 'Stored', note };
  else if (manuals.length > 0) card = { icon: 'manual', amount: '', name: 'Workshop', note };
  await showReward(card);
}

// Shows what the player carries and lets them mark things to drop.
// Nothing is dropped until they confirm.
async function openBackpackPanel() {
  dropping = { resources: emptyResources(), items: [], manuals: [] };
  renderBackpackRows();

  if ((await ask(ui.backpackPanel)) !== 'drop') return;
  const parts = [
    ...RESOURCES.filter(({ id }) => dropping.resources[id] > 0).map((resource) => ({
      text: amountOf(resource, dropping.resources[resource.id]),
      icon: resource.id,
    })),
    ...dropping.items.map((item) => ({ text: `your ${ITEMS[item.id].label}`, icon: item.id })),
    ...dropping.manuals.map((id) => ({ text: `the ${MANUALS[id].label}`, icon: 'manual' })),
  ];
  if (dropFromBackpack(state, dropping) === 0) return;
  saveAndUpdate();
  feedback('drop');
  replayAnimation(ui.backpackHud, 'bump');
  showToast(`You dropped ${listNames(parts.map(({ text }) => text))}`, parts.length === 1 ? parts[0].icon : 'backpack');
}

// One row per resource, item and manual in the backpack. Items and manuals
// are dropped whole, so their rows can only be marked once.
function renderBackpackRows() {
  const rows = RESOURCES.filter(({ id }) => state.backpack[id] > 0).map(({ id, label }) =>
    backpackRow({
      icon: id,
      label,
      max: state.backpack[id],
      marked: () => dropping.resources[id],
      mark: (count) => (dropping.resources[id] = count),
      count: (marked) => state.backpack[id] - marked,
    }),
  );
  for (const item of state.backpackItems) {
    const { label, uses } = ITEMS[item.id];
    rows.push(
      backpackRow({
        icon: item.id,
        label,
        max: 1,
        marked: () => Number(dropping.items.includes(item)),
        mark: (count) =>
          (dropping.items = count ? [...dropping.items, item] : dropping.items.filter((other) => other !== item)),
        count: () => `${item.uses}/${uses}`,
      }),
    );
  }
  for (const id of state.backpackManuals) {
    rows.push(
      backpackRow({
        icon: 'manual',
        label: MANUALS[id].label,
        max: 1,
        marked: () => Number(dropping.manuals.includes(id)),
        mark: (count) =>
          (dropping.manuals = count ? [...dropping.manuals, id] : dropping.manuals.filter((other) => other !== id)),
        count: () => '',
      }),
    );
  }
  ui.backpackItems.replaceChildren(...rows);
  ui.backpackEmpty.hidden = rows.length > 0;
  ui.backpackDropHint.hidden = rows.length === 0;
  renderBackpackPanel();
}

// `entry` describes a row: { icon, label, max, marked(), mark(count), count(marked) },
// where count() is the text shown for what is left.
function backpackRow(entry) {
  const row = ui.backpackRow.content.firstElementChild.cloneNode(true);
  row.entry = entry;
  row.classList.toggle('single', entry.max === 1);
  row.querySelector('.resource-icon use').setAttribute('href', `#i-${entry.icon}`);
  row.querySelector('.resource-name').textContent = entry.label;
  for (const button of row.querySelectorAll('[data-step]')) {
    const step = Number(button.dataset.step);
    button.setAttribute('aria-label', step > 0 ? `Drop one ${entry.label}` : `Keep one more ${entry.label}`);
    holdToRepeat(button, () => {
      const next = entry.marked() + step;
      if (next < 0 || next > entry.max) return false;
      entry.mark(next);
      renderBackpackPanel();
      return true;
    });
  }
  return row;
}

function renderBackpackPanel() {
  const time = now();
  const markedLoad =
    totalResources(dropping.resources) +
    dropping.items.reduce((sum, item) => sum + ITEMS[item.id].size, 0) +
    dropping.manuals.length * MANUAL_SIZE;
  const markedCount = totalResources(dropping.resources) + dropping.items.length + dropping.manuals.length;
  ui.backpackPanelLoad.textContent = `${backpackLoad(state) - markedLoad}/${backpackCapacity(state, time)}`;
  for (const row of ui.backpackItems.children) {
    const { max, marked, count } = row.entry;
    const [drop, keep] = row.querySelectorAll('[data-step]');
    const amount = marked();
    row.querySelector('.resource-count').textContent = count(amount);
    row.querySelector('.drop-count').textContent = amount > 0 && max > 1 ? `−${amount}` : '';
    row.classList.toggle('dropping', amount > 0);
    drop.disabled = amount >= max;
    keep.disabled = amount === 0;
  }
  ui.backpackClose.textContent = markedCount > 0 ? 'Cancel' : 'Close';
  ui.backpackDrop.textContent = `Drop ${markedCount}`;
  ui.backpackDrop.hidden = markedCount === 0;

  const { companion } = state;
  ui.backpackCompanion.hidden = !companion;
  if (!companion) return;
  const wounded = isWounded(companion, time);
  const space = `+${companionCapacityBonus(state, time)} space`;
  ui.backpackCompanionText.textContent = wounded
    ? `${companion.name} is wounded: ${space}. Heals in ${formatDuration(woundHealsAt(companion) - time)}.`
    : `${companion.name} is with you: ${space}.`;
  ui.backpackTreat.hidden = !wounded;
  ui.backpackTreat.disabled = !canTreat(state, companion, time);
}

function treatCompanion() {
  const { companion } = state;
  if (!companion || !treat(state, companion, now())) return;
  saveAndUpdate();
  feedback('heal');
  showToast(`You dressed ${companion.name}'s wound`, 'first-aid-kit');
  // The kit may be used up, so forget it if it was marked to be dropped.
  dropping.items = dropping.items.filter((item) => state.backpackItems.includes(item));
  renderBackpackRows();
}

function treatSurvivor(survivor) {
  const sick = isSick(survivor, now());
  if (!treat(state, survivor, now())) return;
  saveAndUpdate();
  feedback('heal');
  showToast(sick ? `${survivor.name} has been treated` : `${survivor.name}'s wound has been dressed`, 'first-aid-kit');
  renderShelterPanel();
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
  renderShelterPanel();
  ui.shelterPanel.showModal();
}

// Re-rendered every tick while open, so the hunger bars keep moving.
function renderShelterPanel() {
  const { shelter } = state;
  if (!shelter) return;
  const time = now();
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

  const space = freeSpace(state, time);
  renderOnChange(ui.shelterItems, [shelter.items, inShelter, space], () =>
    shelter.items.map((item) => {
      const { label, uses, size } = ITEMS[item.id];
      return itemRow({
        icon: item.id,
        label,
        detail: `${item.uses}/${uses} uses · ${size} space`,
        action: 'Pack',
        enabled: inShelter && canPack(state, item, time),
        onClick: () => packAction(item),
      });
    }),
  );

  renderOnChange(ui.shelterManuals, shelter.manuals, () =>
    shelter.manuals.map((id) => {
      const chip = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = MANUALS[id].label;
      chip.append(iconElement('manual'), name);
      return chip;
    }),
  );
  renderOnChange(ui.shelterRecipes, [shelter.manuals, shelter.storage, inShelter, shelter.radio !== null], () => [
    ...(knowsRadio(state) ? [radioRow()] : []),
    ...knownRecipes(state).map(([id, { label, cost, uses, size }]) =>
      itemRow({
        icon: id,
        label,
        detail: `${describeCost(cost)} · ${uses} uses · ${size} space`,
        action: 'Craft',
        enabled: inShelter && canCraft(state, id),
        onClick: () => craftAction(id),
      }),
    ),
  ]);
  let hint = '';
  if (shelter.manuals.length === 0) hint = 'Recipes come from manuals found in the wasteland.';
  else if (!inShelter) hint = 'Craft and pack gear while you are in the shelter.';
  ui.workshopHint.textContent = hint;
  ui.workshopHint.hidden = !hint;

  renderRadio(time);

  ui.shelterSurvivorCount.textContent = shelter.survivors.length;
  renderSurvivorBadges(time);
  ui.shelterNoSurvivors.hidden = shelter.survivors.length > 0;
}

// The radio in the workshop: a recipe until it is built, then a stamp.
function radioRow() {
  if (state.shelter.radio) {
    return itemRow({ icon: 'radio', label: RADIO.label, detail: 'Stays in the shelter', action: null });
  }
  return itemRow({
    icon: 'radio',
    label: RADIO.label,
    detail: `${describeCost(RADIO.cost)} · stays in the shelter`,
    action: 'Build',
    enabled: inShelter && canBuildRadio(state),
    onClick: buildRadioAction,
  });
}

// Its text changes every tick, but the Listen button stays the same element
// (see renderOnChange for why).
function renderRadio(time) {
  const { radio } = state.shelter;
  ui.radioSection.hidden = !radio;
  if (!radio) return;
  const blocker = listenBlocker(state, inShelter, time);
  ui.radioText.textContent = listening ? 'Listening…' : radioText(blocker, time);
  ui.radioListen.disabled = listening || blocker !== null;
  ui.radioListen.classList.toggle('listening', listening);
}

function radioText(blocker, time) {
  const { radio } = state.shelter;
  switch (blocker) {
    case 'mission': {
      const { survivor, landmark } = state.mission;
      return (
        `${survivor} is waiting at the ${LANDMARKS[landmark.type].label}, ${describeWhere(landmark)}. ` +
        `${formatDuration(missionEndsAt(state.mission) - time)} left.`
      );
    }
    case 'away':
      return 'Listen in from the shelter.';
    case 'companion':
      return `Bring ${state.companion.name} inside first.`;
    case 'cooldown': {
      const wait = formatDuration(listenReadyAt(radio) - time);
      // Listened since the last mission ended, so all they heard was static.
      const heardStatic = radio.lastListenAt > radio.quietSince;
      return `${heardStatic ? 'Only static.' : 'The airwaves are quiet.'} Listen again in ${wait}.`;
    }
    case 'cells':
      return 'The radio is dead. Bring Cells to the shelter to power it.';
    case 'landmarks':
      return 'Survivors call from places you know. Discover landmarks in the wasteland.';
    default:
      return 'Someone out there may be calling for help.';
  }
}

// "2.4 km north-east of Bunker"
function describeWhere(landmark) {
  const { shelter } = state;
  return `${formatDistance(distanceMeters(shelter, landmark))} ${compassPoint(shelter, landmark).long} of ${shelter.name}`;
}

function buildRadioAction() {
  if (!inShelter || !buildRadio(state, now())) return;
  saveAndUpdate();
  feedback('craft');
  showToast(`You built a ${RADIO.label}`, 'radio');
  renderShelterPanel();
}

async function listenAction() {
  if (listening || !state.shelter?.radio || listenBlocker(state, inShelter, now()) !== null) return;
  listening = true;
  feedback('listen');
  renderShelterPanel();
  await wait(LISTEN_MS);
  listening = false;
  const mission = listen(state, now());
  saveAndUpdate();
  renderShelterPanel();
  if (!mission) {
    feedback('static');
    return;
  }

  const { survivor, landmark } = mission;
  const { label } = LANDMARKS[landmark.type];
  feedback('call');
  ui.radioTitle.textContent = 'Distress call';
  ui.radioMessage.textContent = `“This is ${survivor}… I'm hurt… ${label}… ${describeWhere(landmark)}… please hurry…”`;
  ui.radioNote.textContent =
    `Search the area at the ${label} within ${formatDuration(missionEndsAt(mission) - now())} to bring ${survivor} home.`;
  await ask(ui.radioDialog);
  // Show the player where to go.
  ui.shelterPanel.close();
  mapView.playRipple(landmark, 0, RIPPLE_MS);
}

function showLostSignal({ survivor, landmark }) {
  ui.radioTitle.textContent = 'Signal lost';
  ui.radioMessage.textContent = `The signal from the ${LANDMARKS[landmark.type].label} went silent.`;
  ui.radioNote.textContent = `No one came for ${survivor} in time.`;
  if (!ui.radioDialog.open) ui.radioDialog.showModal();
  feedback('lost');
}

// The shelter panel re-renders every tick, and replacing a button between
// press and release would swallow the tap, so lists with buttons are only
// rebuilt when what they show changes.
function renderOnChange(list, shown, build) {
  const signature = JSON.stringify(shown);
  if (list.dataset.signature === signature) return;
  list.dataset.signature = signature;
  list.replaceChildren(...build());
}

function itemRow({ icon, label, detail, action, enabled, onClick }) {
  const row = ui.itemRow.content.firstElementChild.cloneNode(true);
  row.querySelector('.resource-icon use').setAttribute('href', `#i-${icon}`);
  row.querySelector('.resource-name').textContent = label;
  row.querySelector('.item-detail').textContent = detail;
  const button = row.querySelector('.item-action');
  if (!action) {
    // Already built: a stamp instead of a button.
    const stamp = document.createElement('span');
    stamp.className = 'item-stamp';
    stamp.textContent = 'Built';
    button.replaceWith(stamp);
    return row;
  }
  button.textContent = action;
  button.disabled = !enabled;
  button.setAttribute('aria-label', `${action} ${label}`);
  button.addEventListener('click', onClick);
  return row;
}

function craftAction(id) {
  if (!inShelter || !craft(state, id)) return;
  saveAndUpdate();
  feedback('craft');
  showToast(`You crafted a ${ITEMS[id].label}`, id);
  renderShelterPanel();
}

function packAction(item) {
  if (!inShelter || !packItem(state, item, now())) return;
  saveAndUpdate();
  feedback('land');
  replayAnimation(ui.backpackHud, 'bump');
  showToast(`You packed your ${ITEMS[item.id].label}`, item.id);
  renderShelterPanel();
}

// Updates the name tags in place, for the same reason as renderOnChange().
function renderSurvivorBadges(time) {
  const badges = state.shelter.survivors.map((survivor) => {
    let badge = survivorBadges.get(survivor);
    if (!badge) {
      badge = ui.survivorBadge.content.firstElementChild.cloneNode(true);
      badge.querySelector('.treat').addEventListener('click', () => treatSurvivor(survivor));
      survivorBadges.set(survivor, badge);
    }
    updateSurvivorBadge(badge, survivor, time);
    return badge;
  });
  const shown = [...ui.shelterSurvivorNames.children];
  if (badges.length !== shown.length || badges.some((badge, i) => badge !== shown[i])) {
    ui.shelterSurvivorNames.replaceChildren(...badges);
  }
}

// A survivor's name tag, with a bar running down to the end of their current
// hunger stage, and their wound or sickness if they have one.
function updateSurvivorBadge(badge, survivor, time) {
  const { stage, startedAt, endsAt } = hungerOf(survivor, time);
  const text = HUNGER_TEXT[stage];
  badge.dataset.stage = stage;
  badge.querySelector('.survivor-badge-name').textContent = survivor.name;
  badge.querySelector('.hunger-stage').textContent = text.label;
  badge.querySelector('.hunger-fill').style.width = `${(100 * (endsAt - time)) / (endsAt - startedAt)}%`;
  badge.querySelector('.hunger-time').textContent =
    `${text.next(state.shelter.storage.food > 0)} ${formatDuration(endsAt - time)}`;
  const wounded = isWounded(survivor, time);
  const sick = isSick(survivor, time);
  badge.querySelector('.wound').hidden = !wounded && !sick;
  if (!wounded && !sick) return;
  badge.querySelector('.wound use').setAttribute('href', wounded ? '#i-wound' : '#i-radiation');
  badge.querySelector('.wound-label').textContent = wounded && sick ? 'Wounded & sick' : wounded ? 'Wounded' : 'Sick';
  const healsAt = Math.max(wounded ? woundHealsAt(survivor) : 0, sick ? sicknessHealsAt(survivor) : 0);
  badge.querySelector('.wound-time').textContent = `heals in ${formatDuration(healsAt - time)}`;
  const treatButton = badge.querySelector('.treat');
  treatButton.disabled = !canTreat(state, survivor, time);
  treatButton.setAttribute('aria-label', `Treat ${survivor.name}`);
}

// How long ago something happened, e.g. "1d 23h ago" or "just now".
function formatAgo(ms) {
  const minutes = Math.floor(ms / (60 * 1000));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h ago`;
  if (hours > 0) return `${hours}h ${minutes % 60}min ago`;
  return minutes > 0 ? `${minutes} min ago` : 'just now';
}

function formatDuration(ms) {
  const hours = ms / (60 * 60 * 1000);
  return hours >= 1 ? `${Math.ceil(hours)} h` : `${Math.max(1, Math.ceil(hours * 60))} min`;
}

// Tells the player who left the shelter for lack of food, adding to the dialog if it is open.
function showDepartures(names) {
  departed.push(...names);
  ui.departureTitle.textContent =
    departed.length === 1 ? `${departed[0]} has left` : `${departed.length} survivors have left`;
  ui.departureText.textContent = `${listNames(departed)} left ${state.shelter.name}: there was no food.`;
  if (!ui.departureDialog.open) ui.departureDialog.showModal();
  feedback('full');
}

// Tells the player who got sick from contaminated food, adding to the dialog if it is open.
function showSickness(names) {
  sickened.push(...names.filter((name) => !sickened.includes(name)));
  ui.sicknessTitle.textContent =
    sickened.length === 1 ? `${sickened[0]} is sick` : `${sickened.length} survivors are sick`;
  ui.sicknessText.textContent =
    `${listNames(sickened)} got sick: the food was contaminated. A first aid kit will help.`;
  if (!ui.sicknessDialog.open) ui.sicknessDialog.showModal();
  feedback('lost');
}

// "Ada", "Ada and Bo", "Ada, Bo and Cy".
function listNames(names) {
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

function describeGame() {
  const { position } = tracker;
  if (!position) return '—';
  const zone = inShelter ? 'In shelter' : 'Wasteland';
  const distance = state.shelter ? `, ${Math.round(distanceMeters(state.shelter, position))} m from shelter` : '';
  const searched = plural(activeSearchedAreas(state, now()).length, 'searched area');
  const radiation = radiationAtPosition(state, position);
  const fallout = radiation > 0 ? `, radiation ${radiation.toFixed(2)}` : '';
  return `${zone}${distance}, ${searched}, ${plural(state.landmarks.length, 'landmark')}${fallout}`;
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
  replaceState(result.state);
  showToast('Save imported', 'import');
}

// A tapped landmark's card: its illustration, when it was last visited, and
// a way to take it off the map.
async function openLandmark(landmark) {
  const { label } = LANDMARKS[landmark.type];
  const pinned = isMissionLandmark(state, landmark);
  ui.landmarkArt.src = `img/landmarks/${landmark.type}.svg`;
  ui.landmarkName.textContent = label;
  ui.landmarkVisited.textContent = `Last visited: ${formatAgo(now() - landmark.visitedAt)}`;
  ui.landmarkMission.hidden = !pinned;
  ui.landmarkRemove.hidden = pinned;
  if ((await ask(ui.landmarkDialog)) !== 'remove') return;
  ui.removeLandmarkName.textContent = label;
  if ((await ask(ui.removeLandmarkDialog)) !== 'remove') return;
  if (!removeLandmark(state, landmark)) return;
  saveAndUpdate();
  showToast(`The ${label} is off your map`, landmark.type);
}

async function resetSave() {
  if ((await ask(ui.resetDialog)) !== 'reset') return;
  replaceState(createInitialState());
  showToast('Game data reset', 'reset');
}

function replaceState(newState) {
  // Other code holds a reference to `state`, so its contents are replaced in place.
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, newState);
  inShelter = false;
  mapView.recenter();
  saveAndUpdate();
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
ui.backpackTreat.addEventListener('click', treatCompanion);
ui.shelterButton.addEventListener('click', openShelterPanel);
ui.radioListen.addEventListener('click', listenAction);
ui.departureDialog.addEventListener('close', () => (departed = []));
ui.sicknessDialog.addEventListener('close', () => (sickened = []));
$('retry-location').addEventListener('click', () => tracker.start());
$('recenter').addEventListener('click', () => mapView.recenter());
mapView.onScaleChange = (meters, pixels) => {
  ui.scaleLabel.textContent = meters >= 1000 ? `${meters / 1000} km` : `${meters} m`;
  ui.scaleLine.style.width = `${pixels}px`;
};
// Map labels are drawn with the web fonts, so redraw once they have loaded.
document.fonts?.ready.then(update);

// The safety notice comes first at every start; then the welcome screen on
// the first one, or the game.
$('safety-button').addEventListener('click', () => {
  ui.safetyScreen.hidden = true;
  if (hasBeenWelcomed()) startTracking();
  else ui.welcomeScreen.hidden = false;
});

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
$('reset-button').addEventListener('click', () => {
  ui.menuDialog.close();
  resetSave();
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
document.addEventListener(
  'click',
  () => {
    sound.unlock();
    crackle();
  },
  { capture: true },
);

// Enter in the name field should create the shelter, not hit the first (Cancel) button.
ui.shelterName.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  ui.nameDialog.close('create');
});
// The player has to choose whether to take the survivor or manual, and whether to fight.
for (const dialog of [ui.survivorDialog, ui.manualDialog, ui.encounterDialog]) {
  dialog.addEventListener('cancel', (event) => event.preventDefault());
}

tracker.addEventListener('change', update);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) tracker.stop();
  else if (started) tracker.resume();
});

mapView.onLandmarkTap = openLandmark;
if (isDebug) mapView.onTap = (point) => tracker.setManualPosition(point);

setInterval(tick, TICK_MS);

requestPersistentStorage();
tick();
const updated = new Date(`${APP_UPDATED}T12:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
$('app-meta').textContent = `Save version ${STATE_VERSION} · Updated ${updated}`;
ui.safetyScreen.hidden = false;
$('safety-button').focus();
