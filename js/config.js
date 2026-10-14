/*
 * Barn Bloom - config.js
 * ------------------------------------------------------------------
 * Every balance number, every piece of game data (species, nutrients,
 * upgrades, events, achievements) and the colour palette live here.
 * Tune the game by editing this file only.
 */
(function (root) {
  'use strict';
  var BB = root.BB = root.BB || {};

  function pct(v) { return Math.round(v * 100) + '%'; }
  function onOff(v) { return v > 0 ? 'Owned' : 'Not owned'; }
  /** Shear power (damage per snip) at a Shear Sharpness level, as text. */
  function shearText(lvl) {
    return Math.round(CONFIG.COMBAT.shearBase * Math.pow(CONFIG.COMBAT.shearGrowth, lvl)).toLocaleString('en-US');
  }

  var CONFIG = {
    VERSION: 1,
    SAVE_KEY: 'barnbloom.save',
    SETTINGS_KEY: 'barnbloom.settings',

    // ---- Loop & time -------------------------------------------------
    TICK: 0.1,              // fixed logic step in seconds
    MAX_FRAME_DT: 0.25,     // clamp for huge frame deltas (background tabs)
    MAX_STEPS_PER_FRAME: 12,
    AUTOSAVE_SECONDS: 30,
    DAY_LENGTH: 240,        // seconds per in-game day
    NIGHT_START: 0.6,       // fraction of the day at which night begins (phase 0 = 06:00)

    // ---- Starting kit ------------------------------------------------
    START: {
      coins: 15,
      slots: 4,
      seeds: { mint: 3 },
      nutrients: { nitro: 2 }
    },
    MAX_SLOTS: 20,

    // ---- Water -------------------------------------------------------
    WATER: {
      max: 120,             // absolute cap of a pot
      pour: 34,             // base amount per pour of the watering can
      baseDrain: 0.5,       // units per second at thirst 1.0
      soggyMargin: 12,      // water above (ideal max + margin) hurts
      thirstyMargin: 6,     // sprinkler / water-all kick in below (ideal min + margin)
      plantStart: 5,        // freshly planted pots start at ideal min + this
      autoTopMargin: 8      // automation fills up to (ideal max - margin)
    },
    TANK: { capacity: 220, refill: 4 },

    // ---- Health ------------------------------------------------------
    HEALTH: {
      dryDamage: 0.9,       // per second at 0 water
      soggyDamage: 0.35,
      pestDamage: 0.45,
      regen: 0.7,
      regenFit: 0.8,        // water fit needed to regenerate
      tonicHeal: 2.0,
      spaHeal: 0.6
    },

    // ---- Growth & quality -------------------------------------------
    GROWTH: {
      minCare: 0.35,        // below this care a plant stops growing
      sproutAt: 0.12,
      youngAt: 0.45,
      primeFactor: 0.75,    // prime window = max(primeMin, growTime * factor)
      primeMin: 60,
      overgrownFloor: 0.5,  // value multiplier a fully past-prime plant keeps
      pestSlow: 0.5,
      nitroBonus: 0.5,
      juicyBonus: 0.25
    },
    QUALITY: {
      careWeight: 0.8,      // perfect care alone gives quality 0.8 (4 stars)
      jamBonus: 0.25,
      jamCap: 0.45,
      spaBonus: 0.1,
      priceBase: 0.5,       // price multiplier = base + span * quality
      priceSpan: 1.5,
      goldenChance: 0.05,
      goldenMinQuality: 0.75,
      goldenMult: 3
    },

    // ---- Nutrients (shared numbers) ---------------------------------
    NUTRIENT: {
      dose: 50,
      max: 100,
      decay: 50 / 90,       // one dose lasts about 90 seconds
      fullAt: 25,           // effect is at full strength above this amount
      likeBonus: 1.5,       // multiplier when the species loves the nutrient
      gelDrainCut: 0.5,
      gelMinDrain: 0.15,
      baseStock: 10,        // shop stock per nutrient, refilled every morning
      restockCostPerItem: 3,
      crumbsGrowth: 0.25,
      crumbsQuality: 0.1,
      crumbsQualityMax: 0.2
    },

    // ---- Random events ----------------------------------------------
    EVENTS: {
      firstDelay: 110,
      minGap: 70,
      maxGap: 130,
      weights: { pest: 3, heat: 2, bee: 2, rain: 2.2, merchant: 1.6 },
      heatDuration: 45,
      heatDrain: 1.8,
      beeDuration: 35,
      beeGrowth: 1.5,
      rainDuration: 30,
      rainWater: 4,         // free water per second, never beyond the comfy middle
      rainTankMult: 6,
      merchantDuration: 80,
      pestHp: 3,            // clicks needed to shoo a bug by hand
      ladybugDelays: [30, 15, 5]
    },

    // ---- Orders (chalkboard) ----------------------------------------
    ORDERS: {
      count: 2,
      unlockHarvests: 5,
      cooldown: 40,
      skipCooldown: 60,
      rewardFactor: 0.8,    // reward = value * qty * factor (on top of the normal sale)
      sunshineChance: 0.3   // for picky (3+ star) orders
    },

    // ---- Automation --------------------------------------------------
    AUTO: {
      hedgehogDelays: [20, 10, 3],
      squirrelDelay: 3,
      sprinklerPerLevel: 4
    },

    // ---- Offline progress -------------------------------------------
    OFFLINE: {
      minSeconds: 60,       // shorter absences are simply ignored
      baseHours: 4,
      baseEfficiency: 0.5,
      waterFloor: 0.5,      // a kind neighbour keeps pots at least at idealMin * this
      step: 1
    },

    // ---- Gifts between friends --------------------------------------
    GIFTS: {
      maxCount: 999,          // per seed / nutrient type in one gift
      maxCoins: 1000000000,
      remember: 400,          // how many gift ids a barn remembers (sent and opened)
      maxOpenTrades: 5        // trade offers one barn can have waiting at a time
    },

    // ---- Prestige ("New Season") ---------------------------------------
    // Earn `goal` coins in one season to start a new one. The goal for
    // prestige level p is firstGoal * goalMult^p.
    PRESTIGE: {
      firstGoal: 1000000,
      goalMult: 2,
      bonusPerLevel: 0.1,     // +10% growth and +10% sell price per prestige level
      heirloomsAtGoal: 10,    // Heirloom Seeds for reaching the goal exactly ...
      heirloomPower: 0.5      // ... times (earned / goal) ^ power
    },

    // ---- Boss fights in the Wild Patch -----------------------------------
    // Shear power at level L = shearBase * shearGrowth^L. A snip only hurts a
    // boss if that power is higher than the boss's armour. Each boss's armour
    // sits just below the power of its required Shear Sharpness level.
    COMBAT: {
      fightTime: 90,          // seconds per attempt (+ Battle Mulch)
      retryCooldown: 1200,    // real seconds before the same boss can be tried again (20 minutes)
      // Per prestige level above the boss's own: health x seasonHpGrowth, armour +25%.
      // Keep seasonHpGrowth below about 2.65, or an early boss ends up with more
      // health than a later one in late seasons (tested).
      seasonHpGrowth: 2.5,
      seasonArmorScaling: 0.25,
      shearBase: 10,
      shearGrowth: 1.6,
      comboWindow: 0.6,       // snips closer together than this build the combo
      comboStep: 0.05,
      comboMax: 2,
      critBase: 0.05,
      critMult: 2.5,
      sprayCooldown: 20,
      sprayBurst: 15,         // burst = power * this
      sprayDot: 2,            // lingering mist = power * this per second ...
      sprayDotTime: 5,        // ... for this many seconds
      brigadeDps: 0.35,       // per hedgehog, times your power, per second
      brigadeEvery: 0.5,
      itemUses: 3,            // each nutrient can be used this often per fight
      nitroTime: 10, nitroMult: 2,
      jamTime: 10, jamCrit: 0.2,
      gelTime: 5,             // Gulp-Gel adds seconds to the clock
      firstMove: 4,           // seconds before the boss's first special move
      podRadius: 26           // pixels, before the Spore Swatter
    },

    CAT_ARRIVES_AT: 150,    // seconds of play before the barn cat wanders in

    STAGE_NAMES: {
      seed: 'Seed', sprout: 'Sprout', young: 'Young', mature: 'Mature',
      overgrown: 'Past prime', dead: 'Withered'
    }
  };

  // ------------------------------------------------------------------
  // Plant species
  // water: [ideal min, ideal max]; thirst multiplies the base drain.
  // ------------------------------------------------------------------
  CONFIG.SPECIES = [
    {
      id: 'mint', name: 'Pepperwink', latin: 'Mentha hastyana',
      blurb: 'A cheerful little herb that grows like it is late for something.',
      quirk: 'Fast and forgiving. The seed everyone starts with.',
      growTime: 40, thirst: 1.0, water: [30, 85], value: 7, seedCost: 3, unlock: 0,
      likes: ['nitro'], dayMult: 1, nightMult: 1, harvests: 1,
      colors: { leaf: '#63b95f', leaf2: '#3f9a55', accent: '#f6c7e0', seed: '#8a6a3a' }
    },
    {
      id: 'fern', name: 'Drizzle Fern', latin: 'Pteris soggybottom',
      blurb: 'Drinks like a camel in reverse. Sulks dramatically when dry.',
      quirk: 'Very thirsty, but pays well for the effort. Adores Gulp-Gel.',
      growTime: 75, thirst: 1.8, water: [50, 100], value: 24, seedCost: 8, unlock: 60,
      likes: ['gel'], dayMult: 1, nightMult: 1, harvests: 1,
      colors: { leaf: '#4fae7a', leaf2: '#2f8a66', accent: '#b9f0c8', seed: '#5a7a4a' }
    },
    {
      id: 'cactus', name: 'Grumpy Prickle', latin: 'Cactus disapprovius',
      blurb: 'Wants to be left alone. Judges you when you overwater it.',
      quirk: 'Barely drinks. One pour too many and it gets soggy feet.',
      growTime: 150, thirst: 0.25, water: [8, 45], value: 48, seedCost: 14, unlock: 180,
      likes: ['jam'], dayMult: 1.1, nightMult: 0.9, harvests: 1,
      colors: { leaf: '#6fbf73', leaf2: '#4a9a5c', accent: '#ff8fb1', seed: '#9a8a5a' }
    },
    {
      id: 'sunflower', name: 'Sunny Goliath', latin: 'Helianthus bigfacea',
      blurb: 'Follows the sun all day and naps the moment it sets.',
      quirk: 'Grows 30% faster in daylight, much slower at night.',
      growTime: 120, thirst: 1.1, water: [35, 85], value: 60, seedCost: 22, unlock: 500,
      likes: ['nitro'], dayMult: 1.3, nightMult: 0.6, harvests: 1,
      colors: { leaf: '#6cbf52', leaf2: '#4a9a3f', accent: '#ffcf3f', seed: '#3a3028' }
    },
    {
      id: 'berry', name: 'Jamboree Berry', latin: 'Rubus partytime',
      blurb: 'Throws three parties per plant. Bring a basket each time.',
      quirk: 'Re-fruits after harvest: three harvests from a single seed.',
      growTime: 180, thirst: 1.2, water: [40, 85], value: 75, seedCost: 40, unlock: 1400,
      likes: ['jam'], dayMult: 1, nightMult: 1, harvests: 3, regrow: 0.45,
      colors: { leaf: '#4fa35a', leaf2: '#357f48', accent: '#d9366f', seed: '#7a2a4a' }
    },
    {
      id: 'shroom', name: 'Glimmercap', latin: 'Fungus nightlightii',
      blurb: 'Glows softly, hums occasionally, and is definitely not a plant.',
      quirk: 'Grows 60% faster at night. Likes it damp.',
      growTime: 200, thirst: 1.4, water: [55, 100], value: 190, seedCost: 70, unlock: 6000,
      likes: ['gel'], dayMult: 0.8, nightMult: 1.6, harvests: 1,
      colors: { leaf: '#f2ead8', leaf2: '#d9cdb4', accent: '#58e6d9', seed: '#b9a98a' }
    },
    {
      id: 'orchid', name: 'Moonveil Orchid', latin: 'Orchis fussypantsia',
      blurb: 'Elegant, slow, and extremely particular about its bathwater.',
      quirk: 'Narrow comfy zone and a long wait, but worth a small fortune.',
      growTime: 420, thirst: 0.8, water: [40, 72], value: 620, seedCost: 220, unlock: 30000,
      likes: ['tonic'], dayMult: 1, nightMult: 1, harvests: 1,
      colors: { leaf: '#5aa56a', leaf2: '#3d8554', accent: '#c79bff', seed: '#6a5a7a' }
    },
    {
      id: 'lotus', name: 'Stardust Lotus', latin: 'Nelumbo cosmica',
      blurb: 'Fell out of the night sky, landed in a pot, and decided to stay.',
      quirk: 'Legendary. A fine bloom (4 stars or better) also yields Sunshine.',
      growTime: 900, thirst: 1.0, water: [45, 78], value: 3000, seedCost: 1200,
      unlock: 250000, unlockSun: 5, sunshine: 2,
      likes: ['jam', 'gel'], dayMult: 1, nightMult: 1.15, harvests: 1,
      colors: { leaf: '#4fb3a5', leaf2: '#2f8f8a', accent: '#ff9fe0', seed: '#5a6ad0' }
    }
  ];

  // ------------------------------------------------------------------
  // Nutrients. "shape" is used for colour-blind friendly pips.
  // ------------------------------------------------------------------
  CONFIG.NUTRIENTS = [
    {
      id: 'nitro', name: 'Nitro-Bloom Fizz', short: 'Nitro', shape: 'circle', color: '#f2b53a',
      cost: 6, powUpgrade: 'nitroPow', key: 'Q',
      effect: 'Growth +50% while active.',
      blurb: 'Carbonated plant espresso. Shake well, stand back.'
    },
    {
      id: 'gel', name: 'Gulp-Gel', short: 'Gel', shape: 'square', color: '#4aa8e0',
      cost: 5, powUpgrade: 'gelPow', key: 'W',
      effect: 'Water drains 50% slower while active.',
      blurb: 'Wobbly blue jelly that holds on to water like a grudge.'
    },
    {
      id: 'jam', name: 'Glamour Jam', short: 'Jam', shape: 'triangle', color: '#e0629b',
      cost: 10, powUpgrade: 'jamPow', key: 'E',
      effect: 'Raises quality (and sell price) while the plant grows.',
      blurb: 'A spa treatment in a jar. Plants come out positively smug.'
    },
    {
      id: 'tonic', name: 'Bug-Off Tonic', short: 'Tonic', shape: 'diamond', color: '#58b368',
      cost: 8, powUpgrade: 'tonicPow', key: 'R',
      effect: 'Heals the plant, evicts pests and keeps new ones away.',
      blurb: 'Smells of mint and mild threats. Bugs read the label and leave.'
    }
  ];

  // Rare consumable, only from the travelling merchant, orders and the Special tab.
  CONFIG.CRUMBS = {
    id: 'crumbs', name: 'Comet Crumbs', short: 'Crumbs', shape: 'star', color: '#a58bff', key: 'T',
    effect: 'Instantly adds 25% growth and a permanent pinch of quality.',
    blurb: 'Swept up from under a shooting star. Do not eat. (It tastes purple.)',
    sunCost: 1, sunQty: 2
  };

  CONFIG.SYNERGIES = [
    { id: 'juicy', name: 'Juicy Boost', a: 'nitro', b: 'gel', desc: 'Nitro + Gel: another +25% growth.' },
    { id: 'spa', name: 'Spa Day', a: 'jam', b: 'tonic', desc: 'Jam + Tonic: extra quality and gentle healing.' }
  ];

  // ------------------------------------------------------------------
  // Upgrades. cost(level) = round(cost * mult^level).
  // value(level) = base + per * level (or values[level]), described by fmt(value).
  // requires: { upgrade, level } | { pots } | { harvests }
  // capPerPrestige / maxCap: the max level rises by capPerPrestige for every
  // prestige level, up to maxCap.
  // currency: 'coins' (default, reset by a New Season), 'sunshine' or
  // 'heirlooms' (both kept forever).
  // ------------------------------------------------------------------
  CONFIG.UPGRADE_CATEGORIES = [
    { id: 'tools', name: 'Tools' },
    { id: 'nutrients', name: 'Nutrients' },
    { id: 'barn', name: 'Barn' },
    { id: 'auto', name: 'Helpers' },
    { id: 'economy', name: 'Economy' },
    { id: 'combat', name: 'Combat' },
    { id: 'sunshine', name: 'Sunshine' }
  ];

  CONFIG.UPGRADES = [
    // ---- Tools ----
    { id: 'spout', cat: 'tools', name: 'Gentle Rose Spout', max: 1, cost: 60, mult: 1, base: 0, per: 1,
      desc: 'A fine rose for the can. Manual watering can no longer push a plant past its comfy zone.', fmt: onOff },
    { id: 'can', cat: 'tools', name: 'Bigger Watering Can', max: 5, capPerPrestige: 1, maxCap: 8, cost: 45, mult: 2.1, base: 34, per: 8,
      desc: 'More water per pour, so thirsty plants need fewer visits.',
      fmt: function (v) { return v + ' water per pour'; }, requires: { upgrade: 'spout', level: 1 } },
    { id: 'splash', cat: 'tools', name: 'Splash Zone', max: 2, cost: 180, mult: 4, base: 0, per: 0.5,
      desc: 'Each pour also splashes the pots to the left and right.',
      fmt: function (v) { return v > 0 ? 'Neighbours get ' + pct(v) : 'No splash'; }, requires: { upgrade: 'spout', level: 1 } },
    { id: 'whistle', cat: 'tools', name: 'Water-All Whistle', max: 1, cost: 350, mult: 1, base: 0, per: 1,
      desc: 'Unlocks the "Water thirsty" button: one tap tops up every thirsty plant (uses tank water).',
      fmt: onOff, requires: { pots: 6 } },
    { id: 'scythe', cat: 'tools', name: 'Harvest-All Scythe', max: 1, cost: 300, mult: 1, base: 0, per: 1,
      desc: 'Unlocks the "Harvest all" button: gather every ripe plant in one swoosh.',
      fmt: onOff, requires: { harvests: 25 } },

    // ---- Nutrients ----
    { id: 'nitroPow', cat: 'nutrients', name: 'Fizzier Nitro-Bloom', max: 5, capPerPrestige: 1, maxCap: 12, cost: 120, mult: 2.2, base: 0, per: 0.2,
      desc: 'Nitro-Bloom Fizz is more effective.', fmt: function (v) { return '+' + pct(v) + ' effect'; } },
    { id: 'gelPow', cat: 'nutrients', name: 'Thicker Gulp-Gel', max: 5, capPerPrestige: 1, maxCap: 12, cost: 100, mult: 2.2, base: 0, per: 0.2,
      desc: 'Gulp-Gel holds on to even more water.', fmt: function (v) { return '+' + pct(v) + ' effect'; } },
    { id: 'jamPow', cat: 'nutrients', name: 'Fancier Glamour Jam', max: 5, capPerPrestige: 1, maxCap: 12, cost: 160, mult: 2.2, base: 0, per: 0.2,
      desc: 'Glamour Jam adds more quality.', fmt: function (v) { return '+' + pct(v) + ' effect'; } },
    { id: 'tonicPow', cat: 'nutrients', name: 'Stronger Bug-Off', max: 5, capPerPrestige: 1, maxCap: 12, cost: 110, mult: 2.2, base: 0, per: 0.2,
      desc: 'Bug-Off Tonic heals faster.', fmt: function (v) { return '+' + pct(v) + ' effect'; } },
    { id: 'slowRelease', cat: 'nutrients', name: 'Slow-Release Pellets', max: 5, capPerPrestige: 1, maxCap: 10, cost: 200, mult: 2.3, base: 0, per: 0.2,
      desc: 'Every nutrient dose lasts longer.', fmt: function (v) { return '+' + pct(v) + ' duration'; } },
    { id: 'bulk', cat: 'nutrients', name: 'Bulk Contract', max: 5, capPerPrestige: 1, maxCap: 10, cost: 150, mult: 2, base: 10, per: 5,
      desc: 'The shop stocks more of each nutrient every morning.',
      fmt: function (v) { return v + ' of each per day'; } },

    // ---- Barn ----
    { id: 'slots', cat: 'barn', name: 'Extra Shelf Space', max: 16, cost: 35, mult: 1.5, base: 4, per: 1,
      desc: 'Adds another pot. The barn fills up and gains new decorations as it grows.',
      fmt: function (v) { return v + ' pots'; } },
    { id: 'tank', cat: 'barn', name: 'Bigger Water Tank', max: 8, capPerPrestige: 1, maxCap: 15, cost: 60, mult: 1.9, base: 220, per: 150,
      desc: 'The barrel in the corner holds more water.', fmt: function (v) { return v + ' capacity'; } },
    { id: 'pump', cat: 'barn', name: 'Rain Barrel Pump', max: 8, capPerPrestige: 1, maxCap: 15, cost: 80, mult: 1.9, base: 4, per: 2.5,
      desc: 'The water tank refills faster.', fmt: function (v) { return v + ' water / second'; } },
    { id: 'mulch', cat: 'barn', name: 'Mulch Blankets', max: 5, capPerPrestige: 1, maxCap: 9, cost: 90, mult: 2.2, base: 0, per: 0.08,
      desc: 'A snug layer of straw on every pot. Water evaporates more slowly for all plants.',
      fmt: function (v) { return '-' + pct(v) + ' water drain'; } },
    { id: 'lamps', cat: 'barn', name: 'Grow Lamps', max: 5, capPerPrestige: 1, maxCap: 12, cost: 220, mult: 2.6, base: 0, per: 0.08,
      desc: 'Rosy grow lamps hang from the beams and speed up every plant, day and night.',
      fmt: function (v) { return '+' + pct(v) + ' growth'; } },
    { id: 'soil', cat: 'barn', name: 'Premium Potting Soil', max: 5, capPerPrestige: 1, maxCap: 8, cost: 140, mult: 2.4, base: 0, per: 0.12,
      desc: 'Plants take less damage from neglect and recover faster.',
      fmt: function (v) { return pct(v) + ' tougher'; } },

    // ---- Helpers (automation) ----
    { id: 'sprinkler', cat: 'auto', name: 'Drip-o-Matic Sprinkler', max: 5, cost: 400, mult: 2.6, base: 0, per: 4,
      desc: 'Copper drip lines keep the first pots watered automatically (uses tank water).',
      fmt: function (v) { return v > 0 ? 'Covers ' + v + ' pots' : 'Not installed'; }, requires: { pots: 7 } },
    { id: 'hedgehog', cat: 'auto', name: 'Harvest Hedgehog', max: 3, cost: 900, mult: 3.5, base: 0, per: 1,
      desc: 'A diligent hedgehog harvests ripe plants for you. Higher levels make it quicker.',
      fmt: function (v) { return v > 0 ? 'Harvests after ' + CONFIG.AUTO.hedgehogDelays[v - 1] + 's' : 'Not hired'; },
      requires: { upgrade: 'scythe', level: 1 } },
    { id: 'squirrel', cat: 'auto', name: 'Seed Squirrel', max: 2, cost: 1500, mult: 5, base: 0, per: 1,
      desc: 'Replants empty pots with whatever grew there last. Level 2 also buys the seed if you have none.',
      fmt: function (v) { return v === 0 ? 'Not hired' : (v === 1 ? 'Replants from your seed bag' : 'Replants and buys seeds'); },
      requires: { upgrade: 'hedgehog', level: 1 } },
    { id: 'ladybugs', cat: 'auto', name: 'Ladybug Patrol', max: 3, cost: 500, mult: 3, base: 0, per: 1,
      desc: 'Ladybugs chase pests away on their own.',
      fmt: function (v) { return v > 0 ? 'Pests gone after ' + CONFIG.EVENTS.ladybugDelays[v - 1] + 's' : 'Not hired'; },
      requires: { harvests: 60 } },

    // ---- Economy ----
    { id: 'stall', cat: 'economy', name: "Farmers' Market Stall", max: 10, capPerPrestige: 2, maxCap: 24, cost: 100, mult: 1.9, base: 0, per: 0.1,
      desc: 'A nicer stall means nicer prices for everything you harvest.',
      fmt: function (v) { return '+' + pct(v) + ' sell price'; } },
    { id: 'hat', cat: 'economy', name: 'Haggling Hat', max: 5, capPerPrestige: 1, maxCap: 8, cost: 150, mult: 2.4, base: 0, per: 0.05,
      desc: 'Seeds and nutrients cost less. It is a very persuasive hat.',
      fmt: function (v) { return '-' + pct(v) + ' shop prices'; } },
    { id: 'hammock', cat: 'economy', name: 'Cozy Hammock', max: 4, cost: 250, mult: 2.5, base: 0, per: 1,
      desc: 'The barn keeps working longer and better while you are away.',
      fmt: function (v) {
        return (CONFIG.OFFLINE.baseHours + v) + 'h offline at ' + pct(CONFIG.OFFLINE.baseEfficiency + 0.1 * v) + ' speed';
      } },
    { id: 'chalk', cat: 'economy', name: 'Fancy Chalkboard', max: 3, capPerPrestige: 1, maxCap: 8, cost: 300, mult: 3, base: 0, per: 0.25,
      desc: 'Customers tip better for chalkboard orders.',
      fmt: function (v) { return '+' + pct(v) + ' order rewards'; } },

    // ---- Combat (boss fights; unlock with the first New Season) ----
    { id: 'sharp', cat: 'combat', name: 'Shear Sharpness', max: 4, capPerPrestige: 3, maxCap: 25, capBonus: 'hSharp',
      cost: 200, mult: 1.85, base: 0, per: 1, requires: { prestige: 1 },
      desc: 'Sharper pruning shears. Your power (damage per snip) must beat a boss\'s armour, or your snips just bounce off.',
      fmt: function (v) { return shearText(v) + ' power per snip'; } },
    { id: 'snips', cat: 'combat', name: 'Swift Snips', max: 4, capPerPrestige: 1, maxCap: 10, cost: 1000, mult: 2.2, base: 0, per: 0.03,
      requires: { prestige: 1 },
      desc: 'Practised wrists. More snips land as critical hits for 2.5 times the damage.',
      fmt: function (v) { return pct(CONFIG.COMBAT.critBase + v) + ' critical chance'; } },
    { id: 'potency', cat: 'combat', name: 'Sprayer Potency', max: 4, capPerPrestige: 1, maxCap: 10, cost: 1500, mult: 2.2, base: 0, per: 0.25,
      requires: { prestige: 1 },
      desc: 'A stronger weed-killer mix for the sprayer burst and its lingering mist.',
      fmt: function (v) { return '+' + pct(v) + ' spray damage'; } },
    { id: 'nozzle', cat: 'combat', name: 'Quick-Pump Nozzle', max: 5, cost: 2000, mult: 2.5, base: 0, per: 0.08,
      requires: { prestige: 1 },
      desc: 'The sprayer is ready again sooner.',
      fmt: function (v) { return Math.round(CONFIG.COMBAT.sprayCooldown * (1 - v)) + 's spray cooldown'; } },
    { id: 'brigade', cat: 'combat', name: 'Hedgehog Brigade', max: 3, capPerPrestige: 1, maxCap: 10, cost: 3000, mult: 2.4, base: 0, per: 1,
      requires: { prestige: 1 },
      desc: 'Your hedgehog calls in friends who nibble at the boss on their own.',
      fmt: function (v) { return v ? v + (v === 1 ? ' hedgehog joins' : ' hedgehogs join') + ' the fight' : 'Nobody comes along'; } },
    { id: 'gloves', cat: 'combat', name: 'Thorn Gloves', max: 4, cost: 2500, mult: 2.6, base: 0, per: 0.15,
      requires: { prestige: 1 },
      desc: 'Thick leather gloves. Boss moves cost you less time and heal the boss less.',
      fmt: function (v) { return '-' + pct(v) + ' boss move penalties'; } },
    { id: 'swatter', cat: 'combat', name: 'Spore Swatter', max: 4, cost: 2000, mult: 2.5, base: 0, per: 0.2,
      requires: { prestige: 1 },
      desc: 'Spines, buds, spores and stars are bigger targets and take longer to hit.',
      fmt: function (v) { return '+' + pct(v) + ' time to swat'; } },
    { id: 'battleMulch', cat: 'combat', name: 'Battle Mulch', max: 4, cost: 5000, mult: 3, base: 0, per: 5,
      requires: { prestige: 1 },
      desc: 'Sticky mulch slows the boss down. Every fight lasts longer.',
      fmt: function (v) { return (CONFIG.COMBAT.fightTime + v) + 's per fight'; } },

    // ---- Sunshine (premium) ----
    { id: 'glaze', cat: 'sunshine', currency: 'sunshine', name: 'Sunshine Glaze', max: 5, cost: 3, mult: 1.5, base: 0, per: 0.2,
      desc: 'A sunny shimmer on every harvest. Stacks with the market stall.',
      fmt: function (v) { return '+' + pct(v) + ' sell price'; } },
    { id: 'chorus', cat: 'sunshine', currency: 'sunshine', name: 'Dawn Chorus', max: 5, cost: 3, mult: 1.5, base: 0, per: 0.12,
      desc: 'Birdsong in the rafters. Plants cannot help but grow along.',
      fmt: function (v) { return '+' + pct(v) + ' growth'; } },
    { id: 'clover', cat: 'sunshine', currency: 'sunshine', name: 'Lucky Clover', max: 3, cost: 2, mult: 1.6, base: 0, per: 0.04,
      desc: 'Raises the chance that a well-kept plant matures golden (triple price, +1 Sunshine).',
      fmt: function (v) { return pct(CONFIG.QUALITY.goldenChance + v) + ' golden chance'; } },
    { id: 'butler', cat: 'sunshine', currency: 'sunshine', name: 'Butler Bee', max: 1, cost: 6, mult: 1, base: 0, per: 1,
      desc: 'A very polite bee feeds each growing plant its favourite nutrient from your stock.',
      fmt: onOff, requires: { upgrade: 'sprinkler', level: 1 } },

    // ---- Heirloom (bought with Heirloom Seeds, never reset; shown in the Seasons screen) ----
    { id: 'hStart', cat: 'heirloom', currency: 'heirlooms', name: 'Nest Egg', max: 5, cost: 3, mult: 2,
      values: [0, 300, 2000, 10000, 50000, 250000],
      desc: 'Every new season starts with a pile of coins from the old one.',
      fmt: function (v) { return v ? 'Start with ' + v.toLocaleString('en-US') + ' extra coins' : 'No head start'; } },
    { id: 'hPots', cat: 'heirloom', currency: 'heirlooms', name: 'Inherited Shelves', max: 4, cost: 5, mult: 2, base: 0, per: 2,
      desc: 'Some shelves stay up between seasons.',
      fmt: function (v) { return v ? 'Start with ' + (CONFIG.START.slots + v) + ' pots' : 'Start with ' + CONFIG.START.slots + ' pots'; } },
    { id: 'hSpecies', cat: 'heirloom', currency: 'heirlooms', name: 'Seed Library', max: 5, cost: 4, mult: 2,
      values: [1, 3, 5, 6, 7, 8],
      desc: 'Keeps species unlocked between seasons, starting with the cheapest.',
      fmt: function (v) { return v > 1 ? 'Keep everything up to ' + CONFIG.SPECIES[v - 1].name : 'Only Pepperwink'; } },
    { id: 'hHelpers', cat: 'heirloom', currency: 'heirlooms', name: 'Loyal Helpers', max: 3, cost: 8, mult: 2.5, base: 0, per: 1,
      desc: 'Your tools and helpers stick around for the next season.',
      fmt: function (v) {
        return ['Nothing kept', 'Keep spout, whistle and scythe', '... plus sprinkler and hedgehog', '... plus squirrel and ladybugs'][v];
      } },
    { id: 'hGrow', cat: 'heirloom', currency: 'heirlooms', name: 'Deep Roots', max: 10, cost: 2, mult: 1.6, base: 0, per: 0.1,
      desc: 'Old roots, strong roots. Every plant grows faster, in every season.',
      fmt: function (v) { return '+' + pct(v) + ' growth'; } },
    { id: 'hSell', cat: 'heirloom', currency: 'heirlooms', name: 'Market Fame', max: 10, cost: 2, mult: 1.6, base: 0, per: 0.1,
      desc: 'People have heard of your barn. They pay more for anything from it.',
      fmt: function (v) { return '+' + pct(v) + ' sell price'; } },
    { id: 'hHeir', cat: 'heirloom', currency: 'heirlooms', name: 'Heirloom Harvest', max: 5, cost: 5, mult: 2, base: 0, per: 0.2,
      desc: 'Save more of the best seeds at the end of each season.',
      fmt: function (v) { return '+' + pct(v) + ' Heirloom Seeds'; } },
    { id: 'hLuck', cat: 'heirloom', currency: 'heirlooms', name: 'Four-Leaf Field', max: 3, cost: 4, mult: 2, base: 0, per: 0.02,
      desc: 'A field full of clover. Golden plants turn up more often.',
      fmt: function (v) { return '+' + pct(v) + ' golden chance'; } },
    { id: 'hShop', cat: 'heirloom', currency: 'heirlooms', name: 'Old Customer', max: 3, cost: 3, mult: 2, base: 0, per: 0.05,
      desc: 'The shopkeeper knows you by now. Seeds and nutrients are cheaper.',
      fmt: function (v) { return '-' + pct(v) + ' shop prices'; } },
    { id: 'hTank', cat: 'heirloom', currency: 'heirlooms', name: 'Spring Well', max: 3, cost: 2, mult: 2, base: 0, per: 0.5,
      desc: 'A spring under the barn. The water tank refills faster.',
      fmt: function (v) { return '+' + pct(v) + ' tank refill'; } },
    { id: 'hOrders', cat: 'heirloom', currency: 'heirlooms', name: 'Regulars', max: 3, cost: 3, mult: 2, base: 0, per: 0.25,
      desc: 'Customers who have come back for years tip generously.',
      fmt: function (v) { return '+' + pct(v) + ' order rewards'; } },
    { id: 'hNap', cat: 'heirloom', currency: 'heirlooms', name: 'Feather Pillow', max: 2, cost: 3, mult: 3, base: 0, per: 2,
      desc: 'The barn keeps working even longer while you are away.',
      fmt: function (v) { return '+' + v + 'h offline time'; } },
    { id: 'hSharp', cat: 'heirloom', currency: 'heirlooms', name: "Sharpener's Guild", max: 3, cost: 10, mult: 2, base: 0, per: 1,
      desc: 'A guild membership card. Shear Sharpness can go higher in every season.',
      fmt: function (v) { return '+' + v + ' max Shear Sharpness level'; } }
  ];

  // ------------------------------------------------------------------
  // Bosses: mutated plants in the Wild Patch.
  // prestige / sharp: needed to fight. hp / armor: at the boss's own prestige
  // (they grow per prestige level above it, see COMBAT). Damage stays between
  // attempts, and hp is set so that at the required level a boss takes a few
  // tries: see the boss table in tests/balance.js.
  // Move kinds: shield (snips blocked, combo lost), pods (targets to swat;
  // missed ones cost time or heal the boss), grab (sprayer disabled),
  // armorUp (armour x mult), snap (every snip costs `amount` seconds),
  // weak (your damage x mult; Bug-Off Tonic clears it).
  // ------------------------------------------------------------------
  CONFIG.BOSSES = [
    { id: 'thornzilla', name: 'Thornzilla', title: 'The Prickle That Got Away', prestige: 1, sharp: 3,
      hp: 105000, armor: 35, heirlooms: 5, color: '#6cbf4a', moveEvery: [7, 10],
      blurb: 'A Grumpy Prickle that drank a whole crate of Nitro-Bloom. Now it is grumpy AND enormous.',
      moves: [
        { kind: 'shield', name: 'Thorn Shield', dur: 3, text: 'Stop snipping until the shield drops, or you lose your combo!' },
        { kind: 'pods', name: 'Spine Volley', n: 3, life: 2.6, look: 'spine', effect: 'time', amount: 3, text: 'Swat the spines before they hit you!' }
      ] },
    { id: 'fernkraken', name: 'The Fernkraken', title: 'Terror of the Damp Corner', prestige: 2, sharp: 6,
      hp: 470000, armor: 145, heirlooms: 10, color: '#3d9a6a', moveEvery: [6, 9],
      blurb: 'A Drizzle Fern that never stopped drinking. Its fronds grab anything that moves.',
      moves: [
        { kind: 'grab', name: 'Frond Grab', dur: 6, text: 'A frond grabbed your sprayer!' },
        { kind: 'pods', name: 'Regrowth Buds', n: 3, life: 3, look: 'bud', effect: 'heal', amount: 0.03, text: 'Pop the buds before they heal it!' }
      ] },
    { id: 'snapdragon', name: 'Sir Snapdragon', title: 'Knight of the Flytrap Order', prestige: 4, sharp: 11,
      hp: 3600000, armor: 1500, heirlooms: 20, color: '#d9465a', moveEvery: [7, 10],
      blurb: 'A flytrap in leaf armour with a strict code of honour and a very big mouth.',
      moves: [
        { kind: 'armorUp', name: 'Leaf Plate', dur: 4, mult: 1.6, text: 'Its armour hardens! Only extra-sharp shears get through.' },
        { kind: 'snap', name: 'Snap Attack', dur: 1.8, amount: 1, text: 'Hands off while it snaps! Every snip costs a second.' }
      ] },
    { id: 'mold', name: 'Mother Mold', title: 'Queen of the Glimmer Caves', prestige: 5, sharp: 15,
      hp: 22000000, armor: 9800, heirlooms: 35, color: '#9a62c4', moveEvery: [5, 8],
      blurb: 'A Glimmercap the size of a shed. Every puff of spores is a new problem.',
      moves: [
        { kind: 'pods', name: 'Spore Pods', n: 5, life: 3.5, look: 'spore', effect: 'heal', amount: 0.025, text: 'Pop the spore pods before they burst!' },
        { kind: 'weak', name: 'Spore Fog', dur: 6, mult: 0.5, text: 'Spore fog halves your damage. Bug-Off Tonic clears it.' }
      ] },
    { id: 'eclipse', name: 'The Eclipse Lotus', title: 'The Star That Fell Wrong', prestige: 7, sharp: 19,
      hp: 160000000, armor: 64000, heirlooms: 60, color: '#ff8fd8', moveEvery: [6, 8],
      blurb: 'A Stardust Lotus that swallowed a shadow. Beautiful, ancient and deeply annoyed.',
      moves: [
        { kind: 'armorUp', name: 'Eclipse', dur: 5, mult: 1.4, text: 'Darkness hardens its petals!' },
        { kind: 'pods', name: 'Falling Stars', n: 4, life: 3, look: 'star', effect: 'time', amount: 2, text: 'Catch the falling stars!' }
      ],
      phase2: { at: 0.5, speed: 0.6, text: 'The Eclipse Lotus opens its second bloom!', moves: [
        { kind: 'shield', name: 'Void Bloom', dur: 3, text: 'A void shield! Hold your snips.' },
        { kind: 'pods', name: 'Shadow Seeds', n: 5, life: 2.8, look: 'seed', effect: 'heal', amount: 0.02, text: 'Pop the shadow seeds!' },
        { kind: 'armorUp', name: 'Total Eclipse', dur: 4, mult: 1.4, text: 'Total eclipse! Its armour hardens.' }
      ] } }
  ];

  // ------------------------------------------------------------------
  // Cosmetic pot paints (Shop > Special)
  // ------------------------------------------------------------------
  CONFIG.POT_STYLES = [
    { id: 'terracotta', name: 'Classic Terracotta', cost: 0, currency: 'coins', body: '#c9714b', rim: '#dd8a62', shade: '#a85839' },
    { id: 'blue', name: 'Blueberry Glaze', cost: 300, currency: 'coins', body: '#4f7fc4', rim: '#6f9be0', shade: '#3b63a0' },
    { id: 'moss', name: 'Mossy Stone', cost: 900, currency: 'coins', body: '#8a9a86', rim: '#a3b39c', shade: '#6c7c6b' },
    { id: 'candy', name: 'Candy Stripe', cost: 2, currency: 'sunshine', body: '#f6e7dc', rim: '#f2a3b8', shade: '#e88aa5', stripes: '#ee8fa9' },
    { id: 'gold', name: 'Gilded Fancy', cost: 5, currency: 'sunshine', body: '#e3b341', rim: '#f6d56a', shade: '#bb8a24' }
  ];

  // ------------------------------------------------------------------
  // Cat coats (Shop > Special). Purely cosmetic, paid in coins.
  // Flags: stripes (tabby), fluffy (long hair), points (Siamese mask), round (chubby face).
  // Optional colours: white (chest), muzzle, paws, tail, blaze (forehead), eye, nose.
  // ------------------------------------------------------------------
  CONFIG.CAT_SKINS = [
    { id: 'barn', name: 'Barn Cat', breed: 'Ginger tabby', cost: 0, stripes: true,
      fur: '#e59a4c', dark: '#c97a30', white: '#fff3e0', muzzle: '#fff3e0', paws: '#fff3e0' },
    { id: 'lexie', name: 'Lexie', breed: 'Cyperse (brown tabby)', cost: 50, stripes: true,
      fur: '#8f6e4c', dark: '#3b2c22', white: '#fff6ea', muzzle: '#fff6ea', paws: '#ffffff',
      eye: '#b9c45a', nose: '#e58f8a' },
    { id: 'maya', name: 'Maya', breed: 'Fluffy ginger', cost: 50, fluffy: true,
      fur: '#e8964a', dark: '#cf7a34', white: '#f6c690', muzzle: '#f9d9b0', paws: '#f2b06c', tail: '#e08a40',
      eye: '#c9a14a' },
    { id: 'alice', name: 'Alice', breed: 'Fluffy grey tabby', cost: 50, fluffy: true, stripes: true,
      fur: '#8f8474', dark: '#5b4f43', white: '#b7aa98', muzzle: '#c9b9a0', paws: '#a39684', tail: '#7a6f61',
      blaze: '#c98a52', eye: '#b7b25a', nose: '#c9837a' },
    { id: 'coco', name: 'Coco', breed: 'Siamese', cost: 50, points: true,
      fur: '#f1e3cb', dark: '#4a3528', white: '#fbf3e3', paws: '#4a3528',
      eye: '#5aa8e8', nose: '#5a4034' },
    { id: 'mosh', name: 'Mosh', breed: 'British Shorthair', cost: 50, round: true,
      fur: '#8f99a8', dark: '#737d8c', muzzle: '#a7b0bd', paws: '#a7b0bd',
      eye: '#e0922e', nose: '#6f7784' }
  ];

  // ------------------------------------------------------------------
  // Achievements. Done when value(state) >= goal. Each grants 1 Sunshine.
  // ------------------------------------------------------------------
  CONFIG.ACHIEVEMENT_REWARD = 1;
  CONFIG.ACHIEVEMENTS = [
    { id: 'first', name: 'First Bloom', desc: 'Harvest your first plant.', goal: 1, value: function (s) { return s.stats.harvests; } },
    { id: 'h25', name: 'Green Thumb', desc: 'Harvest 25 plants.', goal: 25, value: function (s) { return s.stats.harvests; } },
    { id: 'h200', name: 'Greener Thumb', desc: 'Harvest 200 plants.', goal: 200, value: function (s) { return s.stats.harvests; } },
    { id: 'h1000', name: 'Thumb of Legend', desc: 'Harvest 1,000 plants.', goal: 1000, value: function (s) { return s.stats.harvests; } },
    { id: 'c500', name: 'Pocket Money', desc: 'Earn 500 coins in total.', goal: 500, value: function (s) { return s.stats.coinsEarned; } },
    { id: 'c10k', name: 'Barn Baron', desc: 'Earn 10,000 coins in total.', goal: 10000, value: function (s) { return s.stats.coinsEarned; } },
    { id: 'c250k', name: 'Bloom Tycoon', desc: 'Earn 250,000 coins in total.', goal: 250000, value: function (s) { return s.stats.coinsEarned; } },
    { id: 'star5', name: 'Blue Ribbon', desc: 'Harvest a 5-star plant.', goal: 1, value: function (s) { return s.stats.fiveStars; } },
    { id: 'star5x25', name: 'County Fair Regular', desc: 'Harvest 25 five-star plants.', goal: 25, value: function (s) { return s.stats.fiveStars; } },
    { id: 'golden', name: 'Midas Thumb', desc: 'Harvest a golden plant.', goal: 1, value: function (s) { return s.stats.goldens; } },
    { id: 'botanist', name: 'Botanist', desc: 'Harvest every species at least once.', goal: 8,
      value: function (s) { var n = 0; for (var k in s.stats.bySpecies) { if (s.stats.bySpecies[k] > 0) n++; } return n; } },
    { id: 'pots10', name: 'Room to Grow', desc: 'Own 10 pots.', goal: 10, value: function (s) { return s.pots.length; } },
    { id: 'pots20', name: 'Full House', desc: 'Own all 20 pots.', goal: 20, value: function (s) { return s.pots.length; } },
    { id: 'order1', name: 'Special Delivery', desc: 'Complete a chalkboard order.', goal: 1, value: function (s) { return s.stats.ordersDone; } },
    { id: 'order15', name: 'Talk of the Town', desc: 'Complete 15 chalkboard orders.', goal: 15, value: function (s) { return s.stats.ordersDone; } },
    { id: 'cat', name: "Barn Cat's Best Friend", desc: 'Pet the barn cat 10 times.', goal: 10, value: function (s) { return s.stats.catPets; } },
    { id: 'bee', name: 'Honey Money', desc: 'Catch the lucky bee for a tip.', goal: 1, value: function (s) { return s.stats.beeClicks; } },
    { id: 'pest', name: 'Bug Bouncer', desc: 'Get rid of 5 pests.', goal: 5, value: function (s) { return s.stats.pestsBeaten; } },
    { id: 'events', name: 'Never a Dull Day', desc: 'Live through 10 random events.', goal: 10, value: function (s) { return s.stats.eventsSeen; } },
    { id: 'tinker', name: 'Tinkerer', desc: 'Buy 20 upgrade levels.', goal: 20, value: function (s) { return s.stats.upgradesBought; } },
    { id: 'feetup', name: 'Feet Up', desc: 'Own the sprinkler, the hedgehog and the squirrel.', goal: 3,
      value: function (s) {
        return (s.upgrades.sprinkler ? 1 : 0) + (s.upgrades.hedgehog ? 1 : 0) + (s.upgrades.squirrel ? 1 : 0);
      } },
    { id: 'lotus', name: 'Stargazer', desc: 'Harvest a Stardust Lotus.', goal: 1, value: function (s) { return s.stats.bySpecies.lotus || 0; } },
    { id: 'season1', name: 'A New Season', desc: 'Start your first New Season.', goal: 1, value: function (s) { return s.prestige; } },
    { id: 'season3', name: 'Seasoned Grower', desc: 'Reach prestige 3.', goal: 3, value: function (s) { return s.prestige; } },
    { id: 'season7', name: 'Evergreen', desc: 'Reach prestige 7.', goal: 7, value: function (s) { return s.prestige; } },
    { id: 'boss1', name: 'Weed Whacker', desc: 'Defeat Thornzilla.', goal: 1, value: function (s) { return s.trophies.thornzilla ? 1 : 0; } },
    { id: 'boss2', name: 'Frond Fighter', desc: 'Defeat The Fernkraken.', goal: 1, value: function (s) { return s.trophies.fernkraken ? 1 : 0; } },
    { id: 'boss3', name: 'Knight Errant', desc: 'Defeat Sir Snapdragon.', goal: 1, value: function (s) { return s.trophies.snapdragon ? 1 : 0; } },
    { id: 'boss4', name: 'Mold Breaker', desc: 'Defeat Mother Mold.', goal: 1, value: function (s) { return s.trophies.mold ? 1 : 0; } },
    { id: 'boss5', name: 'Eclipse Chaser', desc: 'Defeat The Eclipse Lotus.', goal: 1, value: function (s) { return s.trophies.eclipse ? 1 : 0; } }
  ];

  // ------------------------------------------------------------------
  // Palette (canvas). The DOM palette lives in css/style.css :root.
  // ------------------------------------------------------------------
  CONFIG.PALETTE = {
    woodDark: '#4e3224', wood: '#7b4f36', woodMid: '#96633f', woodLight: '#b9835a', woodPale: '#d6a878',
    hay: '#e9c765', hayDark: '#c99a3c', cream: '#fff3d6', ink: '#3a2a22',
    soil: '#5a3d2e', soilLight: '#74503a',
    water: '#58b7ea', waterDark: '#2f86c4', health: '#e8686b', growth: '#7bcf6a',
    wilt: '#b79c4c', dead: '#7a6a58', gold: '#ffd24a', glow: '#ffe9a8', lamp: '#ff9fd0',
    floor: '#a87449', floorDark: '#8b5c3a'
  };

  // Sky keyframes over one day: [phase, top colour, bottom colour, darkness 0..1]
  CONFIG.SKY = [
    [0.00, '#f4a39a', '#ffe1b0', 0.22],
    [0.07, '#8fd3f4', '#e3f6ff', 0.0],
    [0.46, '#86cdf2', '#e3f6ff', 0.0],
    [0.55, '#f08a5d', '#ffd28a', 0.16],
    [0.62, '#3b3b78', '#c06c84', 0.40],
    [0.70, '#131a3a', '#2a3566', 0.55],
    [0.93, '#131a3a', '#2a3566', 0.55],
    [1.00, '#f4a39a', '#ffe1b0', 0.22]
  ];

  // ---- Lookup tables --------------------------------------------------
  function indexById(list) {
    var map = {};
    for (var i = 0; i < list.length; i++) map[list[i].id] = list[i];
    return map;
  }
  CONFIG.SPECIES_BY_ID = indexById(CONFIG.SPECIES);
  CONFIG.NUTRIENTS_BY_ID = indexById(CONFIG.NUTRIENTS);
  CONFIG.UPGRADES_BY_ID = indexById(CONFIG.UPGRADES);
  CONFIG.POT_STYLES_BY_ID = indexById(CONFIG.POT_STYLES);
  CONFIG.CAT_SKINS_BY_ID = indexById(CONFIG.CAT_SKINS);
  CONFIG.BOSSES_BY_ID = indexById(CONFIG.BOSSES);
  CONFIG.ACHIEVEMENTS_BY_ID = indexById(CONFIG.ACHIEVEMENTS);

  BB.CONFIG = CONFIG;
  if (typeof module !== 'undefined' && module.exports) module.exports = BB;
})(typeof window !== 'undefined' ? window : globalThis);
