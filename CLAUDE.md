# Tinwalk

An app that gamifies walks, with a survival/scavenging theme. The user sets up a shelter at home, walks out into the "wasteland", searches areas for supplies using real GPS, and brings loot and survivors back. It runs in the browser (PWA later) with no server: all state lives in `localStorage`.

## Source of truth

- `docs/bootstrap.md` is the app spec (in Polish). Its "Zakres prototypu" section is what's implemented; "Na przyszłość" lists ideas that are deliberately **not** implemented yet. Check the spec before changing game rules.
- Rules on a specific topic live in their own files in `docs/`, linked from `bootstrap.md` (e.g. `docs/loot.md`: resources, loot by distance and biome, survivor chances; `docs/survivors.md`: survivors in the shelter, meals and hunger; `docs/crafting.md`: manuals, recipes, items; `docs/combat.md`: enemies, fight or run, wounds). The project author prefers this to growing `bootstrap.md`.
- The project author communicates in Polish; reply in Polish.

## Project rules

- Everything in the app is in English: UI text, code, identifiers, comments, commit messages.
- Exception: documentation in `docs/*.md` is written in Polish.
- Plain HTML, CSS and JavaScript (ES modules). No frameworks, no build step, no npm dependencies. The map is drawn on a Canvas.
- Mobile-first, portrait.
- Commit only when the project author asks.

## Running locally

```sh
python -m http.server 8000
```

Open `http://localhost:8000/?debug`. Geolocation requires HTTPS, but `localhost` counts as secure. ES modules don't load from `file://`.

Chrome caches ES modules aggressively: after editing JS or CSS, hard-reload (Ctrl+Shift+R), or you may test stale code.

Debug mode (`?debug`) shows a GPS diagnostics panel, lets you set the user's position by tapping the map, and can speed up game time (1×, 60×, 3600×) to test the 12-hour expiry of searched areas.

## Architecture

All code is in `js/`, loaded from `index.html` via `js/main.js`.

| Module | Responsibility |
|---|---|
| `main.js` | Wires everything together: UI rendering, actions (create shelter, search, fight, unload, craft), dialogs, menu, reward animations |
| `game.js` | Game rules and constants (radii, loot tiers and weights, capacity, survivor meals, manuals, items, enemies, wounds). Functions mutate the state; the caller saves |
| `state.js` | State shape, `STATE_VERSION`, load/save to `localStorage`, export/import with validation |
| `gps.js` | `LocationTracker`: Geolocation API, accuracy/staleness filtering, signal state, manual position for debug |
| `geo.js` | Haversine distances, Web Mercator projection, weighted position averaging |
| `clock.js` | Game time (`now()`), which debug mode can speed up |
| `map.js` | `MapView`: canvas rendering, zoom gestures, markers, short map animations (`playSweep`, `playRipple`) |
| `terrain.js` | Procedural biomes, ground colors and icon drawing, as pure functions of Mercator coordinates |
| `terrain-tiles.js` | Renders terrain into cached tiles per zoom level |
| `noise.js` | Seeded simplex noise and integer hashing |
| `fx.js` | DOM helpers: `iconElement`, flying icons, replaying CSS animations |
| `sound.js` | Sound effects synthesized with the Web Audio API (no audio files) |
| `haptics.js` | Vibration patterns (Android only; iPhone browsers don't support it) |
| `settings.js` | On/off preferences in `localStorage` |
| `debug.js` | Debug panel and the debug clock |
| `names.js` | Survivor names |

## Conventions and gotchas

- **Time:** game rules read time from `clock.now()`, never `Date.now()`, so debug time acceleration works. The exception is GPS reading timestamps, which are wall-clock time and are compared with `Date.now()`.
- **Saved state:** when changing its shape, bump `STATE_VERSION` in `state.js`, add a migration for older saves, and update `isValidState`. It validates both loading and importing.
- **Terrain must stay deterministic:** never use `Math.random` there. Changing the noise seed, frequencies or thresholds in `terrain.js` changes the world for every existing user. Terrain sizes were tuned by measuring biome runs along simulated 3 km walks.
- **Coordinates:** the map and terrain work in Web Mercator units; distances in game rules use `distanceMeters` (haversine).
- **Tile cache:** its capacity scales with the number of visible tiles. A fixed, too-small cache made large screens re-render tiles every frame (flickering).
- **Colors:** the palette is defined as CSS custom properties in `css/style.css`; `COLORS` in `map.js` mirrors it for canvas drawing. Keep them in sync.
- **Icons:** icons are `<symbol id="i-…">` entries in the SVG sprite in `index.html`; create them in JS with `iconElement(name)`. Resource, item and enemy ids (`junk`, `knife`, `giant-rat`) double as icon names.
- **Shelter panel re-renders every tick:** replacing a button between press and release swallows the tap, so lists with buttons go through `renderOnChange()` and survivor badges are updated in place.
- **Fonts:** Big Shoulders Stencil (headings, buttons, numbers) and Courier Prime (text) are self-hosted in `fonts/` with their OFL licenses. Canvas labels use them too, so the map re-renders once `document.fonts.ready` resolves.
- **Feedback:** `feedback(name)` in `main.js` plays both a sound and a vibration; event names are shared between `SOUNDS` in `sound.js` and `PATTERNS` in `haptics.js`. Browsers only allow audio after a user gesture, so `sound.unlock()` runs on every click.
- **Animations:** respect `prefers-reduced-motion` (CSS media query, and `prefersReducedMotion()` in `fx.js`).
- **Code style:** match the surrounding code: 2-space indent, single quotes, semicolons, small focused modules, and comments that explain *why* rather than *what*.

## Verifying changes

There is no test framework.

- Syntax: `for f in js/*.js; do node --check "$f"; done`
- Logic modules (`game.js`, `geo.js`, `state.js`, `noise.js`, `terrain.js`) can be imported in Node scripts. Stub browser globals first, e.g. `Object.defineProperty(globalThis, 'localStorage', { value: { getItem: () => null, setItem() {} } })`.
- UI: check in the browser with `?debug`, setting the position by tapping the map. To force a survivor, an enemy or a manual, temporarily override `Math.random` while the search animation runs. Set the override after the animation starts: the search sound also calls `Math.random` and would use up a scripted sequence of values.

## Deployment

Static hosting over HTTPS (GitHub Pages is planned). Deploy `index.html`, `css/`, `js/` and `fonts/`. The server must serve `.js` files with a JavaScript MIME type, since module scripts with the wrong type are rejected. Ideally send `Cache-Control: no-cache` for HTML, JS and CSS, so users don't end up with a mix of old and new files after an update.
