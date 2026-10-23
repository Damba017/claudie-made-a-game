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
| 🎃 | **Plumpkin** | Thirsty and slow. A perfect 5-star one is a prize pumpkin and sells for double. |
| 🍄 | **Glimmercap** | Glows in the dark and grows best at night. |
| 🌸 | **Moonveil Orchid** | Slow, fussy about water, worth a small fortune. |
| 🌶️ | **Firecracker Pepper** | Grows twice as fast in a heatwave and crackles with sparks when ripe. |
| 🪷 | **Stardust Lotus** | Legendary. Fell out of the night sky and stayed. |
| 🌹 | **Crystalbloom Rose** | A rose of living glass. Worth a fortune, but quickly past its prime. |
| 🏮 | **Firefly Lantern** | Paper lanterns with a firefly inside. Three harvests from one seed, faster at night. |
| 🌳 | **Grandpa Bonsai** | Very old, very slow, very valuable. Three harvests from one seed, and it is never in a hurry to go past its prime. |
| 🦜 | **Firebird of Paradise** | The finest plant in the shop. Thinks it is a bird. Loves a heatwave; a fine bloom gives 4 Sunshine. |

### ✨ Rare plants (only from events)

Never sold in the shop. Once you have unlocked the Moonveil Orchid, someone sometimes offers one seed when an event starts (about once an hour per event). Pricey, but worth it: the first four give several harvests and a special reward, the last three give one big harvest and help the whole barn while they grow. Rare seeds come with you into a New Season.

| | Plant | Found | Seed | Why it's worth it |
| :-: | --- | --- | --: | --- |
| 🌈 | **Rainbow Lily** | Rainy days | 40,000 | 4 harvests, twice as fast in the rain, 1 Sunshine every harvest |
| 🔥 | **Ember Agave** | Heatwaves | 60,000 | Barely drinks, 3× faster in a heatwave, 3 harvests, double price when harvested in a heatwave |
| 🍯 | **Honeyheart** | Lucky bee | 100,000 | 4 harvests with a Comet Crumb each; the lucky bee visits more often |
| 🥕 | **Wanderer's Mandrake** | Travelling merchant | 300,000 | The only plant that gives Heirloom Seeds (1 per harvest at 4+ stars). It shrieks. |
| 🪲 | **Gobblepot Pitcher** | Pests | 80,000 | Every pest goes straight into its pitcher instead of your plants, and each snack makes it grow |
| ☁️ | **Puffcloud Nimbus** | Rainy days | 150,000 | Its own little rain cloud waters it and the pots on either side |
| 🎋 | **Fortune Bamboo** | Lucky bee | 220,000 | +8% chance for every plant in the barn to ripen golden |

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

- 🪴 **21 plants**: 14 to unlock in the shop and 7 rare ones that only turn up during events
- 🌦️ **Random events**: pests, heatwaves, rainy days, a lucky bee and a travelling merchant
- 🌗 **Day and night**: moving light shafts, lanterns, grow lamps, fireflies and glowing plants
- 🛠️ **50 upgrades**: 37 in seven categories, from a bigger watering can to razor-sharp shears, plus 13 Heirloom upgrades that never reset
- 🌰 **New Seasons (prestige)**: reach the season's coin goal, start over with Heirloom Seeds and a permanent +10% growth and sell price per season; many upgrade caps rise each season
- 👹 **Boss fights in the Wild Patch**: eight mutated plants to snip down (Thornzilla, The Fernkraken, Sir Snapdragon, Mother Mold, The Eclipse Lotus, King Gourdon, The Glass Duchess and The Mandrake Monarch), each with its own moves, armour and a huge pile of health. The damage you deal stays between attempts, so a boss takes a few tries; each can be beaten once per season, with a 20-minute recovery after every attempt, and they grow back tougher every season
- 🦔 **Helpers**: a sprinkler, the Harvest Hedgehog, the Seed Squirrel and a Ladybug Patrol make the game semi-idle
- 📋 **Chalkboard orders**: customers ask for specific plants and pay a bonus
- ⭐ **Golden plants**: well-kept plants sometimes mature golden for triple price
- ☀️ **Sunshine**: a rare second currency for premium upgrades
- 📖 **Plant Almanac** and **34 awards** to collect
- 🐈 **A barn cat** that wanders in and likes being petted, with five extra coats to collect: Lexie the brown tabby, fluffy Maya and Alice, Coco the Siamese and Mosh the British Shorthair
- 💌 **Visit friends**: copy a visit code for your barn, send it to a friend, and stroll through each other's barns
- 🎁 **Gifts**: wrap coins, seeds and nutrients into a gift code for a friend
- 🤝 **Trading**: offer "I give this, I want that" by code; your friend accepts and sends a reply code back (gifts and trades run on trust, like any deal between friends)
- 🪧 **A barn sign** in the corner with your barn's name, the season you're in, how close the next harvest festival is, and about how many coins per minute your plants make
- 🎨 **Pot paints**, 📸 **photo mode**, and a barn that gains decorations as it grows
- 💾 **Saves**: autosave, export and import as text, and offline progress with a "welcome back" summary
- 🌙 **Dark mode** for menus and panels (light, dark, or follow your computer)
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
| `N` | Seasons (prestige and Heirloom upgrades) |
| `B` | The Wild Patch (boss fights) |
| `Space` `S` · `Q` `W` `E` `R` · `Esc` | In a fight: snip, spray · battle items · give up |
| `P` / `Esc` | Pause · close a dialog |
| `M` / `F` | Mute · Photo mode |
| `` ` `` | Admin panel for testing *(only for the owner: needs a local file and a private key file that is not in this repository; also in the pause menu)* |

## 🗂️ Project layout

```
index.html
css/
  style.css        palette and layout
js/
  config.js        every balance number and all game data
  state.js         plain-data factories for the game state
  logic.js         the whole simulation (no DOM, runs in Node)
  combat.js        boss fights in the Wild Patch (no DOM, runs in Node)
  save.js          serialising, migration, sanitising, export/import
  audio.js         synthesised sound effects and ambient music
  art.js           procedural drawings: plants, pots, critters, bosses, icons
  render.js        the barn scene, the greenhouse arena, lighting, particles
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
power    = 10 × 1.6 ^ Shear Sharpness level      (a snip only hurts if power > armour)
boss     = health × 2.5 ^ seasons above its own, armour + 25% per season
season   = coins earned this season ≥ 1,000,000 × 2 ^ prestige
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
- **Rare plants are event-only.** They give every event a little extra excitement. Most are perennials, and the newer ones help the whole barn while they grow; a rare seed also survives a New Season, so a pricey purchase never feels wasted. The Seed Squirrel never spends a rare seed on its own.

## 📈 Pacing

Measured with a scripted player (`tests/balance.js`) that never uses nutrients:

| Minute | Coins earned | Pots | Species |
| :-: | --: | :-: | :-: |
| 1 | 50 – 75 | 5 | 1 |
| 5 | 610 – 940 | 7 – 8 | 2 |
| 10 | 1,500 – 4,300 | 9 – 10 | 2 – 3 |
| 30 | 18,000 – 31,500 | 13 – 15 | 4 – 5 |
| 60 | ≈ 74,000 | 17 | 5 |
| 120 | ≈ 2.8 million | 20 | 8 |

And the eight bosses against the same kind of scripted player (4 clicks per second). Damage stays between attempts, so it keeps coming back every 20 minutes until it wins:

| Boss | Required level, no help | + combat upgrades | + battle items | One level higher | Two seasons later, 5 levels higher |
| --- | :-: | :-: | :-: | :-: | :-: |
| Thornzilla | 4 tries | 3 tries | 2 tries | 3 tries | 2 tries |
| The Fernkraken | 4 tries | 3 tries | 2 tries | 3 tries | 2 tries |
| Sir Snapdragon | 4 tries | 3 tries | 2 tries | 2 tries | 1 try |
| Mother Mold | 3 tries | 2 tries | 2 tries | 2 tries | 2 tries |
| The Eclipse Lotus | 5 tries | 3 tries | 2 tries | 2 tries | 2 tries |
| King Gourdon | 4 tries | 2 tries | 2 tries | 2 tries | 2 tries |
| The Glass Duchess | 4 tries | 3 tries | 2 tries | 3 tries | 2 tries |
| The Mandrake Monarch | 5 tries | 3 tries | 2 tries | 3 tries | 2 tries* |

\* Shear Sharpness 30 is above the in-game cap of 28, so that cell is only a simulation.

## 🧪 Tests

Open **`tests/tests.html`** in a browser to run 59 logic tests and the balance simulation.

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
- 👹 Boss difficulty still needs tuning by real players
- 🍂 Seasons, more critters and weather visible on the plants
- 💾 Only one save slot

## 💛 Credits

Design, code, drawings and sounds by Claude (Anthropic).

Special thanks to the barn cat, who supervised. 🐈

---

<div align="center">

*Made with plain JavaScript and a lot of virtual watering.* 🌼

</div>
