// Loads, saves, exports and imports the game state.

import { now } from './clock.js';
import { ITEMS, LANDMARKS, MANUALS, RESOURCES, emptyResources } from './game.js';

const STORAGE_KEY = 'tinwalk.state';
export const STATE_VERSION = 5;

const INVALID_SAVE = "This file isn't a valid Tinwalk save";
const OTHER_VERSION = 'This save comes from a different version of Tinwalk';

// Each migration upgrades a save from the version it is keyed by to the next one.
const MIGRATIONS = {
  // Ammo, Meds and Tech were removed: such things will be crafted from Junk instead.
  1(save) {
    for (const resources of [save.backpack, save.shelter?.storage]) {
      if (!isObject(resources)) continue;
      delete resources.ammo;
      delete resources.meds;
      delete resources.tech;
    }
    save.version = 2;
  },
  // Survivors in the shelter started eating. Their arrival wasn't recorded
  // before, so they arrive, and have just eaten, at the time of the upgrade.
  2(save) {
    const time = now();
    for (const survivor of save.shelter?.survivors ?? []) {
      if (!isObject(survivor)) continue;
      survivor.arrivedAt = time;
      survivor.lastMealAt = time;
    }
    if (isObject(save.shelter)) save.shelter.departedSurvivors = [];
    save.version = 3;
  },
  // Crafting, fights and wounds: items and manuals, and no one is wounded yet.
  3(save) {
    save.backpackItems = [];
    save.backpackManuals = [];
    save.searchesWithoutManual = 0;
    if (isObject(save.companion)) save.companion.woundedAt = null;
    if (isObject(save.shelter)) {
      save.shelter.items = [];
      save.shelter.manuals = [];
      for (const survivor of save.shelter.survivors ?? []) {
        if (isObject(survivor)) survivor.woundedAt = null;
      }
    }
    save.version = 4;
  },
  // Landmarks, the radio and rescue missions. The Radio Manual is new, so no
  // one has it yet.
  4(save) {
    save.landmarks = [];
    save.mission = null;
    if (isObject(save.shelter)) save.shelter.radio = null;
    save.version = 5;
  },
};

function migrate(save) {
  while (isObject(save) && MIGRATIONS[save.version]) MIGRATIONS[save.version](save);
  return save;
}

export function createInitialState() {
  return {
    version: STATE_VERSION,
    // { name, lat, lon, createdAt, storage, items, manuals,
    //   radio: { builtAt, lastListenAt, quietSince } | null,
    //   survivors: [{ name, arrivedAt, lastMealAt, woundedAt }],
    //   departedSurvivors: [{ name, arrivedAt, leftAt, reason }] }
    shelter: null,
    searchedAreas: [], // [{ lat, lon, searchedAt }]
    landmarks: [], // [{ type, lat, lon, discoveredAt }]
    // The rescue mission under way: { survivor, landmark: { type, lat, lon }, calledAt }
    mission: null,
    backpack: emptyResources(),
    backpackItems: [], // [{ id, uses }]
    backpackManuals: [], // manual ids
    companion: null, // { name, woundedAt }
    // Raises the chance of finding a manual, see game.js.
    searchesWithoutManual: 0,
  };
}

export function loadState() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return createInitialState();
    const state = migrate(JSON.parse(raw));
    if (isValidState(state)) return state;
  } catch (error) {
    console.warn('Could not load the saved game', error);
  }
  // Keep the unreadable save instead of overwriting it, so it can be recovered.
  if (raw !== null) {
    try {
      localStorage.setItem(`${STORAGE_KEY}.backup-${Date.now()}`, raw);
    } catch (error) {
      console.warn('Could not back up the saved game', error);
    }
  }
  return createInitialState();
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Could not save the game', error);
  }
}

// Asks the browser not to evict our data (e.g. Safari after days without use).
export function requestPersistentStorage() {
  navigator.storage?.persist?.().catch(() => {});
}

export function exportState(state) {
  return JSON.stringify(state, null, 2);
}

// Returns { state } for a valid save, or { error } with a message for the player.
export function parseSave(text) {
  let data;
  try {
    data = migrate(JSON.parse(text));
  } catch {
    return { error: INVALID_SAVE };
  }
  if (typeof data?.version === 'number' && data.version !== STATE_VERSION) return { error: OTHER_VERSION };
  return isValidState(data) ? { state: data } : { error: INVALID_SAVE };
}

const isObject = (value) => value !== null && typeof value === 'object';
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isCount = (value) => Number.isInteger(value) && value >= 0;
const isPoint = (value) => isObject(value) && isNumber(value.lat) && isNumber(value.lon);
const isPerson = (value) => isObject(value) && typeof value.name === 'string';
const isLivingPerson = (value) => isPerson(value) && (value.woundedAt === null || isNumber(value.woundedAt));
const isShelterSurvivor = (value) =>
  isLivingPerson(value) && isNumber(value.arrivedAt) && isNumber(value.lastMealAt);
const isDepartedSurvivor = (value) =>
  isPerson(value) && isNumber(value.arrivedAt) && isNumber(value.leftAt) && typeof value.reason === 'string';
const isResources = (value) => isObject(value) && RESOURCES.every(({ id }) => isCount(value[id]));
const isItem = (value) =>
  isObject(value) && Object.hasOwn(ITEMS, value.id) && isCount(value.uses) && value.uses > 0;
const isItemList = (value) => Array.isArray(value) && value.every(isItem);
const isManualList = (value) =>
  Array.isArray(value) &&
  value.every((id) => Object.hasOwn(MANUALS, id)) &&
  new Set(value).size === value.length;
const isLandmarkPoint = (value) => isPoint(value) && Object.hasOwn(LANDMARKS, value.type);
const isLandmark = (value) => isLandmarkPoint(value) && isNumber(value.discoveredAt);
const isMission = (value) =>
  isObject(value) && typeof value.survivor === 'string' && isLandmarkPoint(value.landmark) && isNumber(value.calledAt);
const isRadio = (value) =>
  isObject(value) &&
  isNumber(value.builtAt) &&
  (value.lastListenAt === null || isNumber(value.lastListenAt)) &&
  isNumber(value.quietSince);

function isValidShelter(shelter) {
  return (
    isPoint(shelter) &&
    typeof shelter.name === 'string' &&
    isNumber(shelter.createdAt) &&
    isResources(shelter.storage) &&
    isItemList(shelter.items) &&
    isManualList(shelter.manuals) &&
    (shelter.radio === null || isRadio(shelter.radio)) &&
    Array.isArray(shelter.survivors) &&
    shelter.survivors.every(isShelterSurvivor) &&
    Array.isArray(shelter.departedSurvivors) &&
    shelter.departedSurvivors.every(isDepartedSurvivor)
  );
}

function isValidState(state) {
  return (
    isObject(state) &&
    state.version === STATE_VERSION &&
    (state.shelter === null || isValidShelter(state.shelter)) &&
    Array.isArray(state.searchedAreas) &&
    state.searchedAreas.every((area) => isPoint(area) && isNumber(area.searchedAt)) &&
    Array.isArray(state.landmarks) &&
    state.landmarks.every(isLandmark) &&
    // A mission needs a radio, which is in the shelter.
    (state.mission === null || (isMission(state.mission) && state.shelter?.radio != null)) &&
    isResources(state.backpack) &&
    isItemList(state.backpackItems) &&
    isManualList(state.backpackManuals) &&
    isCount(state.searchesWithoutManual) &&
    (state.companion === null || isLivingPerson(state.companion))
  );
}
