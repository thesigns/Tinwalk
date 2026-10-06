// Game rules: shelter, searching, backpack, landmarks, the radio and rescue
// missions, survivors, unloading and meals, crafting, fights and wounds.
// Functions take the game state and mutate it; saving is up to the caller.

import { distanceMeters, toMercator } from './geo.js';
import { SURVIVOR_NAMES } from './names.js';
import { nextCrossing, sunElevation } from './sun.js';
import { biomeAt, radiationAt, settlementAt } from './terrain.js';

// one: the label for a single unit, as in "1 Cell".
export const RESOURCES = [
  { id: 'junk', label: 'Junk', one: 'Junk' },
  { id: 'food', label: 'Food', one: 'Food' },
  { id: 'cells', label: 'Cells', one: 'Cell' },
  { id: 'isotopes', label: 'Isotopes', one: 'Isotope' },
];

// Searches further from the shelter turn up more loot.
// Each tier applies up to (but not including) its maxDistance in meters.
const LOOT_TIERS = [
  { maxDistance: 1000, minLoot: 1, maxLoot: 1 },
  { maxDistance: 2000, minLoot: 1, maxLoot: 2 },
  { maxDistance: 4000, minLoot: 2, maxLoot: 4 },
  { maxDistance: 8000, minLoot: 3, maxLoot: 6 },
  { maxDistance: Infinity, minLoot: 4, maxLoot: 8 },
];

// The biome where the player searches decides which resource is likely.
// Cells are rare outside the ruins: they power the radio and nothing makes them yet.
// Isotopes come only from fallout, with a Geiger counter (see collectLoot()).
const BIOME_LOOT_WEIGHTS = {
  plains: { junk: 45, food: 45, cells: 10, isotopes: 0 },
  forest: { junk: 20, food: 75, cells: 5, isotopes: 0 },
  ruins: { junk: 60, food: 10, cells: 30, isotopes: 0 },
};

// A Geiger counter in the backpack picks the isotopes out of a search in the
// fallout; everything else found there is too hot to keep. Without one, food
// found there is contaminated, which no one can tell until it makes someone sick.
const ISOTOPES_PER_SEARCH = 1;
const ISOTOPES = RESOURCES.find(({ id }) => id === 'isotopes');

// Manuals unlock crafting recipes. Ids double as keys in the save.
export const MANUALS = {
  radio: { label: 'Radio Manual' },
  knifemaking: { label: 'Knifemaking Manual' },
  pharmacology: { label: 'Pharmacology Manual' },
  'electric-tools': { label: 'Electric Tools Manual' },
};
// The radio leads to rescue missions, the only way to find survivors, so its
// manual always comes first.
const FIRST_MANUAL = 'radio';
export const MANUAL_SIZE = 3;
// Each search without a manual makes the next one likelier, so bad luck
// doesn't keep a player from crafting for long.
const MANUAL_BASE_CHANCE = 0.02;
const MANUAL_CHANCE_STEP = 0.01;
const MANUAL_MAX_CHANCE = 0.2;
// Pharmacies and electronics are in towns, so their manuals turn up more often
// in ruins. The first manual is always the same, so it needs no weights.
const BIOME_MANUAL_WEIGHTS = {
  plains: { knifemaking: 1, pharmacology: 1, 'electric-tools': 1 },
  forest: { knifemaking: 1, pharmacology: 1, 'electric-tools': 1 },
  ruins: { knifemaking: 1, pharmacology: 2, 'electric-tools': 2 },
};

// Crafted items, in workshop order. Ids double as icon names. The cost is in
// resources from storage; a weapon's bonus adds to the player's strike card. Electric items come with their Cells built in and
// are gone once those run flat: they are never recharged.
export const ITEMS = {
  knife: { label: 'Knife', manual: 'knifemaking', cost: { junk: 5 }, uses: 6, size: 2, bonus: 2 },
  'combat-knife': { label: 'Combat knife', manual: 'knifemaking', cost: { junk: 15 }, uses: 12, size: 3, bonus: 4 },
  'first-aid-kit': { label: 'First aid kit', manual: 'pharmacology', cost: { junk: 7 }, uses: 3, size: 2 },
  flashlight: { label: 'Flashlight', manual: 'electric-tools', cost: { junk: 10, cells: 1 }, uses: 10, size: 2 },
  'geiger-counter': {
    label: 'Geiger counter',
    manual: 'electric-tools',
    cost: { junk: 10, cells: 1 },
    uses: 10,
    size: 2,
  },
};
const FIRST_AID_KIT = 'first-aid-kit';
const FLASHLIGHT = 'flashlight';
const GEIGER_COUNTER = 'geiger-counter';

// Night falls at the end of civil dusk, when the sun is 6 degrees below the
// horizon: right after sunset there is still light to search by. Searching in
// the dark finds a unit less (but never nothing); a flashlight lifts that and
// finds a unit more, day or night, so the night is never better than the day.
const NIGHT_SUN_ELEVATION = -6;
const DARK_LOOT_PENALTY = 1;
const FLASHLIGHT_LOOT_BONUS = 1;

// The radio is built once and stays in the shelter. Expensive on purpose:
// building it is a goal in itself.
export const RADIO = { label: 'Radio', manual: 'radio', cost: { junk: 30 } };
// One listen every few hours. The chance of a call grows the longer the radio
// has been quiet, counted from the end of the last mission, so a player who
// listens once a day always hears someone.
export const LISTEN_COOLDOWN_MS = 4 * 60 * 60 * 1000;
// Every listen drains Cells from storage, even when all it brings is static.
const LISTEN_CELLS = 1;
const CALL_CHANCE_STEP = 0.25;
const CALL_CHANCE_PERIOD_MS = 4 * 60 * 60 * 1000;
const MISSION_DURATION_MS = 24 * 60 * 60 * 1000;

// Landmarks, by the biome they are found in. Ids double as icon names.
export const LANDMARKS = {
  'abandoned-mine': {
    label: 'Abandoned Mine',
    biome: 'plains',
    flavor: 'The headframe still creaks in the wind. Nobody has gone down in years.',
  },
  farmstead: {
    label: 'Farmstead',
    biome: 'plains',
    flavor: 'A cold stove, a dry well and an empty dog chain. They left in a hurry.',
  },
  windmill: {
    label: 'Windmill',
    biome: 'plains',
    flavor: 'Its sails stopped turning when the grain ran out. Crows keep watch now.',
  },
  'grain-silo': {
    label: 'Grain Silo',
    biome: 'plains',
    flavor: 'Rust ate through the bins and the grain spilled out. The rats got there first.',
  },
  'bus-wreck': {
    label: 'Bus Wreck',
    biome: 'plains',
    flavor: 'The last bus to town never made it. A birch grows through its roof.',
  },
  'roadside-shrine': {
    label: 'Roadside Shrine',
    biome: 'plains',
    flavor: 'Someone still lights a candle here. You never see who.',
  },
  watchtower: {
    label: 'Watchtower',
    biome: 'forest',
    flavor: 'From the cabin you could once see three villages. Now you see smoke.',
  },
  'lean-to': {
    label: 'Lean-to',
    biome: 'forest',
    flavor: 'Poles, branches and a cold fire pit. Someone slept here not long ago.',
  },
  'hunting-stand': {
    label: 'Hunting Stand',
    biome: 'forest',
    flavor: 'Spent shells lie in the grass. The hunter left, or became the hunted.',
  },
  'ranger-station': {
    label: 'Ranger Station',
    biome: 'forest',
    flavor: "The forester's logbook ends mid-sentence, on the day it all began.",
  },
  bunker: {
    label: 'Bunker',
    biome: 'forest',
    flavor: 'Built for a war that never came. Then a different one did.',
  },
  'plane-wreck': {
    label: 'Plane Wreck',
    biome: 'forest',
    flavor: "A small plane nosed into the pines. The pilot's seat is empty.",
  },
  pharmacy: {
    label: 'Pharmacy',
    biome: 'ruins',
    flavor: 'The shelves were stripped bare in the first week. Maybe not the back room.',
  },
  'gas-station': {
    label: 'Gas Station',
    biome: 'ruins',
    flavor: 'The pumps ran dry long ago, but the smell of fuel lingers.',
  },
  'police-station': {
    label: 'Police Station',
    biome: 'ruins',
    flavor: 'Someone made a last stand here. The sandbags are still in place.',
  },
  school: {
    label: 'School',
    biome: 'ruins',
    flavor: 'The clock stopped at a quarter past ten. Chalk words still cover the board.',
  },
  'water-tower': {
    label: 'Water Tower',
    biome: 'ruins',
    flavor: 'The tank is dry and the ladder broken, but the view still reaches far.',
  },
  church: {
    label: 'Church',
    biome: 'ruins',
    flavor: 'The spire fell into the churchyard. The doors were left open.',
  },
};
// Every fourth searched area may turn up a landmark, counting the areas still
// active, so each fresh walk starts counting anew. Landmarks keep apart from
// each other and from the shelter, so a route walked before has nothing left
// to find and new ground is what pays off.
const LANDMARK_SEARCH_INTERVAL = 4;
const LANDMARK_SPACING = 600;
// A landmark stands where the player searched, which proves they could get
// there on foot. From a bus or a train it could end up on a road or railway.
const MAX_LANDMARK_SPEED = 12 / 3.6;

// A fight is two cards: the enemy draws a threat card from its own deck, the
// player sees it and either runs or draws a strike card, 1 to 10 plus their
// weapon's bonus. A higher strike wins, an equal one is a stalemate.
// Rats live outside the fallout, mutated rats inside it. lossOnRun and
// lossOnDefeat are the shares of backpack resources the player loses; attack
// sets the chance of wounding the companion. Ids double as icon names.
export const ENEMIES = {
  rat: { label: 'Rat', threat: [1, 6], attack: 1, lossOnRun: 0.1, lossOnDefeat: 0.3 },
  'mutated-rat': { label: 'Mutated Rat', threat: [4, 10], attack: 2, lossOnRun: 0.15, lossOnDefeat: 0.4 },
};
export const STRIKE_CARDS = 10;
const ENCOUNTER_CHANCE = 0.05;
const PLAYER_DEFENSE = 1;
// Winning a fight doubles the loot of the search.
export const VICTORY_LOOT_MULTIPLIER = 2;

export const SHELTER_RADIUS = 100;
// The player leaves the shelter a bit further out than they enter it, so GPS
// jitter at the edge doesn't flip them in and out.
export const SHELTER_EXIT_RADIUS = 110;
// Searched areas merge like metaballs. Each search spreads an influence that
// fades to nothing at SEARCH_INFLUENCE meters, and a point counts as searched
// where the influences add up to at least 1. A lone search covers a disc of
// SEARCH_RADIUS; searches close to each other flow together into one blob.
export const SEARCH_RADIUS = 200;
export const SEARCH_INFLUENCE = 1.5 * SEARCH_RADIUS;
const SEARCH_THRESHOLD = (1 - (SEARCH_RADIUS / SEARCH_INFLUENCE) ** 2) ** 2;
export const SHELTER_SEARCH_DISTANCE = 200;
// Short enough that a favorite route can be walked again later the same day.
export const SEARCH_EXPIRY_MS = 6 * 60 * 60 * 1000;
export const SHELTER_NAME_MAX_LENGTH = 24;
export const DEFAULT_SHELTER_NAME = 'Shelter';

// Survivors in the shelter eat 1 Food a day. Without food they get hungry,
// then starving, and leave the shelter when the last stage runs out.
const MEAL_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const HUNGER_STAGES = ['satiated', 'hungry', 'starving'];
// A wounded or sick survivor eats more, but only if there is enough food.
const AILING_MEAL_FOOD = 2;
// Wounds and sickness heal on their own; a first aid kit heals them right away.
const WOUND_HEAL_MS = 72 * 60 * 60 * 1000;
const SICKNESS_HEAL_MS = 72 * 60 * 60 * 1000;

const BACKPACK_CAPACITY = 50;
export const SURVIVOR_CAPACITY_BONUS = 30;
export const WOUNDED_CAPACITY_BONUS = 10;

export function emptyResources() {
  return Object.fromEntries(RESOURCES.map(({ id }) => [id, 0]));
}

export function totalResources(resources) {
  return RESOURCES.reduce((sum, { id }) => sum + resources[id], 0);
}

// Backpack space taken by resources, items and manuals.
export function backpackLoad(state) {
  const items = state.backpackItems.reduce((sum, item) => sum + ITEMS[item.id].size, 0);
  return totalResources(state.backpack) + items + state.backpackManuals.length * MANUAL_SIZE;
}

export function companionCapacityBonus(state, time) {
  if (!state.companion) return 0;
  return isWounded(state.companion, time) ? WOUNDED_CAPACITY_BONUS : SURVIVOR_CAPACITY_BONUS;
}

export function backpackCapacity(state, time) {
  return BACKPACK_CAPACITY + companionCapacityBonus(state, time);
}

// The backpack may hold more than its capacity after a companion got
// wounded; nothing falls out, but nothing more fits until it is lighter.
export function freeSpace(state, time) {
  return Math.max(0, backpackCapacity(state, time) - backpackLoad(state));
}

export function createShelter(state, { lat, lon }, name, time) {
  state.shelter = {
    name: name.trim().slice(0, SHELTER_NAME_MAX_LENGTH) || DEFAULT_SHELTER_NAME,
    lat,
    lon,
    createdAt: time,
    storage: emptyResources(),
    // How many of the Food units in storage are contaminated. Hidden from the player.
    contaminatedFood: 0,
    items: [],
    manuals: [],
    radio: null,
    survivors: [],
    // Survivors who left, kept for statistics such as how long they lasted.
    departedSurvivors: [],
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

// How much a search contributes to the searched field at the given distance:
// exactly 1 at SEARCH_RADIUS, more closer in, 0 from SEARCH_INFLUENCE on.
// Takes the distance squared, so the map can evaluate it on a whole grid
// without square roots.
export function searchWeight(distanceSquared) {
  if (distanceSquared >= SEARCH_INFLUENCE ** 2) return 0;
  return (1 - distanceSquared / SEARCH_INFLUENCE ** 2) ** 2 / SEARCH_THRESHOLD;
}

export function isSearched(areas, position) {
  let field = 0;
  for (const area of areas) {
    field += searchWeight(distanceMeters(area, position) ** 2);
    if (field >= 1) return true;
  }
  return false;
}

// Why the player can't search here: 'shelter', 'searched', or null if they can.
export function searchBlocker(state, position, time) {
  if (state.shelter && distanceMeters(state.shelter, position) < SHELTER_SEARCH_DISTANCE) return 'shelter';
  return isSearched(activeSearchedAreas(state, time), position) ? 'searched' : null;
}

// Searches the area, which counts as searched whatever happens next. Returns
// { encounter } if an enemy shows up (see fight()): an enemy left on the map
// nearby always does, and otherwise one may turn up and stay on the map until
// beaten. Only a won fight then brings loot, through finishSearch().
// Otherwise returns finishSearch()'s { loot, rescued }.
export function search(state, position, time, random = Math.random) {
  state.searchedAreas.push({ lat: position.lat, lon: position.lon, searchedAt: time });
  visitLandmarks(state, position, time);
  const waiting = enemyNear(state, position);
  if (waiting) return { encounter: { enemy: waiting, threat: drawThreat(waiting, random), returning: true } };
  const rescued = completeRescue(state, time);
  // A wounded survivor wouldn't have lasted with enemies around.
  if (!rescued && random() < ENCOUNTER_CHANCE) {
    const type = radiationAtPosition(state, position) > 0 ? 'mutated-rat' : 'rat';
    const enemy = { type, lat: position.lat, lon: position.lon, foundAt: time };
    state.enemies.push(enemy);
    return { encounter: { enemy, threat: drawThreat(enemy, random), returning: false } };
  }
  return { loot: collectLoot(state, position, time, 1, random), rescued };
}

// Landmarks that a search's area reaches count as visited, the same reach
// that completes a rescue there.
function visitLandmarks(state, position, time) {
  const areas = activeSearchedAreas(state, time);
  for (const landmark of state.landmarks) {
    if (reaches(areas, position, landmark)) landmark.visitedAt = time;
  }
}

// The landmark a search here would reach, the nearest if there are more, or null.
export function landmarkInReach(state, position, time) {
  const areas = [...activeSearchedAreas(state, time), { lat: position.lat, lon: position.lon, searchedAt: time }];
  let nearest = null;
  for (const landmark of state.landmarks) {
    if (!reaches(areas, position, landmark)) continue;
    if (!nearest || distanceMeters(landmark, position) < distanceMeters(nearest, position)) nearest = landmark;
  }
  return nearest;
}

// Whether the areas, including one just searched at the position, cover the landmark.
function reaches(areas, position, landmark) {
  return distanceMeters(landmark, position) < SEARCH_INFLUENCE && isSearched(areas, landmark);
}

// Whether a rescue mission's survivor is waiting at the landmark.
export function isMissionLandmark(state, landmark) {
  const target = state.mission?.landmark;
  return Boolean(target) && target.type === landmark.type && target.lat === landmark.lat && target.lon === landmark.lon;
}

// Takes a landmark off the map for good, which also frees the ground around
// it for a new one. The landmark of a mission under way stays. Returns
// whether it was removed.
export function removeLandmark(state, landmark) {
  const index = state.landmarks.indexOf(landmark);
  if (index === -1 || isMissionLandmark(state, landmark)) return false;
  state.landmarks.splice(index, 1);
  return true;
}

// The rest of a search after a won fight: { loot, rescued }, with loot from
// collectLoot() and rescued the name of the survivor found if the search
// reached the rescue mission's landmark, or null.
export function finishSearch(state, position, time, multiplier, random = Math.random) {
  const rescued = completeRescue(state, time);
  return { loot: collectLoot(state, position, time, multiplier, random), rescued };
}

// The enemy on the map closest to a position within a search's reach, or null.
function enemyNear(state, position) {
  let nearest = null;
  let nearestDistance = SEARCH_RADIUS;
  for (const enemy of state.enemies) {
    const distance = distanceMeters(enemy, position);
    if (distance <= nearestDistance) {
      nearest = enemy;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function drawThreat(enemy, random) {
  const [low, high] = ENEMIES[enemy.type].threat;
  return low + Math.floor(random() * (high - low + 1));
}

// The biome at a { lat, lon } position, e.g. BIOMES.forest.
export function biomeAtPosition(position) {
  const { x, y } = toMercator(position);
  return biomeAt(x, y);
}

// The settlement whose ruins are at a { lat, lon } position, or null.
export function settlementAtPosition(position) {
  const { x, y } = toMercator(position);
  return settlementAt(x, y);
}

// Returns { resource, found, carried, manual, landmark, dark, flashlight, geiger },
// where manual is a manual id or null and landmark a newly discovered landmark
// or null. dark tells whether the dark cost the player a unit; flashlight and
// geiger are { wornOut } if that item was used, or null. A found manual is
// carried only after takeManual(); a landmark is on the map at once. The
// position may carry the player's speed in m/s (see gps.js).
export function collectLoot(state, position, time, multiplier = 1, random = Math.random) {
  const biome = biomeAtPosition(position).name;
  const radioactive = radiationAtPosition(state, position) > 0;
  const geiger = radioactive ? mostWorn(state.backpackItems, GEIGER_COUNTER) : null;
  const { resource, amount, dark, light } = geiger
    ? { resource: ISOTOPES, amount: ISOTOPES_PER_SEARCH, dark: false, light: null }
    : rollResource(state, position, biome, time, random);
  // Used-up items are left behind, freeing their space.
  const lightWornOut = light ? useItem(state.backpackItems, light) : false;
  const geigerWornOut = geiger ? useItem(state.backpackItems, geiger) : false;
  const found = multiplier * amount;
  const carried = Math.min(found, freeSpace(state, time));
  state.backpack[resource.id] += carried;
  if (radioactive && resource.id === 'food') state.backpackContaminatedFood += carried;
  return {
    resource,
    found,
    carried,
    manual: rollManual(state, biome, random),
    landmark: findLandmark(state, position, biome, time, random),
    dark,
    flashlight: light ? { wornOut: lightWornOut } : null,
    geiger: geiger ? { wornOut: geigerWornOut } : null,
  };
}

// An ordinary find: { resource, amount, dark, light }, where light is the
// flashlight that lit the search, or null.
function rollResource(state, position, biome, time, random) {
  const tier = lootTier(distanceMeters(state.shelter, position));
  const resource = pickWeighted(RESOURCES, BIOME_LOOT_WEIGHTS[biome], random);
  let amount = tier.minLoot + Math.floor(random() * (tier.maxLoot - tier.minLoot + 1));
  const light = mostWorn(state.backpackItems, FLASHLIGHT);
  let dark = false;
  if (light) {
    amount += FLASHLIGHT_LOOT_BONUS;
  } else if (isNight(position, time)) {
    const dim = Math.max(1, amount - DARK_LOOT_PENALTY);
    dark = dim < amount;
    amount = dim;
  }
  return { resource, amount, dark, light };
}

// How radioactive a { lat, lon } position is, from 0 (clean) to 1. The
// ground around the shelter, where no one searches, is clean.
export function radiationAtPosition(state, position) {
  if (state.shelter && distanceMeters(state.shelter, position) < SHELTER_SEARCH_DISTANCE) return 0;
  const { x, y } = toMercator(position);
  return radiationAt(x, y);
}

// Whether the backpack holds a Geiger counter, which reveals the fallout.
export function hasGeigerCounter(state) {
  return state.backpackItems.some((item) => item.id === GEIGER_COUNTER);
}

// Whether it is dark at a { lat, lon } position.
export function isNight(position, time) {
  return sunElevation(position, time) < NIGHT_SUN_ELEVATION;
}

// When night next falls or ends at a position, or null during a polar day or night.
export function nextDaylightChange(position, time) {
  return nextCrossing(position, time, NIGHT_SUN_ELEVATION);
}


// A manual the player doesn't have yet, or null.
function rollManual(state, biome, random) {
  const missing = Object.keys(MANUALS).filter((id) => !hasManual(state, id));
  if (missing.length === 0) return null;
  const chance = Math.min(MANUAL_BASE_CHANCE + MANUAL_CHANCE_STEP * state.searchesWithoutManual, MANUAL_MAX_CHANCE);
  if (random() >= chance) {
    state.searchesWithoutManual++;
    return null;
  }
  state.searchesWithoutManual = 0;
  if (missing.includes(FIRST_MANUAL)) return FIRST_MANUAL;
  const weights = BIOME_MANUAL_WEIGHTS[biome];
  return pickWeighted(missing.map((id) => ({ id })), weights, random).id;
}

// Discovers a landmark where the player searched, if this search is due one
// and nothing else stands nearby. Returns it, or null.
function findLandmark(state, position, biome, time, random) {
  // An unknown speed counts as walking: it is unknown mostly when standing still.
  if (position.speed > MAX_LANDMARK_SPEED) return null;
  if (activeSearchedAreas(state, time).length % LANDMARK_SEARCH_INTERVAL !== 0) return null;
  const places = [state.shelter, ...state.landmarks];
  if (places.some((place) => distanceMeters(place, position) < LANDMARK_SPACING)) return null;
  const types = Object.keys(LANDMARKS).filter((type) => LANDMARKS[type].biome === biome);
  const type = types[Math.floor(random() * types.length)];
  const landmark = { type, lat: position.lat, lon: position.lon, discoveredAt: time, visitedAt: time };
  state.landmarks.push(landmark);
  return landmark;
}

// Whether the player has the manual, in the shelter or on the way there.
function hasManual(state, id) {
  return state.shelter.manuals.includes(id) || state.backpackManuals.includes(id);
}

export function canTakeManual(state, time) {
  return freeSpace(state, time) >= MANUAL_SIZE;
}

export function takeManual(state, id, time) {
  if (!canTakeManual(state, time) || hasManual(state, id)) return false;
  state.backpackManuals.push(id);
  return true;
}

// The weapons in the backpack, the player's to choose from: the strongest
// first, and of equally strong ones the most worn, which is worth using up first.
export function backpackWeapons(state) {
  return state.backpackItems
    .filter((item) => ITEMS[item.id].bonus)
    .sort((a, b) => ITEMS[b.id].bonus - ITEMS[a.id].bonus || a.uses - b.uses);
}

// Fights the encounter's enemy with a weapon from the backpack, or bare-handed
// if it is null. Every fight uses the weapon up a little, whatever the outcome.
// Returns { outcome, card, strike, wornOut, lost, wounded }: 'won', 'stalemate'
// or 'lost', the strike card drawn and the strike with the weapon's bonus,
// whether the weapon was used up, the resources lost and whether the companion
// was wounded. A beaten enemy leaves the map; after a win, the caller finishes
// the search with VICTORY_LOOT_MULTIPLIER.
export function fight(state, { enemy, threat }, weapon, time, random = Math.random) {
  const card = 1 + Math.floor(random() * STRIKE_CARDS);
  const strike = card + (weapon ? ITEMS[weapon.id].bonus : 0);
  const wornOut = weapon ? useItem(state.backpackItems, weapon) : false;
  const result = { card, strike, wornOut, lost: emptyResources(), wounded: false };
  if (strike > threat) {
    state.enemies.splice(state.enemies.indexOf(enemy), 1);
    return { outcome: 'won', ...result };
  }
  if (strike === threat) return { outcome: 'stalemate', ...result };

  const { lossOnDefeat, attack } = ENEMIES[enemy.type];
  const lost = loseResources(state, lossOnDefeat, random);
  const wounded = state.companion !== null && random() < attack / (attack + PLAYER_DEFENSE);
  if (wounded) state.companion.woundedAt = time;
  return { outcome: 'lost', ...result, lost, wounded };
}

// Runs from the enemy, always successfully. Returns the resources dropped on the way.
export function runAway(state, { enemy }, random = Math.random) {
  return loseResources(state, ENEMIES[enemy.type].lossOnRun, random);
}

// Loses a share of the resources in the backpack, rounded down but at least 1
// unit, picked at random unit by unit. Items and manuals are never lost.
function loseResources(state, share, random) {
  const lost = emptyResources();
  const total = totalResources(state.backpack);
  if (total === 0) return lost;
  let count = Math.max(1, Math.floor(total * share));
  let remaining = total;
  while (count-- > 0) {
    let roll = Math.floor(random() * remaining);
    for (const { id } of RESOURCES) {
      if (roll < state.backpack[id]) {
        if (id === 'food') state.backpackContaminatedFood -= takeFood(state.backpack.food, state.backpackContaminatedFood, 1, random);
        state.backpack[id]--;
        lost[id]++;
        break;
      }
      roll -= state.backpack[id];
    }
    remaining--;
  }
  return lost;
}

// Takes `count` units at random out of `food` units, `contaminated` of which
// are contaminated. Returns how many of the taken units were contaminated;
// the caller updates both counts. Contaminated food looks like any other, so
// it goes in its share.
function takeFood(food, contaminated, count, random) {
  let taken = 0;
  for (let i = 0; i < count && food > 0; i++, food--) {
    if (random() * food < contaminated) {
      contaminated--;
      taken++;
    }
  }
  return taken;
}

// Uses an item once, removing it from the list when it is used up. Returns true if it was.
function useItem(list, item) {
  item.uses--;
  if (item.uses > 0) return false;
  list.splice(list.indexOf(item), 1);
  return true;
}

export function isWounded(survivor, time) {
  if (survivor.woundedAt === null) return false;
  const elapsed = time - survivor.woundedAt;
  return elapsed >= 0 && elapsed < WOUND_HEAL_MS;
}

export function woundHealsAt(survivor) {
  return survivor.woundedAt + WOUND_HEAL_MS;
}

// Only survivors in the shelter eat, so only they can get sick; the
// companion has no sickAt.
export function isSick(survivor, time) {
  if (survivor.sickAt == null) return false;
  const elapsed = time - survivor.sickAt;
  return elapsed >= 0 && elapsed < SICKNESS_HEAL_MS;
}

export function sicknessHealsAt(survivor) {
  return survivor.sickAt + SICKNESS_HEAL_MS;
}

// Wounded or sick, so in need of a first aid kit.
export function isAiling(survivor, time) {
  return isWounded(survivor, time) || isSick(survivor, time);
}

// The first aid kit in a list that would be used first: the most worn one.
function firstAidKit(items) {
  return mostWorn(items, FIRST_AID_KIT);
}

// Of the items of a kind in a list, the one with the fewest uses left, so
// they get used up one by one; null if there is none.
function mostWorn(items, id) {
  return items
    .filter((item) => item.id === id)
    .reduce((most, item) => (!most || item.uses < most.uses ? item : most), null);
}

// Kits for the companion come from the backpack; kits for shelter survivors
// from storage, applied by the others there, so the player needn't be home.
export function canTreat(state, survivor, time) {
  if (!isAiling(survivor, time)) return false;
  const items = survivor === state.companion ? state.backpackItems : state.shelter.items;
  return firstAidKit(items) !== null;
}

// Heals a survivor's wound and sickness with one use of a first aid kit.
// Returns false if there is nothing to treat or no kit at hand.
export function treat(state, survivor, time) {
  if (!canTreat(state, survivor, time)) return false;
  const items = survivor === state.companion ? state.backpackItems : state.shelter.items;
  survivor.woundedAt = null;
  if (survivor !== state.companion) survivor.sickAt = null;
  useItem(items, firstAidKit(items));
  return true;
}

// What a manual lets the player craft, by label.
export function manualRecipes(id) {
  const labels = Object.values(ITEMS).filter((item) => item.manual === id).map((item) => item.label);
  if (RADIO.manual === id) labels.push(RADIO.label);
  return labels;
}

// Items the shelter's manuals let the player craft, as [id, item] pairs.
export function knownRecipes(state) {
  return Object.entries(ITEMS).filter(([, item]) => state.shelter.manuals.includes(item.manual));
}

export function canCraft(state, id) {
  const item = ITEMS[id];
  return state.shelter.manuals.includes(item.manual) && canAfford(state.shelter.storage, item.cost);
}

// Crafts an item from resources in storage, into storage. The caller checks
// that the player is in the shelter.
export function craft(state, id) {
  if (!canCraft(state, id)) return false;
  spend(state.shelter.storage, ITEMS[id].cost);
  state.shelter.items.push({ id, uses: ITEMS[id].uses });
  return true;
}

// Whether there are enough resources for a cost such as { junk: 10, cells: 1 }.
function canAfford(resources, cost) {
  return Object.entries(cost).every(([id, amount]) => resources[id] >= amount);
}

function spend(resources, cost) {
  for (const [id, amount] of Object.entries(cost)) resources[id] -= amount;
}

export function knowsRadio(state) {
  return state.shelter.manuals.includes(RADIO.manual);
}

export function canBuildRadio(state) {
  return knowsRadio(state) && !state.shelter.radio && canAfford(state.shelter.storage, RADIO.cost);
}

// Builds the radio from resources in storage. The caller checks that the
// player is in the shelter.
export function buildRadio(state, time) {
  if (!canBuildRadio(state)) return false;
  spend(state.shelter.storage, RADIO.cost);
  state.shelter.radio = { builtAt: time, lastListenAt: null, quietSince: time };
  return true;
}

// Landmarks a survivor could call from: those outside searched areas, where
// the player can still search, and so reach them.
export function callableLandmarks(state, time) {
  const areas = activeSearchedAreas(state, time);
  return state.landmarks.filter((landmark) => !isSearched(areas, landmark));
}

// Why the player can't listen to the radio: 'mission', 'away', 'companion',
// 'cooldown', 'cells' or 'landmarks', or null if they can. The caller checks that
// there is a radio.
export function listenBlocker(state, inShelter, time) {
  if (state.mission) return 'mission';
  if (!inShelter) return 'away';
  if (state.companion) return 'companion';
  if (time < listenReadyAt(state.shelter.radio)) return 'cooldown';
  if (state.shelter.storage.cells < LISTEN_CELLS) return 'cells';
  return callableLandmarks(state, time).length === 0 ? 'landmarks' : null;
}

export function listenReadyAt(radio) {
  return radio.lastListenAt === null ? -Infinity : radio.lastListenAt + LISTEN_COOLDOWN_MS;
}

export function callChance(radio, time) {
  const periods = Math.floor(Math.max(0, time - radio.quietSince) / CALL_CHANCE_PERIOD_MS);
  return Math.min(1, CALL_CHANCE_STEP * (1 + periods));
}

// Listens to the radio. Returns the rescue mission if a survivor calls, or
// null for static. The caller checks listenBlocker() first.
export function listen(state, time, random = Math.random) {
  const { radio, storage } = state.shelter;
  radio.lastListenAt = time;
  storage.cells -= LISTEN_CELLS;
  if (random() >= callChance(radio, time)) return null;
  const landmarks = callableLandmarks(state, time);
  const { type, lat, lon } = landmarks[Math.floor(random() * landmarks.length)];
  const survivor = SURVIVOR_NAMES[Math.floor(random() * SURVIVOR_NAMES.length)];
  state.mission = { survivor, landmark: { type, lat, lon }, calledAt: time };
  return state.mission;
}

export function missionEndsAt(mission) {
  return mission.calledAt + MISSION_DURATION_MS;
}

// Ends the mission if the survivor's time ran out. Returns the failed
// mission, or null.
export function expireMission(state, time) {
  const { mission } = state;
  if (!mission || time < missionEndsAt(mission)) return null;
  state.mission = null;
  // The radio went quiet when the mission ended, not when the game was opened.
  state.shelter.radio.quietSince = missionEndsAt(mission);
  return mission;
}

// Ends the mission if its landmark has just been searched. Returns the
// rescued survivor's name, or null. They join only after takeSurvivor(). An
// enemy near the landmark keeps the survivor pinned down until it is beaten.
function completeRescue(state, time) {
  const { mission } = state;
  if (!mission || time >= missionEndsAt(mission)) return null;
  if (!isSearched(activeSearchedAreas(state, time), mission.landmark)) return null;
  if (enemyNear(state, mission.landmark)) return null;
  state.mission = null;
  state.shelter.radio.quietSince = time;
  return mission.survivor;
}

export function canPack(state, item, time) {
  return freeSpace(state, time) >= ITEMS[item.id].size;
}

// Moves an item from storage into the backpack. The caller checks that the
// player is in the shelter.
export function packItem(state, item, time) {
  if (!canPack(state, item, time)) return false;
  state.shelter.items.splice(state.shelter.items.indexOf(item), 1);
  state.backpackItems.push(item);
  return true;
}

// Throws things out of the backpack, e.g. to make room for something else.
// `resources` maps resource ids to units; `items` and `manuals` are the
// backpack items and manual ids to drop. Returns how many things were dropped.
export function dropFromBackpack(state, { resources, items = [], manuals = [] }, random = Math.random) {
  let dropped = 0;
  for (const { id } of RESOURCES) {
    const amount = Math.min(resources[id] ?? 0, state.backpack[id]);
    if (id === 'food') state.backpackContaminatedFood -= takeFood(state.backpack.food, state.backpackContaminatedFood, amount, random);
    state.backpack[id] -= amount;
    dropped += amount;
  }
  const keptItems = state.backpackItems.filter((item) => !items.includes(item));
  const keptManuals = state.backpackManuals.filter((id) => !manuals.includes(id));
  dropped += state.backpackItems.length - keptItems.length + state.backpackManuals.length - keptManuals.length;
  state.backpackItems = keptItems;
  state.backpackManuals = keptManuals;
  return dropped;
}

// Rescued survivors called for help because they were hurt, so they start wounded.
export function takeSurvivor(state, name, time) {
  state.companion = { name, woundedAt: time };
}

export function canUnload(state) {
  return backpackLoad(state) > 0 || state.companion !== null;
}

// Moves the backpack into shelter storage and the companion into the shelter,
// where hungry survivors eat right away. Returns { items, manuals, survivor,
// left, sickened }, where items counts resource units and items, manuals lists
// the ids of new manuals, survivor is a name or null, left lists the names of
// survivors who had already left for lack of food before the unload, and
// sickened the names of those who got sick from a meal.
export function unload(state, time, random = Math.random) {
  const { left, sickened } = settleMeals(state, time, random);
  const { shelter } = state;
  const items = totalResources(state.backpack) + state.backpackItems.length;
  for (const { id } of RESOURCES) {
    shelter.storage[id] += state.backpack[id];
    state.backpack[id] = 0;
  }
  shelter.contaminatedFood += state.backpackContaminatedFood;
  state.backpackContaminatedFood = 0;
  shelter.items.push(...state.backpackItems);
  state.backpackItems = [];
  const manuals = state.backpackManuals.filter((id) => !shelter.manuals.includes(id));
  shelter.manuals.push(...manuals);
  state.backpackManuals = [];

  const survivor = state.companion;
  if (survivor) {
    shelter.survivors.push({
      name: survivor.name,
      arrivedAt: time,
      lastMealAt: time,
      woundedAt: survivor.woundedAt,
      sickAt: null,
    });
  }
  state.companion = null;
  sickened.push(...feedHungry(shelter, time, random));
  return { items, manuals, survivor: survivor?.name ?? null, left, sickened: [...new Set(sickened)] };
}

// A shelter survivor's hunger: { stage, startedAt, endsAt }. When the last
// stage ends, the survivor leaves.
export function hungerOf(survivor, time) {
  const elapsed = Math.floor((time - survivor.lastMealAt) / MEAL_INTERVAL_MS);
  const index = Math.min(Math.max(elapsed, 0), HUNGER_STAGES.length - 1);
  const startedAt = survivor.lastMealAt + index * MEAL_INTERVAL_MS;
  return { stage: HUNGER_STAGES[index], startedAt, endsAt: startedAt + MEAL_INTERVAL_MS };
}

// Settles every meal and departure due up to `time`, in order. Returns
// { meals, left, sickened }: how many meals were eaten, the names of survivors
// who left and of those who got sick from a meal. Storage only changes while
// the game is open, and unload() settles right before adding food, so any food
// in storage now was already there when these meals were due: survivors ate on time.
export function settleMeals(state, time, random = Math.random) {
  const { shelter } = state;
  if (!shelter) return { meals: 0, left: [], sickened: [] };
  let meals = 0;
  const sickened = new Set();
  while (shelter.storage.food > 0) {
    const next = mostOverdue(shelter.survivors, time);
    if (!next) break;
    next.lastMealAt += MEAL_INTERVAL_MS;
    if (eat(shelter, next, next.lastMealAt, random)) sickened.add(next.name);
    meals++;
  }
  const deadline = MEAL_INTERVAL_MS * HUNGER_STAGES.length;
  const leaving = shelter.survivors.filter((survivor) => time - survivor.lastMealAt >= deadline);
  shelter.survivors = shelter.survivors.filter((survivor) => !leaving.includes(survivor));
  // They left when their last stage ran out, which may be long before the game was opened.
  for (const { name, arrivedAt, lastMealAt } of leaving) {
    shelter.departedSurvivors.push({ name, arrivedAt, leftAt: lastMealAt + deadline, reason: 'starved' });
  }
  // Those who got sick and then left are reported as gone, not sick.
  const stayed = [...sickened].filter((name) => shelter.survivors.some((survivor) => survivor.name === name));
  return { meals, left: leaving.map(({ name }) => name), sickened: stayed };
}

// Hungry and starving survivors eat as soon as food arrives, the most starved
// first. Returns the names of those who got sick from it.
function feedHungry(shelter, time, random) {
  const sickened = [];
  while (shelter.storage.food > 0) {
    const next = mostOverdue(shelter.survivors, time);
    if (!next) break;
    next.lastMealAt = time;
    if (eat(shelter, next, time, random)) sickened.push(next.name);
  }
  return sickened;
}

// Takes a meal out of storage. A wounded or sick survivor eats more, if there
// is more. Contaminated food makes them sick, or sick again for longer.
// Returns true if it did.
function eat(shelter, survivor, time, random) {
  const portion = Math.min(isAiling(survivor, time) ? AILING_MEAL_FOOD : 1, shelter.storage.food);
  const contaminated = takeFood(shelter.storage.food, shelter.contaminatedFood, portion, random);
  shelter.storage.food -= portion;
  shelter.contaminatedFood -= contaminated;
  if (contaminated === 0) return false;
  survivor.sickAt = time;
  return true;
}

// The survivor whose meal has been due the longest, or null if no meal is due.
function mostOverdue(survivors, time) {
  let result = null;
  for (const survivor of survivors) {
    if (time - survivor.lastMealAt < MEAL_INTERVAL_MS) continue;
    if (!result || survivor.lastMealAt < result.lastMealAt) result = survivor;
  }
  return result;
}

function lootTier(distance) {
  return LOOT_TIERS.find((tier) => distance < tier.maxDistance);
}

// Picks one of `options` (objects with an id) by the weights in `weights`, keyed by id.
function pickWeighted(options, weights, random) {
  const total = options.reduce((sum, { id }) => sum + weights[id], 0);
  let roll = random() * total;
  for (const option of options) {
    roll -= weights[option.id];
    if (roll < 0) return option;
  }
  return options.at(-1);
}
