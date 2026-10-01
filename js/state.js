// Loads and saves the game state in localStorage.

import { emptyResources } from './game.js';

const STORAGE_KEY = 'tinwalk.state';
export const STATE_VERSION = 1;

export function createInitialState() {
  return {
    version: STATE_VERSION,
    shelter: null, // { name, lat, lon, createdAt, storage, survivors: [{ name }] }
    searchedAreas: [], // [{ lat, lon, searchedAt }]
    backpack: emptyResources(),
    companion: null, // { name }
  };
}

export function loadState() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return createInitialState();
    const state = JSON.parse(raw);
    if (state?.version === STATE_VERSION) return state;
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
