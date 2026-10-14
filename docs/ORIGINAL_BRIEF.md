# Original brief (verbatim)

This is the prompt the project started from, kept word for word so it is never lost. `CLAUDE.md` holds the condensed, always-loaded version.

The user added two instructions alongside it:

- "Of course, you can make as much folders as you need. Ask me before you do anything/create anything!!!"
- Later: "i dont hafe homebrew and any terminal commands" (after rejecting a shell command).

---

# Project: "Barn Bloom", a cozy plant-care browser game

You have full creative and technical freedom. Do NOT ask me clarifying questions. Make every decision yourself, and record the important ones in a short "Design decisions" section in README.md. This is a fun test of your coding ability, so aim for something polished, charming and genuinely fun to play for 20+ minutes, not a bare-bones prototype.

## 1. The concept

The player owns a barn full of plants. They keep the plants alive and growing by watering them and feeding them nutrients, harvest them when mature, sell the harvest for coins, and spend coins on seeds, nutrients, upgrades and barn expansions. It is an incremental / idle-friendly management game with a cozy vibe.

## 2. Hard technical constraints

- Plain HTML + CSS + JavaScript only. No frameworks, no bundler, no npm dependencies, no external assets (no images, fonts, audio files, CDNs).
- It must work by simply opening index.html in a browser (also from file://). Therefore use classic <script> tags in the right order, NOT ES modules.
- File layout (suggestion, adjust if you have a better idea): index.html, css/style.css, js/config.js, js/state.js, js/logic.js, js/render.js, js/ui.js, js/audio.js, js/save.js, js/main.js, README.md.
- All graphics are drawn procedurally in code (Canvas 2D and/or inline SVG, your choice). Choose one coherent art style (for example charming flat-vector or chunky pixel-art-style) and stay consistent. For text use system font stacks only.
- Keep game logic (pure functions, no DOM access) strictly separate from rendering and UI so the logic can be tested in Node.
- All balance numbers (costs, rates, multipliers, timings) live in ONE config file so tuning is easy.
- Use a proper game loop (requestAnimationFrame, delta-time based, with a fixed-step logic tick so the game behaves the same at any frame rate). Clamp huge delta times (e.g. when the tab was in the background).

## 3. Core gameplay systems

### Plants
- Each plant sits in a pot/planter slot in the barn and has: growth stage (seed, sprout, young, mature, overgrown/past-prime), water level, nutrient levels, health, quality, and an age.
- Water drains over time. At 0 water, health drops. Overwatering should also be possible and slightly harmful, so the player has to pay attention instead of mashing the button.
- Plants grow only while their needs are reasonably met. Better care leads to faster growth and higher quality, which gives a higher sell price. Neglected plants wilt visibly (drooping, color change), and can die (the player can then clear the pot and replant).
- Provide 6-8 plant species with different personalities (growth time, thirst, nutrient preferences, sell value, unlock cost). For example: a quick cheap herb, a thirsty fern, a drought-loving cactus, a slow but valuable orchid, a sunflower, a weird glowing mushroom, and one rare/legendary plant as a late-game goal. Make up your own names and quirks.

### Nutrients (the "good stuff" that must be bought)
- At least 3-4 distinct nutrient types with clearly different effects, e.g. one that speeds up growth, one that makes the plant hold water longer, one that boosts quality / sell value, one that heals or protects against pests. Invent funny names.
- Nutrients are bought in the shop in limited stock (inventory counts) and applied to plants by the player. Show clearly what each one does and which plants like it most.
- Allow simple synergies (e.g. certain combos are extra effective) but keep it understandable. Show a visible "nutrient bar" per plant.

### Economy
- Currency: coins. Possibly a second rare currency (e.g. "golden seeds" or "sunshine") earned from special events or milestones, used for premium upgrades. Only add it if it improves the game.
- Harvested plants go into inventory or are sold directly (your choice), with price depending on species, quality and any active multipliers.
- Prices of seeds, nutrients and upgrades should scale sensibly so there is always a meaningful next goal. The first 5 minutes must feel rewarding and fast; later it slows down in a satisfying way. A player must never get permanently stuck with zero coins and no way to earn more (build a safeguard, e.g. a cheap always-available seed).

### Upgrades (important, make this good)
- A proper upgrade screen with several categories, e.g.:
  - Tools: bigger watering can (waters more at once / multiple plants), auto-sprinkler, harvest-all scythe.
  - Nutrient upgrades: for example "Nitro-Bloom is 25% more effective" with multiple levels, plus potency/duration upgrades.
  - Barn: more plant slots, bigger barn visuals (the barn actually looks bigger/fuller as you expand), better lighting (grow lamps), a water tank with capacity.
  - Automation: unlockable helpers (auto-water, auto-harvest, auto-replant) that unlock later and have upgrade levels, so the game becomes semi-idle.
  - Economy: sell price boosts, shop discounts, offline-earnings boost.
- Upgrade costs scale per level. Show current effect and next-level effect in the tooltip/description. Locked upgrades show what unlocks them.

### Random events and variety
- Small random events to keep it lively, with a visible, non-annoying notification and a clear way to react: e.g. pest infestation on one plant, heatwave (water drains faster), lucky bee (bonus growth/pollination), a travelling merchant selling a rare nutrient or seed for a limited time, a rainy day (free water). Make them tweakable/disable-able in settings.
- Day/night cycle in the barn visuals (light through the window/roof gaps shifting during the day, lamps at night). Cosmetic, but it should look lovely.
- Optional but welcome: an achievements/milestones list, and a "Plant Almanac" (encyclopedia of discovered plants and nutrients with a little drawing and flavor text).

## 4. Screens, menus and UI (all required)

- Main menu: title with an animated background (barn scene), buttons: Continue (disabled if no save), New Game, How to Play, Settings, Credits.
- In-game HUD: coins (and other currencies), current day/time, quick access to Shop, Upgrades, Almanac, Achievements and Pause. Selected-tool indicator (watering can, nutrient, harvest, shovel/clear pot).
- Interaction model: click/tap a plant to select it, and use tools via toolbar buttons or keyboard shortcuts. Also support drag-and-drop or "select tool then click plant". Make it fast to care for many plants (e.g. hold to water several, "water all thirsty plants" button once unlocked).
- Plant info panel on hover/select: species, stage, water, nutrients, health, quality, time to maturity, sell value.
- Shop screen with tabs (Seeds, Nutrients, Special), quantity buttons (x1, x5, x10, max), and clear affordability feedback.
- Upgrade screen as described above.
- Pause menu: Resume, Settings, Save, Save & Quit to Menu.
- Settings: master/music/sfx volume + mute, game speed (e.g. 1x/2x), toggle for random events, toggle for screen shake/particles/reduced motion, colorblind-friendly mode (don't rely on color alone to show status), UI scale, and a "Reset save" with confirmation.
- Tutorial: a short, skippable, contextual first-time guide (a few guided steps, not a wall of text), plus a How to Play screen.
- Confirmation dialogs for destructive actions. Toast notifications for events and achievements.
- Responsive layout: works well on desktop and reasonably on mobile/touch (large tap targets). Keyboard shortcuts for main actions, listed in How to Play. Tooltips everywhere that matters. Sensible focus/ARIA basics on buttons and dialogs.

## 5. Visuals and game feel ("juice")

- Hand-drawn-in-code plants for every species and every growth stage, with wilting/healthy variants, subtle idle animation (swaying, breathing), and visible state indicators (thirsty droplet icon, nutrient sparkle, pest bug, etc.).
- Particles and feedback: water splash, nutrient sparkles, coin pop and floating "+12" numbers on sale, harvest burst, level-up shine on upgrade purchase, gentle screen shake only on big events (respect the reduced-motion setting).
- Barn scene: wooden beams, hay, shelves with pots, dusty light shafts, a window, maybe small ambient critters (butterfly, bee, mouse). Make it look cozy and cohesive, not placeholder-ish.
- Smooth UI transitions (CSS), consistent color palette defined once as CSS variables / config.
- Audio: synthesize everything with the Web Audio API (no audio files): soft click, water pouring, coin chime, harvest pop, upgrade jingle, error buzz, plus an optional calm generative ambient loop. Audio starts only after the first user interaction (browser autoplay rules), and is easy to mute.

## 6. Save system

- Autosave to localStorage every ~30 seconds and on important actions. Include a version number in the save format, with a simple migration path for future changes.
- Manual save, load, and export/import save as a copy-paste text string (base64 of JSON) so progress can be backed up.
- Offline progress: when returning after being away, simulate a capped, sensible amount of time (e.g. up to 8 hours, affected by an upgrade), and show a "Welcome back" summary of what happened. Make sure plants don't just all die instantly while away. Design that fairly.
- Handle corrupted or missing saves gracefully (never crash on load).

## 7. Developer niceties

- A hidden debug panel (toggle with a key such as backtick) with cheats: add coins, skip time, grow all plants, trigger an event, reset. Disabled/hidden by default.
- A small FPS counter option in settings.
- Clean, commented, readable code with sensible naming. No giant spaghetti functions.

## 8. How I want you to work

1. First, write a short plan: architecture, the data model for plants/nutrients/upgrades, the main formulas for growth and economy, and the milestone order. Then start building without waiting for approval.
2. Build in milestones, so there is always a runnable game: (a) core loop with one plant species, watering and selling, (b) full plant set, nutrients and shop, (c) upgrades and automation, (d) menus, settings, tutorial, save/load, (e) events, audio, achievements, almanac, (f) polish and juice.
3. Verify your own work as you go: run a syntax/lint check on the JS, write a small Node script that tests the pure game logic (growth, water drain, economy, save/load round-trip, offline progress), and fix everything it finds. If a headless browser is available, load the page and check for console errors. Do not claim something works if you have not checked it.
4. Do a balance pass: simulate (with a script) the first 10 and 30 minutes of a reasonable player and make sure progression feels good with no dead ends and no trivially exploitable loops.
5. Finish with a short README.md: how to run, controls, feature overview, the "Design decisions" section, and a "Known limitations / ideas for later" list.
6. When done, give me a brief summary: what you built, what extra features you added on your own initiative, and anything you would improve with more time.

## 9. Definition of done

- Opening index.html starts a working game with no console errors.
- Every screen/menu listed above exists and works.
- At least 6 plant species, 3+ nutrient types, 15+ upgrades across categories, random events, day/night cycle, synthesized audio, achievements, almanac, working saves with offline progress.
- Nothing is a placeholder: every button does something, every text is written, no "TODO" left in the UI.
- You surprised me with at least a few cool extras I did not ask for. Go wild within the KISS spirit: stay simple where simple is enough.

Have fun with it, and make something you would be proud of.
