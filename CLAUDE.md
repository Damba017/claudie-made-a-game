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
- **Terminal: the user runs commands, Claude does not.** Since 17 October 2026 the user has Homebrew and git and pushes the game to GitHub (`Damba017/claudie-made-a-game`, GitHub Pages) from their own terminal. GitLab was tried that day and dropped as too confusing. Give commands as copyable `bash` blocks (one per block) with a plain explanation. Claude itself still uses only the file tools and the built-in browser: do not call Bash unless the user explicitly asks (it slipped five times on 12 and 14 October and had to be confessed). Node was not installed as of 12 October, so tests run in `tests/tests.html`.
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
| `js/logic.js` | `BB.Logic` | The simulation: `tick`, plant queries, player actions, shop, orders, events, offline, prestige |
| `js/combat.js` | `BB.Combat` | Boss fights: locks, power vs armour, moves, pods, items, scripted fighter |
| `js/save.js` | `BB.Save` | Serialise, migrate, sanitise, export/import, storage, settings |
| `js/audio.js` | `BB.Audio` | Sound effects, ambient music, rain loop |
| `js/art.js` | `BB.Art` | Drawings: plants, pots, critters, props, DOM icons |
| `js/render.js` | `BB.Render` | Scene layout, cached wall, sky and light, particles, hit testing |
| `js/ui.js` | `BB.UI` | HUD, toolbar, info panel, dialogs, menu, tutorial, toasts, admin panel |
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
- 50 upgrades: 37 in seven categories (tools, nutrients, barn, helpers, economy, combat, sunshine) plus 13 Heirloom upgrades.
- Prestige (New Seasons) and 5 bosses in the Wild Patch.
- 5 random events, day/night cycle, 30 awards, almanac, chalkboard orders, golden plants, Sunshine currency, barn cat, pot paints, photo mode.
- All screens from the brief, tutorial, settings, admin panel (owner only), saves with export/import and offline progress.

Changes made after the first build:

- Water drain lowered: `WATER.baseDrain` 0.7 to 0.5 (user found it too fast).
- New upgrade **Mulch Blankets** (`mulch`, barn): -8% water drain per level, 5 levels.
- **Cat coats** (Shop > Special, 50 coins each, buyable before the cat arrives): Lexie (Cyperse brown tabby, the user's own cat), Maya (fluffy ginger), Alice (fluffy grey tabby), Coco (Siamese), Mosh (British Shorthair), plus the free Barn Cat. Data in `CONFIG.CAT_SKINS`, drawn by `Art.cat` from colour fields and the flags `stripes`, `fluffy`, `points`, `round`; state in `catSkin` / `catSkins`; `L.buyCatSkin`. The menu barn shows Lexie. To add a coat, add one entry to `CAT_SKINS`.
- **Visiting** (Friends button in the main menu and pause menu): `Save.visitString(state)` makes a `BARN-...` code holding only the barn's looks and stats (no coins or stock); `Save.parseVisit` turns it into a sanitised state. `G.startVisit` / `G.leaveVisit` in `main.js` switch to `G.mode === 'visit'`, where only the clock runs and the scene is drawn read-only (the cat can still be petted). The banner is `#visitBar` (`UI.showVisit`). The barn has a name (`state.barnName`, `Save.cleanName`).
- **Gifts and trading** (Friends > Gifts tab, only inside a game): `L.makeGift(state, items)` takes coins, seeds, nutrients and Comet Crumbs out of the sender's stock and returns a gift; `Save.giftString` / `Save.parseGift` turn it into a `GIFT-...` code and back; `L.openGift` adds the items. A barn remembers ids in `state.giftsSent` (cannot open its own gift) and `state.giftsOpened` (once per barn), and keeps `state.lastGiftCode` so a wrapped gift is not lost. Amounts are capped by `CONFIG.GIFTS`. Trust-based, not cheat-proof: a code can be opened in several barns. The user knows and accepted this.
- **Trading** (Friends > Trade tab): three steps by code. `L.makeTrade(state, give, want)` sets the offered items aside in `state.tradesOut[id]` and yields a `TRADE-` code (`Save.tradeString` / `parseTrade`); the friend's `L.acceptTrade` pays `want`, receives `give` and yields a `DEAL-` reply (`Save.dealString` / `parseDeal`); `L.completeTrade` pays out the `want` stored in the original offer (never what the reply claims). `L.cancelTrade` returns the set-aside items. Max 5 open offers. Item helpers: `L.cleanGiftItems`, `hasItems`, `moveItems`. UI: `friendsTrade` and the shared `itemFields` in `ui.js`. Same trust caveat as gifts.
- The user's friend plays the GitHub Pages version. The user tests locally first and uploads to GitHub afterwards. Visit and gift codes only work between players on a version that has these features.
- Cloud sync and a live shared barn were discussed and dropped as too costly.
- Orders toned down (`rewardFactor` 0.8, `cooldown` 40) and late unlocks raised (Glimmercap 6,000, Orchid 30,000, Lotus 250,000 + 5 Sunshine) after the balance simulation.
- README rewritten for GitHub with emoji tables.

Verification status:

- 37 logic tests passed and the game was played through in a browser, from pasted copies of the source.
- The user has since run the real `index.html` and it works.
- Not re-run since: the balance simulation after the drain change and Mulch Blankets (README pacing table is slightly low).
- Cat coats: all six were drawn and checked in a browser from a pasted copy of `Art.cat`. The user has since tried the cat coats and visiting and reports they look right.
- The user has tried gifts and reports they work.
- The new tests (mulch, cat coats, visit codes, gifts, trades; 42 in total) have never been run as far as I know. Ask the user to open `tests/tests.html` and report the first line.
- Trading has not been run at all; it was written and desk-checked only (session ended 12 October 2026 with the user about to test it). The user said on 14 October that the game is fun, without mentioning trading.
- 14 October 2026: the user ran `tests/tests.html`: 50 of 51 passed. The failure ("upgrades clamped" in the hostile-save test) was real: `Save.sanitize` clamped levels only to `maxCap`. Fixed: it now clamps to `L.upgradeMax` for the save's prestige level. The user re-ran it: all 51 passed.
- Prestige and bosses have not been played in the game yet (the user will test them with the admin panel).
- Admin panel (14 October 2026): the user opened it from `file://` and reports it works great.
- End of the 14 October 2026 session: all 53 tests passed in `tests/tests.html`. Prestige and bosses still have not been played through properly by the user.
- Audio code runs without errors but has never been tuned by ear.

## Prestige and bosses (agreed 14 October 2026)

The user had 3 million coins and every upgrade bought. Agreed plan, built in two parts.

### Part 1: prestige (built 14 October 2026, not yet tested by the user)

- **New Season** = prestige. Goal: earn `PRESTIGE.firstGoal` (1M) coins in one season, times `goalMult` (2) per prestige level. Only coins earned by playing count (`earn()` in logic: harvests, orders, bee tips), not gifts or trades. `state.seasonEarned`; old saves count their lifetime earnings as season one.
- `L.prestige(state)` returns a **new** state. Resets coins, pots, coin upgrades, species, seeds, nutrients, orders, events. Keeps the fields in `SEASON_KEEPS` (awards, almanac, Sunshine and Sunshine upgrades, Heirloom upgrades, cat coats, pot paints, barn name, lifetime stats, gift memory). Refused while trade offers are open (set-aside items must not cross seasons).
- Rewards: **Heirloom Seeds** (`state.heirlooms`) = `heirloomsAtGoal * sqrt(earned / goal) * (1 + hHeir)`, and a permanent +10% growth and sell per prestige level (`L.prestigeBonus`).
- **12 Heirloom upgrades** (`cat: 'heirloom'`, `currency: 'heirlooms'`): hStart, hPots, hSpecies, hHelpers, hGrow, hSell, hHeir, hLuck, hShop, hTank, hOrders, hNap. Upgrades may now use a `values` array instead of `base`/`per`.
- **Rising caps:** 15 coin upgrades have `capPerPrestige` / `maxCap`; always use `L.upgradeMax(state, id)`, never `u.max`.
- UI: Seasons dialog (`UI.openSeasons`, HUD button and key N), Heirloom pill in the HUD, toast when the goal is reached (`seasonReady` event), admin panel "Give Heirloom Seeds" and "Reach season goal". 3 new awards (season1, season3, season7).

### Part 2: bosses (built 14 October 2026, not yet tested by the user)

How it was built (see `js/combat.js`, `BB.Combat`):

- Fight object is transient (never saved). `K.start(state, id, now)` checks `K.lock` and sets `state.bossRetryAt[id] = now + 20 min` at the START of every attempt (so closing the page mid-fight gains nothing). `K.tick`, `K.snip`, `K.spray`, `K.useItem`, `K.pop`, `K.giveUp`, `K.finish` (pays once: Heirloom Seeds, `state.bossesBeaten` for the season, `state.trophies` forever). Events go to `fight.events`; `FIGHT_HANDLERS` in `main.js` turns them into effects.
- Power = `COMBAT.shearBase * shearGrowth^level` (10 x 1.6^L). Armour check: power must be higher than `K.armorNow(f)` (armour x armorUp multiplier); otherwise snips, spray, mist and brigade all do nothing. Each boss's armour is about 0.85 x the power of its required level, and `K.powerAt(sharp - 1) <= armor` (tested).
- Health and armour grow 25% per prestige level above the boss's own (`K.stats`).
- `G.mode === 'fight'`: barn paused, `fightFrame()` in `main.js`, `R.drawFight` (greenhouse arena), `UI.showFight` / `updateFight` / `fightBanner` / `fightResult`. Wild Patch list: `UI.openWildPatch` (HUD button and key B, shown from prestige 1).
- Art: `BOSS_ART` and `Art.boss` / `Art.drawBossIcon` / `Art.trophy` in `art.js`. Trophies stand on the barn windowsill (`drawTrophies` in render) and travel in visit codes.
- `K.simulate` is a scripted fighter (tests and the boss table in `tests/balance.js`). The user ran it on 14 October 2026: at the exact required level, bosses 1 to 3 are beaten without help (Snapdragon with 9 s left), Mother Mold needs combat upgrades, the Eclipse Lotus needs upgrades plus battle items (or one level more). That curve was judged right; HP left unchanged. Numbers are in the README.
- 8 combat upgrades (`cat: 'combat'`, `requires: { prestige: 1 }`): sharp (Shear Sharpness, max 4 + 3 per prestige, cap 25, `capBonus: 'hSharp'`), snips, potency, nozzle, brigade, gloves, swatter, battleMulch. Heirloom `hSharp`. 5 boss awards. 6 new tests (51 in total).

Original plan:

- **The Wild Patch**, an overgrown night greenhouse screen with 5 mutated-plant bosses, each with its own drawing, health and two special moves: 1 Thornzilla (mutant cactus), 2 The Fernkraken (tentacle fern), 3 Sir Snapdragon (armoured flytrap), 4 Mother Mold (spore mushroom), 5 The Eclipse Lotus (corrupted lotus, two phases).
- **Fights:** 90-second timer. Pruning Shears (click, combo up to x2), Weed Sprayer (cooldown burst + damage over time), Hedgehog Brigade (auto damage), nutrients as battle items (Nitro double damage, Bug-Off clears spores, Jam crits).
- **User rules:**
  - Each boss can be beaten **once per season**; bosses lock again after a New Season and get a little tougher each season.
  - After a failed attempt, the next try is possible only after **20 minutes**.
  - Each boss is also locked behind a **combat upgrade level** (Shear Sharpness) suited to its stage.
  - **Armour:** a hit only does damage if it is stronger than the boss's armour ("Too weak!" otherwise). Armour and health scale with boss number and prestige. (Claude's reading of "damage must be higher than their health"; the user confirmed this on 14 October 2026.)
  - **Boss 5 needs at least prestige 7 and Shear Sharpness level 19.** Shear Sharpness has 25 levels; its cap rises with prestige so level 19 needs at least prestige 5.
- **Combat upgrades (coins):** Shear Sharpness, Swift Snips (crit), Sprayer Potency, Sprayer Cooldown, Hedgehog Brigade, Thorn Gloves, Spore Swatter, Battle Mulch (longer timer). Plus Heirloom upgrade "Sharpener's Guild" (higher Shear Sharpness cap).
- Rewards: Heirloom Seeds and a first-kill trophy in the barn.
- Tune with the balance simulation so boss 5 really needs prestige 7 and level 19.

## Admin panel (built 14 October 2026)

For the user's own testing. It replaces the old debug panel, so the public version has no cheat screen.

- **Only on the owner's computer:** `G.isAdmin` is true only when the page runs from `file://`. On GitHub Pages the backtick key does nothing and the key is not listed in How to Play. (A client-only game cannot be truly locked: someone could still type `BB.Game.admin...` in the browser console. The user accepted this design.)
- Open and close with the backtick key (`` ` ``, also matched by `e.code === 'Backquote'` because it is a dead key on some layouts), in the barn and in boss fights, or with the "Admin panel" button in the pause menu (only shown when `G.isAdmin`). The panel stays open when a fight starts. `UI.toggleAdmin` / `buildAdmin` in `ui.js` (reuses the `#debug` element), actions in `G.admin` in `main.js` (plus a few older `G.debug` helpers).
- Sections: Give (add or set any amount of coins, Sunshine, Heirloom Seeds, Comet Crumbs, each nutrient, each seed), Seasons (set prestige, reach season goal), Upgrades (set any level, max all, unlock all species, "Ignore level caps"), Bosses (reset timers and "beaten", boss to 1 HP, win now, "No 20-minute wait"), Barn (grow all, skip time, night, fake 2 h away, restart tutorial), Events, Reset the whole save.
- Barn buttons only work in the barn and fight buttons only during a fight (a toast says so otherwise).
- The two switches are settings (`adminNoCaps`, `adminNoCooldown`) and only take effect when `G.isAdmin`. `L.ignoreCaps` makes `L.upgradeMax` return the absolute cap (`maxCap || max`). Switching it off drops levels back to the normal cap. Tested by "the admin switch ignore level caps" in `tests/logic.test.js` (52 tests now, all passed).

## Dark mode (built 14 October 2026)

The user wanted darker menus and panels only; the barn scene stays as it is ("barn skins might come later someday").

- Setting `theme` in `Save.defaultSettings`: 0 = Automatic (follows `prefers-color-scheme`, live), 1 = Light, 2 = Dark. Settings > Display & accessibility > Theme. `applyTheme` in `main.js` toggles `html.dark`.
- CSS: the `html.dark` block at the end of `style.css` gives `--cream`, `--cream-2`, `--paper`, `--ink`, `--ink-soft` and `--shadow` dark values, then overrides the few hard-coded light tints and coloured text.
- **Convention for new CSS:** panels use `--cream` / `--paper` / `--ink` so they follow dark mode. Text that sits on wood or on the dark fight screen (window titles, active tabs, barn sign, fight HUD, event chips, menu title) uses `--on-wood` or a fixed colour, never `--cream`, or it turns dark in dark mode.
- Checked in the built-in browser from a pasted copy of the main CSS (modal, tabs, items, settings rows, side card, toasts, toolbar) in both themes. Not yet seen in the real game.

## Boss rework (14 October 2026)

The user found the bosses died far too quickly and asked for huge health, so that a boss takes at least 2 to 3 tries at the stage where you meet it (not necessarily with max upgrades). Agreed and built:

- **Damage stays between attempts.** `state.bossHealth[id]` = share of health left this season, `state.bossTries[id]` = attempts this season (both reset by a New Season, since they are not in `SEASON_KEEPS`). `K.start` starts the boss at that health (the Eclipse Lotus starts in phase 2 if it is below half); `K.tick` and `K.finish` write it back (`remember`), so closing the page mid-fight loses nothing. A win deletes it. Saves: sanitised in `Save.sanitize`; no `CONFIG.VERSION` bump on purpose (friend codes check the version).
- **Health per boss**, tuned per boss from the user's old boss table (old: 15k, 85k, 950k, 8.6M, 72M): Thornzilla 105,000, Fernkraken 470,000, Snapdragon 3.6M, Mother Mold 22M, Eclipse Lotus 160M. Aim at the required level: about 4 tries without help, 2 to 3 with combat upgrades, about 2 with battle items.
- **Per season above the boss's own:** health x `COMBAT.seasonHpGrowth` (2.5), armour +`seasonArmorScaling` (25%, as before). Claude proposed 3.5x, but anything above about 2.65 makes an early boss outgrow a later one in late seasons; a test checks the order for prestige 0 to 12.
- UI: wound line on the Wild Patch card, "Still wounded" in the fight banner, the result screen says the damage stays, "Beaten on attempt N". Admin "Reset bosses" also clears health and tries.
- `tests/balance.js` boss table now shows tries until a win (max 12), plus a "two seasons later, +5 sharpness" row. Test: "bosses take a few tries". The user ran it: 53 tests passed, and the boss table came out as planned (required level: 3 to 5 tries without help, 2 to 3 with combat upgrades, 2 with items; 1 to 2 two seasons later). Numbers are in the README.

## Barn sign (built 14 October 2026)

The user found the top right corner too empty. A wooden sign now hangs there (two ropes and nails, drawn in CSS): barn name, "Season N" with one leaf per season (up to 6), coins per minute, and a "Harvest festival 62%" bar (gold and glowing when the goal is reached). Clicking opens Seasons; the tooltip gives the exact numbers.

- `buildSign`, `updateSign`, `fitSign` in `ui.js` (HUD section). Income is an estimate, `L.incomeEstimate(state)` in logic: sum over living plants of `projectedValue x growthRate` (ripe plants at their regrow speed), shown as "≈ X/min" per real minute at the current speed. The first version measured coins earned over the last minute; the user found it showed 0 while slow plants (Stardust Lotus) were growing, so it was replaced. Display only, nothing saved. Test: "the income estimate on the barn sign". The user ran it: all 53 tests passed, and the estimate works in the game.
- The user saw the sign in the real game on 14 October 2026 and said it looks perfect.
- Layout: `.hud.with-sign` turns the HUD into a grid (buttons left, sign right, 18.5rem like the side panel). `fitSign` (called from `UI.insets`) only adds the class on screens 900px and wider when both button rows fit beside the sign, so it never adds a row; on smaller screens the sign is hidden.
- Checked in the built-in browser from a pasted copy of the CSS and `fitSign` (look, gold state, alignment, show/hide at 983 and 1600 px).

## Ideas not done yet

- Barn skins (other looks for the barn scene itself), mentioned by the user as "someday".
- Tune sounds and music by ear.
- Compact phone HUD (it wraps to three rows at 375 px).
- Tune boss health from the boss table in `tests/tests.html` and real fights.
- Seasons, more critters, weather visible on plants.
- More than one save slot.
- Per-pot feeding plan for the Butler Bee.
- A screenshot for the README (press `F` in game for photo mode).

## Keeping this file current

After each session that changes the game, update "Current state" and "Ideas not done yet". Keep this file short; details belong in the code comments and `README.md`.
