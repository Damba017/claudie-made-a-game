<div align="center">

# 🌱 Barn Bloom 🌻

**A cozy little plant-care game for your browser**

*Water · Feed · Harvest · Grow your barn*

`HTML` · `CSS` · `JavaScript` · no frameworks · no build step · no asset files

```
        ✿            ❀
   🌿   |    🌵   🍄  |   🌸
  ╔═╧═╗╔╧══╗╔═╧═╗╔╧══╗╔═╧═╗
  ╚═══╝╚═══╝╚═══╝╚═══╝╚═══╝
 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

</div>

---

## ✨ What is this?

You own a barn full of plants. Keep them watered and fed, harvest them when a gold star appears, sell the harvest, and turn a four-pot shelf into a full barn that mostly runs itself.

Every plant, critter and plank is **drawn in code** on a canvas, and every sound is **synthesised live** with the Web Audio API. There is not a single image, font or audio file in this repository.

## ▶️ Play

1. Download or clone this repository.
2. Open **`index.html`** in a browser.

That's it. No install, no server, works straight from `file://`.

## 🪴 Meet the plants

| | Plant | Personality |
| :-: | --- | --- |
| 🌿 | **Pepperwink** | Fast, cheap and forgiving. Everyone's first seed. |
| 🌱 | **Drizzle Fern** | Very thirsty, sulks dramatically when dry. |
| 🌵 | **Grumpy Prickle** | Barely drinks. Judges you when you overwater it. |
| 🌻 | **Sunny Goliath** | Grows faster in daylight, naps at night. |
| 🍓 | **Jamboree Berry** | Three harvests from a single seed. |
| 🍄 | **Glimmercap** | Glows in the dark and grows best at night. |
| 🌸 | **Moonveil Orchid** | Slow, fussy about water, worth a small fortune. |
| 🪷 | **Stardust Lotus** | Legendary. Fell out of the night sky and stayed. |

## 🧪 The good stuff

| | Nutrient | Effect |
| :-: | --- | --- |
| ● | **Nitro-Bloom Fizz** | Growth +50% |
| ■ | **Gulp-Gel** | Water drains 50% slower |
| ▲ | **Glamour Jam** | Higher quality and sell price |
| ◆ | **Bug-Off Tonic** | Heals, evicts pests, keeps new ones away |
| ★ | **Comet Crumbs** | Rare. Instant growth and a pinch of quality |

Each species loves one nutrient and gets 50% more out of it. *Nitro + Gel* and *Jam + Tonic* form bonus synergies. The shapes are used everywhere in the game, so nothing depends on colour alone.

## 🎮 Features

- 🌦️ **Random events**: pests, heatwaves, rainy days, a lucky bee and a travelling merchant
- 🌗 **Day and night**: moving light shafts, lanterns, grow lamps, fireflies and glowing plants
- 🛠️ **29 upgrades** in six categories, from a bigger watering can to a grow-lamp rig
- 🦔 **Helpers**: a sprinkler, the Harvest Hedgehog, the Seed Squirrel and a Ladybug Patrol make the game semi-idle
- 📋 **Chalkboard orders**: customers ask for specific plants and pay a bonus
- ⭐ **Golden plants**: well-kept plants sometimes mature golden for triple price
- ☀️ **Sunshine**: a rare second currency for premium upgrades
- 📖 **Plant Almanac** and **22 awards** to collect
- 🐈 **A barn cat** that wanders in and likes being petted
- 🎨 **Pot paints**, 📸 **photo mode**, and a barn that gains decorations as it grows
- 💾 **Saves**: autosave, export and import as text, and offline progress with a "welcome back" summary
- ♿ **Accessibility**: colour-blind friendly mode, reduced motion, interface scaling, keyboard controls
- 📱 **Responsive**: desktop and touch

## ⌨️ Controls

Pick a tool, then tap a pot. Hold and drag to use the tool on several pots.

| Key | Action |
| :-: | --- |
| `1` `2` `3` `4` | Select · Watering can · Basket · Shovel |
| `5` | Seed tool (press again to cycle seeds) |
| `Q` `W` `E` `R` | Nitro-Bloom · Gulp-Gel · Glamour Jam · Bug-Off |
| `T` | Comet Crumbs |
| `A` / `H` | Water all thirsty / Harvest all ripe *(after buying the upgrades)* |
| `←` `↑` `→` `↓` `Space` | Move the selection · use the tool on it |
| `S` `U` `L` `K` `O` | Shop · Upgrades · Almanac · Awards · Orders |
| `P` / `Esc` | Pause · close a dialog |
| `M` / `F` | Mute · Photo mode |
| `` ` `` | Debug panel (cheats) |

## 🗂️ Project layout

```
index.html
css/
  style.css        palette and layout
js/
  config.js        every balance number and all game data
  state.js         plain-data factories for the game state
  logic.js         the whole simulation (no DOM, runs in Node)
  save.js          serialising, migration, sanitising, export/import
  audio.js         synthesised sound effects and ambient music
  art.js           procedural drawings: plants, pots, critters, icons
  render.js        the barn scene, lighting, particles
  ui.js            HUD, toolbar, dialogs, menu, tutorial
  main.js          game loop, input, glue
tests/
  tests.html       runs the tests and the balance simulation in a browser
  logic.test.js    logic tests
  balance.js       scripted player for balance tuning
```

Want to tune the game? Everything lives in **`js/config.js`**.

## 🧮 How it works

```
care     = waterFit × (0.4 + 0.6 × health)
growth   = care ÷ growTime × nutrient, lamp, day/night and event bonuses
quality  = average of (0.8 × care + jam bonus) while growing
price    = base value × (0.5 + 1.5 × quality) × market bonuses
upgrade  = base cost × multiplier ^ level
```

Perfect watering alone earns four stars. The fifth needs Glamour Jam.

The loop uses `requestAnimationFrame` with a fixed 10 Hz logic step, so the game behaves the same at any frame rate and at 1×, 2× or 3× speed.

## 🧠 Design decisions

- **Canvas for the barn, DOM for the interface.** The scene needs free-form drawing and particles; menus need text, focus handling and responsive layout.
- **Harvests are sold immediately.** A produce inventory would add a chore without adding a decision.
- **A water tank limits watering.** It stops button mashing and gives rain, the tank, the pump and the sprinkler a purpose.
- **Overwatering is an early-game skill.** The Gentle Rose Spout removes it, and the bigger can requires that spout so it never makes things worse.
- **Nutrient stock is limited per day.** The shop restocks every in-game morning, which gives the day cycle a gameplay meaning.
- **Offline progress is fair by rule.** Time away is capped and slowed. While away there are no random events, nothing takes damage, a neighbour keeps pots from drying out completely, and ripe plants wait for you.
- **No dead ends.** If you have no coins, no seeds and nothing growing, a neighbour leaves two seeds on your doorstep.
- **Saves are sanitised field by field**, so a damaged save loads as far as it can and never crashes the game.

## 📈 Pacing

Measured with a scripted player (`tests/balance.js`) that never uses nutrients:

| Minute | Coins earned | Pots | Species |
| :-: | --: | :-: | :-: |
| 1 | 50 – 75 | 5 | 1 |
| 5 | 540 – 790 | 7 | 2 |
| 10 | 1,300 – 2,200 | 8 – 9 | 2 – 3 |
| 30 | 13,500 – 19,000 | 12 – 13 | 4 |
| 60 | ≈ 73,000 | 17 | 5 |
| 120 | ≈ 1.1 million | 20 | 8 |

## 🧪 Tests

Open **`tests/tests.html`** in a browser to run 37 logic tests and the balance simulation.

With Node installed you can also run:

```bash
node tests/logic.test.js
```

```bash
node tests/balance.js
```

## 🚧 Known limitations and ideas

- 🔊 Sounds and music have not been tuned by ear yet
- 📱 On phones the HUD takes three rows; a compact layout would give the barn more room
- 💰 Late-game income grows very fast; a prestige system would give the two-hour mark a goal
- 🍂 Seasons, more critters and weather visible on the plants
- 💾 Only one save slot

## 💛 Credits

Design, code, drawings and sounds by Claude (Anthropic).

Special thanks to the barn cat, who supervised. 🐈

---

<div align="center">

*Made with plain JavaScript and a lot of virtual watering.* 🌼

</div>
