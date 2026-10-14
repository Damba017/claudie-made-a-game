/*
 * Barn Bloom - balance simulation
 * ------------------------------------------------------------------
 * A scripted "reasonable player" plays the pure game logic for a while
 * and reports how progression went. Used to tune js/config.js.
 * Runs from tests/tests.html or with: node tests/balance.js
 *
 * The bot is deliberately plain: it waters, harvests, replants the most
 * profitable species it owns and buys the cheapest useful thing it can
 * afford. It never uses nutrients, so a real player should do better.
 */
(function (root) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports && typeof require === 'function' && !root.BB) {
    require('../js/config.js'); require('../js/state.js'); require('../js/logic.js'); require('../js/combat.js'); require('../js/save.js');
  }
  var BB = root.BB, C = BB.CONFIG, S = BB.State, L = BB.Logic;

  function seeded(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // Things the bot is willing to buy, besides seeds and species unlocks.
  var WISHLIST = ['slots', 'spout', 'can', 'stall', 'pump', 'tank', 'whistle', 'scythe', 'sprinkler', 'hedgehog',
    'squirrel', 'lamps', 'hat', 'splash', 'soil', 'ladybugs', 'chalk', 'glaze', 'chorus', 'clover'];

  function profitRate(state, sp) {
    var harvests = sp.harvests || 1;
    var time = sp.growTime + (harvests - 1) * sp.growTime * (1 - (sp.regrow || 0));
    return (sp.value * 1.6 * L.sellMultiplier(state) * harvests - L.seedCost(state, sp.id)) / time;
  }
  function bestSpecies(state) {
    var best = null, bestRate = -1;
    C.SPECIES.forEach(function (sp) {
      if (!state.unlocked[sp.id]) return;
      if (state.coins < L.seedCost(state, sp.id) && !(state.seeds[sp.id] > 0)) return;
      var r = profitRate(state, sp);
      if (r > bestRate) { bestRate = r; best = sp; }
    });
    return best;
  }

  /**
   * opts: { minutes, actionsPerSecond, seed, events }
   * Returns { checkpoints: [...], text }
   */
  function simulate(opts) {
    var minutes = opts.minutes || 30, aps = opts.actionsPerSecond || 1.5;
    L.rng = seeded(opts.seed || 7);
    L.drain();
    var st = S.newGame();
    st.tutorial.done = true;
    var env = { events: opts.events !== false, offline: false };
    var budget = 0, t = 0, total = minutes * 60;
    var marks = [1, 2, 5, 10, 15, 20, 30, 45, 60, 90, 120].filter(function (m) { return m <= minutes; });
    var checkpoints = [], log = [], lastEarned = 0, lastEarnT = 0, longestDry = 0, tankEmpty = 0;

    function note(text) { log.push('    ' + clock(t) + '  ' + text); }
    function clock(s) { var m = Math.floor(s / 60), x = Math.floor(s % 60); return (m < 10 ? ' ' : '') + m + ':' + (x < 10 ? '0' : '') + x; }

    function act() {
      var i, p, sp;
      // 1. harvest
      for (i = 0; i < st.pots.length && budget >= 1; i++) {
        if (L.isReady(st.pots[i].plant) && L.harvest(st, i).ok) budget--;
      }
      // 2. clear the dead
      for (i = 0; i < st.pots.length && budget >= 1; i++) {
        p = st.pots[i].plant;
        if (p && p.dead) { L.clear(st, i); budget--; }
      }
      // 3. shoo pests
      for (i = 0; i < st.pots.length && budget >= 1; i++) {
        p = st.pots[i].plant;
        if (p && !p.dead && p.pest > 0) { L.shoo(st, i); budget--; }
      }
      // 4. water the thirsty (one tap of the whistle if owned)
      var thirsty = [];
      for (i = 0; i < st.pots.length; i++) {
        p = st.pots[i].plant;
        if (p && !p.dead) { sp = L.species(p); if (p.water < sp.water[0] + 4 && i >= L.sprinklerCoverage(st)) thirsty.push(i); }
      }
      if (thirsty.length >= 2 && L.level(st, 'whistle') > 0 && budget >= 1) { if (L.waterAll(st).ok) budget--; }
      else {
        for (i = 0; i < thirsty.length && budget >= 1; i++) {
          var r = L.water(st, thirsty[i]);
          if (r.ok) budget--; else if (r.reason === 'tank') { tankEmpty++; break; }
        }
      }
      // 5. plant
      for (i = 0; i < st.pots.length && budget >= 1; i++) {
        if (st.pots[i].plant) continue;
        var best = bestSpecies(st);
        if (!best) break;
        if (!(st.seeds[best.id] > 0)) L.buySeed(st, best.id, 1);
        if (L.plant(st, i, best.id).ok) budget--;
      }
    }

    function shop() {
      // Keep enough coins back to replant the whole barn once.
      var best = bestSpecies(st);
      var reserve = best ? L.seedCost(st, best.id) * Math.min(st.pots.length, 6) : 0;
      var options = [];
      for (var i = 0; i < C.SPECIES.length; i++) {
        var sp = C.SPECIES[i];
        if (!st.unlocked[sp.id]) {
          if (!sp.unlockSun || st.sunshine >= sp.unlockSun) options.push({ cost: sp.unlock, kind: 'species', id: sp.id, name: 'unlock ' + sp.name });
          break;   // only ever consider the next species
        }
      }
      WISHLIST.forEach(function (id) {
        var u = C.UPGRADES_BY_ID[id];
        if (L.level(st, id) >= L.upgradeMax(st, id) || L.upgradeLock(st, id)) return;
        var cur = u.currency || 'coins', cost = L.upgradeCost(st, id);
        if (cur === 'sunshine') { if (st.sunshine >= cost) options.push({ cost: 0, kind: 'upgrade', id: id, name: u.name }); return; }
        if ((id === 'pump' || id === 'tank') && tankEmpty < 3) return;   // only when water actually runs short
        options.push({ cost: cost, kind: 'upgrade', id: id, name: u.name });
      });
      options.sort(function (a, b) { return a.cost - b.cost; });
      var pick = options[0];
      if (!pick || st.coins - pick.cost < reserve) return;
      if (pick.kind === 'species') { if (L.unlockSpecies(st, pick.id).ok) note(pick.name); }
      else if (L.buyUpgrade(st, pick.id).ok) {
        if (pick.id === 'pump' || pick.id === 'tank') tankEmpty = 0;
        note(pick.name + ' -> level ' + L.level(st, pick.id));
      }
    }

    var nextMark = 0, sinceShop = 0, sinceAct = 0;
    while (t < total) {
      L.tick(st, C.TICK, env);
      t += C.TICK; sinceShop += C.TICK; sinceAct += C.TICK;
      budget = Math.min(3, budget + aps * C.TICK);
      if (sinceAct >= 0.3) { sinceAct = 0; act(); }
      if (sinceShop >= 1) { sinceShop = 0; shop(); }
      if (st.stats.coinsEarned > lastEarned) { longestDry = Math.max(longestDry, t - lastEarnT); lastEarned = st.stats.coinsEarned; lastEarnT = t; }
      L.drain();
      if (nextMark < marks.length && t >= marks[nextMark] * 60) {
        var prev = checkpoints[checkpoints.length - 1];
        var species = C.SPECIES.filter(function (sp) { return st.unlocked[sp.id]; }).length;
        var levels = 0;
        for (var k in st.upgrades) levels += st.upgrades[k];
        checkpoints.push({
          minute: marks[nextMark], coins: Math.round(st.coins), earned: Math.round(st.stats.coinsEarned), pots: st.pots.length,
          species: species, upgradeLevels: levels, harvests: st.stats.harvests, deaths: st.stats.deaths, sunshine: st.sunshine,
          perMinute: Math.round((st.stats.coinsEarned - (prev ? prev.earned : 0)) / (marks[nextMark] - (prev ? prev.minute : 0)))
        });
        nextMark++;
      }
    }
    longestDry = Math.max(longestDry, t - lastEarnT);

    var lines = ['  min   coins   earned  /min  pots species upgrades harvests deaths sun'];
    checkpoints.forEach(function (c) {
      lines.push('  ' + pad(c.minute, 3) + pad(c.coins, 8) + pad(c.earned, 9) + pad(c.perMinute, 6) + pad(c.pots, 6) + pad(c.species, 8) +
        pad(c.upgradeLevels, 9) + pad(c.harvests, 9) + pad(c.deaths, 7) + pad(c.sunshine, 4));
    });
    lines.push('  longest stretch without income: ' + Math.round(longestDry) + 's');
    lines.push('  purchases:');
    L.rng = Math.random;
    return { checkpoints: checkpoints, longestDry: longestDry, final: st, text: lines.concat(log).join('\n') };
  }
  function pad(v, n) { v = String(v); while (v.length < n) v = ' ' + v; return v; }

  /** A player who ignores the barn completely: checks the no-dead-end safeguard. */
  function neglect(minutes) {
    L.rng = seeded(3);
    var st = S.newGame(), env = { events: true, offline: false }, t = 0;
    for (var i = 0; i < 3; i++) L.plant(st, i, 'mint');
    st.coins = 0;
    while (t < minutes * 60) { L.tick(st, C.TICK, env); t += C.TICK; }
    for (i = 0; i < st.pots.length; i++) if (st.pots[i].plant && st.pots[i].plant.dead) L.clear(st, i);
    for (i = 0; i < 20; i++) L.tick(st, C.TICK, env);
    L.rng = Math.random;
    L.drain();
    return { seeds: L.totalSeeds(st), coins: st.coins, deaths: st.stats.deaths };
  }

  /**
   * Every boss against a scripted fighter clicking 4 times per second, at the
   * boss's required prestige and Shear Sharpness level (and one level above),
   * with and without support upgrades and battle items, and two seasons later
   * with sharper shears. Damage stays between attempts, so the fighter keeps
   * trying (20 minutes apart) and the report shows how many tries it took.
   */
  function bossReport() {
    var K = BB.Combat, MAX = 12, lines = ['  boss               season sharp support items   result'];
    var SUPPORT = { none: {}, some: { snips: 3, potency: 3, nozzle: 3, brigade: 3, gloves: 2, swatter: 2, battleMulch: 2 } };
    // [extra seasons, extra sharpness levels, support, battle items]
    var CASES = [[0, 0, 'none', false], [0, 0, 'some', false], [0, 0, 'some', true], [0, 1, 'none', false], [2, 5, 'some', false]];
    C.BOSSES.forEach(function (b) {
      CASES.forEach(function (cs) {
        L.rng = seeded(5);
        var st = S.newGame(), k, r, tries = 0, now = 0;
        st.prestige = b.prestige + cs[0];
        for (k in SUPPORT[cs[2]]) st.upgrades[k] = SUPPORT[cs[2]][k];
        st.upgrades.sharp = b.sharp + cs[1];
        do {
          st.nutrients = { nitro: 3, gel: 3, jam: 3, tonic: 3 };
          r = K.simulate(st, b.id, { cps: 4, items: cs[3], now: now });
          if (!r.ok) break;
          K.finish(st, r.fight);
          tries++;
          now += (C.COMBAT.retryCooldown + 1) * 1000;
        } while (!r.won && tries < MAX);
        lines.push('  ' + padRight(b.name, 19) + pad(st.prestige, 6) + pad(st.upgrades.sharp, 6) + pad(cs[2], 8) + pad(cs[3] ? 'yes' : 'no', 6) + '   ' +
          (!r.ok ? 'cannot fight (' + r.reason + ')'
            : r.won ? 'WON on try ' + tries + (tries === 1 ? ' (' + Math.round(r.timeLeft) + 's left)' : '')
            : 'not beaten after ' + MAX + ' tries, boss at ' + Math.round(K.healthLeft(st, b.id) * 100) + '%'));
      });
    });
    L.rng = Math.random;
    return lines.join('\n');
  }
  function padRight(v, n) { v = String(v); while (v.length < n) v += ' '; return v; }

  function report() {
    var out = [], a = simulate({ minutes: 30, actionsPerSecond: 1.5, seed: 7 });
    out.push('Balance: attentive player (1.5 actions/second), 30 minutes'); out.push(a.text);
    var b = simulate({ minutes: 30, actionsPerSecond: 0.5, seed: 11 });
    out.push(''); out.push('Balance: relaxed player (0.5 actions/second), 30 minutes'); out.push(b.text.split('\n  purchases:')[0]);
    var c = simulate({ minutes: 120, actionsPerSecond: 1.5, seed: 21 });
    out.push(''); out.push('Balance: attentive player, 2 hours (long-term pacing)'); out.push(c.text.split('\n  purchases:')[0]);
    var n = neglect(10);
    out.push(''); out.push('Neglect test: 10 minutes without touching anything, zero coins');
    out.push('  plants lost: ' + n.deaths + ', seeds in the bag afterwards: ' + n.seeds + (n.seeds > 0 ? '  (safeguard works: never stuck)' : '  (STUCK!)'));
    out.push(''); out.push('Bosses: a scripted fighter at 4 clicks per second, trying again until it wins');
    out.push(bossReport());
    return out.join('\n');
  }

  BB.Balance = { simulate: simulate, neglect: neglect, report: report, bossReport: bossReport };
  if (typeof document === 'undefined') console.log(report());
})(typeof window !== 'undefined' ? window : globalThis);
