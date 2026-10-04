// Game rules: shelter, searching, backpack, survivors, unloading and meals,
// crafting, fights and wounds.
// Functions take the game state and mutate it; saving is up to the caller.

import { distanceMeters, toMercator } from './geo.js';
import { SURVIVOR_NAMES } from './names.js';
import { biomeAt, settlementAt } from './terrain.js';

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

// Manuals unlock crafting recipes. Ids double as keys in the save.
export const MANUALS = {
  knifemaking: { label: 'Knifemaking Manual' },
  pharmacology: { label: 'Pharmacology Manual' },
};
export const MANUAL_SIZE = 3;
// Each search without a manual makes the next one likelier, so bad luck
// doesn't keep a player from crafting for long.
const MANUAL_BASE_CHANCE = 0.02;
const MANUAL_CHANCE_STEP = 0.01;
const MANUAL_MAX_CHANCE = 0.2;
// Pharmacies are in towns, so the Pharmacology Manual turns up more often in ruins.
const BIOME_MANUAL_WEIGHTS = {
  plains: { knifemaking: 1, pharmacology: 1 },
  forest: { knifemaking: 1, pharmacology: 1 },
  ruins: { knifemaking: 1, pharmacology: 2 },
};

// Crafted items, in workshop order. Ids double as icon names.
export const ITEMS = {
  knife: { label: 'Knife', manual: 'knifemaking', cost: 5, uses: 6, size: 2, attack: 3 },
  'combat-knife': { label: 'Combat knife', manual: 'knifemaking', cost: 15, uses: 12, size: 3, attack: 9 },
  'first-aid-kit': { label: 'First aid kit', manual: 'pharmacology', cost: 7, uses: 3, size: 2 },
};
const FIRST_AID_KIT = 'first-aid-kit';

// lossOnRun and lossOnDefeat are the shares of backpack resources the player
// loses. Ids double as icon names.
export const ENEMIES = [
  { id: 'giant-rat', label: 'Giant Rat', attack: 1, defense: 1, lossOnRun: 0.1, lossOnDefeat: 0.3 },
];
const ENCOUNTER_CHANCE = 0.05;
const BARE_HANDS_ATTACK = 1;
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
// A wounded survivor eats more, but only if there is enough food.
const WOUNDED_MEAL_FOOD = 2;
// Wounds heal on their own; a first aid kit heals them right away.
const WOUND_HEAL_MS = 72 * 60 * 60 * 1000;

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
    items: [],
    manuals: [],
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
// { enemy } if an enemy shows up: the player then fights or runs, and only a
// won fight brings loot. Otherwise returns { loot } from collectLoot().
export function search(state, position, time, random = Math.random) {
  state.searchedAreas.push({ lat: position.lat, lon: position.lon, searchedAt: time });
  // There is only one kind of enemy so far.
  if (random() < ENCOUNTER_CHANCE) return { enemy: ENEMIES[0] };
  return { loot: collectLoot(state, position, time, 1, random) };
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

// Returns { resource, found, carried, survivor, manual }, where survivor is a
// name or null and manual a manual id or null. A found survivor joins only
// after takeSurvivor(), and a found manual is carried only after takeManual().
export function collectLoot(state, position, time, multiplier = 1, random = Math.random) {
  const tier = lootTier(distanceMeters(state.shelter, position));
  const biome = biomeAtPosition(position).name;
  const resource = pickWeighted(RESOURCES, BIOME_LOOT_WEIGHTS[biome], random);
  const found = multiplier * (tier.minLoot + Math.floor(random() * (tier.maxLoot - tier.minLoot + 1)));
  const carried = Math.min(found, freeSpace(state, time));
  state.backpack[resource.id] += carried;

  const survivor =
    !state.companion && random() < tier.survivorChance
      ? SURVIVOR_NAMES[Math.floor(random() * SURVIVOR_NAMES.length)]
      : null;
  return { resource, found, carried, survivor, manual: rollManual(state, biome, random) };
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
  const weights = BIOME_MANUAL_WEIGHTS[biome];
  return pickWeighted(missing.map((id) => ({ id })), weights, random).id;
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

// The weapon the player would fight with: the strongest one in the backpack,
// and of equally strong ones the most worn, so they get used up one by one.
export function bestWeapon(state) {
  let best = null;
  for (const item of state.backpackItems) {
    const { attack } = ITEMS[item.id];
    if (!attack) continue;
    const bestAttack = best ? ITEMS[best.id].attack : 0;
    if (attack > bestAttack || (attack === bestAttack && item.uses < best.uses)) best = item;
  }
  return best;
}

export function winChance(state, enemy) {
  const weapon = bestWeapon(state);
  const attack = weapon ? ITEMS[weapon.id].attack : BARE_HANDS_ATTACK;
  return attack / (attack + enemy.defense);
}

// Fights the enemy. Returns { won, weapon, wornOut, lost, wounded }: the id of
// the weapon used (or null), whether it was used up, the resources lost and
// whether the companion was wounded. After a win, the caller collects the
// loot with VICTORY_LOOT_MULTIPLIER.
export function fight(state, enemy, time, random = Math.random) {
  const won = random() < winChance(state, enemy);
  const weapon = bestWeapon(state);
  const wornOut = weapon ? useItem(state.backpackItems, weapon) : false;
  if (won) return { won, weapon: weapon?.id ?? null, wornOut, lost: emptyResources(), wounded: false };

  const lost = loseResources(state, enemy.lossOnDefeat, random);
  const wounded = state.companion !== null && random() < enemy.attack / (enemy.attack + PLAYER_DEFENSE);
  if (wounded) state.companion.woundedAt = time;
  return { won, weapon: weapon?.id ?? null, wornOut, lost, wounded };
}

// Runs from the enemy, always successfully. Returns the resources dropped on the way.
export function runAway(state, enemy, random = Math.random) {
  return loseResources(state, enemy.lossOnRun, random);
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

// The first aid kit in a list that would be used first: the most worn one.
function firstAidKit(items) {
  return items
    .filter((item) => item.id === FIRST_AID_KIT)
    .reduce((most, item) => (!most || item.uses < most.uses ? item : most), null);
}

// Kits for the companion come from the backpack; kits for shelter survivors
// from storage, applied by the others there, so the player needn't be home.
export function canTreat(state, survivor, time) {
  if (!isWounded(survivor, time)) return false;
  const items = survivor === state.companion ? state.backpackItems : state.shelter.items;
  return firstAidKit(items) !== null;
}

// Heals a survivor's wound with a first aid kit. Returns false if there is
// nothing to treat or no kit at hand.
export function treat(state, survivor, time) {
  if (!canTreat(state, survivor, time)) return false;
  const items = survivor === state.companion ? state.backpackItems : state.shelter.items;
  survivor.woundedAt = null;
  useItem(items, firstAidKit(items));
  return true;
}

// Items the shelter's manuals let the player craft, as [id, item] pairs.
export function knownRecipes(state) {
  return Object.entries(ITEMS).filter(([, item]) => state.shelter.manuals.includes(item.manual));
}

export function canCraft(state, id) {
  const item = ITEMS[id];
  return state.shelter.manuals.includes(item.manual) && state.shelter.storage.junk >= item.cost;
}

// Crafts an item from Junk in storage, into storage. The caller checks that
// the player is in the shelter.
export function craft(state, id) {
  if (!canCraft(state, id)) return false;
  state.shelter.storage.junk -= ITEMS[id].cost;
  state.shelter.items.push({ id, uses: ITEMS[id].uses });
  return true;
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
export function dropFromBackpack(state, { resources, items = [], manuals = [] }) {
  let dropped = 0;
  for (const { id } of RESOURCES) {
    const amount = Math.min(resources[id] ?? 0, state.backpack[id]);
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

export function takeSurvivor(state, name) {
  state.companion = { name, woundedAt: null };
}

export function canUnload(state) {
  return backpackLoad(state) > 0 || state.companion !== null;
}

// Moves the backpack into shelter storage and the companion into the shelter,
// where hungry survivors eat right away. Returns { items, manuals, survivor, left },
// where items counts resource units and items, manuals lists the ids of new
// manuals, survivor is a name or null, and left lists the names of survivors
// who had already left for lack of food before the unload.
export function unload(state, time) {
  const { left } = settleMeals(state, time);
  const { shelter } = state;
  const items = totalResources(state.backpack) + state.backpackItems.length;
  for (const { id } of RESOURCES) {
    shelter.storage[id] += state.backpack[id];
    state.backpack[id] = 0;
  }
  shelter.items.push(...state.backpackItems);
  state.backpackItems = [];
  const manuals = state.backpackManuals.filter((id) => !shelter.manuals.includes(id));
  shelter.manuals.push(...manuals);
  state.backpackManuals = [];

  const survivor = state.companion;
  if (survivor) {
    shelter.survivors.push({ name: survivor.name, arrivedAt: time, lastMealAt: time, woundedAt: survivor.woundedAt });
  }
  state.companion = null;
  feedHungry(shelter, time);
  return { items, manuals, survivor: survivor?.name ?? null, left };
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
// { meals, left }: how many meals were eaten and the names of survivors who
// left. Storage only changes while the game is
// open, and unload() settles right before adding food, so any food in storage
// now was already there when these meals were due: survivors ate on time.
export function settleMeals(state, time) {
  const { shelter } = state;
  if (!shelter) return { meals: 0, left: [] };
  let meals = 0;
  while (shelter.storage.food > 0) {
    const next = mostOverdue(shelter.survivors, time);
    if (!next) break;
    next.lastMealAt += MEAL_INTERVAL_MS;
    eat(shelter, next, next.lastMealAt);
    meals++;
  }
  const deadline = MEAL_INTERVAL_MS * HUNGER_STAGES.length;
  const leaving = shelter.survivors.filter((survivor) => time - survivor.lastMealAt >= deadline);
  shelter.survivors = shelter.survivors.filter((survivor) => !leaving.includes(survivor));
  // They left when their last stage ran out, which may be long before the game was opened.
  for (const { name, arrivedAt, lastMealAt } of leaving) {
    shelter.departedSurvivors.push({ name, arrivedAt, leftAt: lastMealAt + deadline, reason: 'starved' });
  }
  return { meals, left: leaving.map(({ name }) => name) };
}

// Hungry and starving survivors eat as soon as food arrives, the most starved first.
function feedHungry(shelter, time) {
  while (shelter.storage.food > 0) {
    const next = mostOverdue(shelter.survivors, time);
    if (!next) break;
    next.lastMealAt = time;
    eat(shelter, next, time);
  }
}

// Takes a meal out of storage. A wounded survivor eats more, if there is more.
function eat(shelter, survivor, time) {
  const portion = isWounded(survivor, time) ? WOUNDED_MEAL_FOOD : 1;
  shelter.storage.food -= Math.min(portion, shelter.storage.food);
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
