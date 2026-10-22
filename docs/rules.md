# Project rules (Barn Bloom)

Project-specific rules. The general rules are in `CLAUDE.md`.

The full original brief is in `docs/goal.md`. Read it before any large feature or redesign. The rules below are the parts that must hold on every change.

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

## Git remote

- Remote `origin`: `https://github.com/Damba017/claudie-made-a-game.git` (HTTPS, branch `main`), with a fine-grained token for this repo only.
- **Git and GitHub:** the game lives in `~/game`, a git repo pushed to GitHub (`Damba017/claudie-made-a-game`), played on GitHub Pages at damba017.github.io (the user's friend plays there too). Normal update: `git add -A`, `git commit -m "..."`, `git push`. Undo a pushed commit: `git revert --no-edit <id>`, then `git push`. This repo has `credential.useHttpPath true`, so its fine-grained token (Contents read/write, this repo only) is stored separately from the token of the user's Telegram bot. GitLab was tried and dropped as too confusing.

## README

- Update `README.md` when a change makes it wrong (feature list, counts, controls, balance tables).

## Testing (verifying without a terminal)

- The built-in browser shows local HTML as a static `data:` snapshot, so `<script src>` files do not load. Claude in Chrome cannot open `file://` either.
- What works: open https://example.com in the built-in browser, paste the code under test with the JavaScript tool, run it and screenshot. This tests a copy, not the files on disk, so say so. (Used for the barn sign, dark mode and the plant drawings.)
- Simplest real check: ask the user to open `index.html` and `tests/tests.html` and report what they see.
- `tests/tests.html` runs the logic tests and the balance simulation (pacing, boss table, rare-plant table).
- A new logic feature should come with a test in `tests/logic.test.js`.

## Architecture (code map)

Everything hangs off one global namespace, `BB`. Load order (see `index.html`):

| File | Exposes | Role |
| --- | --- | --- |
| `js/config.js` | `BB.CONFIG` | Balance numbers, species, nutrients, upgrades, events, bosses, awards, palette |
| `js/state.js` | `BB.State` | `newGame()`, `newPlant()`, `newPot()`, `demo()` (menu barn) |
| `js/logic.js` | `BB.Logic` | The simulation: `tick`, plant queries, player actions, shop, orders, events, rare offers, offline, prestige |
| `js/combat.js` | `BB.Combat` | Boss fights: locks, power vs armour, moves, pods, items, scripted fighter |
| `js/save.js` | `BB.Save` | Serialise, migrate, sanitise, export/import, friend codes, storage, settings |
| `js/audio.js` | `BB.Audio` | Sound effects, ambient music, rain loop |
| `js/art.js` | `BB.Art` | Drawings: plants, pots, critters, bosses, props, DOM icons |
| `js/render.js` | `BB.Render` | Scene layout, cached wall, sky and light, particles, fight arena, hit testing |
| `js/ui.js` | `BB.UI` | HUD, barn sign, toolbar, info panel, dialogs, menu, tutorial, toasts, admin panel |
| `js/main.js` | `BB.Game` | Loop, input, action wrappers with feedback, save/load, logic-event handlers |

Key conventions:

- **Logic never touches the DOM.** It reports what happened by pushing events (`emit`) to `Logic.queue`. `main.js` drains the queue each frame and turns events into sounds, particles and toasts (`HANDLERS`).
- **UI never mutates state.** It calls `BB.Game` methods (`G.act`, `G.buyUpgrade`, ...), which call logic and give feedback.
- **Logic actions return** `{ ok: true, ... }` or `{ ok: false, reason }`.
- **State is plain JSON.** `state.pots` is an array of `{ plant, memo, idle }`; its length is the pot count (the `slots` upgrade level is derived from it).
- **Plants are drawn in unit space:** origin at the soil centre, up is negative y, pot 78 units wide. Each species has one function in `SPECIES_ART` that draws every stage from continuous growth `k`.
- **Dialogs** come from `openModal` in `ui.js`. `blocking: true` pauses the game. Live content registers functions in `m.updaters`. `UI.confirm` can show a "don't ask again" box (`dontAsk` option; `onYes(checked)`).
- **CSS and dark mode:** panels use `--cream` / `--paper` / `--ink`, which the `html.dark` block at the end of `style.css` redefines. Text on wood or on the dark fight screen uses `--on-wood` or a fixed colour, never `--cream`.
- Code style: ES5-style (`var`, function expressions, IIFE per file), commented sections, no long spaghetti functions.

## Recipes

- **New upgrade:** add an entry to `CONFIG.UPGRADES` (`id, cat, name, desc, max, cost, mult, base, per, fmt`, optional `requires`, `currency`, `capPerPrestige`/`maxCap`, `values`). Read it with `L.eff(state, id)` or `L.level(state, id)`; for caps always use `L.upgradeMax`.
- **New species:** add to `CONFIG.SPECIES`, add a draw function to `SPECIES_ART` and a height to `HEIGHT` in `art.js`. Shop plants go in unlock-price order before the rare block (then check the Seed Library `hSpecies` `values`, which index into this order). A rare plant goes at the very end with `rare: '<event kind>'`, `price`, `seedCost` (same as price) and an `offer` text.
- **New nutrient:** add to `CONFIG.NUTRIENTS` (with `shape`, `color`, `key`, `powUpgrade`), add its key to `newPlant().nutrients`, apply its effect in `logic.js`, add a bottle in `Art.drawNutrientIcon` and a keyboard shortcut in `main.js`.
- **New event:** add weight and duration to `CONFIG.EVENTS`, handle it in `L.triggerEvent` and `tickEvents`, add a toast in `EVENT_TOASTS` (`main.js`) and a chip in `EVENT_INFO` (`ui.js`).
- **New saved field:** add it to `S.newGame()` and copy it in `Save.sanitize` (older saves then get the default). Only bump `CONFIG.VERSION` (with a step in `MIGRATIONS`) when old saves really need converting: friend codes from a newer version are rejected by older games, and the friend may be a version behind.

## Feature notes (the non-obvious parts)

- **Balance changes after the first build:** `WATER.baseDrain` 0.5 (the user found 0.7 too fast); Mulch Blankets upgrade (-8% drain per level); orders toned down (`rewardFactor` 0.8, `cooldown` 40); late unlocks raised after the balance simulation.
- **Cat coats:** `CONFIG.CAT_SKINS`, 50 coins each, buyable before the cat arrives. Lexie is the user's own cat (Cyperse brown tabby); also Maya, Alice, Coco (Siamese), Mosh (British Shorthair) and the free Barn Cat. Drawn by `Art.cat` from colour fields and flags; a new coat is one entry. The menu barn shows Lexie.
- **Friends** (no server, codes are base64 JSON and trust-based; the user accepted that a code can be reused): visit codes `BARN-` (`Save.visitString` / `parseVisit`, read-only `G.mode === 'visit'`); gifts `GIFT-` (`L.makeGift` / `L.openGift`, capped by `CONFIG.GIFTS`); trades `TRADE-` offer and `DEAL-` reply (`L.makeTrade` sets items aside in `state.tradesOut`; `L.completeTrade` pays what the original offer stored; max 5 open). Cloud sync and a live shared barn were dropped as too costly.
- **Prestige:** goal `PRESTIGE.firstGoal` (1M) x 2 per level, counted only from coins earned by playing (`earn()`, not gifts or trades). `L.prestige` returns a new state; `SEASON_KEEPS` lists what survives. Rewards: Heirloom Seeds and +10% growth and sell per level. Refused while trade offers are open.
- **Bosses** (`js/combat.js`): the Wild Patch opens at prestige 1 (key B). Snip power 10 x 1.6^Shear Sharpness must beat armour. A 20-minute wait starts with each attempt. Damage stays between attempts (`state.bossHealth`, `state.bossTries`, reset by a New Season). Health 105k / 470k / 3.6M / 22M / 160M / 420M / 1.1B / 2.85B; per season above the boss's own, health x2.5 (`seasonHpGrowth`; keep it below about 2.65 or an early boss outgrows a later one) and armour +25%. User's rule: boss 5 needs prestige 7 and Sharpness 19. Bosses 6-8 (King Gourdon, The Glass Duchess, The Mandrake Monarch) need prestige 8 / 9 / 10 and Sharpness 21 / 23 / 25; each needs more than 2.5x the health of the one before, or the hp ordering test (prestige 0-12) fails. Shear Sharpness max cap is 28. Tuned to 3-5 tries without help and 2-3 with combat upgrades (boss table in `tests/balance.js` and the README).
- **Admin panel:** only when the page runs from `file://` (`G.isAdmin`); backtick key or the pause menu. Give anything, set prestige and upgrade levels, ignore caps, boss tools, time skips, events, rare offers, reset save. `G.admin` / `G.debug` in `main.js`, `buildAdmin` in `ui.js`. Not cheat-proof (browser console), accepted by the user.
- **Dark mode:** setting `theme` (0 automatic, 1 light, 2 dark) toggles `html.dark` (`applyTheme` in `main.js`). Only menus and panels; the barn scene is unchanged.
- **Barn sign** (top right, wide screens; `buildSign` / `updateSign` / `fitSign` in `ui.js`): barn name, season, income estimate (`L.incomeEstimate`: value x growth speed of every plant, per real minute) and a harvest-festival bar that opens Seasons. `fitSign` only shows it when both HUD rows fit beside it.
- **Rare plants:** `CONFIG.RARE`: offers start after the Moonveil Orchid is unlocked; when the matching event starts there is a 15% chance (rolled in `maybeRareOffer` inside `L.triggerEvent`), and the offer waits 90 s (`state.events.rare`, `L.offerRare`, `L.buyRare`; toast with Buy, card in Shop > Special, HUD chip). Rare plants are never unlocked, sold, ordered or replanted by the squirrel; a New Season keeps them as seeds (`L.rareSeedsKept`). Perk fields: `rainMult`, `heatMult`, `heatProof`, `heatPay`, `sunshine`/`sunStars`, `crumbs`, `heirlooms`/`heirStars`, `sound`; shop extras Plumpkin `prize`, Rose `primeFactor`. One seed earns back about 3x its price (rare table in `tests/balance.js`). Pests bring offers too, and rain and the lucky bee each have two rare plants (`L.raresFor`; a second dice roll picks one). Barn-wide perks of the one-harvest rare plants: `eatsPests`/`snack` (Gobblepot Pitcher, in `L.triggerEvent`), `drizzle` (Puffcloud Nimbus, `drizzleOn` in the tick), `luck` (Fortune Bamboo, `L.barnLuck`, does not stack). Only plants with `beeLure` (Honeyheart) call the lucky bee more often.
- **Digging up plants:** setting `confirmDig`; the warning has a "Don't ask me again" box, Settings > Game switches it back on. Sweeping the shovel only clears withered plants.
