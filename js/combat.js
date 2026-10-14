/*
 * Barn Bloom - combat.js
 * ------------------------------------------------------------------
 * Boss fights in the Wild Patch. Pure logic like logic.js (no DOM),
 * so it runs in Node and in the test page.
 *
 * A fight is a plain object that is never saved: Combat.start() makes
 * one, Combat.tick() advances it, and the player acts through snip(),
 * spray(), useItem() and pop(). What happened is pushed to
 * fight.events for main.js to turn into sounds, particles and banners.
 * Combat.finish() pays out the reward once the fight is over.
 * The boss's remaining health is saved (state.bossHealth), so big bosses
 * are worn down over several attempts within a season.
 */
(function (root) {
  'use strict';
  var BB = root.BB = root.BB || {};
  var C = BB.CONFIG, L = BB.Logic, CB = C.COMBAT;
  var K = {};

  function fail(reason) { return { ok: false, reason: reason }; }
  function push(f, type, data) {
    data = data || {};
    data.type = type;
    if (f.events.length < 200) f.events.push(data);
  }
  function rand(a, b) { return a + (b - a) * L.rng(); }
  function moving(f, kind) { return !!(f.move && f.move.kind === kind); }

  // ==================================================================
  // Bosses, power and locks
  // ==================================================================
  K.boss = function (id) { return C.BOSSES_BY_ID[id]; };

  /** Damage of one snip at a Shear Sharpness level. */
  K.powerAt = function (lvl) { return Math.round(CB.shearBase * Math.pow(CB.shearGrowth, lvl)); };
  K.power = function (state) { return K.powerAt(L.level(state, 'sharp')); };

  /**
   * Health, armour and reward of a boss in the player's current season. Health
   * grows fast with every season above the boss's own (your shears do too);
   * armour only a little, so a boss you could hit never becomes unhittable.
   */
  K.stats = function (state, id) {
    var b = K.boss(id), above = Math.max(0, (state.prestige || 0) - b.prestige);
    return { hp: Math.round(b.hp * Math.pow(CB.seasonHpGrowth, above)),
      armor: Math.round(b.armor * (1 + CB.seasonArmorScaling * above)), heirlooms: b.heirlooms };
  };

  /** Share of its health a boss still has this season. Damage stays between attempts. */
  K.healthLeft = function (state, id) {
    var h = state.bossHealth && state.bossHealth[id];
    return typeof h === 'number' ? h : 1;
  };
  /** Writes the fight's health into the save, so the next attempt starts there. */
  function remember(state, f) {
    if (!f.won) state.bossHealth[f.id] = Math.max(0, f.hp / f.maxHp);
  }

  /**
   * Why a boss cannot be fought right now, or null if it can.
   * Returns { reason: prestige | sharp | beaten | cooldown, text, wait (seconds, for cooldown) }.
   */
  K.lock = function (state, id, now) {
    var b = K.boss(id);
    if ((state.prestige || 0) < b.prestige) return { reason: 'prestige', text: 'Unlocks at prestige ' + b.prestige };
    if (L.level(state, 'sharp') < b.sharp) return { reason: 'sharp', text: 'Needs Shear Sharpness level ' + b.sharp };
    if (state.bossesBeaten[id]) return { reason: 'beaten', text: 'Already beaten this season' };
    var wait = ((state.bossRetryAt[id] || 0) - now) / 1000;
    if (wait > 0) return { reason: 'cooldown', wait: wait, text: 'Still recovering from your last attempt' };
    return null;
  };

  K.fightTime = function (state) { return CB.fightTime + L.eff(state, 'battleMulch'); };
  K.sprayCooldown = function (state) { return CB.sprayCooldown * (1 - L.eff(state, 'nozzle')); };
  K.critChance = function (state, f) { return CB.critBase + L.eff(state, 'snips') + (f.buffs.jam > 0 ? CB.jamCrit : 0); };
  /** Boss move penalties (time lost, healing) are multiplied by this. */
  K.penaltyCut = function (state) { return 1 - L.eff(state, 'gloves'); };
  K.armorNow = function (f) { return f.armor * (moving(f, 'armorUp') ? f.move.def.mult : 1); };
  /** True when the player's shears are too weak for the boss's (current) armour. */
  K.blocked = function (state, f) { return K.power(state) <= K.armorNow(f); };
  K.itemsLeft = function (state, f, id) { return Math.max(0, Math.min(state.nutrients[id] || 0, CB.itemUses - f.uses[id])); };

  function damageMult(f) {
    return (f.buffs.nitro > 0 ? CB.nitroMult : 1) * (moving(f, 'weak') ? f.move.def.mult : 1);
  }

  // ==================================================================
  // Starting and ending a fight
  // ==================================================================
  /**
   * Starts a fight. The 20-minute retry wait begins right away, win or lose.
   * The boss starts with whatever health it had left after the last attempt.
   */
  K.start = function (state, id, now) {
    var lock = K.lock(state, id, now);
    if (lock) return fail(lock.reason);
    var s = K.stats(state, id), def = K.boss(id);
    var hp = Math.max(1, Math.round(s.hp * K.healthLeft(state, id)));
    state.bossRetryAt[id] = now + CB.retryCooldown * 1000;
    state.stats.bossAttempts++;
    state.bossTries[id] = (state.bossTries[id] || 0) + 1;
    var fight = {
      id: id, hp: hp, maxHp: s.hp, armor: s.armor, reward: s.heirlooms,
      time: K.fightTime(state), elapsed: 0, phase: 1,
      combo: 1, sinceSnip: 99, sprayCd: 0, dot: 0, dotDps: 0, brigadeT: 0,
      buffs: { nitro: 0, jam: 0 }, uses: { nitro: 0, gel: 0, jam: 0, tonic: 0 },
      move: null, nextMove: CB.firstMove, moveIndex: Math.floor(L.rng() * 2), pods: [], podSeq: 1,
      done: false, won: false, finished: false, result: null, events: [],
      dealt: 0, snips: 0, bounced: 0
    };
    // A boss worn down past its second bloom in an earlier attempt starts in phase two.
    if (def.phase2 && hp <= s.hp * def.phase2.at) fight.phase = 2;
    return { ok: true, fight: fight };
  };

  K.giveUp = function (f) {
    if (f.done) return;
    f.done = true; f.won = false; f.move = null; f.pods = [];
    push(f, 'lost', { gaveUp: true });
  };

  /** Pays out a finished fight (once). Returns a summary for the result screen. */
  K.finish = function (state, f) {
    if (f.finished) return f.result;
    f.finished = true;
    var r = { won: f.won, boss: f.id, dealt: f.dealt, hpLeft: f.hp / f.maxHp, timeLeft: Math.max(0, f.time),
      snips: f.snips, bounced: f.bounced, heirlooms: 0, first: false, tries: state.bossTries[f.id] || 1 };
    remember(state, f);
    if (f.won) {
      delete state.bossHealth[f.id];
      r.first = !state.trophies[f.id];
      r.heirlooms = f.reward;
      state.bossesBeaten[f.id] = true;
      state.trophies[f.id] = true;
      state.heirlooms += f.reward;
      state.stats.heirloomsEarned += f.reward;
      state.stats.bossWins++;
    }
    f.result = r;
    return r;
  };

  /** Deals damage that already got past the armour. Handles defeat and the second phase. */
  function hurt(f, amount) {
    if (f.done || !(amount > 0)) return 0;
    amount = Math.min(f.hp, Math.round(amount));
    f.hp -= amount;
    f.dealt += amount;
    var def = K.boss(f.id);
    if (f.hp <= 0) {
      f.hp = 0; f.done = true; f.won = true; f.move = null; f.pods = [];
      push(f, 'won');
    } else if (def.phase2 && f.phase === 1 && f.hp <= f.maxHp * def.phase2.at) {
      f.phase = 2; f.move = null; f.pods = []; f.nextMove = 1.5; f.moveIndex = 0;
      push(f, 'phase', { text: def.phase2.text });
    }
    return amount;
  }

  // ==================================================================
  // Player actions
  // ==================================================================
  /** One click on the boss with the pruning shears. */
  K.snip = function (state, f) {
    if (f.done) return fail('done');
    f.snips++;
    f.combo = f.sinceSnip <= CB.comboWindow ? Math.min(CB.comboMax, f.combo + CB.comboStep) : 1;
    f.sinceSnip = 0;
    if (moving(f, 'shield')) {
      f.combo = 1;
      push(f, 'shielded');
      return { ok: true, blocked: 'shield' };
    }
    if (moving(f, 'snap')) {
      var pen = f.move.def.amount * K.penaltyCut(state);
      f.time = Math.max(0, f.time - pen);
      f.combo = 1;
      push(f, 'bitten', { amount: pen });
      return { ok: true, blocked: 'snap' };
    }
    if (K.blocked(state, f)) {
      f.bounced++;
      push(f, 'tooWeak');
      return { ok: true, blocked: 'armor' };
    }
    var crit = L.rng() < K.critChance(state, f);
    var dealt = hurt(f, K.power(state) * f.combo * damageMult(f) * (crit ? CB.critMult : 1));
    push(f, 'hit', { amount: dealt, crit: crit, combo: f.combo });
    return { ok: true, damage: dealt, crit: crit };
  };

  /** The weed sprayer: a big burst plus a lingering mist, then a cooldown. */
  K.spray = function (state, f) {
    if (f.done) return fail('done');
    if (moving(f, 'grab')) return fail('grabbed');
    if (f.sprayCd > 0) return fail('cooldown');
    f.sprayCd = K.sprayCooldown(state);
    if (moving(f, 'shield') || K.blocked(state, f)) {
      f.bounced++;
      push(f, 'tooWeak', { spray: true });
      return { ok: true, blocked: true };
    }
    var potency = 1 + L.eff(state, 'potency');
    var dealt = hurt(f, K.power(state) * CB.sprayBurst * potency * damageMult(f));
    f.dot = CB.sprayDotTime;
    f.dotDps = K.power(state) * CB.sprayDot * potency;
    push(f, 'spray', { amount: dealt });
    return { ok: true, damage: dealt };
  };

  /** Nutrients from the barn as battle items: nitro, gel, jam, tonic. */
  K.useItem = function (state, f, id) {
    if (f.done) return fail('done');
    if (!(id in f.uses)) return fail('unknown');
    if (f.uses[id] >= CB.itemUses) return fail('used');
    if (!(state.nutrients[id] > 0)) return fail('none');
    state.nutrients[id]--;
    f.uses[id]++;
    if (id === 'nitro') f.buffs.nitro = CB.nitroTime;
    if (id === 'jam') f.buffs.jam = CB.jamTime;
    if (id === 'gel') f.time += CB.gelTime;
    if (id === 'tonic') {
      f.pods = [];
      if (moving(f, 'weak')) { f.move = null; f.nextMove = gap(f); }
    }
    push(f, 'item', { id: id });
    return { ok: true };
  };

  /** Swats a pod (spine, bud, spore, star or seed) before it hits. */
  K.pop = function (f, podId) {
    if (f.done) return fail('done');
    for (var i = 0; i < f.pods.length; i++) {
      if (f.pods[i].id === podId) {
        var p = f.pods.splice(i, 1)[0];
        push(f, 'pop', { pod: p });
        return { ok: true };
      }
    }
    return fail('gone');
  };

  // ==================================================================
  // Boss moves and the clock
  // ==================================================================
  function moveList(f) {
    var def = K.boss(f.id);
    return f.phase === 2 && def.phase2 ? def.phase2.moves : def.moves;
  }
  function gap(f) {
    var def = K.boss(f.id);
    return rand(def.moveEvery[0], def.moveEvery[1]) * (f.phase === 2 && def.phase2 ? def.phase2.speed : 1);
  }
  function startMove(state, f) {
    var list = moveList(f), def = list[f.moveIndex % list.length];
    f.moveIndex++;
    if (def.kind === 'pods') {
      var life = def.life * (1 + L.eff(state, 'swatter'));
      for (var i = 0; i < def.n; i++) {
        f.pods.push({ id: f.podSeq++, x: rand(0.1, 0.9), y: rand(0.2, 0.72), life: life, max: life,
          look: def.look, effect: def.effect, amount: def.amount });
      }
      f.move = { kind: 'pods', def: def, t: 0.8 };
    } else {
      f.move = { kind: def.kind, def: def, t: def.dur };
    }
    push(f, 'move', { def: def });
  }

  /** Advances a fight by dt real seconds. */
  K.tick = function (state, f, dt) {
    if (f.done) return;
    f.elapsed += dt;
    f.time -= dt;
    f.sinceSnip += dt;
    if (f.sinceSnip > CB.comboWindow) f.combo = 1;
    f.sprayCd = Math.max(0, f.sprayCd - dt);
    f.buffs.nitro = Math.max(0, f.buffs.nitro - dt);
    f.buffs.jam = Math.max(0, f.buffs.jam - dt);

    var open = !moving(f, 'shield') && !K.blocked(state, f);
    if (f.dot > 0) {
      f.dot -= dt;
      if (open) hurt(f, f.dotDps * damageMult(f) * dt);
    }
    var hogs = L.eff(state, 'brigade');
    if (hogs > 0 && open) {
      f.brigadeT += dt;
      if (f.brigadeT >= CB.brigadeEvery) {
        var bite = hurt(f, K.power(state) * CB.brigadeDps * hogs * damageMult(f) * f.brigadeT);
        f.brigadeT = 0;
        if (bite) push(f, 'brigade', { amount: bite });
      }
    }
    if (f.done) return;

    for (var i = f.pods.length - 1; i >= 0; i--) {
      var p = f.pods[i];
      p.life -= dt;
      if (p.life > 0) continue;
      f.pods.splice(i, 1);
      var cut = K.penaltyCut(state);
      if (p.effect === 'heal') {
        var heal = Math.round(f.maxHp * p.amount * cut);
        f.hp = Math.min(f.maxHp, f.hp + heal);
        push(f, 'podHit', { pod: p, heal: heal });
      } else {
        var lost = p.amount * cut;
        f.time -= lost;
        push(f, 'podHit', { pod: p, time: lost });
      }
    }

    if (f.move) {
      f.move.t -= dt;
      if (f.move.t <= 0) { f.move = null; f.nextMove = gap(f); }
    } else {
      f.nextMove -= dt;
      if (f.nextMove <= 0) startMove(state, f);
    }

    if (f.time <= 0) {
      f.time = 0; f.done = true; f.won = false; f.move = null; f.pods = [];
      push(f, 'lost');
    }
    remember(state, f);   // kept up to date, so even closing the page mid-fight keeps the damage
  };

  // ==================================================================
  // A scripted fighter, for tests and the balance report
  // ==================================================================
  /**
   * Plays a whole fight: snips at `cps` clicks per second, stops during
   * shields, snaps and hardened armour, sprays whenever possible and swats
   * pods after `react` seconds (each swat costs a click). With items: true
   * it also uses Nitro, Jam, Gel and Tonic sensibly.
   */
  K.simulate = function (state, id, opts) {
    opts = opts || {};
    var cps = opts.cps || 4, react = opts.react || 0.6, dt = 0.05;
    var s = K.start(state, id, opts.now || 0);
    if (!s.ok) return { ok: false, reason: s.reason };
    var f = s.fight, clicks = 0;
    while (!f.done) {
      K.tick(state, f, dt);
      clicks += cps * dt;
      for (var i = f.pods.length - 1; i >= 0 && clicks >= 1; i--) {
        if (f.pods[i].max - f.pods[i].life >= react) { K.pop(f, f.pods[i].id); clicks -= 1; }
      }
      if (opts.items) {
        if (f.buffs.nitro <= 0 && K.itemsLeft(state, f, 'nitro')) K.useItem(state, f, 'nitro');
        if (f.buffs.jam <= 0 && K.itemsLeft(state, f, 'jam')) K.useItem(state, f, 'jam');
        if ((moving(f, 'weak') || f.pods.length >= 4) && K.itemsLeft(state, f, 'tonic')) K.useItem(state, f, 'tonic');
        if (f.time < 8 && K.itemsLeft(state, f, 'gel')) K.useItem(state, f, 'gel');
      }
      var wait = moving(f, 'shield') || moving(f, 'snap') || K.blocked(state, f);
      if (!wait && f.sprayCd <= 0 && !moving(f, 'grab')) K.spray(state, f);
      while (clicks >= 1) { clicks -= 1; if (!wait) K.snip(state, f); }
      f.events.length = 0;
    }
    return { ok: true, won: f.won, hpLeft: f.hp / f.maxHp, timeLeft: f.time, fight: f };
  };

  BB.Combat = K;
  if (typeof module !== 'undefined' && module.exports) module.exports = BB;
})(typeof window !== 'undefined' ? window : globalThis);
