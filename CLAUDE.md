# Tinwalk

An app that gamifies walks, with a survival/scavenging theme. The user sets up a shelter at home, walks out into the "wasteland", searches areas for supplies using real GPS, and brings loot and survivors back. It runs in the browser (PWA later) with no server: all state lives in `localStorage`.

## Source of truth

- `docs/bootstrap.md` is the app spec (in Polish). Its "Zakres prototypu" section is what's implemented; "Na przyszłość" lists ideas that are deliberately **not** implemented yet. Check the spec before changing game rules.
- Rules on a specific topic live in their own files in `docs/`, linked from `bootstrap.md` (e.g. `docs/loot.md`: resources, loot by distance and biome; `docs/landmarks.md`: landmarks, the radio and rescue missions (the only source of survivors); `docs/survivors.md`: survivors in the shelter, meals and hunger; `docs/party.md`: the party that walks with the player, its strength, meals and the party page; `docs/crafting.md`: manuals, recipes, items; `docs/combat.md`: enemies, the dice fight, enemies left on the map, wounds; `docs/night.md`: day and night, the flashlight; `docs/radiation.md`: invisible fallout zones, the Geiger counter, Isotopes, contaminated food and sickness). The project author prefers this to growing `bootstrap.md`.
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

Debug mode (`?debug`) shows a GPS diagnostics panel, lets you set the user's position by tapping the map (the heading cone then points along the move), and can speed up game time (1×, 60×, 3600×) to test the 6-hour expiry of searched areas and nightfall.

## Architecture

All code is in `js/`, loaded from `index.html` via `js/main.js`.

| Module | Responsibility |
|---|---|
| `main.js` | Wires everything together: UI rendering, tabs (Backpack, Party, Shelter, Wastes) and their pages, actions (create shelter, search, fight, unload, craft, listen to the radio), dialogs, the start screen, reward animations |
| `game.js` | Game rules and constants (radii, loot tiers and weights, capacity, survivor meals, manuals, items, the radio, landmarks, rescue missions, enemies and the dice fight, wounds). Functions mutate the state; the caller saves |
| `state.js` | State shape, `STATE_VERSION`, load/save to `localStorage`, export/import with validation |
| `gps.js` | `LocationTracker`: Geolocation API, accuracy/staleness filtering, signal state, manual position for debug |
| `heading.js` | `HeadingTracker`: which way the phone points, from its compass (tilt-compensated, smoothed; asks for permission on iPhones); in debug mode, along the last tap-move |
| `geo.js` | Haversine distances, Web Mercator projection, weighted position averaging |
| `sun.js` | Sun elevation from time and position (simplified NOAA formulas), for telling day from night |
| `clock.js` | Game time (`now()`), which debug mode can speed up |
| `map.js` | `MapView`: canvas rendering, pan and zoom gestures, recentering, markers (shelter, landmarks, enemies, the rescue target and an arrow to it), short map animations (`playSweep`, `playRipple`) |
| `terrain.js` | The world (World ID seed and center) and, inside it, procedural biomes (warped-noise forests, settlements laid out in Voronoi districts with street grids of their own) and the invisible radiation layer, as pure functions of the position relative to the world's center |
| `relief.js` | A height field for the map only: mountain ranges of eroded ridges, dusty basins with badlands, flattened towns, forest canopies |
| `buildings.js` | The buildings of each ruined block, laid out from its hash: big and tall downtown, small houses towards the edge of town, some fallen into rubble |
| `terrain-render.js` | Draws one terrain tile: hill-shaded relief colored by biome, film grain, and towns blended over it. No DOM, so it runs in workers too |
| `terrain-worker.js` | Renders tiles in a worker and sends them back as `ImageBitmap`s |
| `terrain-tiles.js` | `TerrainTiles`: asks the workers (or, without OffscreenCanvas, the page) for the tiles the screen needs, caches them per zoom level |
| `polygon.js` | Convex polygons cut by straight lines: clipping, insetting, intersecting, Voronoi bisectors; the ruins are built from these |
| `noise.js` | Seeded simplex noise and integer hashing |
| `dice.js` | Dice notation (`2d6+1d3`, `1d6+2`): rolling, ranges, averages; used for strength in fights |
| `fx.js` | DOM helpers: `iconElement`, flying icons, replaying CSS animations |
| `sound.js` | Sound effects synthesized with the Web Audio API (no audio files) |
| `haptics.js` | Vibration patterns (Android only; iPhone browsers don't support it) |
| `settings.js` | On/off preferences in `localStorage` |
| `version.js` | `APP_UPDATED`, the date of the last update shown on the start screen |
| `debug.js` | Debug panel and the debug clock |
| `names.js` | Survivor names |

## Conventions and gotchas

- **Time:** game rules read time from `clock.now()`, never `Date.now()`, so debug time acceleration works. The exception is GPS reading timestamps, which are wall-clock time and are compared with `Date.now()`.
- **Saved state:** when changing its shape, bump `STATE_VERSION` in `state.js`, add a migration for older saves, and update `isValidState`. It validates both loading and importing.
- **Testing a fresh game:** each origin has its own `localStorage`, so serving the app on another port (e.g. `python -m http.server 8002`) gives a clean save without touching the one on port 8000.
- **Terrain must stay deterministic:** never use `Math.random` there, nor in `relief.js` or `buildings.js`. The terrain is a function of the World ID (via `worldSeed()`) and of the position relative to the world's center (`state.world.origin`), so players who share an ID get the same land around their starting points. Changing frequencies, thresholds, settlement parameters or how seeds are derived in `terrain.js` changes every world, and so does any change to the output of `noise.js` (it was once made faster with bit-identical results, checked against the old version on a million samples). Terrain sizes were tuned by measuring biome runs along simulated 3 km walks. The relief is only drawn: it never moves a biome.
- **Tile workers:** tiles are drawn off the page's thread, so the workers have their own copy of the terrain modules and of the world. `TerrainTiles.setWorld()` (via `MapView.setWorld()`) passes the world to them; calling only `terrain.js`'s `setWorld()` would leave the map drawing the old one. Where a worker can't draw (no OffscreenCanvas with a 2D context, before Safari 16.4), tiles are drawn on the page within a time budget per frame. Worker code can't use the DOM or `Path2D` (not in every browser's workers).
- **Coordinates:** the map works in Web Mercator units; distances in game rules use `distanceMeters` (haversine). Terrain functions take Mercator coordinates but convert them to world units (~0.62 m, ground distance east and north of the world's center), so the land is the same at every latitude. Call `setWorld()` (via `applyWorld()` in `main.js`) whenever the saved world changes; until then the map draws no terrain.
- **Tile cache:** its capacity scales with the number of visible tiles and of those asked for ahead (a ring around the screen and the coarser level over it, see `MapView.askAhead`). A cache smaller than what the map keeps asking for would re-render tiles every frame (flickering, or workers busy forever); a much larger one costs memory, about 1 MB per tile on sharp screens.
- **Colors:** the palette is defined as CSS custom properties in `css/style.css`; `COLORS` in `map.js` mirrors it for canvas drawing. Keep them in sync. The terrain has colors of its own, in `terrain-render.js`: washed-out, slightly cool greys and browns, like the world map of an old post-apocalyptic game. Text drawn over the map gets a paper halo, and the shelter is a bright green translucent disc, so they read over dark forest and light dust alike.
- **Landmark and enemy art:** each landmark type has a map badge in `img/landmark-icons/<type>.svg` (96×96, flat and simple, read at 46 px; the map rasterizes it once and falls back to the sprite icon without a file) and a detailed illustration in `img/landmarks/<type>.svg` (512×512 medallion, shown on the landmark card when a badge is tapped). Enemies work the same way with `img/enemy-icons/` (badges on red paint instead of paper) and `img/enemies/` (shown in the fight dialog). Story pictures, like the one on the new game screen, are medallions in the same style in `img/pictures/`. All sets share the palette in `css/style.css`.
- **Icons:** icons are `<symbol id="i-…">` entries in the SVG sprite in `index.html`; create them in JS with `iconElement(name)`. Resource, item, enemy and landmark ids (`junk`, `knife`, `rat`, `windmill`) double as icon names. The map draws landmark and enemy icons on the canvas from the same sprite via `Path2D`, so their symbols must use `<path>` elements only.
- **Shelter page re-renders every tick:** replacing a button between press and release swallows the tap, so lists with buttons go through `renderOnChange()` and survivor badges are updated in place.
- **Fonts:** headings and buttons use Big Shoulders Stencil (`--font-stencil`), text fields the player types into use Courier Prime (`--font-type`), and all other text uses the system sans (`--font-sans`). Both web fonts are self-hosted in `fonts/` with their OFL licenses. Canvas labels use the stencil too, so the map re-renders once `document.fonts.ready` resolves.
- **Feedback:** `feedback(name)` in `main.js` plays both a sound and a vibration; event names are shared between `SOUNDS` in `sound.js` and `PATTERNS` in `haptics.js`. Browsers only allow audio after a user gesture, so `sound.unlock()` runs on every click.
- **Animations:** respect `prefers-reduced-motion` (CSS media query, and `prefersReducedMotion()` in `fx.js`).
- **Code style:** match the surrounding code: 2-space indent, single quotes, semicolons, small focused modules, and comments that explain *why* rather than *what*.

## Verifying changes

There is no test framework.

- Syntax: `for f in js/*.js; do node --input-type=module --check < "$f"; done`. Check them as modules: plain `node --check` reads `.js` as a script and misses errors like a function declared twice.
- Logic modules (`game.js`, `dice.js`, `geo.js`, `state.js`, `noise.js`, `terrain.js`, `relief.js`, `buildings.js`) can be imported in Node scripts. Stub browser globals first, e.g. `Object.defineProperty(globalThis, 'localStorage', { value: { getItem: () => null, setItem() {} } })`.
- UI: check in the browser with `?debug`, setting the position by tapping the map. To force a survivor, an enemy or a manual, temporarily override `Math.random` while the search animation runs. Set the override after the animation starts: the search sound also calls `Math.random` and would use up a scripted sequence of values.

## Deployment

Bump `APP_UPDATED` in `js/version.js` to the current date with every commit that changes the app; the start screen shows it next to the save version.

The app is live on GitHub Pages at https://thesigns.github.io/Tinwalk/, published straight from the repository (no build, no workflow), so pushing `main` deploys it. The site is served under `/Tinwalk/`, so keep all paths relative.

GitHub Pages serves `.js` with a JavaScript MIME type (module scripts with the wrong type are rejected), but sends `Cache-Control: max-age=600`, which can't be changed. For up to 10 minutes after a push, a player may get a mix of old and new files; a reload fixes it.
