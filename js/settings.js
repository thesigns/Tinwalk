// Player preferences kept in localStorage. Everything is on until turned off.

export function isSettingOn(key) {
  try {
    return localStorage.getItem(key) !== 'off';
  } catch {
    return true;
  }
}

export function saveSetting(key, on) {
  try {
    localStorage.setItem(key, on ? 'on' : 'off');
  } catch (error) {
    console.warn('Could not save a setting', error);
  }
}
