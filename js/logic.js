/*
 * Barn Bloom - logic.js
 * ------------------------------------------------------------------
 * The whole simulation as pure-ish functions over the state object.
 * No DOM access here, so this file can run in Node or in a test page.
 *
 * Things that the presentation layer may want to react to (sounds,
 * particles, toasts) are pushed into Logic.queue via emit() and read
 * with Logic.drain().
 */
(function (root) {
  'use strict';
  var BB = root.BB = root.BB || {};
  var C = BB.CONFIG, S = BB.State;
  var L = {};

  L.rng = Math.random;          // replaceable for deterministic tests
  L.queue = [];
  L.muted = false;              // true while fast-forwarding offline time

  var KEEP_WHEN_MUTED = { achievement: true, catArrives: true };
  var DEFAULT_ENV = { events: true, offline: false };
  var CUSTOMERS = ['Granny Maple', 'Chef Basilio', 'The Mayor', 'Postman Pip', 'Miss Clementine',
    'Old Barnaby', 'Dr. Thistle', 'The Twins', 'Captain Juniper', 'Farmer Odette'];

  function emit(type, data) {
    if (L.muted && !KEEP_WHEN_MUTED[type]) return;
    if (L.queue.length > 400) return;
    data = data || {};
    data.type = type;
    L.queue.push(data);
  }
  L.drain = function () { var q = L.queue; L.queue = []; return q; };

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function rand(a, b) { return a + (b - a) * L.rng(); }
  function fail(reason) { return { ok: false, reason: reason }; }
  L.clamp = clamp;

  // ==================================================================
  // Time
  // ==================================================================
  L.phase = function (state) { return (state.time % C.DAY_LENGTH) / C.DAY_LENGTH; };
  L.isNight = function (state) { return L.phase(state) >= C.NIGHT_START; };
  L.day = function (state) { return Math.floor(state.time / C.DAY_LENGTH) + 1; };
  L.clock = function (state) {
    var h = (6 + L.phase(state) * 24) % 24;
    var hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
  };

  // ==================================================================
  // Upgrades
  // ==================================================================
  L.level = function (state, id) { return state.upgrades[id] || 0; };
  L.upgradeValue = function (id, lvl) {
    var u = C.UPGRADES_BY_ID[id];
    if (u.values) return u.values[Math.min(lvl, u.values.length - 1)];
    return Math.round((u.base + u.per * lvl) * 1000) / 1000;
  };
  L.eff = function (state, id) { return L.upgradeValue(id, L.level(state, id)); };
  /** Highest level an upgrade can reach right now; some caps rise with prestige. */
  L.ignoreCaps = false;         // admin panel switch: every upgrade may go to its absolute max
  L.upgradeMax = function (state, id) {
    var u = C.UPGRADES_BY_ID[id];
    if (L.ignoreCaps) return u.maxCap || u.max;
    if (!u.capPerPrestige) return u.max;
    var extra = u.capBonus ? L.eff(state, u.capBonus) : 0;
    return Math.min(u.maxCap, u.max + u.capPerPrestige * (state.prestige || 0) + extra);
  };
  L.upgradeCost = function (state, id) {
    var u = C.UPGRADES_BY_ID[id], lvl = L.level(state, id);
    if (lvl >= L.upgradeMax(state, id)) return Infinity;
    return Math.round(u.cost * Math.pow(u.mult, lvl));
  };
  /** Returns null when available, otherwise a human readable unlock hint. */
  L.upgradeLock = function (state, id) {
    var r = C.UPGRADES_BY_ID[id].requires;
    if (!r) return null;
    if (r.prestige && (state.prestige || 0) < r.prestige) {
      return r.prestige === 1 ? 'Unlocks with your first New Season' : 'Requires prestige ' + r.prestige;
    }
    if (r.upgrade && L.level(state, r.upgrade) < r.level) {
      var need = C.UPGRADES_BY_ID[r.upgrade];
      return 'Requires ' + need.name + (need.max > 1 ? ' (level ' + r.level + ')' : '');
    }
    if (r.pots && state.pots.length < r.pots) return 'Requires ' + r.pots + ' pots';
    if (r.harvests && state.stats.harvests < r.harvests) {
      return 'Requires ' + r.harvests + ' harvests (' + state.stats.harvests + ' so far)';
    }
    return null;
  };
  L.buyUpgrade = function (state, id) {
    var u = C.UPGRADES_BY_ID[id];
    if (!u) return fail('unknown');
    var lvl = L.level(state, id);
    if (lvl >= L.upgradeMax(state, id)) return fail('max');
    if (L.upgradeLock(state, id)) return fail('locked');
    var cost = L.upgradeCost(state, id), cur = u.currency || 'coins';
    if (state[cur] < cost) return fail('funds');
    state[cur] -= cost;
    state.upgrades[id] = lvl + 1;
    state.stats.upgradesBought++;
    if (id === 'slots') state.pots.push(S.newPot());
    if (id === 'tank') state.tank += u.per;
    if (id === 'bulk') L.fillStock(state, u.per);
    emit('upgrade', { id: id, level: lvl + 1 });
    return { ok: true, level: lvl + 1, cost: cost };
  };

  L.pourAmount = function (state) { return L.eff(state, 'can'); };
  L.tankCapacity = function (state) { return L.eff(state, 'tank'); };
  L.tankRefill = function (state) { return L.eff(state, 'pump') * (1 + L.eff(state, 'hTank')); };
  L.sprinklerCoverage = function (state) { return L.eff(state, 'sprinkler'); };

  // ==================================================================
  // Plant queries
  // ==================================================================
  L.species = function (p) { return C.SPECIES_BY_ID[p.species]; };

  L.primeWindow = function (sp) { return Math.max(C.GROWTH.primeMin, sp.growTime * (sp.primeFactor || C.GROWTH.primeFactor)); };

  L.stage = function (p) {
    if (p.dead) return 'dead';
    if (p.growth >= 1) return p.ripeAge > L.primeWindow(L.species(p)) ? 'overgrown' : 'mature';
    if (p.growth < C.GROWTH.sproutAt) return 'seed';
    if (p.growth < C.GROWTH.youngAt) return 'sprout';
    return 'young';
  };
  L.isReady = function (p) { return !!p && !p.dead && p.growth >= 1; };

  /** 1 inside the comfy zone, falling off when too dry or too wet. */
  L.waterFit = function (sp, water) {
    var lo = sp.water[0], hi = sp.water[1];
    if (water < lo) return water / lo;
    if (water > hi) return Math.max(0.15, 1 - (water - hi) / 30);
    return 1;
  };
  L.isThirsty = function (p) { return p.water < L.species(p).water[0]; };
  L.isSoggy = function (p) { return p.water > L.species(p).water[1] + C.WATER.soggyMargin; };

  /** Overall care 0..1: how happy the plant is right now. */
  L.care = function (p) {
    if (p.dead) return 0;
    return L.waterFit(L.species(p), p.water) * (0.4 + 0.6 * p.health / 100);
  };

  /** Effect strength of one nutrient on one plant (0 = inactive). */
  L.nutStrength = function (state, p, id) {
    var amount = p.nutrients[id] || 0;
    if (amount <= 0) return 0;
    var n = C.NUTRIENTS_BY_ID[id];
    var s = Math.min(1, amount / C.NUTRIENT.fullAt);
    var like = L.species(p).likes.indexOf(id) >= 0 ? C.NUTRIENT.likeBonus : 1;
    return s * (1 + L.eff(state, n.powUpgrade)) * like;
  };

  /** Ids of the nutrient synergies currently active on a plant. */
  L.synergies = function (p) {
    var out = [];
    for (var i = 0; i < C.SYNERGIES.length; i++) {
      var sy = C.SYNERGIES[i];
      if (p.nutrients[sy.a] > 0 && p.nutrients[sy.b] > 0) out.push(sy.id);
    }
    return out;
  };
  function hasSynergy(p, id) { return L.synergies(p).indexOf(id) >= 0; }

  /** Growth per second (fraction of full growth). */
  L.growthRate = function (state, p) {
    if (p.dead || p.growth >= 1) return 0;
    var care = L.care(p);
    if (care < C.GROWTH.minCare) return 0;
    var sp = L.species(p);
    var m = care;
    m *= 1 + C.GROWTH.nitroBonus * L.nutStrength(state, p, 'nitro') + (hasSynergy(p, 'juicy') ? C.GROWTH.juicyBonus : 0);
    m *= 1 + L.eff(state, 'lamps') + L.eff(state, 'chorus');
    m *= 1 + L.prestigeBonus(state) + L.eff(state, 'hGrow');
    m *= L.isNight(state) ? sp.nightMult : sp.dayMult;
    if (state.events.bee > 0) m *= C.EVENTS.beeGrowth;
    if (state.events.heat > 0 && sp.heatMult) m *= sp.heatMult;    // Firecracker Pepper, Ember Agave
    if (state.events.rain > 0 && sp.rainMult) m *= sp.rainMult;    // Rainbow Lily
    if (p.pest > 0) m *= C.GROWTH.pestSlow;
    return m / sp.growTime;
  };

  L.drainRate = function (state, p) {
    var sp = L.species(p);
    var cut = Math.max(C.NUTRIENT.gelMinDrain, 1 - C.NUTRIENT.gelDrainCut * L.nutStrength(state, p, 'gel'));
    return C.WATER.baseDrain * sp.thirst * cut * (1 - L.eff(state, 'mulch')) *
      (state.events.heat > 0 && !sp.heatProof ? C.EVENTS.heatDrain : 1);
  };

  /** Seconds until mature at the current rate, Infinity when stalled. */
  L.timeToMature = function (state, p) {
    if (p.growth >= 1) return 0;
    var r = L.growthRate(state, p);
    return r > 0 ? (1 - p.growth) / r : Infinity;
  };

  L.quality = function (p) {
    var base = p.qTime > 0 ? p.qSum / p.qTime : C.QUALITY.careWeight * L.care(p);
    return clamp(base + (p.qBonus || 0), 0, 1);
  };
  L.stars = function (q) { return clamp(Math.ceil(q * 5 - 1e-9), 1, 5); };

  function stageMult(p) {
    var prime = L.primeWindow(L.species(p));
    var over = p.ripeAge - prime;
    if (over <= 0) return 1;
    return Math.max(C.GROWTH.overgrownFloor, 1 - (1 - C.GROWTH.overgrownFloor) * over / prime);
  }
  L.sellMultiplier = function (state) {
    return (1 + L.eff(state, 'stall')) * (1 + L.eff(state, 'glaze')) * (1 + L.prestigeBonus(state) + L.eff(state, 'hSell'));
  };

  /** What the plant would sell for once mature, at its current quality. */
  L.projectedValue = function (state, p) {
    var sp = L.species(p), q = L.quality(p);
    var v = sp.value * (C.QUALITY.priceBase + C.QUALITY.priceSpan * q) * L.sellMultiplier(state);
    if (p.golden) v *= C.QUALITY.goldenMult;
    if (sp.prize && L.stars(q) >= 5) v *= sp.prize;                 // a prize Plumpkin
    if (sp.heatPay && state.events.heat > 0) v *= sp.heatPay;       // Ember Agave in a heatwave
    return Math.max(1, Math.round(v));
  };
  L.sellValue = function (state, p) {
    if (p.dead || p.growth < 1) return 0;
    return Math.max(1, Math.round(L.projectedValue(state, p) * stageMult(p)));
  };

  /**
   * Rough coins per game second the barn makes right now (shown on the barn sign):
   * each living plant pays its projected value once per full growth, at its
   * current growth speed. Ripe plants count at the speed they would regrow.
   */
  L.incomeEstimate = function (state) {
    var total = 0;
    for (var i = 0; i < state.pots.length; i++) {
      var p = state.pots[i].plant;
      if (!p || p.dead) continue;
      var grow = p;
      if (p.growth >= 1) { grow = {}; for (var k in p) grow[k] = p[k]; grow.growth = 0; }
      total += L.projectedValue(state, p) * L.growthRate(state, grow);
    }
    return total;
  };

  L.readyCount = function (state) {
    var n = 0;
    for (var i = 0; i < state.pots.length; i++) if (L.isReady(state.pots[i].plant)) n++;
    return n;
  };
  L.livingCount = function (state) {
    var n = 0;
    for (var i = 0; i < state.pots.length; i++) { var p = state.pots[i].plant; if (p && !p.dead) n++; }
    return n;
  };

  // ==================================================================
  // Player actions on pots
  // ==================================================================
  /** Coins the player earned by playing (not gifts or trades): count towards the season goal. */
  function earn(state, coins) {
    state.coins += coins;
    state.stats.coinsEarned += coins;
    state.seasonEarned += coins;
  }

  function livePlant(state, i) {
    var pot = state.pots[i];
    return pot && pot.plant && !pot.plant.dead ? pot.plant : null;
  }

  /** Pours up to `amount` into pot i (never above `cap`), limited by the tank. Returns water added. */
  function pourInto(state, i, amount, cap) {
    var p = livePlant(state, i);
    if (!p) return 0;
    var want = Math.min(amount, cap - p.water);
    if (want <= 0.5) return 0;
    var got = Math.min(want, state.tank);
    if (got < 0.5) return 0;
    p.water += got;
    state.tank -= got;
    return got;
  }
  function manualCap(state, p) {
    return L.level(state, 'spout') > 0 ? Math.max(p.water, L.species(p).water[1]) : C.WATER.max;
  }

  L.water = function (state, i) {
    var p = livePlant(state, i);
    if (!p) return fail('noplant');
    var amount = L.pourAmount(state);
    var cap = manualCap(state, p);
    if (cap - p.water <= 0.5) return fail('full');
    if (state.tank < 1) return fail('tank');
    var got = pourInto(state, i, amount, cap);
    if (got <= 0) return fail('full');
    state.stats.watered++;
    emit('water', { slot: i, amount: got });
    var splash = L.eff(state, 'splash');
    if (splash > 0) {
      var side = [i - 1, i + 1];
      for (var k = 0; k < 2; k++) {
        var q = livePlant(state, side[k]);
        if (q && pourInto(state, side[k], amount * splash, Math.max(q.water, L.species(q).water[1])) > 0) {
          emit('water', { slot: side[k], amount: 0, splash: true });
        }
      }
    }
    return { ok: true, added: got };
  };

  /** One-tap watering of every plant in the lower part of its comfy zone. */
  L.waterAll = function (state) {
    if (L.level(state, 'whistle') < 1) return fail('locked');
    var n = 0, wanted = 0;
    for (var i = 0; i < state.pots.length; i++) {
      var p = livePlant(state, i);
      if (!p) continue;
      var sp = L.species(p), lo = sp.water[0], hi = sp.water[1];
      if (p.water >= lo + (hi - lo) * 0.4) continue;
      wanted++;
      var target = hi - C.WATER.autoTopMargin;
      if (pourInto(state, i, target - p.water, target) > 0) {
        n++;
        emit('water', { slot: i, amount: 1, quiet: n > 1 });
      }
    }
    if (n === 0) return fail(wanted > 0 ? 'tank' : 'none');
    state.stats.watered += n;
    return { ok: true, count: n };
  };

  L.plant = function (state, i, id, opts) {
    var pot = state.pots[i];
    if (!pot) return fail('nopot');
    if (pot.plant) return fail('occupied');
    if (!C.SPECIES_BY_ID[id]) return fail('unknown');
    if (!(state.seeds[id] > 0)) return fail('noseed');
    state.seeds[id]--;
    pot.plant = S.newPlant(id);
    pot.memo = C.SPECIES_BY_ID[id].rare ? null : id;
    pot.idle = 0;
    state.discovered.species[id] = true;
    state.stats.planted++;
    emit('plant', { slot: i, species: id, auto: !!(opts && opts.auto) });
    return { ok: true };
  };

  L.feed = function (state, i, id, opts) {
    var p = livePlant(state, i);
    if (!p) return fail('noplant');
    if (id === 'crumbs') {
      if (!(state.crumbs > 0)) return fail('none');
      if (p.growth >= 1) return fail('mature');
      state.crumbs--;
      p.growth = Math.min(0.999, p.growth + C.NUTRIENT.crumbsGrowth);
      p.qBonus = Math.min(C.NUTRIENT.crumbsQualityMax, (p.qBonus || 0) + C.NUTRIENT.crumbsQuality);
      state.discovered.nutrients.crumbs = true;
      emit('feed', { slot: i, nutrient: 'crumbs' });
      return { ok: true };
    }
    if (!C.NUTRIENTS_BY_ID[id]) return fail('unknown');
    if (!(state.nutrients[id] > 0)) return fail('none');
    if (p.nutrients[id] > C.NUTRIENT.max - C.NUTRIENT.dose + 10) return fail('full');
    state.nutrients[id]--;
    p.nutrients[id] = Math.min(C.NUTRIENT.max, p.nutrients[id] + C.NUTRIENT.dose);
    state.stats.fed++;
    emit('feed', { slot: i, nutrient: id, auto: !!(opts && opts.auto) });
    return { ok: true };
  };

  L.harvest = function (state, i, opts) {
    var pot = state.pots[i];
    var p = pot && pot.plant;
    if (!p || p.dead) return fail('noplant');
    if (p.growth < 1) return fail('unripe');
    var sp = L.species(p);
    var coins = L.sellValue(state, p);
    var q = L.quality(p), stars = L.stars(q), golden = !!p.golden;
    var sun = 0;
    if (golden) { sun += 1; state.stats.goldens++; }
    if (sp.sunshine && stars >= (sp.sunStars || 4)) sun += sp.sunshine;
    // Rare plant rewards: Comet Crumbs (Honeyheart), Heirloom Seeds (Mandrake).
    var crumbs = sp.crumbs || 0;
    var heir = sp.heirlooms && stars >= (sp.heirStars || 4) ? sp.heirlooms : 0;

    earn(state, coins);
    state.sunshine += sun;
    if (crumbs) { state.crumbs += crumbs; state.discovered.nutrients.crumbs = true; }
    if (heir) { state.heirlooms += heir; state.stats.heirloomsEarned += heir; }
    var st = state.stats;
    st.harvests++;
    st.bySpecies[sp.id] = (st.bySpecies[sp.id] || 0) + 1;
    if (!(st.bestQuality[sp.id] >= stars)) st.bestQuality[sp.id] = stars;
    if (stars >= 5) st.fiveStars++;

    progressOrders(state, sp.id, stars);

    p.harvestsLeft = (p.harvestsLeft || 1) - 1;
    var regrow = p.harvestsLeft > 0 && sp.regrow;
    if (regrow) {
      p.growth = sp.regrow; p.ripeAge = 0; p.golden = false;
      p.qSum = 0; p.qTime = 0; p.qBonus = 0;
    } else {
      // The squirrel replants from memory, but never spends a rare seed on its own.
      pot.plant = null; pot.memo = sp.rare ? null : sp.id; pot.idle = 0;
    }
    emit('harvest', {
      slot: i, species: sp.id, coins: coins, stars: stars, golden: golden, sunshine: sun,
      crumbs: crumbs, heirlooms: heir, auto: !!(opts && opts.auto), regrow: !!regrow
    });
    return { ok: true, coins: coins, stars: stars, golden: golden, sunshine: sun, crumbs: crumbs, heirlooms: heir };
  };

  L.harvestAll = function (state) {
    if (L.level(state, 'scythe') < 1) return fail('locked');
    var n = 0, coins = 0;
    for (var i = 0; i < state.pots.length; i++) {
      if (L.isReady(state.pots[i].plant)) {
        var r = L.harvest(state, i);
        if (r.ok) { n++; coins += r.coins; }
      }
    }
    return n > 0 ? { ok: true, count: n, coins: coins } : fail('none');
  };

  /** Shovel: removes whatever is in the pot. On an empty pot it clears the squirrel's memory. */
  L.clear = function (state, i) {
    var pot = state.pots[i];
    if (!pot) return fail('nopot');
    if (!pot.plant) {
      if (!pot.memo) return fail('empty');
      pot.memo = null;
      return { ok: true, memoOnly: true };
    }
    var wasDead = pot.plant.dead;
    pot.plant = null; pot.memo = null; pot.idle = 0;
    emit('clear', { slot: i, dead: wasDead });
    return { ok: true };
  };

  L.shoo = function (state, i) {
    var p = livePlant(state, i);
    if (!p || p.pest <= 0) return fail('nopest');
    p.pest--;
    if (p.pest <= 0) {
      p.pest = 0; p.pestT = 0;
      state.stats.pestsBeaten++;
      emit('pestGone', { slot: i, by: 'hand' });
    } else {
      emit('pestHit', { slot: i });
    }
    return { ok: true, left: p.pest };
  };

  // ==================================================================
  // Shop
  // ==================================================================
  function discounted(state, cost) {
    return Math.max(1, Math.round(cost * (1 - L.eff(state, 'hat') - L.eff(state, 'hShop'))));
  }
  L.seedCost = function (state, id) { return discounted(state, C.SPECIES_BY_ID[id].seedCost); };
  L.nutrientCost = function (state, id) { return discounted(state, C.NUTRIENTS_BY_ID[id].cost); };
  L.totalSeeds = function (state) {
    var n = 0;
    for (var k in state.seeds) n += state.seeds[k] || 0;
    return n;
  };
  L.maxSeeds = function (state, id) { return Math.floor(state.coins / L.seedCost(state, id)); };
  L.maxNutrient = function (state, id) {
    return Math.min(state.shopStock[id] || 0, Math.floor(state.coins / L.nutrientCost(state, id)));
  };

  L.buySeed = function (state, id, qty) {
    if (!C.SPECIES_BY_ID[id]) return fail('unknown');
    if (C.SPECIES_BY_ID[id].rare) return fail('rare');        // only from event offers
    if (!state.unlocked[id]) return fail('locked');
    qty = Math.floor(qty);
    if (!(qty >= 1)) return fail('qty');
    var cost = L.seedCost(state, id) * qty;
    if (state.coins < cost) return fail('funds');
    state.coins -= cost;
    state.seeds[id] = (state.seeds[id] || 0) + qty;
    emit('buy', { kind: 'seed', id: id, qty: qty, cost: cost });
    return { ok: true, cost: cost, qty: qty };
  };

  L.buyNutrient = function (state, id, qty) {
    if (!C.NUTRIENTS_BY_ID[id]) return fail('unknown');
    qty = Math.floor(qty);
    if (!(qty >= 1)) return fail('qty');
    if ((state.shopStock[id] || 0) < qty) return fail('stock');
    var cost = L.nutrientCost(state, id) * qty;
    if (state.coins < cost) return fail('funds');
    state.coins -= cost;
    state.shopStock[id] -= qty;
    state.nutrients[id] = (state.nutrients[id] || 0) + qty;
    state.discovered.nutrients[id] = true;
    emit('buy', { kind: 'nutrient', id: id, qty: qty, cost: cost });
    return { ok: true, cost: cost, qty: qty };
  };

  L.unlockSpecies = function (state, id) {
    var sp = C.SPECIES_BY_ID[id];
    if (!sp) return fail('unknown');
    if (sp.rare) return fail('rare');
    if (state.unlocked[id]) return fail('owned');
    if (state.coins < sp.unlock) return fail('funds');
    if (sp.unlockSun && state.sunshine < sp.unlockSun) return fail('sunshine');
    state.coins -= sp.unlock;
    if (sp.unlockSun) state.sunshine -= sp.unlockSun;
    state.unlocked[id] = true;
    emit('unlock', { id: id });
    return { ok: true };
  };

  /** Tops every nutrient shelf up to the daily stock (plus an optional bonus). */
  L.fillStock = function (state, bonus) {
    var cap = L.eff(state, 'bulk');
    for (var i = 0; i < C.NUTRIENTS.length; i++) {
      var id = C.NUTRIENTS[i].id;
      state.shopStock[id] = bonus ? (state.shopStock[id] || 0) + bonus : Math.max(state.shopStock[id] || 0, cap);
    }
  };
  L.restockCost = function (state) {
    var cap = L.eff(state, 'bulk'), missing = 0;
    for (var i = 0; i < C.NUTRIENTS.length; i++) missing += Math.max(0, cap - (state.shopStock[C.NUTRIENTS[i].id] || 0));
    return missing * C.NUTRIENT.restockCostPerItem;
  };
  L.restock = function (state) {
    var cost = L.restockCost(state);
    if (cost <= 0) return fail('full');
    if (state.coins < cost) return fail('funds');
    state.coins -= cost;
    L.fillStock(state);
    emit('buy', { kind: 'restock', cost: cost });
    return { ok: true, cost: cost };
  };

  L.buyCrumbs = function (state) {
    if (state.sunshine < C.CRUMBS.sunCost) return fail('sunshine');
    state.sunshine -= C.CRUMBS.sunCost;
    state.crumbs += C.CRUMBS.sunQty;
    state.discovered.nutrients.crumbs = true;
    emit('buy', { kind: 'crumbs', qty: C.CRUMBS.sunQty });
    return { ok: true };
  };

  L.buyPotStyle = function (state, id) {
    var st = C.POT_STYLES_BY_ID[id];
    if (!st) return fail('unknown');
    if (!state.potStyles[id]) {
      if (state[st.currency] < st.cost) return fail(st.currency === 'coins' ? 'funds' : 'sunshine');
      state[st.currency] -= st.cost;
      state.potStyles[id] = true;
      emit('buy', { kind: 'style', id: id });
    }
    state.potStyle = id;
    return { ok: true };
  };

  /** Buys a cat coat if needed, then puts it on. Can be done before the cat has arrived. */
  L.buyCatSkin = function (state, id) {
    var skin = C.CAT_SKINS_BY_ID[id];
    if (!skin) return fail('unknown');
    if (!state.catSkins[id]) {
      if (state.coins < skin.cost) return fail('funds');
      state.coins -= skin.cost;
      state.catSkins[id] = true;
      emit('buy', { kind: 'catSkin', id: id });
    }
    state.catSkin = id;
    return { ok: true };
  };

  // ---- Gifts between friends -------------------------------------------
  // A gift is plain data: { id, from, at, items: { coins, crumbs, seeds, nutrients } }.
  // Gifts run on trust: a barn remembers which ids it sent and opened, nothing more.

  /** Keeps only known, positive, whole amounts. Returns null for an empty gift. */
  L.cleanGiftItems = function (raw) {
    if (!raw || typeof raw !== 'object') return null;
    var max = C.GIFTS.maxCount, any = false, k;
    function amount(v, cap) {
      v = Math.floor(Number(v));
      return v > 0 && isFinite(v) ? Math.min(v, cap) : 0;
    }
    var items = { coins: amount(raw.coins, C.GIFTS.maxCoins), crumbs: amount(raw.crumbs, max), seeds: {}, nutrients: {} };
    if (items.coins || items.crumbs) any = true;
    for (k in C.SPECIES_BY_ID) {
      if (raw.seeds && amount(raw.seeds[k], max)) { items.seeds[k] = amount(raw.seeds[k], max); any = true; }
    }
    for (k in C.NUTRIENTS_BY_ID) {
      if (raw.nutrients && amount(raw.nutrients[k], max)) { items.nutrients[k] = amount(raw.nutrients[k], max); any = true; }
    }
    return any ? items : null;
  };

  function rememberGift(map, id) {
    var keys = Object.keys(map);
    if (keys.length >= C.GIFTS.remember) delete map[keys[0]];
    map[id] = true;
  }

  /** Takes the items out of the sender's stock and returns the gift to hand over. */
  L.makeGift = function (state, raw) {
    var items = L.cleanGiftItems(raw), k;
    if (!items) return fail('empty');
    if (items.coins > Math.floor(state.coins) || items.crumbs > state.crumbs) return fail('short');
    for (k in items.seeds) if (items.seeds[k] > (state.seeds[k] || 0)) return fail('short');
    for (k in items.nutrients) if (items.nutrients[k] > (state.nutrients[k] || 0)) return fail('short');
    state.coins -= items.coins;
    state.crumbs -= items.crumbs;
    for (k in items.seeds) state.seeds[k] -= items.seeds[k];
    for (k in items.nutrients) state.nutrients[k] -= items.nutrients[k];
    var id = '', chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (var i = 0; i < 12; i++) id += chars.charAt(Math.floor(L.rng() * chars.length));
    rememberGift(state.giftsSent, id);
    var gift = { v: C.VERSION, kind: 'gift', id: id, from: state.barnName, at: Date.now(), items: items };
    emit('giftSent', { gift: gift });
    return { ok: true, gift: gift };
  };

  /** Adds a received gift to the stock. Each gift opens once per barn, and never in the barn that sent it. */
  L.openGift = function (state, gift) {
    var items = gift && L.cleanGiftItems(gift.items), k;
    if (!items || typeof gift.id !== 'string' || !gift.id) return fail('invalid');
    if (state.giftsSent[gift.id]) return fail('own');
    if (state.giftsOpened[gift.id]) return fail('used');
    state.coins += items.coins;
    state.crumbs += items.crumbs;
    if (items.crumbs) state.discovered.nutrients.crumbs = true;
    for (k in items.seeds) state.seeds[k] = (state.seeds[k] || 0) + items.seeds[k];
    for (k in items.nutrients) {
      state.nutrients[k] = (state.nutrients[k] || 0) + items.nutrients[k];
      state.discovered.nutrients[k] = true;
    }
    rememberGift(state.giftsOpened, gift.id);
    emit('giftOpened', { from: gift.from, items: items });
    return { ok: true, items: items, from: gift.from };
  };

  // ---- Trading between friends -----------------------------------------
  // Three steps, all by code and without a server:
  //   1. A proposes: "I give X, I want Y". X is set aside in A's barn (state.tradesOut).
  //   2. B accepts: B pays Y, receives X and gets a reply ("deal") to send back.
  //   3. A enters the reply and receives Y, exactly as written in A's own offer.
  // Like gifts this runs on trust between friends.

  function hasItems(state, items) {
    var k;
    if (items.coins > Math.floor(state.coins) || items.crumbs > state.crumbs) return false;
    for (k in items.seeds) if (items.seeds[k] > (state.seeds[k] || 0)) return false;
    for (k in items.nutrients) if (items.nutrients[k] > (state.nutrients[k] || 0)) return false;
    return true;
  }
  function moveItems(state, items, sign) {
    var k;
    state.coins += sign * items.coins;
    state.crumbs += sign * items.crumbs;
    for (k in items.seeds) state.seeds[k] = (state.seeds[k] || 0) + sign * items.seeds[k];
    for (k in items.nutrients) state.nutrients[k] = (state.nutrients[k] || 0) + sign * items.nutrients[k];
    if (sign > 0) {
      if (items.crumbs) state.discovered.nutrients.crumbs = true;
      for (k in items.nutrients) state.discovered.nutrients[k] = true;
    }
  }
  function newCodeId() {
    var id = '', chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (var i = 0; i < 12; i++) id += chars.charAt(Math.floor(L.rng() * chars.length));
    return id;
  }

  /** Step 1: sets the offered items aside and returns the trade to send. */
  L.makeTrade = function (state, giveRaw, wantRaw) {
    var give = L.cleanGiftItems(giveRaw), want = L.cleanGiftItems(wantRaw);
    if (!give || !want) return fail('empty');
    if (Object.keys(state.tradesOut).length >= C.GIFTS.maxOpenTrades) return fail('toomany');
    if (!hasItems(state, give)) return fail('short');
    moveItems(state, give, -1);
    var id = newCodeId();
    state.tradesOut[id] = { give: give, want: want, at: Date.now() };
    emit('tradeOffered', { id: id });
    return { ok: true, id: id, trade: L.tradeFor(state, id) };
  };

  /** The trade object (as sent to a friend) for one of your open offers, or null. */
  L.tradeFor = function (state, id) {
    var t = state.tradesOut[id];
    return t ? { v: C.VERSION, kind: 'trade', id: id, from: state.barnName, at: t.at, give: t.give, want: t.want } : null;
  };

  /** Why this barn cannot accept a trade: 'invalid' | 'own' | 'used' | 'short', or null if it can. */
  L.tradeProblem = function (state, trade) {
    var give = trade && L.cleanGiftItems(trade.give), want = trade && L.cleanGiftItems(trade.want);
    if (!give || !want || typeof trade.id !== 'string' || !trade.id) return 'invalid';
    if (state.tradesOut[trade.id]) return 'own';
    if (state.giftsOpened[trade.id]) return 'used';
    if (!hasItems(state, want)) return 'short';
    return null;
  };

  /** Step 2: pays what is asked, receives what is offered, returns the reply to send back. */
  L.acceptTrade = function (state, trade) {
    var problem = L.tradeProblem(state, trade);
    if (problem) return fail(problem);
    var give = L.cleanGiftItems(trade.give), want = L.cleanGiftItems(trade.want);
    moveItems(state, want, -1);
    moveItems(state, give, 1);
    rememberGift(state.giftsOpened, trade.id);
    emit('tradeAccepted', { from: trade.from, items: give });
    return { ok: true, items: give, paid: want,
      deal: { v: C.VERSION, kind: 'deal', id: trade.id, from: state.barnName, at: Date.now() } };
  };

  /** Step 3: the reply arrives; hand over what the original offer asked for. */
  L.completeTrade = function (state, deal) {
    var t = deal && typeof deal.id === 'string' ? state.tradesOut[deal.id] : null;
    if (!t) return fail('unknown');
    moveItems(state, t.want, 1);
    delete state.tradesOut[deal.id];
    emit('tradeDone', { from: deal.from, items: t.want });
    return { ok: true, items: t.want, from: deal.from };
  };

  /** Takes an open offer back. Only fair if the friend has not accepted it. */
  L.cancelTrade = function (state, id) {
    var t = state.tradesOut[id];
    if (!t) return fail('unknown');
    moveItems(state, t.give, 1);
    delete state.tradesOut[id];
    return { ok: true, items: t.give };
  };

  // ---- Travelling merchant -------------------------------------------
  // Both only look at shop plants; rare plants never count as "unlocked".
  function bestUnlocked(state) {
    var best = C.SPECIES[0];
    for (var i = 0; i < C.SPECIES.length; i++) if (!C.SPECIES[i].rare && state.unlocked[C.SPECIES[i].id]) best = C.SPECIES[i];
    return best;
  }
  function nextLocked(state) {
    for (var i = 0; i < C.SPECIES.length; i++) if (!C.SPECIES[i].rare && !state.unlocked[C.SPECIES[i].id]) return C.SPECIES[i];
    return null;
  }

  L.makeOffer = function (state) {
    var roll = L.rng(), best = bestUnlocked(state), locked = nextLocked(state);
    if (roll < 0.3) {
      return { kind: 'crumbs', qty: 3, price: Math.max(40, Math.round(best.value * 2.5)),
        title: '3 Comet Crumbs', desc: 'Swept up fresh this morning. ' + C.CRUMBS.effect, sold: false };
    }
    if (roll < 0.55) {
      var sum = 0;
      for (var i = 0; i < C.NUTRIENTS.length; i++) sum += C.NUTRIENTS[i].cost;
      return { kind: 'bundle', qty: 4, price: Math.round(sum * 4 * 0.6),
        title: 'Sampler Crate', desc: '4 of every nutrient at 40% off. Does not touch the shop stock.', sold: false };
    }
    if (roll < 0.85) {
      if (locked) {
        return { kind: 'seeds', species: locked.id, qty: 3, price: Math.round(locked.seedCost * 3 * 1.3),
          title: '3 ' + locked.name + ' seeds', desc: 'A taste of something you have not unlocked yet.', sold: false };
      }
      return { kind: 'seeds', species: best.id, qty: 5, price: Math.round(best.seedCost * 5 * 0.5),
        title: '5 ' + best.name + ' seeds', desc: 'Half price, because the cart is heavy.', sold: false };
    }
    return { kind: 'sunshine', qty: 1, price: Math.max(400, Math.round(state.seasonEarned * 0.04)),
      title: 'A jar of Sunshine', desc: 'One bottled sunbeam, slightly used.', sold: false };
  };

  L.buyOffer = function (state) {
    var ev = state.events, o = ev.offer;
    if (!o || ev.merchant <= 0) return fail('gone');
    if (o.sold) return fail('sold');
    if (state.coins < o.price) return fail('funds');
    state.coins -= o.price;
    o.sold = true;
    if (o.kind === 'crumbs') { state.crumbs += o.qty; state.discovered.nutrients.crumbs = true; }
    if (o.kind === 'bundle') {
      for (var i = 0; i < C.NUTRIENTS.length; i++) {
        var id = C.NUTRIENTS[i].id;
        state.nutrients[id] = (state.nutrients[id] || 0) + o.qty;
        state.discovered.nutrients[id] = true;
      }
    }
    if (o.kind === 'seeds') state.seeds[o.species] = (state.seeds[o.species] || 0) + o.qty;
    if (o.kind === 'sunshine') state.sunshine += o.qty;
    emit('buy', { kind: 'offer', cost: o.price });
    return { ok: true };
  };

  // ---- Rare seed offers (event-only plants) ---------------------------
  /** Every rare plant that belongs to an event kind (some events have two). */
  L.raresFor = function (kind) {
    return C.SPECIES.filter(function (sp) { return sp.rare === kind; });
  };
  /** The first rare plant of an event kind, or null. */
  L.rareFor = function (kind) { return L.raresFor(kind)[0] || null; };
  /** Rare offers only start once the barn is far enough along to afford them. */
  L.rareOpen = function (state) { return !!state.unlocked[C.RARE.needs]; };

  /** Puts a rare seed on offer for a while (replaces any older offer). */
  L.offerRare = function (state, id) {
    var sp = C.SPECIES_BY_ID[id];
    if (!sp || !sp.rare) return fail('unknown');
    state.events.rare = { species: id, price: sp.price, t: C.RARE.offerTime };
    emit('rareOffer', { species: id, price: sp.price });
    return { ok: true };
  };

  /** When an event starts: sometimes its rare plant is offered too. */
  function maybeRareOffer(state, kind) {
    var list = L.raresFor(kind);
    if (!list.length || !L.rareOpen(state) || state.events.rare) return;   // no extra dice roll before that (keeps tests stable)
    if (L.rng() >= C.RARE.chance) return;
    var sp = list.length > 1 ? list[Math.floor(L.rng() * list.length)] : list[0];
    L.offerRare(state, sp.id);
  }

  L.buyRare = function (state) {
    var o = state.events.rare;
    if (!o) return fail('gone');
    if (state.coins < o.price) return fail('funds');
    state.coins -= o.price;
    state.seeds[o.species] = (state.seeds[o.species] || 0) + 1;
    state.events.rare = null;
    emit('buy', { kind: 'rare', species: o.species, cost: o.price });
    return { ok: true, species: o.species };
  };

  /** Growing Honeyhearts that attract the lucky bee (capped). */
  function honeyhearts(state) {
    var n = 0;
    for (var i = 0; i < state.pots.length; i++) {
      var p = state.pots[i].plant;
      if (p && !p.dead && C.SPECIES_BY_ID[p.species].beeLure) n++;
    }
    return Math.min(n, C.RARE.maxHoneyhearts);
  }

  /** Slot of the first living Gobblepot Pitcher (it catches every pest), or -1. */
  function pestEater(state) {
    for (var i = 0; i < state.pots.length; i++) {
      var p = livePlant(state, i);
      if (p && L.species(p).eatsPests) return i;
    }
    return -1;
  }

  /** Extra golden chance from Fortune Bamboo in the barn. Does not stack. */
  L.barnLuck = function (state) {
    var best = 0;
    for (var i = 0; i < state.pots.length; i++) {
      var p = livePlant(state, i);
      if (p && L.species(p).luck > best) best = L.species(p).luck;
    }
    return best;
  };
  /** Chance that a well-kept plant ripens golden. */
  L.goldenChance = function (state) {
    return C.QUALITY.goldenChance + L.eff(state, 'clover') + L.eff(state, 'hLuck') + L.barnLuck(state);
  };

  /** Puffcloud rain: tops pot j up towards the middle of its comfy zone. */
  function drizzleOn(state, j, amount) {
    var q = livePlant(state, j);
    if (!q) return;
    var sp = L.species(q), mid = (sp.water[0] + sp.water[1]) / 2;
    if (q.water < mid) q.water = Math.min(mid, q.water + amount);
  }

  // ==================================================================
  // Orders
  // ==================================================================
  L.makeOrder = function (state) {
    var pool = [], i;
    for (i = 0; i < C.SPECIES.length; i++) {
      if (!C.SPECIES[i].rare && state.unlocked[C.SPECIES[i].id]) for (var w = 0; w <= i; w++) pool.push(C.SPECIES[i]);
    }
    var sp = pool[Math.floor(L.rng() * pool.length)] || C.SPECIES[0];
    var qty = sp.growTime > 300 ? 1 + Math.floor(L.rng() * 2) : 2 + Math.floor(L.rng() * 4);
    var roll = L.rng();
    var minStars = roll < 0.65 ? 1 : (roll < 0.9 ? 3 : 4);
    var picky = minStars === 1 ? 1 : (minStars === 3 ? 1.3 : 1.7);
    var reward = Math.round(sp.value * qty * C.ORDERS.rewardFactor * picky *
      (1 + L.eff(state, 'chalk') + L.eff(state, 'hOrders')) * L.sellMultiplier(state));
    var sun = minStars >= 3 && L.rng() < C.ORDERS.sunshineChance ? 1 : 0;
    var crumbs = !sun && L.rng() < 0.12 ? 1 : 0;
    return {
      id: state.orderSeq++, who: CUSTOMERS[Math.floor(L.rng() * CUSTOMERS.length)],
      species: sp.id, qty: qty, done: 0, minStars: minStars, reward: reward, sun: sun, crumbs: crumbs
    };
  };

  function progressOrders(state, speciesId, stars) {
    for (var k = 0; k < state.orders.length; k++) {
      var o = state.orders[k];
      if (!o || o.species !== speciesId || stars < o.minStars) continue;
      o.done++;
      if (o.done >= o.qty) {
        earn(state, o.reward);
        state.sunshine += o.sun;
        state.crumbs += o.crumbs;
        if (o.crumbs) state.discovered.nutrients.crumbs = true;
        state.stats.ordersDone++;
        state.orders[k] = null;
        state.orderCooldown[k] = C.ORDERS.cooldown;
        emit('order', { order: o });
      }
      return;   // one harvest counts for one order only
    }
  }

  L.skipOrder = function (state, k) {
    if (!state.orders[k]) return fail('none');
    state.orders[k] = null;
    state.orderCooldown[k] = C.ORDERS.skipCooldown;
    return { ok: true };
  };

  function tickOrders(state, dt) {
    if (state.stats.harvests < C.ORDERS.unlockHarvests) return;
    for (var k = 0; k < C.ORDERS.count; k++) {
      if (state.orders[k]) continue;
      state.orderCooldown[k] = (state.orderCooldown[k] || 0) - dt;
      if (state.orderCooldown[k] <= 0) {
        state.orders[k] = L.makeOrder(state);
        emit('newOrder', { order: state.orders[k] });
      }
    }
  }

  // ==================================================================
  // Random events
  // ==================================================================
  /** Event weights right now: a growing Honeyheart makes the lucky bee more likely. */
  L.eventWeights = function (state) {
    var w = {}, k;
    for (k in C.EVENTS.weights) w[k] = C.EVENTS.weights[k];
    if (state) w.bee += C.RARE.beeWeightEach * honeyhearts(state);
    return w;
  };
  L.pickEvent = function (state) {
    var w = L.eventWeights(state), total = 0, k;
    for (k in w) total += w[k];
    var r = L.rng() * total;
    for (k in w) { r -= w[k]; if (r <= 0) return k; }
    return 'bee';
  };

  L.triggerEvent = function (state, kind) {
    var ev = state.events;
    if (kind === 'pest') {
      // A Gobblepot Pitcher catches the bug before it reaches any other plant.
      var eater = pestEater(state);
      if (eater >= 0) {
        var gp = state.pots[eater].plant;
        if (gp.growth < 1) gp.growth = Math.min(0.999, gp.growth + L.species(gp).snack);
        state.stats.eventsSeen++;
        state.stats.pestsBeaten++;
        emit('eventStart', { kind: 'pest', slot: eater, eaten: true });
        maybeRareOffer(state, 'pest');
        return 'pest';
      }
      var candidates = [];
      for (var i = 0; i < state.pots.length; i++) {
        var p = livePlant(state, i);
        if (p && p.pest <= 0 && !(p.nutrients.tonic > 0)) candidates.push(i);
      }
      if (candidates.length === 0) kind = 'bee';
      else {
        var slot = candidates[Math.floor(L.rng() * candidates.length)];
        state.pots[slot].plant.pest = C.EVENTS.pestHp;
        state.pots[slot].plant.pestT = 0;
        state.stats.eventsSeen++;
        emit('eventStart', { kind: 'pest', slot: slot });
        maybeRareOffer(state, 'pest');
        return 'pest';
      }
    }
    if (kind === 'heat') { ev.heat = C.EVENTS.heatDuration; ev.rain = 0; }
    else if (kind === 'rain') { ev.rain = C.EVENTS.rainDuration; ev.heat = 0; }
    else if (kind === 'bee') { ev.bee = C.EVENTS.beeDuration; ev.beeClicked = false; }
    else if (kind === 'merchant') { ev.merchant = C.EVENTS.merchantDuration; ev.offer = L.makeOffer(state); }
    else return null;
    state.stats.eventsSeen++;
    emit('eventStart', { kind: kind });
    maybeRareOffer(state, kind);
    return kind;
  };

  function tickEvents(state, dt, env) {
    var ev = state.events, kinds = ['heat', 'rain', 'bee', 'merchant'];
    for (var i = 0; i < kinds.length; i++) {
      var k = kinds[i];
      if (ev[k] > 0) {
        ev[k] -= dt;
        if (ev[k] <= 0) {
          ev[k] = 0;
          if (k === 'merchant') ev.offer = null;
          emit('eventEnd', { kind: k });
        }
      }
    }
    if (ev.rare) {
      ev.rare.t -= dt;
      if (ev.rare.t <= 0) { emit('rareGone', { species: ev.rare.species }); ev.rare = null; }
    }
    if (!env.events || env.offline) return;
    ev.next -= dt;
    if (ev.next <= 0) {
      ev.next = rand(C.EVENTS.minGap, C.EVENTS.maxGap);
      L.triggerEvent(state, L.pickEvent(state));
    }
  }

  /** The lucky bee can be clicked once per visit for a small tip. */
  L.clickBee = function (state) {
    var ev = state.events;
    if (ev.bee <= 0 || ev.beeClicked) return fail('nobee');
    var tip = Math.round(10 + bestUnlocked(state).value * 1.5 * L.sellMultiplier(state));
    ev.beeClicked = true;
    earn(state, tip);
    state.stats.beeClicks++;
    emit('beeTip', { coins: tip });
    return { ok: true, coins: tip };
  };

  L.petCat = function (state) {
    if (!state.cat) return fail('nocat');
    state.stats.catPets++;
    emit('catPet', {});
    return { ok: true };
  };

  // ==================================================================
  // Simulation tick
  // ==================================================================
  function updatePlant(state, pot, i, dt, env) {
    var p = pot.plant;
    if (!p || p.dead) return;
    var sp = L.species(p), lo = sp.water[0], hi = sp.water[1], k;
    p.age += dt;

    // Nutrients wear off.
    var decay = C.NUTRIENT.decay / (1 + L.eff(state, 'slowRelease')) * dt;
    for (k in p.nutrients) if (p.nutrients[k] > 0) p.nutrients[k] = Math.max(0, p.nutrients[k] - decay);

    // Water: drain, free rain water, and the neighbour's offline watering.
    p.water = Math.max(0, p.water - L.drainRate(state, p) * dt);
    if (state.events.rain > 0) {
      var mid = (lo + hi) / 2;
      if (p.water < mid) p.water = Math.min(mid, p.water + C.EVENTS.rainWater * dt);
    }
    if (env.offline && p.water < lo * C.OFFLINE.waterFloor) p.water = lo * C.OFFLINE.waterFloor;
    if (sp.drizzle) for (k = i - 1; k <= i + 1; k++) drizzleOn(state, k, sp.drizzle * dt);   // Puffcloud Nimbus

    // Pests.
    var tonic = L.nutStrength(state, p, 'tonic');
    if (p.pest > 0) {
      p.pestT += dt;
      var bugs = L.level(state, 'ladybugs');
      var byBugs = bugs > 0 && p.pestT >= C.EVENTS.ladybugDelays[bugs - 1];
      if (tonic > 0 || byBugs) {
        p.pest = 0; p.pestT = 0;
        state.stats.pestsBeaten++;
        emit('pestGone', { slot: i, by: tonic > 0 ? 'tonic' : 'ladybugs' });
      }
    }

    // Health. Nothing can hurt a plant while the player is away.
    var fit = L.waterFit(sp, p.water);
    var soil = L.eff(state, 'soil');
    var dmg = 0;
    if (!env.offline) {
      if (p.water <= 0) dmg += C.HEALTH.dryDamage;
      if (p.water > hi + C.WATER.soggyMargin) dmg += C.HEALTH.soggyDamage;
      if (p.pest > 0) dmg += C.HEALTH.pestDamage;
    }
    if (dmg > 0) p.health -= dmg * (1 - soil) * dt;
    else if (fit >= C.HEALTH.regenFit) p.health += C.HEALTH.regen * (1 + soil) * dt;
    if (tonic > 0) p.health += C.HEALTH.tonicHeal * tonic * dt;
    var spa = hasSynergy(p, 'spa');
    if (spa) p.health += C.HEALTH.spaHeal * dt;
    if (p.health > 100) p.health = 100;
    if (p.health <= 0) {
      p.health = 0; p.dead = true; p.pest = 0;
      state.stats.deaths++;
      emit('died', { slot: i, species: sp.id });
      return;
    }

    // Growth and quality.
    if (p.growth < 1) {
      var care = L.care(p);
      var sample = care * C.QUALITY.careWeight +
        Math.min(C.QUALITY.jamCap, C.QUALITY.jamBonus * L.nutStrength(state, p, 'jam')) +
        (spa ? C.QUALITY.spaBonus : 0);
      p.qSum += sample * dt;
      p.qTime += dt;
      p.growth += L.growthRate(state, p) * dt;
      if (p.growth >= 1) {
        p.growth = 1;
        p.ripeAge = 0;
        p.golden = L.quality(p) >= C.QUALITY.goldenMinQuality && L.rng() < L.goldenChance(state);
        emit('matured', { slot: i, species: sp.id, golden: p.golden });
      }
    } else if (env.offline) {
      // Ripe plants wait patiently for the player instead of going past prime.
      p.ripeAge = Math.min(p.ripeAge + dt, L.primeWindow(sp) * 0.99);
    } else {
      p.ripeAge += dt;
    }
  }

  /** Helpers: sprinkler, butler bee, hedgehog and squirrel. */
  function automate(state, pot, i, dt) {
    var p = pot.plant;
    if (p && !p.dead) {
      var sp = L.species(p);
      if (i < L.sprinklerCoverage(state) && p.water < sp.water[0] + C.WATER.thirstyMargin && state.tank >= 5) {
        var target = sp.water[1] - C.WATER.autoTopMargin;
        if (pourInto(state, i, target - p.water, target) > 0) emit('sprinkle', { slot: i });
      }
      if (p.growth < 1 && L.level(state, 'butler') > 0) {
        for (var k = 0; k < sp.likes.length; k++) {
          var id = sp.likes[k];
          if (p.nutrients[id] <= 0 && state.nutrients[id] > 0) L.feed(state, i, id, { auto: true });
        }
      }
      var hog = L.level(state, 'hedgehog');
      if (hog > 0 && p.growth >= 1 && p.ripeAge >= C.AUTO.hedgehogDelays[hog - 1]) {
        L.harvest(state, i, { auto: true });
      }
      return;
    }
    if (!p && pot.memo) {
      var sq = L.level(state, 'squirrel');
      if (sq < 1) return;
      pot.idle += dt;
      if (pot.idle < C.AUTO.squirrelDelay) return;
      pot.idle = 0;
      if (!(state.seeds[pot.memo] > 0) && sq >= 2 && state.unlocked[pot.memo]) L.buySeed(state, pot.memo, 1);
      if (state.seeds[pot.memo] > 0) L.plant(state, i, pot.memo, { auto: true });
    }
  }

  /** Never leave the player with no coins, no seeds and nothing growing. */
  function safeguard(state) {
    if (state.coins >= L.seedCost(state, 'mint')) return;
    if (L.totalSeeds(state) > 0 || L.livingCount(state) > 0) return;
    state.seeds.mint = (state.seeds.mint || 0) + 2;
    emit('charity', {});
  }

  L.checkAchievements = function (state) {
    for (var i = 0; i < C.ACHIEVEMENTS.length; i++) {
      var a = C.ACHIEVEMENTS[i];
      if (state.achievements[a.id]) continue;
      if (a.value(state) >= a.goal) {
        state.achievements[a.id] = true;
        state.sunshine += C.ACHIEVEMENT_REWARD;
        emit('achievement', { id: a.id });
      }
    }
  };

  /** Advances the whole barn by dt seconds. env: { events, offline }. */
  L.tick = function (state, dt, env) {
    env = env || DEFAULT_ENV;
    state.time += dt;
    if (!env.offline) state.playTime += dt;

    var refill = L.tankRefill(state) * (state.events.rain > 0 ? C.EVENTS.rainTankMult : 1);
    state.tank = Math.min(L.tankCapacity(state), state.tank + refill * dt);

    var day = L.day(state);
    if (day !== state.stockDay) {
      state.stockDay = day;
      L.fillStock(state);
      emit('newDay', { day: day });
    }

    tickEvents(state, dt, env);
    for (var i = 0; i < state.pots.length; i++) {
      updatePlant(state, state.pots[i], i, dt, env);
      automate(state, state.pots[i], i, dt);
    }
    tickOrders(state, dt);

    state.secondAcc += dt;
    if (state.secondAcc >= 1) {
      state.secondAcc = 0;
      safeguard(state);
      L.checkAchievements(state);
      if (!state.cat && state.playTime >= C.CAT_ARRIVES_AT) { state.cat = true; emit('catArrives', {}); }
      if (!state.seasonReady && L.canPrestige(state)) { state.seasonReady = true; emit('seasonReady', {}); }
    }
  };

  // ==================================================================
  // Offline progress
  // ==================================================================
  // ==================================================================
  // Prestige: "New Season"
  // ==================================================================
  /** Permanent growth and sell bonus from past seasons. */
  L.prestigeBonus = function (state) { return C.PRESTIGE.bonusPerLevel * (state.prestige || 0); };
  /** Coins to earn this season before a New Season can start. */
  L.prestigeGoal = function (state) {
    return Math.round(C.PRESTIGE.firstGoal * Math.pow(C.PRESTIGE.goalMult, state.prestige || 0));
  };
  L.canPrestige = function (state) { return state.seasonEarned >= L.prestigeGoal(state); };
  /** Heirloom Seeds a New Season would give right now (0 before the goal is reached). */
  L.heirloomGain = function (state) {
    if (!L.canPrestige(state)) return 0;
    var ratio = state.seasonEarned / L.prestigeGoal(state);
    return Math.floor(C.PRESTIGE.heirloomsAtGoal * Math.pow(ratio, C.PRESTIGE.heirloomPower) * (1 + L.eff(state, 'hHeir')));
  };

  // Things a New Season never resets.
  var SEASON_KEEPS = ['createdAt', 'time', 'playTime', 'sunshine', 'heirlooms', 'achievements', 'discovered',
    'potStyle', 'potStyles', 'cat', 'catSkin', 'catSkins', 'barnName', 'stats', 'orderSeq',
    'giftsSent', 'giftsOpened', 'lastGiftCode', 'lastDealCode', 'trophies'];
  // What each level of Loyal Helpers keeps (cumulative).
  var LOYAL_HELPERS = [['spout', 'whistle', 'scythe'], ['sprinkler', 'hedgehog'], ['squirrel', 'ladybugs']];

  /**
   * Starts a New Season. Returns { ok, state, heirlooms } with a brand new
   * state object; the old one should be thrown away.
   */
  L.prestige = function (state) {
    if (!L.canPrestige(state)) return fail('goal');
    if (Object.keys(state.tradesOut).length) return fail('trades');   // set-aside items must not cross seasons
    var gain = L.heirloomGain(state), next = S.newGame(), i, id;
    for (i = 0; i < SEASON_KEEPS.length; i++) next[SEASON_KEEPS[i]] = state[SEASON_KEEPS[i]];
    next.prestige = (state.prestige || 0) + 1;
    next.heirlooms += gain;
    next.stats.heirloomsEarned += gain;
    next.tutorial.done = true;

    // Sunshine and Heirloom upgrades stay; coin upgrades start over.
    for (id in state.upgrades) {
      var u = C.UPGRADES_BY_ID[id];
      if (u && u.currency) next.upgrades[id] = state.upgrades[id];
    }
    // Head starts bought with Heirloom Seeds.
    next.coins += L.eff(next, 'hStart');
    var extraPots = L.eff(next, 'hPots');
    for (i = 0; i < extraPots; i++) next.pots.push(S.newPot());
    if (extraPots) next.upgrades.slots = extraPots;
    for (i = 0; i < L.eff(next, 'hSpecies'); i++) next.unlocked[C.SPECIES[i].id] = true;
    for (i = 0; i < L.level(next, 'hHelpers'); i++) {
      LOYAL_HELPERS[i].forEach(function (h) { next.upgrades[h] = Math.max(1, next.upgrades[h] || 0); });
    }
    next.tank = L.tankCapacity(next);
    // Rare plants cannot be bought again, so they come along: seeds in the bag
    // stay, and a living rare plant goes back into the bag as a seed.
    var rare = L.rareSeedsKept(state);
    for (id in rare) next.seeds[id] = rare[id];
    return { ok: true, state: next, heirlooms: gain };
  };

  /** Rare seeds a New Season would carry over: the bag plus one per living rare plant. */
  L.rareSeedsKept = function (state) {
    var out = {}, i, id;
    for (i = 0; i < C.SPECIES.length; i++) {
      id = C.SPECIES[i].id;
      if (C.SPECIES[i].rare && state.seeds[id] > 0) out[id] = state.seeds[id];
    }
    for (i = 0; i < state.pots.length; i++) {
      var p = state.pots[i].plant;
      if (p && !p.dead && C.SPECIES_BY_ID[p.species].rare) out[p.species] = (out[p.species] || 0) + 1;
    }
    return out;
  };

  L.offlineLimits = function (state) {
    var h = L.level(state, 'hammock');
    return { cap: (C.OFFLINE.baseHours + h + L.eff(state, 'hNap')) * 3600, efficiency: C.OFFLINE.baseEfficiency + 0.1 * h };
  };

  /**
   * Fast-forwards the barn after an absence of `elapsed` real seconds.
   * Fairness rules: time is capped and slowed, no random events, no damage,
   * a neighbour keeps pots from drying out completely, and ripe plants wait.
   */
  L.simulateOffline = function (state, elapsed) {
    var lim = L.offlineLimits(state);
    var away = Math.max(0, elapsed || 0);
    var counted = Math.min(away, lim.cap);
    var sim = counted * lim.efficiency;
    var st = state.stats;
    var before = { coins: st.coinsEarned, harvests: st.harvests, orders: st.ordersDone, sunshine: state.sunshine };
    var env = { events: false, offline: true };
    var wasMuted = L.muted;
    L.muted = true;
    var t = sim;
    while (t > 0) {
      var d = Math.min(C.OFFLINE.step, t);
      L.tick(state, d, env);
      t -= d;
    }
    L.muted = wasMuted;
    state.events.next = Math.max(state.events.next, 30);
    var thirsty = 0;
    for (var i = 0; i < state.pots.length; i++) {
      var p = state.pots[i].plant;
      if (p && !p.dead && L.isThirsty(p)) thirsty++;
    }
    return {
      away: away, counted: counted, simulated: sim, capped: away > lim.cap, efficiency: lim.efficiency,
      coins: st.coinsEarned - before.coins, harvests: st.harvests - before.harvests,
      orders: st.ordersDone - before.orders, sunshine: state.sunshine - before.sunshine,
      ready: L.readyCount(state), thirsty: thirsty
    };
  };

  BB.Logic = L;
  if (typeof module !== 'undefined' && module.exports) module.exports = BB;
})(typeof window !== 'undefined' ? window : globalThis);
