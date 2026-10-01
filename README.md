# Tinwalk

**Every walk is a supply run.**

Tinwalk is a survival and scavenging game you play on real walks. Set up a shelter at home, head out into the wasteland, search the areas you pass for supplies, and haul your loot and any survivors you meet back home.

It runs in the browser, needs no account and no server, and your location never leaves your device.

**[▶ Play Tinwalk](https://thesigns.github.io/Tinwalk/)** (best on a phone, outdoors)

## How to play

1. **Set up a shelter.** At home, tap **Create a Shelter** and give it a name. Your shelter is a circle with a 100 m radius around that spot.
2. **Go for a walk.** Everything outside your shelter is the wasteland.
3. **Search areas.** Tap **Search area** to scavenge the spot you're standing on. Each search must be at least 200 m from your shelter and from earlier searches. Searched areas recover after 12 hours, so the same daily walk pays off again tomorrow, and loops beat out-and-back routes.
4. **Fill your backpack.** Each search turns up 1–3 units of one resource. Your backpack holds 30 units, and anything that doesn't fit is lost.
5. **Meet survivors.** Every search has a 5% chance of turning up a survivor. Take them with you and they carry 30 extra units, but you can only escort one at a time.
6. **Bring it home.** Back in your shelter, tap **Unload** to move your loot into storage and your survivor into the shelter.

| Resource | How often it turns up |
|---|---|
| Junk | 40% |
| Food | 25% |
| Ammo | 15% |
| Meds | 10% |
| Tech | 10% |

## Features

- **Real GPS.** Readings less accurate than 50 m are ignored, so actions only unlock with a good signal. The shelter position is averaged over several seconds, since GPS is weakest indoors.
- **A procedurally generated map.** Instead of a real map, you walk across a fictional wasteland of plains, forests, deserts, hills and ruins, drawn like an old paper field map. The terrain is generated from your coordinates, so the same place on Earth always looks the same, and a typical walk crosses several kinds of terrain.
- **Private by design.** There is no server: your game is saved only in your browser, and your location is never sent anywhere. You can export your save to a file and import it back.
- **Sound and vibration.** Sound effects are synthesized in the browser, with no audio files. Vibration works on Android; iPhone browsers don't support it. Both can be turned off in the menu.
- **Light on the battery.** The map is rendered into cached tiles, and the player marker's pulse is a CSS animation, so the map isn't redrawn constantly.

## Running locally

Tinwalk is plain HTML, CSS and JavaScript, with no build step and no dependencies. Serve the project folder over HTTP:

```sh
python -m http.server 8000
```

Then open <http://localhost:8000>. Browsers only share your location with secure pages, and `localhost` counts as one. Opening `index.html` straight from disk won't work, because the game uses ES modules.

### Debug mode

Add `?debug` to the address (<http://localhost:8000/?debug>) to test the game at your desk:

- Tap the map to set your position instead of using GPS.
- Speed up game time (60× or 3600×) to watch searched areas expire.
- See GPS diagnostics: accuracy, how old the last reading is, and how many readings were accepted or rejected.

## Deploying

Tinwalk is a static site, so any HTTPS host works. To publish it on GitHub Pages, go to **Settings → Pages**, choose **Deploy from a branch**, and pick `main` and `/ (root)`.

On your own server, make sure `.js` files are served with a JavaScript MIME type. Ideally also send `Cache-Control: no-cache` for HTML, JS and CSS files, so players don't get a mix of old and new files after an update.

## Project structure

```
index.html      Page markup and the SVG icon sprite
css/style.css   All styles
js/             Game code (ES modules), starting from main.js
fonts/          Self-hosted fonts and their licenses
docs/           Game design notes (in Polish)
```

## Roadmap

Tinwalk is a prototype. Resources are only collected and counted for now. Ideas for later:

- Building up the shelter with Junk and Tech
- Survivors eating Food and working in the shelter
- Combat using Ammo, and healing with Meds
- Terrain that affects what you find
- More than one shelter
- Installing as an app (PWA) and playing offline

## Credits

- [Big Shoulders Stencil](https://github.com/xotypeco/big_shoulders) by The Big Shoulders Project Authors, under the SIL Open Font License 1.1
- [Courier Prime](https://github.com/quoteunquoteapps/CourierPrime) by The Courier Prime Project Authors, under the SIL Open Font License 1.1

## License

The code is released under the [MIT License](LICENSE). The fonts in `fonts/` keep their own license, the SIL Open Font License 1.1, included next to them.
