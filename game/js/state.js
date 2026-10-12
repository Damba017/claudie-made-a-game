/*
 * Barn Bloom - state.js
 * ------------------------------------------------------------------
 * Plain-data factories for the game state. No DOM, no logic.
 * Everything in here must survive JSON.stringify / JSON.parse.
 */
(function (root) {
  'use strict';
  var BB = root.BB = root.BB || {};
  var C = BB.CONFIG;
  var S = {};

  /** A fresh plant of the given species (see README for the data model). */
  S.newPlant = function (speciesId) {
    var sp = C.SPECIES_BY_ID[speciesId];
    return {
      species: speciesId,
      growth: 0,                              // 0..1, mature at 1
      water: sp.water[0] + C.WATER.plantStart,
      nutrients: { nitro: 0, gel: 0, jam: 0, tonic: 0 },
      health: 100,
      qSum: 0, qTime: 0, qBonus: 0,           // quality = qSum / qTime + qBonus
      age: 0,
      ripeAge: 0,                             // seconds since maturity
      pest: 0,                                // remaining "shoo" clicks, 0 = no pest
      pestT: 0,
      dead: false,
      golden: false,
      harvestsLeft: sp.harvests || 1
    };
  };

  S.newPot = function () {
    return { plant: null, memo: null, idle: 0 };
  };

  S.newStats = function () {
    return {
      harvests: 0, coinsEarned: 0, bySpecies: {}, bestQuality: {},
      goldens: 0, fiveStars: 0, deaths: 0, ordersDone: 0, catPets: 0, beeClicks: 0,
      pestsBeaten: 0, eventsSeen: 0, upgradesBought: 0, watered: 0, fed: 0, planted: 0
    };
  };

  S.newGame = function () {
    var state = {
      version: C.VERSION,
      createdAt: Date.now(),
      lastSeen: Date.now(),
      time: 0,                                // game seconds, drives the day/night clock
      playTime: 0,
      coins: C.START.coins,
      sunshine: 0,
      tank: C.TANK.capacity,
      pots: [],
      seeds: {},
      nutrients: { nitro: 0, gel: 0, jam: 0, tonic: 0 },
      crumbs: 0,
      shopStock: {},
      stockDay: 1,
      unlocked: { mint: true },
      discovered: { species: {}, nutrients: {} },
      upgrades: {},
      events: { next: C.EVENTS.firstDelay, heat: 0, rain: 0, bee: 0, beeClicked: false, merchant: 0, offer: null },
      orders: [],
      orderCooldown: [],
      orderSeq: 1,
      achievements: {},
      potStyle: 'terracotta',
      potStyles: { terracotta: true },
      cat: false,
      tutorial: { step: 0, done: false },
      stats: S.newStats(),
      secondAcc: 0
    };
    var i, k;
    for (i = 0; i < C.START.slots; i++) state.pots.push(S.newPot());
    for (k in C.START.seeds) state.seeds[k] = C.START.seeds[k];
    for (k in C.START.nutrients) {
      state.nutrients[k] = C.START.nutrients[k];
      state.discovered.nutrients[k] = true;
    }
    for (i = 0; i < C.NUTRIENTS.length; i++) state.shopStock[C.NUTRIENTS[i].id] = C.NUTRIENT.baseStock;
    for (i = 0; i < C.ORDERS.count; i++) { state.orders.push(null); state.orderCooldown.push(5 + i * 12); }
    return state;
  };

  /** A pretty, fully grown showcase barn used behind the main menu. */
  S.demo = function () {
    var state = S.newGame();
    var show = ['mint', 'sunflower', 'fern', 'shroom', 'cactus', 'orchid', 'berry', 'lotus', 'mint', 'sunflower'];
    var growth = [1, 1, 0.8, 1, 1, 1, 1, 1, 0.3, 0.6];
    state.pots = [];
    for (var i = 0; i < show.length; i++) {
      var pot = S.newPot();
      pot.plant = S.newPlant(show[i]);
      pot.plant.growth = growth[i];
      pot.plant.water = (C.SPECIES_BY_ID[show[i]].water[0] + C.SPECIES_BY_ID[show[i]].water[1]) / 2;
      pot.plant.qSum = 0.8; pot.plant.qTime = 1;
      state.pots.push(pot);
    }
    state.upgrades = { slots: 6, lamps: 2, sprinkler: 1, hedgehog: 1, squirrel: 1 };
    state.cat = true;
    state.time = C.DAY_LENGTH * 0.3;
    return state;
  };

  BB.State = S;
  if (typeof module !== 'undefined' && module.exports) module.exports = BB;
})(typeof window !== 'undefined' ? window : globalThis);
