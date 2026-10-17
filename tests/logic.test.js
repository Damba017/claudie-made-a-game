/*
 * Barn Bloom - logic tests
 * ------------------------------------------------------------------
 * Tests the pure game logic (no DOM). Runs in two ways:
 *   - open tests/tests.html in a browser, or
 *   - node tests/logic.test.js
 */
(function (root) {
  'use strict';
  var BB;
  if (typeof module !== 'undefined' && module.exports && typeof require === 'function' && !root.BB) {
    require('../js/config.js'); require('../js/state.js'); require('../js/logic.js'); require('../js/combat.js'); require('../js/save.js');
  }
  BB = root.BB;
  var C = BB.CONFIG, S = BB.State, L = BB.Logic, Save = BB.Save;

  var results = { passed: 0, failed: 0, lines: [] };
  function test(name, fn) {
    L.rng = seeded(12345);
    L.drain();
    try { fn(); results.passed++; results.lines.push('  ok    ' + name); }
    catch (err) { results.failed++; results.lines.push('  FAIL  ' + name + '\n        ' + (err && err.message ? err.message : err)); }
  }
  function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
  function near(a, b, tol, msg) { assert(Math.abs(a - b) <= tol, (msg || 'not close') + ': got ' + a + ', expected ' + b + ' +/- ' + tol); }

  /** Small deterministic RNG (mulberry32). */
  function seeded(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  var QUIET = { events: false, offline: false };
  function run(state, seconds, each, dt) {
    dt = dt || C.TICK;
    var steps = Math.round(seconds / dt);
    for (var i = 0; i < steps; i++) { L.tick(state, dt, QUIET); if (each) each(i * dt); }
  }
  /** Keeps every living plant in the middle of its comfy zone (a perfect gardener). */
  function pamper(state) {
    for (var i = 0; i < state.pots.length; i++) {
      var p = state.pots[i].plant;
      if (p && !p.dead) { var sp = L.species(p); p.water = (sp.water[0] + sp.water[1]) / 2; }
    }
  }
  function fresh(species) {
    var st = S.newGame();
    st.seeds[species || 'mint'] = 10;
    st.unlocked[species || 'mint'] = true;
    return st;
  }

  // ------------------------------------------------------------------
  test('content meets the definition of done', function () {
    assert(C.SPECIES.length >= 6, 'need 6+ species');
    assert(C.NUTRIENTS.length >= 3, 'need 3+ nutrients');
    assert(C.UPGRADES.length >= 15, 'need 15+ upgrades');
    var cats = {};
    C.UPGRADES.forEach(function (u) { cats[u.cat] = true; assert(typeof u.fmt(L.upgradeValue(u.id, 0)) === 'string', u.id + ' fmt'); });
    assert(Object.keys(cats).length >= 5, 'upgrades span 5+ categories');
    assert(C.ACHIEVEMENTS.length >= 10, 'achievements exist');
    C.SPECIES.forEach(function (sp) {
      sp.likes.forEach(function (id) { assert(C.NUTRIENTS_BY_ID[id], sp.id + ' likes unknown nutrient ' + id); });
      assert(sp.water[0] < sp.water[1] && sp.water[1] <= C.WATER.max, sp.id + ' water zone');
    });
    C.UPGRADES.forEach(function (u) {
      if (u.requires && u.requires.upgrade) assert(C.UPGRADES_BY_ID[u.requires.upgrade], u.id + ' requires unknown upgrade');
    });
  });

  test('a new game has the starter kit', function () {
    var st = S.newGame();
    assert(st.pots.length === C.START.slots, 'pots');
    assert(st.coins === C.START.coins, 'coins');
    assert(st.seeds.mint === C.START.seeds.mint, 'mint seeds');
    assert(st.unlocked.mint, 'mint unlocked');
  });

  test('planting uses a seed and fills the pot', function () {
    var st = fresh();
    var r = L.plant(st, 0, 'mint');
    assert(r.ok && st.pots[0].plant.species === 'mint', 'planted');
    assert(st.seeds.mint === 9, 'seed used');
    assert(!L.plant(st, 0, 'mint').ok, 'cannot plant in an occupied pot');
    st.seeds.mint = 0;
    assert(L.plant(st, 1, 'mint').reason === 'noseed', 'needs a seed');
  });

  test('water drains over time at the species rate', function () {
    var st = fresh();
    L.plant(st, 0, 'mint');
    var before = st.pots[0].plant.water;
    run(st, 10);
    near(before - st.pots[0].plant.water, C.WATER.baseDrain * 10, 0.2, 'mint drain in 10s');
    var st2 = fresh('fern');
    L.plant(st2, 0, 'fern');
    var b2 = st2.pots[0].plant.water;
    run(st2, 10);
    assert(b2 - st2.pots[0].plant.water > (before - st.pots[0].plant.water) * 1.5, 'fern is thirstier than mint');
  });

  test('a well-watered plant grows through the stages and matures', function () {
    var st = fresh();
    L.plant(st, 0, 'mint');
    var seen = {};
    run(st, 60, function () { pamper(st); seen[L.stage(st.pots[0].plant)] = true; });
    assert(seen.seed && seen.sprout && seen.young && seen.mature, 'saw stages: ' + Object.keys(seen).join(','));
    assert(st.pots[0].plant.growth === 1, 'mature');
  });

  test('mint matures in roughly its grow time', function () {
    var st = fresh();
    L.plant(st, 0, 'mint');
    var t = 0;
    while (st.pots[0].plant.growth < 1 && t < 200) { pamper(st); L.tick(st, C.TICK, QUIET); t += C.TICK; }
    near(t, C.SPECIES_BY_ID.mint.growTime, 2, 'time to mature');
  });

  test('a dry plant stops growing, loses health and dies; the pot can be cleared', function () {
    var st = fresh();
    L.plant(st, 0, 'mint');
    var p = st.pots[0].plant;
    p.water = 0;
    var g = p.growth;
    run(st, 5);
    assert(p.growth === g, 'no growth when parched');
    assert(p.health < 100, 'health drops at zero water');
    run(st, 200);
    assert(p.dead, 'dies eventually');
    assert(L.stage(p) === 'dead', 'stage dead');
    assert(!L.harvest(st, 0).ok, 'cannot harvest a dead plant');
    assert(L.clear(st, 0).ok && st.pots[0].plant === null, 'cleared');
    assert(st.stats.deaths === 1, 'death counted');
  });

  test('overwatering is possible and slightly harmful', function () {
    var st = fresh('cactus');
    L.plant(st, 0, 'cactus');
    var p = st.pots[0].plant;
    L.water(st, 0); L.water(st, 0); L.water(st, 0);
    assert(L.isSoggy(p), 'cactus is soggy after three pours: ' + p.water);
    assert(L.care(p) < 1, 'care suffers');
    run(st, 20);
    assert(p.health < 100, 'soggy plants lose health');
    assert(C.HEALTH.soggyDamage < C.HEALTH.dryDamage, 'but less than drought');
  });

  test('the rose spout prevents manual overwatering', function () {
    var st = fresh('cactus');
    st.upgrades.spout = 1;
    L.plant(st, 0, 'cactus');
    for (var i = 0; i < 6; i++) L.water(st, 0);
    var p = st.pots[0].plant;
    assert(p.water <= C.SPECIES_BY_ID.cactus.water[1] + 0.001, 'capped at comfy max: ' + p.water);
    assert(L.water(st, 0).reason === 'full', 'reports full');
  });

  test('watering uses the tank, and an empty tank stops it', function () {
    var st = fresh();
    L.plant(st, 0, 'mint');
    st.pots[0].plant.water = 10;
    var tank = st.tank;
    var r = L.water(st, 0);
    near(tank - st.tank, r.added, 0.001, 'tank pays for the pour');
    st.tank = 0;
    st.pots[0].plant.water = 10;
    assert(L.water(st, 0).reason === 'tank', 'no water without tank');
    run(st, 5);
    assert(st.tank > 0, 'tank refills');
    st.tank = 1e9; run(st, 1);
    assert(st.tank <= L.tankCapacity(st), 'tank is capped');
  });

  test('better care gives higher quality and a higher price', function () {
    var good = fresh(), bad = fresh();
    L.plant(good, 0, 'mint'); L.plant(bad, 0, 'mint');
    run(good, 60, function () { pamper(good); });
    // The neglected one is kept dry and sickly, just above the point where growth stops.
    var guard = 0;
    while (bad.pots[0].plant.growth < 1 && guard++ < 6000) { bad.pots[0].plant.water = 16; bad.pots[0].plant.health = 60; L.tick(bad, C.TICK, QUIET); }
    assert(bad.pots[0].plant.growth === 1, 'neglected plant still matured');
    var qg = L.quality(good.pots[0].plant), qb = L.quality(bad.pots[0].plant);
    assert(qg > qb + 0.2, 'quality ' + qg + ' vs ' + qb);
    assert(L.sellValue(good, good.pots[0].plant) > L.sellValue(bad, bad.pots[0].plant), 'price follows quality');
    assert(L.stars(qg) === 4, 'perfect watering alone gives 4 stars, got ' + L.stars(qg));
  });

  test('harvest pays coins, empties the pot and updates stats', function () {
    var st = fresh();
    L.plant(st, 0, 'mint');
    assert(L.harvest(st, 0).reason === 'unripe', 'cannot harvest early');
    run(st, 60, function () { pamper(st); });
    var coins = st.coins, value = L.sellValue(st, st.pots[0].plant);
    var r = L.harvest(st, 0);
    assert(r.ok && r.coins === value && st.coins === coins + value, 'paid');
    assert(st.pots[0].plant === null && st.pots[0].memo === 'mint', 'pot empty, memo kept');
    assert(st.stats.harvests === 1 && st.stats.bySpecies.mint === 1, 'stats');
  });

  test('ripe plants lose value past their prime', function () {
    var st = fresh();
    L.plant(st, 0, 'mint');
    run(st, 60, function () { pamper(st); });
    var p = st.pots[0].plant, v1 = L.sellValue(st, p);
    run(st, L.primeWindow(L.species(p)) * 1.7, function () { pamper(st); });
    assert(L.stage(p) === 'overgrown', 'overgrown');
    var v2 = L.sellValue(st, p);
    assert(v2 < v1 && v2 >= v1 * C.GROWTH.overgrownFloor - 1, 'value decays to a floor: ' + v1 + ' -> ' + v2);
  });

  test('the Jamboree Berry gives three harvests from one seed', function () {
    var st = fresh('berry');
    L.plant(st, 0, 'berry');
    var harvests = 0;
    for (var round = 0; round < 3; round++) {
      var guard = 0;
      while (st.pots[0].plant && st.pots[0].plant.growth < 1 && guard++ < 5000) { pamper(st); L.tick(st, C.TICK, QUIET); }
      assert(L.harvest(st, 0).ok, 'harvest ' + (round + 1));
      harvests++;
    }
    assert(harvests === 3 && st.pots[0].plant === null, 'gone after the third harvest');
  });

  test('nutrients: nitro speeds growth, gel slows drain, jam adds quality', function () {
    var st1 = fresh('sunflower'), st2 = fresh('sunflower');
    st1.nutrients.nitro = 3;
    L.plant(st1, 0, 'sunflower'); L.plant(st2, 0, 'sunflower');
    assert(L.feed(st1, 0, 'nitro').ok, 'fed');
    assert(st1.nutrients.nitro === 2, 'inventory used');
    assert(L.growthRate(st1, st1.pots[0].plant) > L.growthRate(st2, st2.pots[0].plant) * 1.4, 'nitro boosts growth (loved by sunflower)');
    var g1 = fresh('mint'), g2 = fresh('mint');
    g1.nutrients.gel = 1;
    L.plant(g1, 0, 'mint'); L.plant(g2, 0, 'mint');
    L.feed(g1, 0, 'gel');
    near(L.drainRate(g1, g1.pots[0].plant), L.drainRate(g2, g2.pots[0].plant) * 0.5, 0.001, 'gel halves drain');
    var j1 = fresh('mint'), j2 = fresh('mint');
    j1.nutrients.jam = 2;
    L.plant(j1, 0, 'mint'); L.plant(j2, 0, 'mint');
    L.feed(j1, 0, 'jam');
    run(j1, 60, function () { pamper(j1); }); run(j2, 60, function () { pamper(j2); });
    assert(L.quality(j1.pots[0].plant) > L.quality(j2.pots[0].plant), 'jam raises quality');
    assert(L.stars(L.quality(j1.pots[0].plant)) === 5, 'jam makes 5 stars reachable');
  });

  test('nutrients wear off, cannot be wasted, and need stock', function () {
    var st = fresh();
    st.nutrients.nitro = 3;
    L.plant(st, 0, 'mint');
    L.feed(st, 0, 'nitro'); L.feed(st, 0, 'nitro');
    assert(L.feed(st, 0, 'nitro').reason === 'full', 'third dose refused');
    assert(st.nutrients.nitro === 1, 'not consumed when refused');
    run(st, 200, function () { pamper(st); });
    assert(st.pots[0].plant === null || st.pots[0].plant.nutrients.nitro === 0, 'worn off');
    st.nutrients.gel = 0;
    L.plant(st, 1, 'mint');
    assert(L.feed(st, 1, 'gel').reason === 'none', 'needs inventory');
  });

  test('synergies are detected', function () {
    var st = fresh();
    st.nutrients.nitro = 1; st.nutrients.gel = 1;
    L.plant(st, 0, 'mint');
    var base = L.growthRate(st, st.pots[0].plant);
    L.feed(st, 0, 'nitro');
    var withNitro = L.growthRate(st, st.pots[0].plant);
    L.feed(st, 0, 'gel');
    assert(L.synergies(st.pots[0].plant).indexOf('juicy') >= 0, 'juicy boost active');
    assert(L.growthRate(st, st.pots[0].plant) > withNitro && withNitro > base, 'synergy adds growth');
  });

  test('pests slow growth and hurt; tonic or shooing removes them', function () {
    var st = fresh();
    L.plant(st, 0, 'mint');
    var p = st.pots[0].plant;
    var normal = L.growthRate(st, p);
    assert(L.triggerEvent(st, 'pest') === 'pest' && p.pest > 0, 'pest lands on the only plant');
    near(L.growthRate(st, p), normal * C.GROWTH.pestSlow, 1e-9, 'slowed');
    run(st, 5, function () { pamper(st); });
    assert(p.health < 100, 'pest damages');
    for (var i = 0; i < C.EVENTS.pestHp; i++) L.shoo(st, 0);
    assert(p.pest === 0 && st.stats.pestsBeaten === 1, 'shooed by hand');
    L.triggerEvent(st, 'pest');
    st.nutrients.tonic = 1;
    L.feed(st, 0, 'tonic');
    run(st, 0.2);
    assert(p.pest === 0, 'tonic evicts the pest');
    assert(L.triggerEvent(st, 'pest') === 'bee', 'protected plants are skipped (falls back to a bee)');
  });

  test('events: heatwave drains faster, rain waters for free, bee boosts growth', function () {
    var st = fresh();
    L.plant(st, 0, 'mint');
    var p = st.pots[0].plant, d = L.drainRate(st, p), g = L.growthRate(st, p);
    L.triggerEvent(st, 'heat');
    near(L.drainRate(st, p), d * C.EVENTS.heatDrain, 1e-9, 'heat');
    L.triggerEvent(st, 'rain');
    assert(st.events.heat === 0, 'rain ends the heatwave');
    p.water = 5; st.tank = 0;
    run(st, 10);
    assert(p.water > 20, 'rain waters plants: ' + p.water);
    assert(p.water <= (L.species(p).water[0] + L.species(p).water[1]) / 2 + 0.01, 'rain never overwaters');
    assert(st.tank > 100, 'rain fills the tank');
    st.events.rain = 0;
    pamper(st);
    var before = L.growthRate(st, p);
    L.triggerEvent(st, 'bee');
    near(L.growthRate(st, p), before * C.EVENTS.beeGrowth, 1e-9, 'bee');
    assert(L.clickBee(st).ok && !L.clickBee(st).ok, 'bee tips once');
    assert(g > 0, 'sanity');
  });

  test('random events fire on their own and can be disabled', function () {
    var st = fresh();
    L.plant(st, 0, 'mint');
    for (var i = 0; i < 6000; i++) { pamper(st); L.tick(st, C.TICK, { events: false, offline: false }); }
    assert(st.stats.eventsSeen === 0, 'no events when disabled');
    for (i = 0; i < 6000; i++) { pamper(st); L.tick(st, C.TICK, { events: true, offline: false }); }
    assert(st.stats.eventsSeen >= 3, 'events happen: ' + st.stats.eventsSeen);
  });

  test('merchant offers can be bought once and expire', function () {
    var st = fresh();
    st.coins = 100000;
    L.triggerEvent(st, 'merchant');
    assert(st.events.offer && st.events.offer.price > 0, 'offer exists');
    assert(L.buyOffer(st).ok, 'bought');
    assert(L.buyOffer(st).reason === 'sold', 'only once');
    run(st, C.EVENTS.merchantDuration + 1);
    assert(st.events.offer === null && L.buyOffer(st).reason === 'gone', 'merchant leaves');
  });

  test('shop: seeds, nutrients, stock, discounts and unlocks', function () {
    var st = S.newGame();
    st.coins = 20;
    var cost = L.seedCost(st, 'mint');
    assert(L.buySeed(st, 'mint', 2).ok && st.coins === 20 - cost * 2, 'seed price');
    assert(L.buySeed(st, 'mint', 1000).reason === 'funds', 'cannot overspend');
    assert(L.buySeed(st, 'fern', 1).reason === 'locked', 'locked species');
    st.coins = 60;
    assert(L.unlockSpecies(st, 'fern').ok && st.coins === 0, 'unlock costs coins');
    st.coins = 1000;
    var stock = st.shopStock.nitro;
    assert(L.buyNutrient(st, 'nitro', stock + 1).reason === 'stock', 'limited stock');
    assert(L.buyNutrient(st, 'nitro', stock).ok && st.shopStock.nitro === 0, 'buys the shelf empty');
    assert(L.maxNutrient(st, 'nitro') === 0, 'max respects stock');
    run(st, C.DAY_LENGTH + 1);
    assert(st.shopStock.nitro === L.eff(st, 'bulk'), 'restocked the next morning');
    st.upgrades.hat = 5;
    assert(L.seedCost(st, 'fern') < C.SPECIES_BY_ID.fern.seedCost, 'haggling hat discount');
    assert(L.seedCost(st, 'mint') >= 1, 'never free');
    st.coins = 1e9;
    assert(L.unlockSpecies(st, 'lotus').reason === 'sunshine', 'lotus also needs sunshine');
  });

  test('upgrades: cost scales, effects apply, locks hold, max is respected', function () {
    var st = S.newGame();
    st.coins = 1e9;
    var c0 = L.upgradeCost(st, 'stall');
    assert(L.buyUpgrade(st, 'stall').ok, 'bought');
    assert(L.upgradeCost(st, 'stall') > c0, 'next level costs more');
    near(L.sellMultiplier(st), 1.1, 1e-9, 'sell boost');
    assert(L.buyUpgrade(st, 'can').reason === 'locked', 'can needs the spout');
    assert(typeof L.upgradeLock(st, 'can') === 'string', 'lock text');
    L.buyUpgrade(st, 'spout');
    assert(L.buyUpgrade(st, 'can').ok && L.pourAmount(st) === C.WATER.pour + 8, 'bigger can');
    var pots = st.pots.length;
    L.buyUpgrade(st, 'slots');
    assert(st.pots.length === pots + 1, 'new pot');
    while (L.buyUpgrade(st, 'slots').ok) { /* buy them all */ }
    assert(st.pots.length === C.MAX_SLOTS, 'max pots = ' + st.pots.length);
    assert(L.buyUpgrade(st, 'slots').reason === 'max', 'max reached');
    st.coins = 0;
    assert(L.buyUpgrade(st, 'tank').reason === 'funds', 'needs coins');
    assert(L.buyUpgrade(st, 'glaze').reason === 'funds', 'needs sunshine');
    st.sunshine = 3;
    assert(L.buyUpgrade(st, 'glaze').ok && st.sunshine === 0, 'sunshine upgrade');
  });

  test('water-all and harvest-all work once unlocked', function () {
    var st = fresh();
    for (var i = 0; i < 4; i++) L.plant(st, i, 'mint');
    assert(L.waterAll(st).reason === 'locked', 'locked');
    st.upgrades.whistle = 1; st.upgrades.scythe = 1;
    st.pots.forEach(function (pot) { pot.plant.water = 20; });
    var r = L.waterAll(st);
    assert(r.ok && r.count === 4, 'watered 4');
    st.pots.forEach(function (pot) { assert(!L.isSoggy(pot.plant) && !L.isThirsty(pot.plant), 'comfy after water-all'); });
    assert(L.waterAll(st).reason === 'none', 'nobody thirsty');
    assert(L.harvestAll(st).reason === 'none', 'nothing ripe');
    run(st, 60, function () { pamper(st); });
    var h = L.harvestAll(st);
    assert(h.ok && h.count === 4 && h.coins > 0, 'harvested 4');
  });

  test('automation: sprinkler, hedgehog and squirrel run the barn unattended', function () {
    var st = fresh();
    st.seeds.mint = 50;
    st.upgrades = { sprinkler: 1, hedgehog: 3, squirrel: 1, scythe: 1, pump: 4 };
    for (var i = 0; i < 4; i++) L.plant(st, i, 'mint');
    var coins = st.coins;
    run(st, 300);
    assert(st.stats.harvests >= 12, 'auto harvests: ' + st.stats.harvests);
    assert(st.coins > coins, 'earned coins');
    assert(st.stats.deaths === 0, 'nothing died');
    assert(st.seeds.mint < 50, 'squirrel used seeds');
    st.seeds.mint = 0; st.coins = 100; st.upgrades.squirrel = 2;
    run(st, 120);
    assert(L.livingCount(st) > 0, 'level 2 squirrel buys seeds');
  });

  test('ladybugs and the butler bee do their jobs', function () {
    var st = fresh();
    st.upgrades = { ladybugs: 3, butler: 1 };
    st.nutrients.nitro = 3;
    L.plant(st, 0, 'mint');
    run(st, 0.2);
    assert(st.pots[0].plant.nutrients.nitro > 0 && st.nutrients.nitro === 2, 'butler fed the favourite');
    st.pots[0].plant.nutrients.tonic = 0;
    L.triggerEvent(st, 'pest');
    run(st, C.EVENTS.ladybugDelays[2] + 1, function () { pamper(st); });
    assert(st.pots[0].plant.pest === 0, 'ladybugs cleared the pest');
  });

  test('golden plants pay triple and grant sunshine', function () {
    var st = fresh();
    L.plant(st, 0, 'mint');
    L.rng = function () { return 0; };
    run(st, 60, function () { pamper(st); });
    var p = st.pots[0].plant;
    assert(p.golden, 'golden with a lucky roll and good care');
    var value = L.sellValue(st, p);
    p.golden = false; var plain = L.sellValue(st, p); p.golden = true;
    near(value, plain * C.QUALITY.goldenMult, 2, 'triple price');
    var r = L.harvest(st, 0);
    assert(r.sunshine === 1 && st.sunshine >= 1 && st.stats.goldens === 1, 'sunshine granted');
  });

  test('orders are generated, filled by harvests and pay a reward', function () {
    var st = fresh();
    st.stats.harvests = C.ORDERS.unlockHarvests;
    run(st, 40);
    assert(st.orders[0] && st.orders[0].species === 'mint', 'order for an unlocked species');
    var o = st.orders[0];
    o.qty = 2; o.minStars = 1; o.done = 0; o.reward = 50; o.sun = 0; o.crumbs = 0;
    for (var i = 0; i < 2; i++) L.plant(st, i, 'mint');
    run(st, 60, function () { pamper(st); });
    var coins = st.coins;
    var a = L.harvest(st, 0), b = L.harvest(st, 1);
    assert(st.stats.ordersDone === 1, 'order done');
    assert(st.coins === coins + a.coins + b.coins + 50, 'sale plus reward');
    assert(st.orders[0] === null, 'slot cleared for the next customer');
    assert(L.skipOrder(st, 0).reason === 'none', 'nothing to skip');
  });

  test('achievements unlock and grant sunshine once', function () {
    var st = fresh();
    L.plant(st, 0, 'mint');
    run(st, 60, function () { pamper(st); });
    L.harvest(st, 0);
    run(st, 1.5);
    assert(st.achievements.first, 'First Bloom');
    var sun = st.sunshine;
    run(st, 3);
    assert(st.sunshine === sun, 'not granted twice');
  });

  test('safeguard: a broke player with nothing growing gets free seeds', function () {
    var st = S.newGame();
    st.coins = 0; st.seeds = {};
    run(st, 2);
    assert(st.seeds.mint >= 1, 'charity seeds arrived');
    var q = L.drain().filter(function (e) { return e.type === 'charity'; });
    assert(q.length === 1, 'announced once');
    // ...and with them the player can always earn again.
    L.plant(st, 0, 'mint');
    run(st, 60, function () { pamper(st); });
    assert(L.harvest(st, 0).ok && st.coins > 0, 'back in business');
  });

  test('the simulation is frame-rate independent (fixed step)', function () {
    var a = fresh(), b = fresh();
    L.plant(a, 0, 'mint'); L.plant(b, 0, 'mint');
    run(a, 30, null, 0.1); run(b, 30, null, 0.05);
    near(a.pots[0].plant.growth, b.pots[0].plant.growth, 0.01, 'growth');
    near(a.pots[0].plant.water, b.pots[0].plant.water, 0.5, 'water');
  });

  test('save round-trip keeps the whole state', function () {
    var st = fresh();
    st.coins = 1234; st.sunshine = 7; st.crumbs = 2;
    st.upgrades = { slots: 3, stall: 2, spout: 1 };
    for (var i = 0; i < 3; i++) st.pots.push(S.newPot());
    L.plant(st, 0, 'mint'); L.plant(st, 5, 'mint');
    st.nutrients.jam = 4;
    L.feed(st, 0, 'jam');
    run(st, 12.3, function () { pamper(st); });
    st.achievements.first = true;
    st.unlocked.fern = true;
    L.triggerEvent(st, 'merchant');
    var back = Save.parse(Save.serialize(st));
    assert(back, 'parsed');
    assert(back.coins === 1234 && back.sunshine === 7 && back.crumbs === 2, 'currencies');
    assert(back.pots.length === 7, 'pots');
    near(back.pots[0].plant.growth, st.pots[0].plant.growth, 1e-9, 'growth');
    near(back.pots[0].plant.nutrients.jam, st.pots[0].plant.nutrients.jam, 1e-9, 'nutrient level');
    assert(back.pots[5].plant.species === 'mint' && back.pots[1].plant === null, 'pot contents');
    assert(back.upgrades.stall === 2 && back.upgrades.slots === 3, 'upgrades');
    assert(back.achievements.first && back.unlocked.fern && back.unlocked.mint, 'flags');
    assert(back.events.offer && back.events.offer.title === st.events.offer.title, 'active merchant offer');
    near(back.time, st.time, 1e-9, 'clock');
    // The loaded state keeps simulating without trouble.
    run(back, 5);
  });

  test('export / import as a base64 string', function () {
    var st = fresh();
    st.coins = 4321;
    L.plant(st, 2, 'mint');
    var text = Save.exportString(st);
    assert(/^[A-Za-z0-9+/=]+$/.test(text), 'looks like base64');
    var back = Save.importString('  ' + text.slice(0, 20) + '\n' + text.slice(20) + '  ');
    assert(back && back.coins === 4321 && back.pots[2].plant.species === 'mint', 'imported (whitespace tolerated)');
  });

  test('corrupted or hostile saves never crash and never load nonsense', function () {
    var bad = ['', 'null', '{}', 'not json', '{"v":1}', '{"v":1,"state":5}', '[1,2,3]', '{"v":999,"state":{}}', '\u0000\u0001'];
    bad.forEach(function (text) { assert(Save.parse(text) === null, 'rejected: ' + JSON.stringify(text)); });
    assert(Save.importString('!!!not base64!!!') === null, 'bad base64');
    assert(Save.importString(null) === null, 'null import');
    var weird = Save.parse(JSON.stringify({ v: 1, state: {
      coins: 'lots', sunshine: -5, pots: [{ plant: { species: 'triffid' } }, { plant: { species: 'mint', growth: 99, water: -4, health: NaN } }, 7],
      upgrades: { stall: 9999, nonsense: 3, slots: 500 }, seeds: { mint: -3, alien: 9 }, events: 'x', orders: [{ species: 'nope' }], stats: { harvests: 'many' }
    } }));
    assert(weird, 'salvaged');
    assert(weird.coins === C.START.coins && weird.sunshine === 0, 'bad numbers replaced');
    assert(weird.pots.length <= C.MAX_SLOTS && weird.pots.length >= C.START.slots, 'pot count clamped: ' + weird.pots.length);
    assert(weird.pots[0].plant === null, 'unknown species dropped');
    var p = weird.pots[1].plant;
    assert(p.growth === 1 && p.water === 0 && p.health === 100, 'plant fields clamped');
    assert(weird.upgrades.stall === C.UPGRADES_BY_ID.stall.max && !weird.upgrades.nonsense, 'upgrades clamped');
    assert(weird.seeds.mint === 0 && weird.seeds.alien === undefined, 'seed map cleaned');
    assert(weird.orders[0] === null, 'bad order dropped');
    run(weird, 5);   // and it still runs
  });

  test('offline progress is capped, slowed and never kills plants', function () {
    var st = fresh();
    for (var i = 0; i < 4; i++) L.plant(st, i, 'mint');
    var sum = L.simulateOffline(st, 100 * 3600);
    var lim = L.offlineLimits(st);
    assert(sum.capped && sum.counted === lim.cap, 'capped at ' + lim.cap);
    near(sum.simulated, lim.cap * lim.efficiency, 1e-6, 'efficiency applied');
    assert(st.stats.deaths === 0 && L.livingCount(st) === 4, 'nobody died');
    assert(sum.ready === 4, 'plants matured and waited: ' + sum.ready);
    st.pots.forEach(function (pot) {
      assert(L.stage(pot.plant) === 'mature', 'ripe plants do not go past prime offline');
      assert(pot.plant.health > 99, 'no damage offline');
    });
    assert(st.stats.eventsSeen === 0, 'no random events offline');
    st.upgrades.hammock = 4;
    var lim2 = L.offlineLimits(st);
    assert(lim2.cap === 8 * 3600 && lim2.efficiency > lim.efficiency, 'hammock raises cap to 8h and speed');
  });

  test('offline progress with helpers earns coins and reports them', function () {
    var st = fresh();
    st.seeds.mint = 500;
    st.upgrades = { sprinkler: 1, hedgehog: 1, squirrel: 1, scythe: 1, pump: 4 };
    for (var i = 0; i < 4; i++) L.plant(st, i, 'mint');
    var coins = st.coins;
    L.drain();
    var sum = L.simulateOffline(st, 3600);
    assert(sum.harvests > 20, 'harvests while away: ' + sum.harvests);
    assert(sum.coins === st.coins - coins && sum.coins > 0, 'summary matches the purse');
    assert(L.drain().every(function (e) { return e.type === 'achievement' || e.type === 'catArrives'; }), 'no event spam after fast-forward');
    assert(L.simulateOffline(st, 0).simulated === 0, 'zero absence is a no-op');
  });

  test('mulch slows water drain', function () {
    var a = fresh(), b = fresh();
    b.upgrades.mulch = 5;
    L.plant(a, 0, 'mint'); L.plant(b, 0, 'mint');
    near(L.drainRate(b, b.pots[0].plant), L.drainRate(a, a.pots[0].plant) * 0.6, 1e-9, 'five levels cut 40%');
  });

  test('cat coats can be bought, worn and survive a save', function () {
    var st = S.newGame();
    assert(st.catSkin === 'barn' && st.catSkins.barn, 'starts as the barn cat');
    st.coins = 10;
    assert(L.buyCatSkin(st, 'lexie').reason === 'funds', 'needs coins');
    assert(L.buyCatSkin(st, 'nope').reason === 'unknown', 'unknown coat');
    st.coins = 120;
    assert(L.buyCatSkin(st, 'lexie').ok && st.coins === 70 && st.catSkin === 'lexie', 'bought before the cat arrives');
    assert(L.buyCatSkin(st, 'barn').ok && st.coins === 70, 'switching back is free');
    assert(L.buyCatSkin(st, 'lexie').ok && st.coins === 70, 'owned coats are not charged twice');
    var back = Save.parse(Save.serialize(st));
    assert(back.catSkin === 'lexie' && back.catSkins.lexie && !back.catSkins.coco, 'saved');
    var old = Save.parse(JSON.stringify({ v: 1, state: { coins: 5, catSkin: 'coco' } }));
    assert(old.catSkin === 'barn', 'an unowned coat in a save falls back to the barn cat');
    assert(C.CAT_SKINS.length === 6, 'six coats');
  });

  test('visit codes carry the barn but nothing spendable', function () {
    var st = fresh();
    st.coins = 9999; st.sunshine = 12; st.crumbs = 3; st.nutrients.jam = 7;
    st.barnName = Save.cleanName('  Lexie\'s <b>Barn</b>  ');
    st.upgrades = { slots: 2, lamps: 1 };
    st.pots.push(S.newPot()); st.pots.push(S.newPot());
    L.plant(st, 0, 'mint'); L.plant(st, 5, 'mint');
    st.pots[0].plant.growth = 1;
    st.cat = true; st.catSkins.lexie = true; st.catSkin = 'lexie';
    st.potStyles.blue = true; st.potStyle = 'blue';
    st.stats.harvests = 42;
    var code = Save.visitString(st);
    assert(code.indexOf('BARN-') === 0, 'has the BARN- prefix');
    var card = Save.parseVisit('  ' + code.slice(0, 30) + '\n' + code.slice(30) + ' ');
    assert(card, 'parsed (whitespace tolerated)');
    assert(card.name === 'Lexie\'s bBarn/b', 'name cleaned: ' + card.name);
    var v = card.state;
    assert(v.pots.length === 6 && v.pots[0].plant.growth === 1 && v.pots[5].plant.species === 'mint', 'plants travel');
    assert(v.catSkin === 'lexie' && v.cat && v.potStyle === 'blue' && v.upgrades.lamps === 1, 'looks travel');
    assert(v.stats.harvests === 42, 'bragging rights travel');
    assert(v.coins === C.START.coins && v.sunshine === 0 && v.crumbs === 0 && v.nutrients.jam === 0, 'no currency or stock travels');
    assert(st.coins === 9999, 'making a code does not change the barn');
    run(v, 3);   // a visited barn is a valid state
    assert(Save.parseVisit(Save.exportString(st)) === null, 'a save export is not a visit code');
    assert(Save.importString(code) === null, 'a visit code is not a save');
    ['', 'BARN-', 'BARN-!!!', 'BARN-' + 'e30=', null, 'hello'].forEach(function (bad) {
      assert(Save.parseVisit(bad) === null, 'rejected: ' + bad);
    });
    assert(Save.cleanName('') === 'My Barn' && Save.cleanName(42) === 'My Barn', 'empty names get a default');
    assert(Save.cleanName('x'.repeat(80)).length === 24, 'long names are cut');
  });

  test('gifts move items from one barn to another, once', function () {
    var a = S.newGame(), b = S.newGame();
    a.barnName = 'Lexie Farm';
    a.coins = 200; a.seeds = { mint: 5, orchid: 2 }; a.nutrients.jam = 4; a.crumbs = 1;
    assert(L.makeGift(a, {}).reason === 'empty', 'empty gift refused');
    assert(L.makeGift(a, { coins: -5, seeds: { mint: 0, alien: 9 } }).reason === 'empty', 'nonsense is an empty gift');
    assert(L.makeGift(a, { coins: 201 }).reason === 'short', 'cannot give more coins than you have');
    assert(L.makeGift(a, { seeds: { mint: 6 } }).reason === 'short' && a.seeds.mint === 5, 'cannot give more seeds, nothing taken');
    var r = L.makeGift(a, { coins: 50.9, seeds: { mint: 3, orchid: 2 }, nutrients: { jam: 4 }, crumbs: 1 });
    assert(r.ok, 'wrapped');
    assert(a.coins === 150 && a.seeds.mint === 2 && a.seeds.orchid === 0 && a.nutrients.jam === 0 && a.crumbs === 0, 'items left the sender');
    var code = Save.giftString(r.gift);
    assert(code.indexOf('GIFT-') === 0, 'has the GIFT- prefix');
    var gift = Save.parseGift(' ' + code.slice(0, 25) + '\n' + code.slice(25));
    assert(gift && gift.from === 'Lexie Farm' && gift.items.coins === 50, 'parsed (whitespace tolerated)');
    assert(L.openGift(a, gift).reason === 'own', 'the sender cannot open their own gift');
    var coins = b.coins;
    var o = L.openGift(b, gift);
    assert(o.ok && b.coins === coins + 50 && b.seeds.mint === C.START.seeds.mint + 3 && b.seeds.orchid === 2, 'coins and seeds arrived');
    assert(b.nutrients.jam === 4 && b.crumbs === 1 && b.discovered.nutrients.jam && b.discovered.nutrients.crumbs, 'nutrients arrived and are known');
    assert(L.openGift(b, gift).reason === 'used' && b.coins === coins + 50, 'a gift opens only once per barn');
    assert(L.plant(b, 0, 'orchid').ok, 'gifted seeds of a locked species can be planted');
    var b2 = Save.parse(Save.serialize(b)), a2 = Save.parse(Save.serialize(a));
    assert(L.openGift(b2, gift).reason === 'used' && L.openGift(a2, gift).reason === 'own', 'the memory survives saving');
    ['', 'GIFT-', 'GIFT-e30=', 'hello', null, Save.visitString(a), Save.exportString(a)].forEach(function (bad) {
      assert(Save.parseGift(bad) === null, 'rejected: ' + String(bad).slice(0, 12));
    });
    var forged = Save.parseGift(Save.giftString({ v: 1, kind: 'gift', id: 'abcdef123456', from: '<i>x</i>', items: { coins: 1e15, seeds: { mint: 1e9 } } }));
    assert(forged.items.coins === C.GIFTS.maxCoins && forged.items.seeds.mint === C.GIFTS.maxCount && forged.from === 'ix/i', 'forged amounts are capped, names cleaned');
    assert(Save.parseGift(Save.giftString({ v: 1, kind: 'gift', id: 'BAD ID!', items: { coins: 5 } })) === null, 'bad ids rejected');
    assert(L.openGift(b, { id: 'zzzzzz', items: {} }).reason === 'invalid', 'an empty gift cannot be opened');
  });

  test('trades swap items between two barns in three steps', function () {
    var a = S.newGame(), b = S.newGame();
    a.barnName = 'Anna'; b.barnName = 'Ben';
    a.coins = 100; a.seeds = { mint: 4 };
    b.coins = 30; b.seeds = {}; b.nutrients.jam = 5;
    assert(L.makeTrade(a, { seeds: { mint: 2 } }, {}).reason === 'empty', 'must ask for something');
    assert(L.makeTrade(a, {}, { coins: 5 }).reason === 'empty', 'must offer something');
    assert(L.makeTrade(a, { seeds: { mint: 9 } }, { coins: 5 }).reason === 'short', 'cannot offer more than you have');
    // 1. Anna offers 3 mint seeds + 20 coins for 2 jam.
    var r = L.makeTrade(a, { seeds: { mint: 3 }, coins: 20 }, { nutrients: { jam: 2 } });
    assert(r.ok && a.seeds.mint === 1 && a.coins === 80, 'the offer is set aside');
    var trade = Save.parseTrade(Save.tradeString(r.trade));
    assert(trade && trade.from === 'Anna' && trade.give.seeds.mint === 3 && trade.want.nutrients.jam === 2, 'trade code round-trip');
    assert(L.tradeProblem(a, trade) === 'own', 'Anna cannot accept her own offer');
    // 2. Ben accepts.
    var poor = S.newGame();
    assert(L.tradeProblem(poor, trade) === 'short' && L.acceptTrade(poor, trade).reason === 'short', 'needs the asked items');
    assert(L.tradeProblem(b, trade) === null, 'Ben can accept');
    var acc = L.acceptTrade(b, trade);
    assert(acc.ok && b.nutrients.jam === 3 && b.seeds.mint === 3 && b.coins === 50, 'Ben paid 2 jam and got seeds and coins');
    assert(L.acceptTrade(b, trade).reason === 'used' && b.nutrients.jam === 3, 'cannot accept twice');
    var deal = Save.parseDeal(Save.dealString(acc.deal));
    assert(deal && deal.id === r.id && deal.from === 'Ben', 'reply code round-trip');
    // 3. Anna enters the reply.
    assert(L.completeTrade(poor, deal).reason === 'unknown', 'a reply only works in the barn that made the offer');
    var a2 = Save.parse(Save.serialize(a));
    assert(a2.tradesOut[r.id] && a2.tradesOut[r.id].want.nutrients.jam === 2, 'open offers survive saving');
    var done = L.completeTrade(a2, deal);
    assert(done.ok && a2.nutrients.jam === 2 && !a2.tradesOut[r.id], 'Anna received her jam');
    assert(L.completeTrade(a2, deal).reason === 'unknown' && a2.nutrients.jam === 2, 'a reply works once');
    // A forged reply cannot ask for more than the original offer wanted.
    var forged = Save.parseDeal(Save.dealString({ v: 1, kind: 'deal', id: r.id, from: 'x', items: { coins: 999999 } }));
    var coins = a.coins;
    L.completeTrade(a, forged);
    assert(a.coins === coins && a.nutrients.jam === 2, 'the payout comes from the stored offer, not from the reply');
    // Cancelling gives the set-aside items back.
    var c = S.newGame(); c.coins = 40;
    var off = L.makeTrade(c, { coins: 25 }, { seeds: { fern: 1 } });
    assert(c.coins === 15 && L.cancelTrade(c, off.id).ok && c.coins === 40 && !c.tradesOut[off.id], 'cancelled');
    assert(L.cancelTrade(c, off.id).reason === 'unknown', 'cannot cancel twice');
    for (var i = 0; i < C.GIFTS.maxOpenTrades; i++) assert(L.makeTrade(c, { coins: 1 }, { coins: 1 }).ok, 'offer ' + i);
    assert(L.makeTrade(c, { coins: 1 }, { coins: 1 }).reason === 'toomany', 'open offers are limited');
    ['', 'TRADE-', 'TRADE-e30=', 'hello', Save.giftString({ v: 1, kind: 'gift', id: 'abcdef', items: { coins: 1 } })].forEach(function (bad) {
      assert(Save.parseTrade(bad) === null && Save.parseDeal(bad) === null, 'rejected: ' + bad.slice(0, 10));
    });
  });

  test('a New Season resets the barn but keeps the right things', function () {
    var st = fresh();
    st.barnName = 'Lexie Farm';
    st.coins = 5000; st.sunshine = 9; st.crumbs = 2; st.nutrients.jam = 6;
    st.upgrades = { stall: 4, lamps: 2, glaze: 2, chorus: 1, slots: 3 };
    for (var i = 0; i < 3; i++) st.pots.push(S.newPot());
    st.unlocked.fern = true; st.unlocked.cactus = true;
    st.achievements.first = true; st.catSkins.lexie = true; st.catSkin = 'lexie'; st.cat = true;
    st.potStyles.blue = true; st.potStyle = 'blue';
    L.plant(st, 0, 'mint');
    assert(!L.canPrestige(st) && L.heirloomGain(st) === 0 && L.prestige(st).reason === 'goal', 'not before the goal');
    // Earning by playing counts towards the goal; gifts do not.
    var g = S.newGame(); g.coins = 999999;
    var gift = L.makeGift(g, { coins: 999999 }).gift;
    L.openGift(st, gift);
    assert(st.seasonEarned === 0, 'gifted coins are not "earned"');
    run(st, 60, function () { pamper(st); });
    L.harvest(st, 0);
    assert(st.seasonEarned > 0 && st.seasonEarned === st.stats.coinsEarned, 'harvest coins count');
    st.seasonEarned = L.prestigeGoal(st) * 4;
    assert(L.canPrestige(st) && L.heirloomGain(st) === Math.floor(C.PRESTIGE.heirloomsAtGoal * 2), 'gain grows with the square root of earnings');
    var sun = st.sunshine;
    var r = L.prestige(st);
    assert(r.ok && r.heirlooms === 20, 'season started, 20 Heirloom Seeds');
    var n = r.state;
    assert(n.prestige === 1 && n.heirlooms === 20 && n.stats.heirloomsEarned === 20, 'prestige level and seeds');
    assert(n.coins === C.START.coins && n.pots.length === C.START.slots && n.crumbs === 0 && n.nutrients.jam === 0, 'coins, pots and stock reset');
    assert(!n.upgrades.stall && !n.upgrades.lamps && !n.upgrades.slots, 'coin upgrades reset');
    assert(n.upgrades.glaze === 2 && n.upgrades.chorus === 1 && n.sunshine === sun, 'Sunshine and its upgrades kept');
    assert(!n.unlocked.fern && n.unlocked.mint, 'species locked again');
    assert(n.achievements.first && n.catSkin === 'lexie' && n.cat && n.potStyle === 'blue' && n.barnName === 'Lexie Farm', 'cosmetics, awards, name kept');
    assert(n.seasonEarned === 0 && !n.seasonReady && n.tutorial.done, 'fresh season');
    assert(n.stats.harvests === st.stats.harvests, 'lifetime stats kept');
    near(L.sellMultiplier(n), (1 + 0.2 * 2) * 1.1, 1e-9, 'prestige adds 10% sell (with glaze 2)');
    assert(L.prestigeGoal(n) === C.PRESTIGE.firstGoal * C.PRESTIGE.goalMult, 'the next goal is higher');
    run(n, 3);
  });

  test('Heirloom upgrades give head starts in later seasons', function () {
    var st = S.newGame();
    st.heirlooms = 1000;
    ['hStart', 'hPots', 'hSpecies', 'hHelpers', 'hGrow'].forEach(function (id) {
      while (L.buyUpgrade(st, id).ok) { /* max it */ }
    });
    assert(L.level(st, 'hStart') === 5 && L.level(st, 'hHelpers') === 3, 'bought with Heirloom Seeds');
    st.seasonEarned = L.prestigeGoal(st);
    var n = L.prestige(st).state;
    assert(n.coins === C.START.coins + 250000, 'Nest Egg coins');
    assert(n.pots.length === C.START.slots + 8 && n.upgrades.slots === 8, 'Inherited Shelves');
    assert(C.SPECIES.every(function (sp) { return sp.rare ? !n.unlocked[sp.id] : n.unlocked[sp.id]; }), 'Seed Library keeps every shop species (never the rare ones)');
    ['spout', 'whistle', 'scythe', 'sprinkler', 'hedgehog', 'squirrel', 'ladybugs'].forEach(function (h) {
      assert(n.upgrades[h] === 1, 'Loyal Helpers keeps ' + h);
    });
    assert(L.level(n, 'hGrow') === 10, 'Heirloom upgrades never reset');
    var plain = fresh(); L.plant(plain, 0, 'mint'); n.seeds.mint = 1; L.plant(n, 0, 'mint');
    assert(L.growthRate(n, n.pots[0].plant) > L.growthRate(plain, plain.pots[0].plant) * 2, 'Deep Roots and prestige speed up growth');
    // Open trade offers must be settled first.
    var t = S.newGame(); t.coins = 100; t.seasonEarned = L.prestigeGoal(t);
    L.makeTrade(t, { coins: 50 }, { coins: 60 });
    assert(L.prestige(t).reason === 'trades', 'no New Season with open offers');
  });

  test('upgrade caps rise with prestige', function () {
    var st = S.newGame();
    st.coins = 1e15;
    while (L.buyUpgrade(st, 'stall').ok) { /* max it */ }
    assert(L.level(st, 'stall') === 10 && L.buyUpgrade(st, 'stall').reason === 'max', 'base cap 10');
    st.prestige = 3;
    assert(L.upgradeMax(st, 'stall') === 16 && L.buyUpgrade(st, 'stall').ok, 'cap 16 at prestige 3');
    st.prestige = 50;
    assert(L.upgradeMax(st, 'stall') === C.UPGRADES_BY_ID.stall.maxCap, 'never above maxCap');
    assert(L.upgradeMax(st, 'spout') === 1, 'one-off upgrades stay one-off');
    st.upgrades.lamps = 12;
    var back = Save.parse(Save.serialize(st));
    assert(back.upgrades.lamps === 12 && back.prestige === 50, 'raised levels survive saving');
    var legacy = Save.parse(JSON.stringify({ v: 1, state: { stats: { coinsEarned: 3000000 } } }));
    assert(legacy.seasonEarned === 3000000 && L.canPrestige(legacy), 'old saves count their past earnings as season one');
  });

  test('new shop plants: the prize Plumpkin, the heat-loving pepper and the brittle rose', function () {
    var shop = C.SPECIES.filter(function (sp) { return !sp.rare; }), rare = C.SPECIES.filter(function (sp) { return sp.rare; });
    assert(shop.length === 11 && rare.length === 4, '11 shop plants and 4 rare ones');
    for (var i = 1; i < shop.length; i++) assert(shop[i].unlock > shop[i - 1].unlock, shop[i].id + ' costs more to unlock than ' + shop[i - 1].id);
    assert(C.SPECIES.slice(-4).every(function (sp) { return sp.rare; }), 'rare plants sit at the end of the list');
    // Plumpkin: 5 stars doubles the price.
    var st = fresh('pumpkin');
    L.plant(st, 0, 'pumpkin');
    var p = st.pots[0].plant;
    p.qSum = 0.79; p.qTime = 1;
    var four = L.projectedValue(st, p);
    p.qSum = 0.81;
    var five = L.projectedValue(st, p);
    near(five / four, 2 * (0.5 + 1.5 * 0.81) / (0.5 + 1.5 * 0.79), 0.01, 'a prize pumpkin sells for double');
    // Firecracker Pepper grows twice as fast in a heatwave; others only drink more.
    var hp = fresh('pepper'); hp.seeds.mint = 1;
    L.plant(hp, 0, 'pepper'); L.plant(hp, 1, 'mint'); pamper(hp);
    var pe = hp.pots[0].plant, mi = hp.pots[1].plant, g0 = L.growthRate(hp, pe), m0 = L.growthRate(hp, mi);
    L.triggerEvent(hp, 'heat');
    near(L.growthRate(hp, pe), g0 * 2, 1e-9, 'pepper x2 in the heat');
    near(L.growthRate(hp, mi), m0, 1e-9, 'mint does not care');
    // Crystalbloom Rose has a short prime.
    assert(L.primeWindow(C.SPECIES_BY_ID.crystal) < L.primeWindow(C.SPECIES_BY_ID.lotus) / 2, 'the rose goes past its prime quickly');
    var rose = S.newGame(); rose.coins = 1e9; rose.sunshine = 100;
    assert(L.unlockSpecies(rose, 'crystal').ok && rose.sunshine === 100 - C.SPECIES_BY_ID.crystal.unlockSun, 'the rose costs coins and Sunshine');
  });

  test('rare plants: only from event offers, and only once the barn is ready', function () {
    var st = fresh();
    st.coins = 1e9;
    assert(L.unlockSpecies(st, 'lily').reason === 'rare' && L.buySeed(st, 'lily', 1).reason === 'rare', 'never in the shop');
    L.rng = function () { return 0; };              // every dice roll succeeds
    L.triggerEvent(st, 'rain');
    assert(st.events.rare === null, 'no offers before the Moonveil Orchid');
    st.unlocked[C.RARE.needs] = true;
    st.events.rain = 0;
    L.triggerEvent(st, 'rain');
    assert(st.events.rare && st.events.rare.species === 'lily' && st.events.rare.price === C.SPECIES_BY_ID.lily.price, 'rain brings a Rainbow Lily offer');
    var q = L.drain().filter(function (e) { return e.type === 'rareOffer'; });
    assert(q.length === 1, 'announced once');
    st.coins = 10;
    assert(L.buyRare(st).reason === 'funds' && st.events.rare, 'needs the coins, offer stays');
    st.coins = 1e9;
    assert(L.buyRare(st).ok && st.seeds.lily === 1 && st.events.rare === null, 'bought one bulb');
    assert(L.buyRare(st).reason === 'gone', 'only once');
    L.triggerEvent(st, 'heat');
    assert(st.events.rare.species === 'agave', 'a heatwave brings an Ember Agave');
    run(st, C.RARE.offerTime + 1);
    assert(st.events.rare === null, 'the offer moves on after a while');
    L.plant(st, 0, 'mint');                         // a pest needs a plant, or it turns into a bee visit
    L.triggerEvent(st, 'pest');
    assert(st.events.rare === null, 'pests bring nothing');
    var map = { rain: 'lily', heat: 'agave', bee: 'honey', merchant: 'mandrake' };
    for (var kind in map) assert(L.rareFor(kind).id === map[kind], kind + ' -> ' + map[kind]);
    // Rare plants never turn up in orders or the merchant's seed deals.
    var o = S.newGame(); o.unlocked = {};
    C.SPECIES.forEach(function (sp) { if (!sp.rare) o.unlocked[sp.id] = true; });
    L.rng = seeded(9);
    for (var n = 0; n < 200; n++) {
      assert(!C.SPECIES_BY_ID[L.makeOrder(o).species].rare, 'orders only want shop plants');
      var off = L.makeOffer(o);
      assert(!(off.kind === 'seeds' && C.SPECIES_BY_ID[off.species].rare), 'the merchant never sells rare seeds as a normal deal');
    }
  });

  test('rare plants pay off: perks per harvest, Honeyhearts call the bee, and they survive a New Season', function () {
    function grow(st, slot) { var p = st.pots[slot].plant; p.growth = 1; return p; }
    var st = S.newGame();
    st.seeds = { lily: 1, agave: 1, honey: 1, mandrake: 2 };
    ['lily', 'agave', 'honey', 'mandrake'].forEach(function (id, i) { L.plant(st, i, id); });
    pamper(st);
    // Rainbow Lily: twice as fast in rain, 1 Sunshine even at low stars, 4 harvests.
    var lily = st.pots[0].plant, g = L.growthRate(st, lily);
    st.events.rain = 10;
    near(L.growthRate(st, lily), g * 2, 1e-9, 'lily x2 in the rain');
    st.events.rain = 0;
    lily.qSum = 0.1; lily.qTime = 1; grow(st, 0);
    var sun = st.sunshine, r = L.harvest(st, 0);
    assert(r.ok && st.sunshine === sun + 1, '1 Sunshine per harvest, whatever the stars');
    assert(st.pots[0].plant && st.pots[0].plant.harvestsLeft === 3, 'it regrows for 3 more harvests');
    // Ember Agave: shrugs off heat, grows 3x, pays double in a heatwave.
    var ag = st.pots[1].plant, d = L.drainRate(st, ag), ga = L.growthRate(st, ag);
    st.events.heat = 10;
    near(L.drainRate(st, ag), d, 1e-9, 'heat does not dry it out');
    near(L.growthRate(st, ag), ga * 3, 1e-9, 'x3 in the heat');
    grow(st, 1);
    var hot = L.sellValue(st, ag);
    st.events.heat = 0;
    near(hot / L.sellValue(st, ag), 2, 0.01, 'double price in a heatwave');
    // Honeyheart: a Comet Crumb per harvest, and the lucky bee comes more often.
    var base = L.eventWeights(null).bee;
    near(L.eventWeights(st).bee, base + C.RARE.beeWeightEach, 1e-9, 'one Honeyheart attracts the bee');
    grow(st, 2);
    var crumbs = st.crumbs;
    assert(L.harvest(st, 2).crumbs === 1 && st.crumbs === crumbs + 1 && st.discovered.nutrients.crumbs, 'a Comet Crumb inside');
    // Mandrake: an Heirloom Seed at 4+ stars, none below.
    var md = st.pots[3].plant;
    md.qSum = 0.85; md.qTime = 1; grow(st, 3);
    var h = st.heirlooms, rm = L.harvest(st, 3);
    assert(rm.heirlooms === 1 && st.heirlooms === h + 1 && st.stats.heirloomsEarned >= 1, '1 Heirloom Seed at 4 stars');
    md = st.pots[3].plant;
    md.qSum = 0.5; md.qTime = 1; md.growth = 1;
    assert(L.harvest(st, 3).heirlooms === 0 && st.heirlooms === h + 1, 'nothing from a grumpy 3-star Mandrake');
    // A New Season keeps rare seeds in the bag and turns living rare plants back into seeds.
    var kept = L.rareSeedsKept(st);
    assert(kept.mandrake === 2 && kept.lily === 1 && kept.agave === 1 && kept.honey === 1, 'bag + living plants: ' + JSON.stringify(kept));
    st.seasonEarned = L.prestigeGoal(st);
    var n = L.prestige(st).state;
    assert(n.seeds.mandrake === 2 && n.seeds.lily === 1 && n.seeds.agave === 1 && n.seeds.honey === 1, 'rare seeds come along');
    // A waiting offer survives saving; junk does not.
    var sv = S.newGame();
    L.offerRare(sv, 'honey');
    var back = Save.parse(Save.serialize(sv));
    assert(back.events.rare && back.events.rare.species === 'honey' && back.events.rare.price === C.SPECIES_BY_ID.honey.price, 'offer saved');
    sv.events.rare = { species: 'mint', price: 1, t: 50 };
    assert(Save.parse(Save.serialize(sv)).events.rare === null, 'only rare plants can be on offer');
    sv.events.rare = { species: 'lily', price: 1, t: 50 };
    assert(Save.parse(Save.serialize(sv)).events.rare.price === C.SPECIES_BY_ID.lily.price, 'the price comes from the config, not the save');
  });

  test('the income estimate on the barn sign follows plant value and growth speed', function () {
    var st = fresh();
    assert(L.incomeEstimate(st) === 0, 'an empty barn makes nothing');
    L.plant(st, 0, 'mint'); L.plant(st, 1, 'mint');
    pamper(st);
    var p = st.pots[0].plant, one = L.projectedValue(st, p) * L.growthRate(st, p);
    assert(one > 0, 'a happy plant makes something');
    near(L.incomeEstimate(st), 2 * one, 1e-9, 'value x growth speed, added up over the pots');
    st.pots[1].plant.water = 0;
    near(L.incomeEstimate(st), one, 1e-9, 'a plant too dry to grow adds nothing');
    p.growth = 1;
    near(L.incomeEstimate(st), one, 1e-9, 'a ripe plant counts at the speed it would regrow');
    assert(p.growth === 1, 'the estimate does not change the plant');
    st.upgrades.stall = 3;
    assert(L.incomeEstimate(st) > one, 'better prices raise the estimate');
  });

  test('the admin switch "ignore level caps" allows the absolute max, and only while it is on', function () {
    var st = S.newGame();
    st.coins = 1e30;
    try {
      L.ignoreCaps = true;
      assert(L.upgradeMax(st, 'sharp') === C.UPGRADES_BY_ID.sharp.maxCap, 'Shear Sharpness goes to its absolute cap at prestige 0');
      assert(L.upgradeMax(st, 'spout') === 1, 'one-off upgrades stay one-off');
      while (L.buyUpgrade(st, 'stall').ok) { /* max it */ }
      assert(L.level(st, 'stall') === C.UPGRADES_BY_ID.stall.maxCap, 'can be bought up to the absolute cap');
      assert(Save.parse(Save.serialize(st)).upgrades.stall === C.UPGRADES_BY_ID.stall.maxCap, 'survives saving while on');
    } finally {
      L.ignoreCaps = false;
    }
    assert(L.upgradeMax(st, 'stall') === 10, 'normal cap again when off');
    assert(Save.parse(Save.serialize(st)).upgrades.stall === 10, 'a save loaded with the switch off is clamped back');
  });

  // ---- Boss fights ----------------------------------------------------
  var K = BB.Combat;
  function fighter(prestige, sharp, extra) {
    var st = S.newGame();
    st.prestige = prestige;
    st.upgrades.sharp = sharp;
    for (var k in extra || {}) st.upgrades[k] = extra[k];
    return st;
  }

  test('bosses unlock with prestige and Shear Sharpness, once per season, with a 20-minute wait', function () {
    var now = 1e12, st = S.newGame();
    assert(K.lock(st, 'thornzilla', now).reason === 'prestige', 'needs prestige 1');
    assert(L.upgradeLock(st, 'sharp') !== null, 'combat upgrades are locked before the first New Season');
    st.prestige = 1;
    assert(L.upgradeLock(st, 'sharp') === null, 'and open after it');
    assert(K.lock(st, 'thornzilla', now).reason === 'sharp', 'needs Shear Sharpness 3');
    st.upgrades.sharp = 3;
    assert(K.lock(st, 'thornzilla', now) === null, 'ready to fight');
    var r = K.start(st, 'thornzilla', now);
    assert(r.ok && st.bossRetryAt.thornzilla === now + C.COMBAT.retryCooldown * 1000, 'the wait starts with the attempt');
    assert(C.COMBAT.retryCooldown === 20 * 60, 'the wait is 20 minutes');
    assert(K.start(st, 'thornzilla', now + 60000).reason === 'cooldown', 'no retry after 1 minute');
    near(K.lock(st, 'thornzilla', now + 60000).wait, C.COMBAT.retryCooldown - 60, 0.01, 'time left to wait');
    assert(K.lock(st, 'thornzilla', now + C.COMBAT.retryCooldown * 1000 + 1) === null, 'retry possible after 20 minutes');
    st.bossesBeaten.thornzilla = true;
    assert(K.lock(st, 'thornzilla', now + 1e9).reason === 'beaten', 'once per season');
    // The user's rule: boss 5 needs prestige 7 and Shear Sharpness 19.
    var e = fighter(7, 18);
    assert(K.lock(e, 'eclipse', now).reason === 'sharp', 'level 18 is not enough');
    e = fighter(6, 19);
    assert(K.lock(e, 'eclipse', now).reason === 'prestige', 'prestige 6 is not enough');
    e = fighter(7, 19);
    assert(K.lock(e, 'eclipse', now) === null, 'prestige 7 and level 19 unlock it');
    assert(L.upgradeMax(e, 'sharp') >= 19, 'level 19 can be bought at prestige 7');
    assert(L.upgradeMax(fighter(4, 0), 'sharp') < 19, 'level 19 is out of reach before prestige 5');
    var guild = fighter(4, 0); guild.upgrades.hSharp = 3;
    assert(L.upgradeMax(guild, 'sharp') === L.upgradeMax(fighter(4, 0), 'sharp') + 3, "the Sharpener's Guild raises the cap");
  });

  test('armour: snips only hurt when your power beats it, and bosses toughen each season', function () {
    C.BOSSES.forEach(function (b) {
      assert(K.powerAt(b.sharp) > b.armor && K.powerAt(b.sharp - 1) <= b.armor, b.id + ' needs exactly Shear Sharpness ' + b.sharp);
    });
    var st = fighter(1, 3), f = K.start(st, 'thornzilla', 0).fight;
    st.upgrades.sharp = 2;   // pretend the shears got blunt mid-fight
    var r = K.snip(st, f);
    assert(r.blocked === 'armor' && f.hp === f.maxHp && f.bounced === 1, 'too weak: no damage at all');
    st.upgrades.sharp = 3;
    assert(K.snip(st, f).damage > 0 && f.hp < f.maxHp, 'strong enough: damage');
    var later = fighter(3, 3), s1 = K.stats(st, 'thornzilla'), s3 = K.stats(later, 'thornzilla');
    assert(s3.hp > s1.hp && s3.armor > s1.armor, 'tougher two seasons later');
    near(s3.hp / s1.hp, Math.pow(C.COMBAT.seasonHpGrowth, 2), 0.001, 'health grows fast with every season');
    assert(K.powerAt(3) <= s3.armor && K.powerAt(4) > s3.armor, 'armour only grows a little: one more level gets through');
    for (var p = 0; p <= 12; p++) {
      var ps = fighter(p, 0);
      for (var j = 1; j < C.BOSSES.length; j++) {
        assert(K.stats(ps, C.BOSSES[j].id).hp > K.stats(ps, C.BOSSES[j - 1].id).hp, C.BOSSES[j].id + ' stays tougher than ' + C.BOSSES[j - 1].id + ' at prestige ' + p);
      }
    }
    var e = fighter(7, 19), ef = K.start(e, 'eclipse', 0).fight;
    e.upgrades.sharp = 18;
    for (var i = 0; i < 40; i++) { K.snip(e, ef); K.tick(e, ef, 0.25); }
    assert(ef.hp === ef.maxHp, 'level 18 snips all bounce off the Eclipse Lotus');
  });

  test('combo, crits, battle items, the sprayer and the hedgehog brigade', function () {
    var st = fighter(1, 3);
    st.nutrients.nitro = 5;
    var f = K.start(st, 'thornzilla', 0).fight, p = K.power(st);
    L.rng = function () { return 0.99; };        // no crits
    var a = K.snip(st, f);
    assert(a.damage === p && f.combo === 1, 'first snip does plain damage');
    K.tick(st, f, 0.2);
    K.snip(st, f);
    near(f.combo, 1 + C.COMBAT.comboStep, 1e-9, 'quick snips build the combo');
    K.tick(st, f, 1);
    K.snip(st, f);
    assert(f.combo === 1, 'a pause resets the combo');
    L.rng = function () { return 0; };           // always crit
    var c2 = K.snip(st, f);
    assert(c2.crit && c2.damage === Math.round(p * f.combo * C.COMBAT.critMult), 'critical hit');
    L.rng = function () { return 0.99; };
    assert(K.useItem(st, f, 'nitro').ok && st.nutrients.nitro === 4, 'Nitro-Bloom comes out of the barn stock');
    K.tick(st, f, 1);
    assert(K.snip(st, f).damage === p * C.COMBAT.nitroMult, 'nitro doubles damage');
    for (var i = 1; i < C.COMBAT.itemUses; i++) K.useItem(st, f, 'nitro');
    assert(K.useItem(st, f, 'nitro').reason === 'used', 'items are limited per fight');
    assert(K.useItem(st, f, 'jam').reason === 'none', 'and need stock');
    var hp = f.hp;
    assert(K.spray(st, f).ok && f.hp < hp && f.sprayCd > 0, 'spray burst');
    assert(K.spray(st, f).reason === 'cooldown', 'the sprayer needs a cooldown');
    hp = f.hp;
    K.tick(st, f, 1);
    assert(f.hp < hp, 'the spray mist keeps hurting');
    st.nutrients.gel = 1;
    var t = f.time;
    K.useItem(st, f, 'gel');
    near(f.time - t, C.COMBAT.gelTime, 1e-9, 'Gulp-Gel adds time');
    var g = fighter(1, 3, { brigade: 2 }), gf = K.start(g, 'thornzilla', 0).fight;
    K.tick(g, gf, 1);
    assert(gf.hp < gf.maxHp, 'the hedgehog brigade nibbles on its own');
  });

  test('boss moves: shields, snaps, hardened armour, pods, fog and tonic', function () {
    var st = fighter(1, 3), f = K.start(st, 'thornzilla', 0).fight, tz = K.boss('thornzilla');
    f.move = { kind: 'shield', def: tz.moves[0], t: 3 };
    var hp = f.hp;
    assert(K.snip(st, f).blocked === 'shield' && f.hp === hp && f.combo === 1, 'the thorn shield blocks snips');
    K.tick(st, f, 3.1);
    assert(!f.move, 'the shield drops');
    f.nextMove = 0; f.moveIndex = 1;               // next: spine volley
    K.tick(st, f, 0.01);
    assert(f.pods.length === 3, 'three spines fly');
    var t0 = f.time;
    K.pop(f, f.pods[0].id);
    K.tick(st, f, 3);
    near(t0 - f.time, 3 + 2 * 3, 0.05, 'each missed spine costs 3 seconds');
    var sn = fighter(4, 11), sf = K.start(sn, 'snapdragon', 0).fight, sd = K.boss('snapdragon');
    sf.move = { kind: 'snap', def: sd.moves[1], t: 1.8 };
    var tt = sf.time;
    K.snip(sn, sf);
    near(tt - sf.time, 1, 1e-9, 'snipping during a snap costs a second');
    sf.move = { kind: 'armorUp', def: sd.moves[0], t: 4 };
    assert(K.snip(sn, sf).blocked === 'armor', 'hardened armour stops level-11 shears');
    sn.upgrades.sharp = 12;
    assert(K.snip(sn, sf).damage > 0, 'one level more gets through');
    var m = fighter(5, 15), mf = K.start(m, 'mold', 0).fight;
    m.nutrients.tonic = 1;
    L.rng = function () { return 0.99; };
    var full = K.snip(m, mf).damage;
    K.tick(m, mf, 1);
    mf.move = { kind: 'weak', def: K.boss('mold').moves[1], t: 6 };
    assert(K.snip(m, mf).damage === Math.round(full * 0.5), 'spore fog halves damage');
    mf.pods.push({ id: 99, x: 0.5, y: 0.5, life: 3, max: 3, look: 'spore', effect: 'heal', amount: 0.025 });
    K.useItem(m, mf, 'tonic');
    assert(!mf.move && mf.pods.length === 0, 'Bug-Off Tonic clears the fog and the pods');
    mf.hp = Math.round(mf.maxHp / 2);
    var before = mf.hp;
    mf.pods.push({ id: 100, x: 0.5, y: 0.5, life: 0.1, max: 3, look: 'spore', effect: 'heal', amount: 0.025 });
    K.tick(m, mf, 0.2);
    assert(mf.hp > before, 'a missed spore pod heals the boss');
    var gl = fighter(5, 15, { gloves: 4 }), gf = K.start(gl, 'mold', 0).fight;
    gf.hp = Math.round(gf.maxHp / 2);
    var half = gf.hp;
    gf.pods.push({ id: 1, x: 0.5, y: 0.5, life: 0.1, max: 3, look: 'spore', effect: 'heal', amount: 0.025 });
    K.tick(gl, gf, 0.2);
    assert(gf.hp - half < mf.hp - before, 'Thorn Gloves soften the healing');
    var kr = fighter(2, 6), kf = K.start(kr, 'fernkraken', 0).fight;
    kf.move = { kind: 'grab', def: K.boss('fernkraken').moves[0], t: 6 };
    assert(K.spray(kr, kf).reason === 'grabbed', 'no spraying while a frond holds the sprayer');
    var ec = fighter(7, 19), ef = K.start(ec, 'eclipse', 0).fight;
    ef.hp = Math.round(ef.maxHp * 0.5) + 10;
    L.rng = function () { return 0.99; };
    K.snip(ec, ef);
    assert(ef.phase === 2, 'the Eclipse Lotus opens its second bloom at half health');
  });

  test('winning pays Heirloom Seeds and a trophy; a New Season locks the bosses again', function () {
    var st = fighter(1, 3), f = K.start(st, 'thornzilla', 0).fight;
    f.hp = 1;
    L.rng = function () { return 0.99; };
    K.snip(st, f);
    assert(f.done && f.won, 'beaten');
    var r = K.finish(st, f);
    assert(r.won && r.first && r.heirlooms === K.boss('thornzilla').heirlooms, 'reward');
    assert(st.heirlooms === r.heirlooms && st.trophies.thornzilla && st.bossesBeaten.thornzilla, 'seeds, trophy and beaten for this season');
    assert(K.finish(st, f) === r && st.heirlooms === r.heirlooms, 'paid only once');
    run(st, 1.5);
    assert(st.achievements.boss1, 'award for the first boss');
    var back = Save.parse(Save.serialize(st));
    assert(back.trophies.thornzilla && back.bossesBeaten.thornzilla && back.bossRetryAt.thornzilla === C.COMBAT.retryCooldown * 1000, 'boss progress survives saving');
    st.seasonEarned = L.prestigeGoal(st);
    var n = L.prestige(st).state;
    assert(n.trophies.thornzilla && !n.bossesBeaten.thornzilla && !n.upgrades.sharp, 'a New Season keeps trophies, locks bosses again and resets Shear Sharpness');
    var visit = Save.parseVisit(Save.visitString(st));
    assert(visit.state.trophies.thornzilla, 'friends see your trophies when visiting');
    var g = fighter(2, 6), gf = K.start(g, 'fernkraken', 0).fight;
    K.giveUp(gf);
    var gr = K.finish(g, gf);
    assert(!gr.won && !g.bossesBeaten.fernkraken && g.heirlooms === 0, 'giving up gives nothing');
    assert(K.lock(g, 'fernkraken', 1000).reason === 'cooldown', 'and still starts the wait');
  });

  test('bosses take a few tries: the damage you deal stays between attempts', function () {
    // A steady fighter at exactly the required level keeps coming back every 20 minutes.
    var st = fighter(1, 3), now = 0, tries = 0, r, left = [];
    do {
      r = K.simulate(st, 'thornzilla', { cps: 4, now: now });
      if (!r.ok) break;
      K.finish(st, r.fight);
      tries++; now += (C.COMBAT.retryCooldown + 1) * 1000;
      left.push(K.healthLeft(st, 'thornzilla'));
    } while (r.ok && !r.won && tries < 12);
    assert(r.won, 'beaten in the end');
    assert(tries >= 2 && tries <= 6, 'took ' + tries + ' tries (one is not enough)');
    for (var i = 1; i < left.length - 1; i++) assert(left[i] < left[i - 1], 'every try wears it down further');
    assert(st.bossTries.thornzilla === tries && !('thornzilla' in st.bossHealth), 'tries counted; wounds gone once beaten');
    // Giving up keeps the damage, it survives saving, and the next try starts there.
    var w = fighter(1, 3), f = K.start(w, 'thornzilla', 0).fight;
    f.hp = Math.round(f.maxHp * 0.4);
    K.giveUp(f); K.finish(w, f);
    near(K.healthLeft(w, 'thornzilla'), 0.4, 1e-6, 'giving up keeps the damage');
    var back = Save.parse(Save.serialize(w));
    near(K.healthLeft(back, 'thornzilla'), 0.4, 1e-6, 'wounds survive saving');
    assert(back.bossTries.thornzilla === 1, 'tries survive saving');
    var f2 = K.start(back, 'thornzilla', (C.COMBAT.retryCooldown + 1) * 1000).fight;
    assert(f2.maxHp === K.stats(back, 'thornzilla').hp && f2.hp === Math.round(f2.maxHp * 0.4), 'the next try starts where the last one ended');
    var ec = fighter(7, 19);
    ec.bossHealth.eclipse = 0.3;
    assert(K.start(ec, 'eclipse', 0).fight.phase === 2, 'a worn-down Eclipse Lotus starts in its second bloom');
    w.seasonEarned = L.prestigeGoal(w);
    var n = L.prestige(w).state;
    assert(K.healthLeft(n, 'thornzilla') === 1 && !n.bossTries.thornzilla, 'a New Season heals every boss');
    var slow = K.simulate(fighter(4, 11), 'snapdragon', { cps: 0.5 });
    assert(slow.ok && !slow.won && slow.timeLeft === 0, 'time can still run out');
  });

  test('the day/night clock advances and wraps', function () {
    var st = S.newGame();
    assert(L.day(st) === 1 && L.clock(st) === '06:00' && !L.isNight(st), 'starts at dawn');
    st.time = C.DAY_LENGTH * 0.8;
    assert(L.isNight(st), 'night');
    st.time = C.DAY_LENGTH * 2.5;
    assert(L.day(st) === 3, 'day counter');
    var sun1 = fresh('sunflower'); L.plant(sun1, 0, 'sunflower'); pamper(sun1);
    var day = L.growthRate(sun1, sun1.pots[0].plant);
    sun1.time = C.DAY_LENGTH * 0.8;
    assert(L.growthRate(sun1, sun1.pots[0].plant) < day, 'sunflower slows down at night');
  });

  // ------------------------------------------------------------------
  L.rng = Math.random;
  results.text = 'Logic tests: ' + results.passed + ' passed, ' + results.failed + ' failed\n' + results.lines.join('\n');
  BB.TestResults = results;
  if (typeof document === 'undefined') {
    console.log(results.text);
    if (typeof process !== 'undefined' && results.failed) process.exitCode = 1;
  }
})(typeof window !== 'undefined' ? window : globalThis);
