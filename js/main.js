import { now } from './clock.js';
import { DEBUG_START, DebugPanel, isDebug } from './debug.js';
import {
  HUNGER_STAGES,
  ITEMS,
  MANUALS,
  MANUAL_SIZE,
  RESOURCES,
  SEARCH_RADIUS,
  SHELTER_RADIUS,
  VICTORY_LOOT_MULTIPLIER,
  activeSearchedAreas,
  backpackCapacity,
  biomeAtPosition,
  backpackLoad,
  bestWeapon,
  canCraft,
  canPack,
  canTakeManual,
  canTreat,
  canUnload,
  collectLoot,
  companionCapacityBonus,
  craft,
  createShelter,
  dropFromBackpack,
  emptyResources,
  fight,
  freeSpace,
  hungerOf,
  isInShelter,
  isWounded,
  knownRecipes,
  packItem,
  pruneSearchedAreas,
  runAway,
  search,
  searchBlocker,
  settleMeals,
  takeManual,
  takeSurvivor,
  totalResources,
  treat,
  unload,
  winChance,
  woundHealsAt,
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
  'giant-rat': 'A rat the size of a dog jumps out at you, teeth bared.',
};

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
  encounterDialog: $('encounter-dialog'),
  encounterTitle: $('encounter-title'),
  encounterIcon: $('encounter-icon'),
  encounterText: $('encounter-text'),
  encounterOdds: $('encounter-odds'),
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
  departureTitle: $('departure-title'),
  departureText: $('departure-text'),
  scaleLabel: $('scale-label'),
  locationLabel: $('location-label'),
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
// Survivors listed in the open departure dialog.
let departed = [];
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

function update() {
  inShelter = isInShelter(state.shelter, tracker.position, inShelter);
  renderStatus();
  renderActions();
  renderMap();
  // In debug mode the game can be played without GPS.
  ui.deniedScreen.hidden = isDebug || tracker.signal !== 'denied';
  debugPanel?.update();
}

// Searched areas expire and survivors get hungry even when nothing else happens.
function tick() {
  const time = now();
  const pruned = pruneSearchedAreas(state, time);
  const { meals, left } = settleMeals(state, time);
  if (pruned || meals > 0 || left.length > 0) saveState(state);
  if (left.length > 0) showDepartures(left);
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
  ui.locationLabel.hidden = !position;
  if (position) {
    ui.locationLabel.textContent = inShelter ? 'Shelter' : biomeAtPosition(position).label;
    ui.locationLabel.classList.toggle('uncertain', !tracker.hasGoodSignal);
  }
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
  await mapView.playSweep(position, SEARCH_RADIUS, SEARCH_ANIMATION_MS);
  searching = false;

  holdBackpack = true;
  const result = search(state, position, now());
  saveAndUpdate();
  let { loot } = result;
  let victory = null;
  if (result.enemy) {
    holdBackpack = false;
    update();
    victory = await encounter(result.enemy);
    if (!victory) return;
    holdBackpack = true;
    loot = collectLoot(state, position, now(), VICTORY_LOOT_MULTIPLIER);
    saveAndUpdate();
  }

  const { resource, found, carried, survivor, manual } = loot;
  let message = `You've found ${found} ${resource.label}`;
  if (carried === 0) message += ', but your backpack is full';
  else if (carried < found) message += `, but could only carry ${carried}`;
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

  if (survivor) await offerSurvivor(survivor);
  if (manual) await offerManual(manual);
}

// Asks whether to fight the enemy or run, and settles it. Returns a note for
// the loot card after a won fight, or null if the search ends here.
async function encounter(enemy) {
  const weapon = bestWeapon(state);
  const chance = `${Math.round(100 * winChance(state, enemy))}% to win`;
  ui.encounterTitle.textContent = `${enemy.label}!`;
  ui.encounterIcon.setAttribute('href', `#i-${enemy.id}`);
  ui.encounterText.textContent = ENCOUNTER_TEXT[enemy.id];
  ui.encounterOdds.textContent =
    (weapon
      ? `With your ${ITEMS[weapon.id].label} (${plural(weapon.uses, 'use')} left): ${chance}.`
      : `Bare-handed: ${chance}.`) + ' Running away costs some of your supplies.';
  feedback('enemy');

  if ((await ask(ui.encounterDialog)) !== 'fight') {
    const lost = runAway(state, enemy);
    saveAndUpdate();
    feedback('flee');
    const total = totalResources(lost);
    if (total > 0) replayAnimation(ui.backpackHud, 'bump');
    showToast(total > 0 ? `You ran, dropping ${describeResources(lost)}` : 'You ran and got away', enemy.id);
    return null;
  }

  const { won, weapon: used, wornOut, lost, wounded } = fight(state, enemy, now());
  saveAndUpdate();
  const wornNote = wornOut ? ` Your ${ITEMS[used].label} is worn out.` : '';
  if (won) {
    feedback('hit');
    return `You fought off the ${enemy.label}: double loot!${wornNote}`;
  }

  feedback('defeat');
  const total = totalResources(lost);
  let note = `The ${enemy.label} got the better of you.`;
  if (total > 0) note += ` You lost ${describeResources(lost)}.`;
  if (wounded) note += ` ${state.companion.name} was wounded.`;
  await showReward({ icon: enemy.id, amount: total > 0 ? `−${total}` : '', name: 'Defeat', note: note + wornNote, empty: true });
  if (total > 0) replayAnimation(ui.backpackHud, 'bump');
  if (wounded) replayAnimation(ui.companion, 'bump');
  return null;
}

// "3 Junk and 1 Food", leaving out resources with no units.
function describeResources(amounts) {
  return listNames(RESOURCES.filter(({ id }) => amounts[id] > 0).map(({ id, label }) => `${amounts[id]} ${label}`));
}

async function offerSurvivor(survivor) {
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

// Offers a found manual. If it doesn't fit, the player can open the backpack
// to drop something, and then gets the offer again.
async function offerManual(id) {
  const { label } = MANUALS[id];
  const recipes = Object.values(ITEMS).filter((item) => item.manual === id).map((item) => item.label);
  ui.manualName.textContent = label;
  ui.manualText.textContent = `Bring it to your shelter to craft: ${listNames(recipes)}. Takes ${MANUAL_SIZE} backpack space.`;
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
  const { items, manuals, survivor, left } = unload(state, now());
  saveAndUpdate();
  if (left.length > 0) showDepartures(left);
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
    ...RESOURCES.filter(({ id }) => dropping.resources[id] > 0).map(({ id, label }) => ({
      text: `${dropping.resources[id]} ${label}`,
      icon: id,
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
  if (!treat(state, survivor, now())) return;
  saveAndUpdate();
  feedback('heal');
  showToast(`${survivor.name}'s wound has been dressed`, 'first-aid-kit');
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
  renderOnChange(ui.shelterRecipes, [shelter.manuals, shelter.storage.junk, inShelter], () =>
    knownRecipes(state).map(([id, { label, cost, uses, size }]) =>
      itemRow({
        icon: id,
        label,
        detail: `${cost} Junk · ${uses} uses · ${size} space`,
        action: 'Craft',
        enabled: inShelter && canCraft(state, id),
        onClick: () => craftAction(id),
      }),
    ),
  );
  let hint = '';
  if (shelter.manuals.length === 0) hint = 'Recipes come from manuals found in the wasteland.';
  else if (!inShelter) hint = 'Craft and pack gear while you are in the shelter.';
  ui.workshopHint.textContent = hint;
  ui.workshopHint.hidden = !hint;

  ui.shelterSurvivorCount.textContent = shelter.survivors.length;
  renderSurvivorBadges(time);
  ui.shelterNoSurvivors.hidden = shelter.survivors.length > 0;
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
// hunger stage, and their wound if they have one.
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
  badge.querySelector('.wound').hidden = !wounded;
  if (!wounded) return;
  badge.querySelector('.wound-time').textContent = `heals in ${formatDuration(woundHealsAt(survivor) - time)}`;
  const treatButton = badge.querySelector('.treat');
  treatButton.disabled = !canTreat(state, survivor, time);
  treatButton.setAttribute('aria-label', `Treat ${survivor.name}`);
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

// "Ada", "Ada and Bo", "Ada, Bo and Cy".
function listNames(names) {
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
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
ui.backpackTreat.addEventListener('click', treatCompanion);
ui.shelterButton.addEventListener('click', openShelterPanel);
ui.departureDialog.addEventListener('close', () => (departed = []));
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
// The player has to choose whether to take the survivor or manual, and whether to fight.
for (const dialog of [ui.survivorDialog, ui.manualDialog, ui.encounterDialog]) {
  dialog.addEventListener('cancel', (event) => event.preventDefault());
}

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
