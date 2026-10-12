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
    require('../js/config.js'); require('../js/state.js'); require('../js/logic.js'); require('../js/save.js');
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
