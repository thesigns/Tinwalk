// Game time. All game rules read the current time from here, so that the
// debug mode can speed time up in one place.

export function now() {
  return Date.now();
}
