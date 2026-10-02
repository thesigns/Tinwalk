// Game rules: shelter, searching, backpack, survivors and unloading.
// Functions take the game state and mutate it; saving is up to the caller.

import { distanceMeters, toMercator } from './geo.js';
import { SURVIVOR_NAMES } from './names.js';
import { biomeAt } from './terrain.js';

export const RESOURCES = [
  { id: 'junk', label: 'Junk' },
  { id: 'food', label: 'Food' },
];

// Searches further from the shelter turn up more loot and more survivors.
// Each tier applies up to (but not including) its maxDistance in meters.
const LOOT_TIERS = [
  { maxDistance: 1000, minLoot: 1, maxLoot: 1, survivorChance: 0.01 },
  { maxDistance: 2000, minLoot: 1, maxLoot: 2, survivorChance: 0.02 },
  { maxDistance: 4000, minLoot: 2, maxLoot: 4, survivorChance: 0.04 },
  { maxDistance: 8000, minLoot: 3, maxLoot: 6, survivorChance: 0.06 },
  { maxDistance: Infinity, minLoot: 4, maxLoot: 8, survivorChance: 0.08 },
];

// The biome where the player searches decides which resource is likely.
const BIOME_LOOT_WEIGHTS = {
  plains: { junk: 50, food: 50 },
  forest: { junk: 20, food: 80 },
  ruins: { junk: 80, food: 20 },
};

export const SHELTER_RADIUS = 100;
// The player leaves the shelter a bit further out than they enter it, so GPS
// jitter at the edge doesn't flip them in and out.
export const SHELTER_EXIT_RADIUS = 110;
export const SEARCH_RADIUS = 100;
export const MIN_SEARCH_DISTANCE = 200;
export const SEARCH_EXPIRY_MS = 12 * 60 * 60 * 1000;
export const SHELTER_NAME_MAX_LENGTH = 24;
export const DEFAULT_SHELTER_NAME = 'Shelter';

const BACKPACK_CAPACITY = 50;
export const SURVIVOR_CAPACITY_BONUS = 30;

export function emptyResources() {
  return Object.fromEntries(RESOURCES.map(({ id }) => [id, 0]));
}

export function totalResources(resources) {
  return RESOURCES.reduce((sum, { id }) => sum + resources[id], 0);
}

export function backpackCapacity(state) {
  return BACKPACK_CAPACITY + (state.companion ? SURVIVOR_CAPACITY_BONUS : 0);
}

export function createShelter(state, { lat, lon }, name, time) {
  state.shelter = {
    name: name.trim().slice(0, SHELTER_NAME_MAX_LENGTH) || DEFAULT_SHELTER_NAME,
    lat,
    lon,
    createdAt: time,
    storage: emptyResources(),
    survivors: [],
  };
}

export function isInShelter(shelter, position, wasInShelter) {
  if (!shelter || !position) return false;
  const radius = wasInShelter ? SHELTER_EXIT_RADIUS : SHELTER_RADIUS;
  return distanceMeters(shelter, position) <= radius;
}

export function activeSearchedAreas(state, time) {
  return state.searchedAreas.filter((area) => time - area.searchedAt < SEARCH_EXPIRY_MS);
}

// Removes expired searched areas. Returns true if anything was removed.
export function pruneSearchedAreas(state, time) {
  const active = activeSearchedAreas(state, time);
  const changed = active.length !== state.searchedAreas.length;
  state.searchedAreas = active;
  return changed;
}

// Why the player can't search here: 'shelter', 'searched', or null if they can.
export function searchBlocker(state, position, time) {
  if (state.shelter && distanceMeters(state.shelter, position) < MIN_SEARCH_DISTANCE) return 'shelter';
  const tooClose = activeSearchedAreas(state, time).some(
    (area) => distanceMeters(area, position) < MIN_SEARCH_DISTANCE,
  );
  return tooClose ? 'searched' : null;
}

// Returns { resource, found, carried, survivor }, where survivor is a name or null.
// A found survivor joins only after takeSurvivor().
export function search(state, position, time, random = Math.random) {
  const tier = lootTier(distanceMeters(state.shelter, position));
  const { x, y } = toMercator(position);
  const resource = pickResource(BIOME_LOOT_WEIGHTS[biomeAt(x, y).name], random);
  const found = tier.minLoot + Math.floor(random() * (tier.maxLoot - tier.minLoot + 1));
  const space = Math.max(0, backpackCapacity(state) - totalResources(state.backpack));
  const carried = Math.min(found, space);
  state.backpack[resource.id] += carried;
  state.searchedAreas.push({ lat: position.lat, lon: position.lon, searchedAt: time });

  const survivor =
    !state.companion && random() < tier.survivorChance
      ? SURVIVOR_NAMES[Math.floor(random() * SURVIVOR_NAMES.length)]
      : null;
  return { resource, found, carried, survivor };
}

// Throws resources out of the backpack, e.g. to make room for something else.
// `amounts` maps resource ids to units; returns how many units were dropped.
export function dropResources(state, amounts) {
  let dropped = 0;
  for (const { id } of RESOURCES) {
    const amount = Math.min(amounts[id] ?? 0, state.backpack[id]);
    state.backpack[id] -= amount;
    dropped += amount;
  }
  return dropped;
}

export function takeSurvivor(state, name) {
  state.companion = { name };
}

export function canUnload(state) {
  return totalResources(state.backpack) > 0 || state.companion !== null;
}

// Moves the backpack into shelter storage and the companion into the shelter.
// Returns { items, survivor }, where survivor is a name or null.
export function unload(state) {
  const items = totalResources(state.backpack);
  for (const { id } of RESOURCES) {
    state.shelter.storage[id] += state.backpack[id];
    state.backpack[id] = 0;
  }
  const survivor = state.companion;
  if (survivor) state.shelter.survivors.push(survivor);
  state.companion = null;
  return { items, survivor: survivor?.name ?? null };
}

function lootTier(distance) {
  return LOOT_TIERS.find((tier) => distance < tier.maxDistance);
}

function pickResource(weights, random) {
  const total = RESOURCES.reduce((sum, { id }) => sum + weights[id], 0);
  let roll = random() * total;
  for (const resource of RESOURCES) {
    roll -= weights[resource.id];
    if (roll < 0) return resource;
  }
  return RESOURCES.at(-1);
}
