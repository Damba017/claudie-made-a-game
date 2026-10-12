# Barn Bloom

A cozy plant-care / idle browser game. The player waters and feeds plants in a barn, harvests and sells them, and spends coins on seeds, nutrients, upgrades and more pots.

The full original brief is in `docs/ORIGINAL_BRIEF.md`. Read it before any large feature or redesign. The rules below are the parts that must hold on every change.

## Rules from the brief (do not break)

- Plain HTML + CSS + JavaScript only. No frameworks, bundler, npm packages, CDNs or asset files (no images, fonts, audio files).
- Must run by opening `index.html`, including from `file://`. Classic `<script>` tags in dependency order, never ES modules.
- All graphics are drawn in code in one flat-vector style. System font stacks only. All audio is synthesised with the Web Audio API and starts only after a user interaction.
- Game logic is pure (no DOM) and stays separate from rendering and UI, so it runs in Node.
- Every balance number lives in `js/config.js`. Do not hard-code costs, rates or timings elsewhere.
- Fixed-step logic tick (10 Hz) driven by `requestAnimationFrame`, with clamped frame deltas.
- Nothing is a placeholder: every button works, every text is written, no "TODO" in the UI.
- The player can never get permanently stuck (free-seed safeguard), and nothing dies during offline progress.
- Do not rely on colour alone to show status (shape-coded nutrients, colour-blind mode).
- Tone: cozy, charming, a little funny. Keep it simple where simple is enough.
- Do not claim something works unless it was checked. Say what was and was not verified.

## How the user wants to work

- **Ask before creating or doing anything new.** Propose the change first and wait for a yes. Small tweaks the user explicitly asked for can go straight in.
- **No terminal commands.** The user has no Node or Homebrew and rejected shell use. Use the file tools and the built-in browser only.
- Keep replies short and plain. The user is not a professional developer.
- Update `README.md` when a change makes it wrong (feature list, upgrade count, controls, balance table).
- The user plans to publish on GitHub. Do not invent their handle, a licence or badges.

## Verifying without a terminal

- The built-in browser shows local HTML as a static `data:` snapshot, so `<script src>` files do not load. Claude in Chrome cannot open `file://` either.
- What works: paste the source into a page with the browser's JavaScript tool and run it there, then screenshot. This tests a copy, not the files on disk, so say so.
- Simplest real check: ask the user to open `index.html` and `tests/tests.html` and report what they see.
- `tests/tests.html` runs the logic tests and the balance simulation in a browser. With Node they also run as `node tests/logic.test.js` and `node tests/balance.js`.
- A new logic feature should come with a test in `tests/logic.test.js`.

## Architecture

Everything hangs off one global namespace, `BB`. Load order (see `index.html`):

| File | Exposes | Role |
| --- | --- | --- |
| `js/config.js` | `BB.CONFIG` | Balance numbers, species, nutrients, upgrades, events, awards, palette |
| `js/state.js` | `BB.State` | `newGame()`, `newPlant()`, `newPot()`, `demo()` (menu barn) |
| `js/logic.js` | `BB.Logic` | The simulation: `tick`, plant queries, player actions, shop, orders, events, offline |
| `js/save.js` | `BB.Save` | Serialise, migrate, sanitise, export/import, storage, settings |
| `js/audio.js` | `BB.Audio` | Sound effects, ambient music, rain loop |
| `js/art.js` | `BB.Art` | Drawings: plants, pots, critters, props, DOM icons |
| `js/render.js` | `BB.Render` | Scene layout, cached wall, sky and light, particles, hit testing |
| `js/ui.js` | `BB.UI` | HUD, toolbar, info panel, dialogs, menu, tutorial, toasts, debug |
| `js/main.js` | `BB.Game` | Loop, input, action wrappers with feedback, save/load, logic-event handlers |

Key conventions:

- **Logic never touches the DOM.** It reports what happened by pushing events (`emit`) to `Logic.queue`. `main.js` drains the queue each frame and turns events into sounds, particles and toasts (`HANDLERS`).
- **UI never mutates state.** It calls `BB.Game` methods (`G.act`, `G.buyUpgrade`, ...), which call logic and give feedback.
- **Logic actions return** `{ ok: true, ... }` or `{ ok: false, reason }`.
- **State is plain JSON.** `state.pots` is an array of `{ plant, memo, idle }`; its length is the pot count (the `slots` upgrade level is derived from it).
- **Plants are drawn in unit space:** origin at the soil centre, up is negative y, pot 78 units wide. Each species has one function in `SPECIES_ART` that draws every stage from continuous growth `k`.
- **Dialogs** come from `openModal` in `ui.js`. `blocking: true` pauses the game. Live content registers functions in `m.updaters` and is updated in place.
- Code style: ES5-style (`var`, function expressions, IIFE per file), commented sections, no long spaghetti functions.

### Recipes

- **New upgrade:** add an entry to `CONFIG.UPGRADES` (`id, cat, name, desc, max, cost, mult, base, per, fmt`, optional `requires`, `currency`). Read it in logic with `L.eff(state, id)` or `L.level(state, id)`. The upgrade screen and saves pick it up automatically.
- **New species:** add to `CONFIG.SPECIES`, add a draw function to `SPECIES_ART` and a height to `HEIGHT` in `art.js`.
- **New nutrient:** add to `CONFIG.NUTRIENTS` (with `shape`, `color`, `key`, `powUpgrade`), add its key to `newPlant().nutrients`, apply its effect in `logic.js`, add a bottle in `Art.drawNutrientIcon` and a keyboard shortcut in `main.js`.
- **New event:** add weight and duration to `CONFIG.EVENTS`, handle it in `L.triggerEvent` and `tickEvents`, add a toast in `EVENT_TOASTS` (`main.js`) and a chip in `EVENT_INFO` (`ui.js`).
- **Save format change:** bump `CONFIG.VERSION`, add a step to `MIGRATIONS` in `save.js`, and make sure `Save.sanitize` copies the new field.

## Current state (12 October 2026)

Version 1 is complete and the user has played it and likes it.

- 8 species: Pepperwink, Drizzle Fern, Grumpy Prickle, Sunny Goliath, Jamboree Berry, Glimmercap, Moonveil Orchid, Stardust Lotus.
- 4 nutrients (Nitro-Bloom Fizz, Gulp-Gel, Glamour Jam, Bug-Off Tonic) plus rare Comet Crumbs; 2 synergies.
- 29 upgrades in six categories (tools, nutrients, barn, helpers, economy, sunshine).
- 5 random events, day/night cycle, 22 awards, almanac, chalkboard orders, golden plants, Sunshine currency, barn cat, pot paints, photo mode.
- All screens from the brief, tutorial, settings, debug panel, saves with export/import and offline progress.

Changes made after the first build:

- Water drain lowered: `WATER.baseDrain` 0.7 to 0.5 (user found it too fast).
- New upgrade **Mulch Blankets** (`mulch`, barn): -8% water drain per level, 5 levels.
- **Cat coats** (Shop > Special, 50 coins each, buyable before the cat arrives): Lexie (Cyperse brown tabby, the user's own cat), Maya (fluffy ginger), Alice (fluffy grey tabby), Coco (Siamese), Mosh (British Shorthair), plus the free Barn Cat. Data in `CONFIG.CAT_SKINS`, drawn by `Art.cat` from colour fields and the flags `stripes`, `fluffy`, `points`, `round`; state in `catSkin` / `catSkins`; `L.buyCatSkin`. The menu barn shows Lexie. To add a coat, add one entry to `CAT_SKINS`.
- Orders toned down (`rewardFactor` 0.8, `cooldown` 40) and late unlocks raised (Glimmercap 6,000, Orchid 30,000, Lotus 250,000 + 5 Sunshine) after the balance simulation.
- README rewritten for GitHub with emoji tables.

Verification status:

- 37 logic tests passed and the game was played through in a browser, from pasted copies of the source.
- The user has since run the real `index.html` and it works.
- Not re-run since: the balance simulation after the drain change and Mulch Blankets (README pacing table is slightly low).
- Cat coats: all six were drawn and checked in a browser from a pasted copy of `Art.cat`. The shop section, purchase flow and the two new tests (mulch, cat coats; 39 tests in total) have not been run. Ask the user to open `tests/tests.html`.
- Audio code runs without errors but has never been tuned by ear.

## Ideas not done yet

- Tune sounds and music by ear.
- Compact phone HUD (it wraps to three rows at 375 px).
- Prestige or another long-term goal; late-game income grows very fast.
- Seasons, more critters, weather visible on plants.
- More than one save slot.
- Per-pot feeding plan for the Butler Bee.
- A screenshot for the README (press `F` in game for photo mode).

## Keeping this file current

After each session that changes the game, update "Current state" and "Ideas not done yet". Keep this file short; details belong in the code comments and `README.md`.
