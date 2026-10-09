// Loads, saves, exports and imports the game state.

import { now } from './clock.js';
import { ENEMIES, ITEMS, LANDMARKS, MANUALS, MAX_WOUNDS, RESOURCES, emptyResources } from './game.js';

const STORAGE_KEY = 'tinwalk.state';
export const STATE_VERSION = 18;
export const WORLD_ID_MAX_LENGTH = 32;

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
  // Landmarks moved to the corners of a grid around the shelter. Version 10
  // dropped the grid again.
  5(save) {
    save.version = 6;
  },
  // Cells, a new resource that powers the radio. No one has any yet.
  6(save) {
    for (const resources of [save.backpack, save.shelter?.storage]) {
      if (isObject(resources)) resources.cells = 0;
    }
    save.version = 7;
  },
  // Fallout: Isotopes, contaminated food and sickness. Nothing is contaminated yet.
  7(save) {
    for (const resources of [save.backpack, save.shelter?.storage]) {
      if (isObject(resources)) resources.isotopes = 0;
    }
    save.backpackContaminatedFood = 0;
    if (isObject(save.shelter)) {
      save.shelter.contaminatedFood = 0;
      for (const survivor of save.shelter.survivors ?? []) {
        if (isObject(survivor)) survivor.sickAt = null;
      }
    }
    save.version = 8;
  },
  // Enemies that weren't beaten stay on the map. None were kept before.
  8(save) {
    save.enemies = [];
    save.version = 9;
  },
  // Landmarks no longer wait at grid corners, so they don't remember one.
  9(save) {
    for (const landmark of save.landmarks ?? []) {
      if (isObject(landmark)) delete landmark.corner;
    }
    save.version = 10;
  },
  // Landmarks remember when they were last visited; until now, only when found.
  10(save) {
    for (const landmark of save.landmarks ?? []) {
      if (isObject(landmark)) landmark.visitedAt = landmark.discoveredAt;
    }
    save.version = 11;
  },
  // Worlds: the terrain is laid out around where the game began, seeded by a
  // World ID. Older games get a new world centered on their shelter.
  11(save) {
    const { shelter } = save;
    save.world = isPoint(shelter) ? { id: randomWorldId(), origin: { lat: shelter.lat, lon: shelter.lon } } : null;
    save.version = 12;
  },
  // Landmark types are drawn from a bag per biome. The bags start empty and
  // fill up at the next discovery.
  12(save) {
    save.landmarkBags = emptyLandmarkBags();
    save.version = 13;
  },
  // Data, a new resource found mostly in the ruins. No one has any yet.
  13(save) {
    for (const resources of [save.backpack, save.shelter?.storage]) {
      if (isObject(resources)) resources.data = 0;
    }
    save.version = 14;
  },
  // Drones come in swarms. None has been met yet.
  14(save) {
    save.swarm = null;
    save.version = 15;
  },
  // The companion became a party that stays together between walks and eats
  // on the way. A companion hasn't arrived at the shelter yet, and has just eaten.
  15(save) {
    const { companion } = save;
    save.party = isObject(companion)
      ? [{ name: companion.name, arrivedAt: null, lastMealAt: now(), woundedAt: companion.woundedAt, sickAt: null }]
      : [];
    delete save.companion;
    save.version = 16;
  },
  // A survivor found with a full party waits to be taken along at the
  // landmark. No one has been found yet.
  16(save) {
    if (isObject(save.mission)) save.mission.foundAt = null;
    save.version = 17;
  },
  // Wounds are counted, and the player can be wounded too. A survivor whose
  // wound hadn't healed yet (it took 72 hours) has one wound, starting to heal
  // now. A survivor still waiting for rescue has two.
  17(save) {
    const time = now();
    for (const survivor of [...(save.party ?? []), ...(save.shelter?.survivors ?? [])]) {
      if (!isObject(survivor)) continue;
      const { woundedAt } = survivor;
      survivor.wounds = isNumber(woundedAt) && time - woundedAt < 72 * 60 * 60 * 1000 ? 1 : 0;
      survivor.healing = 0;
      survivor.healedTo = time;
      delete survivor.woundedAt;
    }
    save.player = { wounds: 0, healing: 0, healedTo: time };
    if (isObject(save.mission)) save.mission.wounds = 2;
    // When meals were last settled wasn't kept. From the start of time, meals
    // missed since are eaten on time, as they were until now.
    save.mealsSettledAt = 0;
    save.version = 18;
  },
};

// One bag of landmark types per biome; see drawLandmarkType() in game.js.
function emptyLandmarkBags() {
  return { plains: [], forest: [], ruins: [] };
}

// A World ID for a new game: ten random digits.
export function randomWorldId() {
  const digits = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(digits, (n, i) => (i === 0 ? 1 + (n % 9) : n % 10)).join('');
}

function migrate(save) {
  while (isObject(save) && MIGRATIONS[save.version]) MIGRATIONS[save.version](save);
  return save;
}

export function createInitialState() {
  return {
    version: STATE_VERSION,
    // { id, origin: { lat, lon } | null }: the World ID the player chose, and
    // where the game began, the center of the world. The origin is null until
    // the first good position after the game began. null before a new game.
    world: null,
    // { name, lat, lon, createdAt, storage, contaminatedFood, items, manuals,
    //   radio: { builtAt, lastListenAt, quietSince } | null,
    //   survivors: [{ name, arrivedAt, lastMealAt, wounds, healing, healedTo, sickAt }],
    //   departedSurvivors: [{ name, arrivedAt, leftAt, reason }] }
    // arrivedAt is null for those who never reached the shelter.
    shelter: null,
    searchedAreas: [], // [{ lat, lon, searchedAt }]
    landmarks: [], // [{ type, lat, lon, discoveredAt, visitedAt }]
    // The landmark types each biome has yet to give before they repeat: { plains, forest, ruins }.
    landmarkBags: emptyLandmarkBags(),
    // The rescue mission under way: { survivor, wounds, landmark: { type, lat, lon }, calledAt, foundAt },
    // where foundAt is when the survivor was found with a full party, or null.
    mission: null,
    enemies: [], // enemies not beaten yet, where they were met: [{ type, lat, lon, foundAt }]
    // Where the last drone was met, until the next search: { lat, lon } | null. See game.js.
    swarm: null,
    backpack: emptyResources(),
    // How many of the Food units in the backpack are contaminated. Hidden from the player.
    backpackContaminatedFood: 0,
    backpackItems: [], // [{ id, uses }]
    backpackManuals: [], // manual ids
    // The player's wounds; see survivors for what the fields mean.
    player: { wounds: 0, healing: 0, healedTo: 0 },
    // Who walks with the player: [{ name, arrivedAt, lastMealAt, wounds, healing, healedTo, sickAt }].
    // wounds is how many they have, healing how much time has gone into
    // healing the next one, and healedTo up to when that was counted.
    party: [],
    // Raises the chance of finding a manual, see game.js.
    searchesWithoutManual: 0,
    // When meals were last settled; see settleMeals() in game.js.
    mealsSettledAt: 0,
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
const isTime = (value) => value === null || isNumber(value);
// Wounds as the player and survivors have them.
const isWounded = (value) =>
  isObject(value) &&
  isCount(value.wounds) &&
  value.wounds <= MAX_WOUNDS &&
  isNumber(value.healing) &&
  value.healing >= 0 &&
  isNumber(value.healedTo);
const isSurvivor = (value) =>
  isPerson(value) && isWounded(value) && isTime(value.arrivedAt) && isNumber(value.lastMealAt) && isTime(value.sickAt);
// Everyone in the shelter has arrived there.
const isShelterSurvivor = (value) => isSurvivor(value) && value.arrivedAt !== null;
const isDepartedSurvivor = (value) =>
  isPerson(value) && isTime(value.arrivedAt) && isNumber(value.leftAt) && typeof value.reason === 'string';
const isResources = (value) => isObject(value) && RESOURCES.every(({ id }) => isCount(value[id]));
const isItem = (value) =>
  isObject(value) && Object.hasOwn(ITEMS, value.id) && isCount(value.uses) && value.uses > 0;
const isItemList = (value) => Array.isArray(value) && value.every(isItem);
const isManualList = (value) =>
  Array.isArray(value) &&
  value.every((id) => Object.hasOwn(MANUALS, id)) &&
  new Set(value).size === value.length;
const isLandmarkPoint = (value) => isPoint(value) && Object.hasOwn(LANDMARKS, value.type);
const isLandmark = (value) => isLandmarkPoint(value) && isNumber(value.discoveredAt) && isNumber(value.visitedAt);
const isEnemy = (value) => isPoint(value) && Object.hasOwn(ENEMIES, value.type) && isNumber(value.foundAt);
const isMission = (value) =>
  isObject(value) &&
  typeof value.survivor === 'string' &&
  isLandmarkPoint(value.landmark) &&
  isNumber(value.calledAt) &&
  isTime(value.foundAt) &&
  isCount(value.wounds) &&
  value.wounds <= MAX_WOUNDS;
const isWorld = (value) =>
  isObject(value) &&
  typeof value.id === 'string' &&
  value.id.trim().length > 0 &&
  value.id.length <= WORLD_ID_MAX_LENGTH &&
  (value.origin === null || isPoint(value.origin));
// Each bag holds distinct types of its own biome.
const isLandmarkBags = (value) =>
  isObject(value) &&
  Object.entries(emptyLandmarkBags()).every(
    ([biome]) =>
      Array.isArray(value[biome]) &&
      value[biome].every((type) => LANDMARKS[type]?.biome === biome) &&
      new Set(value[biome]).size === value[biome].length,
  );
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
    isCount(shelter.contaminatedFood) &&
    shelter.contaminatedFood <= shelter.storage.food &&
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
    (state.world === null || isWorld(state.world)) &&
    (state.shelter === null || isValidShelter(state.shelter)) &&
    Array.isArray(state.searchedAreas) &&
    state.searchedAreas.every((area) => isPoint(area) && isNumber(area.searchedAt)) &&
    Array.isArray(state.landmarks) &&
    state.landmarks.every(isLandmark) &&
    isLandmarkBags(state.landmarkBags) &&
    Array.isArray(state.enemies) &&
    state.enemies.every(isEnemy) &&
    (state.swarm === null || isPoint(state.swarm)) &&
    // A mission needs a radio, which is in the shelter.
    (state.mission === null || (isMission(state.mission) && state.shelter?.radio != null)) &&
    isResources(state.backpack) &&
    isCount(state.backpackContaminatedFood) &&
    state.backpackContaminatedFood <= state.backpack.food &&
    isItemList(state.backpackItems) &&
    isManualList(state.backpackManuals) &&
    isCount(state.searchesWithoutManual) &&
    isNumber(state.mealsSettledAt) &&
    isWounded(state.player) &&
    Array.isArray(state.party) &&
    state.party.every(isSurvivor) &&
    // Survivors come from rescue missions, which need the shelter's radio.
    (state.party.length === 0 || state.shelter !== null)
  );
}
