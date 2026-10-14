/*
 * Barn Bloom - save.js
 * ------------------------------------------------------------------
 * Serialisation, versioned migration, sanitising of untrusted save
 * data, base64 export/import and the localStorage wrapper.
 * Loading never throws: broken data simply yields null.
 */
(function (root) {
  'use strict';
  var BB = root.BB = root.BB || {};
  var C = BB.CONFIG, S = BB.State;
  var Save = {};

  // ---- Small validators ----------------------------------------------
  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function num(v, def, min, max) {
    if (typeof v !== 'number' || !isFinite(v)) return def;
    if (min !== undefined && v < min) return min;
    if (max !== undefined && v > max) return max;
    return v;
  }
  function int(v, def, min, max) { return Math.floor(num(v, def, min, max)); }
  function countMap(raw, valid) {
    var out = {};
    if (!isObj(raw)) return out;
    for (var k in raw) if (valid[k]) out[k] = int(raw[k], 0, 0, 1e9);
    return out;
  }
  function boolMap(raw, valid) {
    var out = {};
    if (!isObj(raw)) return out;
    for (var k in raw) if ((!valid || valid[k]) && raw[k]) out[k] = true;
    return out;
  }

  // ---- Migration -------------------------------------------------------
  // MIGRATIONS[n] upgrades a save wrapper from version n to n + 1.
  // Example for a future version 2:
  //   MIGRATIONS[1] = function (wrap) { wrap.state.newField = 0; };
  var MIGRATIONS = {};

  Save.migrate = function (wrap) {
    var v = int(wrap.v, 1, 1, 9999);
    while (v < C.VERSION) {
      if (MIGRATIONS[v]) MIGRATIONS[v](wrap);
      v++;
    }
    wrap.v = C.VERSION;
    return wrap;
  };

  // ---- Sanitising ------------------------------------------------------
  function cleanPlant(raw) {
    if (!isObj(raw) || !C.SPECIES_BY_ID[raw.species]) return null;
    var p = S.newPlant(raw.species);
    p.growth = num(raw.growth, 0, 0, 1);
    p.water = num(raw.water, p.water, 0, C.WATER.max);
    p.health = num(raw.health, 100, 0, 100);
    p.qSum = num(raw.qSum, 0, 0);
    p.qTime = num(raw.qTime, 0, 0);
    p.qBonus = num(raw.qBonus, 0, 0, 1);
    p.age = num(raw.age, 0, 0);
    p.ripeAge = num(raw.ripeAge, 0, 0);
    p.pest = int(raw.pest, 0, 0, 10);
    p.pestT = num(raw.pestT, 0, 0);
    p.dead = !!raw.dead || p.health <= 0;
    p.golden = !!raw.golden;
    p.harvestsLeft = int(raw.harvestsLeft, p.harvestsLeft, 1, 10);
    if (isObj(raw.nutrients)) {
      for (var k in p.nutrients) p.nutrients[k] = num(raw.nutrients[k], 0, 0, C.NUTRIENT.max);
    }
    return p;
  }

  function cleanOrder(raw) {
    if (!isObj(raw) || !C.SPECIES_BY_ID[raw.species]) return null;
    return {
      id: int(raw.id, 0, 0), who: typeof raw.who === 'string' ? raw.who.slice(0, 40) : 'A customer',
      species: raw.species, qty: int(raw.qty, 1, 1, 99), done: int(raw.done, 0, 0, 99),
      minStars: int(raw.minStars, 1, 1, 5), reward: int(raw.reward, 1, 0, 1e12),
      sun: int(raw.sun, 0, 0, 5), crumbs: int(raw.crumbs, 0, 0, 5)
    };
  }

  function cleanOffer(raw) {
    var kinds = { crumbs: 1, bundle: 1, seeds: 1, sunshine: 1 };
    if (!isObj(raw) || !kinds[raw.kind]) return null;
    if (raw.kind === 'seeds' && !C.SPECIES_BY_ID[raw.species]) return null;
    return {
      kind: raw.kind, species: raw.species, qty: int(raw.qty, 1, 1, 99), price: int(raw.price, 1, 1, 1e12),
      title: String(raw.title || 'Special offer').slice(0, 60), desc: String(raw.desc || '').slice(0, 200),
      sold: !!raw.sold
    };
  }

  /** Builds a guaranteed-valid state from anything that came out of JSON.parse. */
  Save.sanitize = function (raw) {
    if (!isObj(raw)) return null;
    var st = S.newGame(), i, k;
    st.createdAt = num(raw.createdAt, st.createdAt, 0);
    st.lastSeen = num(raw.lastSeen, Date.now(), 0);
    st.time = num(raw.time, 0, 0);
    st.playTime = num(raw.playTime, 0, 0);
    st.coins = num(raw.coins, st.coins, 0, 1e15);
    st.sunshine = int(raw.sunshine, 0, 0, 1e9);
    st.crumbs = int(raw.crumbs, 0, 0, 1e9);
    st.seeds = countMap(raw.seeds, C.SPECIES_BY_ID);
    var nut = countMap(raw.nutrients, C.NUTRIENTS_BY_ID);
    var stock = countMap(raw.shopStock, C.NUTRIENTS_BY_ID);
    for (i = 0; i < C.NUTRIENTS.length; i++) {
      k = C.NUTRIENTS[i].id;
      st.nutrients[k] = nut[k] || 0;
      st.shopStock[k] = stock[k] !== undefined ? stock[k] : st.shopStock[k];
    }
    st.stockDay = int(raw.stockDay, 1, 1);
    st.unlocked = boolMap(raw.unlocked, C.SPECIES_BY_ID);
    st.unlocked.mint = true;
    if (isObj(raw.discovered)) {
      st.discovered.species = boolMap(raw.discovered.species, C.SPECIES_BY_ID);
      st.discovered.nutrients = boolMap(raw.discovered.nutrients, null);
    }

    st.upgrades = {};
    if (isObj(raw.upgrades)) {
      for (k in raw.upgrades) {
        var u = C.UPGRADES_BY_ID[k];
        if (u) { var lvl = int(raw.upgrades[k], 0, 0, u.maxCap || u.max); if (lvl > 0) st.upgrades[k] = lvl; }
      }
    }

    // Pots: the array length is the source of truth for the "slots" upgrade.
    var rawPots = Array.isArray(raw.pots) ? raw.pots : [];
    var count = Math.max(C.START.slots, Math.min(C.MAX_SLOTS, Math.max(rawPots.length, C.START.slots + (st.upgrades.slots || 0))));
    st.pots = [];
    for (i = 0; i < count; i++) {
      var pot = S.newPot(), rp = rawPots[i];
      if (isObj(rp)) {
        pot.plant = cleanPlant(rp.plant);
        pot.memo = C.SPECIES_BY_ID[rp.memo] ? rp.memo : null;
        pot.idle = num(rp.idle, 0, 0, 60);
      }
      st.pots.push(pot);
    }
    if (count > C.START.slots) st.upgrades.slots = count - C.START.slots; else delete st.upgrades.slots;

    st.tank = num(raw.tank, st.tank, 0, C.UPGRADES_BY_ID.tank.base + C.UPGRADES_BY_ID.tank.per * (st.upgrades.tank || 0));

    if (isObj(raw.events)) {
      var e = raw.events;
      st.events.next = num(e.next, C.EVENTS.firstDelay, 0, 3600);
      st.events.heat = num(e.heat, 0, 0, 600);
      st.events.rain = num(e.rain, 0, 0, 600);
      st.events.bee = num(e.bee, 0, 0, 600);
      st.events.merchant = num(e.merchant, 0, 0, 600);
      st.events.beeClicked = !!e.beeClicked;
      st.events.offer = st.events.merchant > 0 ? cleanOffer(e.offer) : null;
      if (!st.events.offer) st.events.merchant = 0;
    }

    for (i = 0; i < C.ORDERS.count; i++) {
      st.orders[i] = Array.isArray(raw.orders) ? cleanOrder(raw.orders[i]) : null;
      st.orderCooldown[i] = Array.isArray(raw.orderCooldown) ? num(raw.orderCooldown[i], 10, 0, 600) : 10;
    }
    st.orderSeq = int(raw.orderSeq, 1, 1);
    st.achievements = boolMap(raw.achievements, C.ACHIEVEMENTS_BY_ID);
    st.potStyles = boolMap(raw.potStyles, C.POT_STYLES_BY_ID);
    st.potStyles.terracotta = true;
    st.potStyle = st.potStyles[raw.potStyle] ? raw.potStyle : 'terracotta';
    st.barnName = Save.cleanName(raw.barnName);
    st.giftsSent = giftIds(raw.giftsSent);
    st.giftsOpened = giftIds(raw.giftsOpened);
    st.lastGiftCode = typeof raw.lastGiftCode === 'string' && raw.lastGiftCode.indexOf(GIFT_PREFIX) === 0 &&
      raw.lastGiftCode.length < 8000 ? raw.lastGiftCode : '';
    st.lastDealCode = typeof raw.lastDealCode === 'string' && raw.lastDealCode.indexOf(DEAL_PREFIX) === 0 &&
      raw.lastDealCode.length < 2000 ? raw.lastDealCode : '';
    st.tradesOut = {};
    if (isObj(raw.tradesOut)) {
      var open = 0;
      for (k in raw.tradesOut) {
        var rt = raw.tradesOut[k];
        var give = isObj(rt) && BB.Logic.cleanGiftItems(rt.give), want = isObj(rt) && BB.Logic.cleanGiftItems(rt.want);
        if (GIFT_ID.test(k) && give && want && open < C.GIFTS.maxOpenTrades) {
          st.tradesOut[k] = { give: give, want: want, at: num(rt.at, 0, 0) };
          open++;
        }
      }
    }
    st.cat = !!raw.cat;
    st.catSkins = boolMap(raw.catSkins, C.CAT_SKINS_BY_ID);
    st.catSkins.barn = true;
    st.catSkin = st.catSkins[raw.catSkin] ? raw.catSkin : 'barn';
    if (isObj(raw.tutorial)) {
      st.tutorial.step = int(raw.tutorial.step, 0, 0, 99);
      st.tutorial.done = !!raw.tutorial.done;
    }
    if (isObj(raw.stats)) {
      for (k in st.stats) {
        if (typeof st.stats[k] === 'number') st.stats[k] = num(raw.stats[k], 0, 0, 1e15);
      }
      st.stats.bySpecies = countMap(raw.stats.bySpecies, C.SPECIES_BY_ID);
      st.stats.bestQuality = countMap(raw.stats.bestQuality, C.SPECIES_BY_ID);
    }
    st.prestige = int(raw.prestige, 0, 0, 999);
    // Now that the prestige level is known, no upgrade may sit above this season's cap.
    for (k in st.upgrades) st.upgrades[k] = Math.min(st.upgrades[k], BB.Logic.upgradeMax(st, k));
    st.heirlooms = int(raw.heirlooms, 0, 0, 1e12);
    // Saves from before seasons existed: everything played so far counts as the first season.
    st.seasonEarned = typeof raw.seasonEarned === 'number' ? num(raw.seasonEarned, 0, 0, 1e18) : st.stats.coinsEarned;
    st.seasonReady = !!raw.seasonReady;
    st.bossesBeaten = boolMap(raw.bossesBeaten, C.BOSSES_BY_ID);
    st.trophies = boolMap(raw.trophies, C.BOSSES_BY_ID);
    st.bossRetryAt = {};
    if (isObj(raw.bossRetryAt)) {
      for (k in raw.bossRetryAt) if (C.BOSSES_BY_ID[k]) st.bossRetryAt[k] = num(raw.bossRetryAt[k], 0, 0, 1e15);
    }
    // Older saves have neither: every boss simply starts at full health.
    if (isObj(raw.bossHealth)) {
      for (k in raw.bossHealth) if (C.BOSSES_BY_ID[k] && !st.bossesBeaten[k]) st.bossHealth[k] = num(raw.bossHealth[k], 1, 0, 1);
    }
    if (isObj(raw.bossTries)) {
      for (k in raw.bossTries) if (C.BOSSES_BY_ID[k]) st.bossTries[k] = int(raw.bossTries[k], 0, 0, 1e6);
    }
    st.secondAcc = 0;
    return st;
  };

  // ---- Text formats ----------------------------------------------------
  Save.serialize = function (state) {
    return JSON.stringify({ v: C.VERSION, savedAt: Date.now(), state: state });
  };

  /** JSON text -> valid state, or null if the text is unusable. */
  Save.parse = function (text) {
    try {
      var wrap = JSON.parse(text);
      if (!isObj(wrap) || !isObj(wrap.state)) return null;
      if (num(wrap.v, 1) > C.VERSION) return null;   // save from a newer game version
      Save.migrate(wrap);
      return Save.sanitize(wrap.state);
    } catch (err) {
      return null;
    }
  };

  function toBase64(str) {
    if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(str)));
    return Buffer.from(str, 'utf8').toString('base64');
  }
  function fromBase64(b64) {
    if (typeof atob === 'function') return decodeURIComponent(escape(atob(b64)));
    return Buffer.from(b64, 'base64').toString('utf8');
  }

  Save.exportString = function (state) { return toBase64(Save.serialize(state)); };
  Save.importString = function (text) {
    try {
      return Save.parse(fromBase64(String(text).replace(/\s+/g, '')));
    } catch (err) {
      return null;
    }
  };

  // ---- Visiting: a read-only postcard of a barn ------------------------
  var VISIT_PREFIX = 'BARN-';

  /** Tidies a barn name typed by a player (or found in a visit code). */
  Save.cleanName = function (name) {
    if (typeof name !== 'string') return 'My Barn';
    name = name.replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
    return name || 'My Barn';
  };

  /**
   * A visit code: only what is needed to draw the barn and brag a little.
   * No coins, seeds, nutrients or settings travel with it.
   */
  Save.visitString = function (state) {
    var one = function (id) { var m = {}; m[id] = true; return m; };
    var card = { v: C.VERSION, kind: 'visit', at: Date.now(), state: {
      barnName: state.barnName, time: state.time, playTime: state.playTime, prestige: state.prestige,
      pots: state.pots, upgrades: state.upgrades,
      potStyle: state.potStyle, potStyles: one(state.potStyle),
      cat: state.cat, catSkin: state.catSkin, catSkins: one(state.catSkin),
      unlocked: state.unlocked, achievements: state.achievements, stats: state.stats, trophies: state.trophies
    } };
    return VISIT_PREFIX + toBase64(JSON.stringify(card));
  };

  /** Visit code -> { name, at, state }, or null if the text is not a usable visit code. */
  Save.parseVisit = function (text) {
    try {
      text = String(text).replace(/\s+/g, '');
      if (text.indexOf(VISIT_PREFIX) !== 0) return null;
      var card = JSON.parse(fromBase64(text.slice(VISIT_PREFIX.length)));
      if (!isObj(card) || card.kind !== 'visit' || !isObj(card.state)) return null;
      if (num(card.v, 1) > C.VERSION) return null;
      Save.migrate(card);
      var state = Save.sanitize(card.state);
      if (!state) return null;
      state.tank = C.UPGRADES_BY_ID.tank.base + C.UPGRADES_BY_ID.tank.per * (state.upgrades.tank || 0);
      state.tutorial.done = true;
      return { name: state.barnName, at: num(card.at, 0, 0), state: state };
    } catch (err) {
      return null;
    }
  };

  // ---- Gift codes --------------------------------------------------------
  var GIFT_PREFIX = 'GIFT-';
  var GIFT_ID = /^[a-z0-9]{6,20}$/;

  function giftIds(raw) {
    var out = {}, n = 0;
    if (!isObj(raw)) return out;
    for (var k in raw) {
      if (raw[k] && GIFT_ID.test(k) && n < C.GIFTS.remember) { out[k] = true; n++; }
    }
    return out;
  }

  Save.giftString = function (gift) { return GIFT_PREFIX + toBase64(JSON.stringify(gift)); };

  /** Gift code -> { id, from, at, items }, or null if the text is not a usable gift code. */
  Save.parseGift = function (text) {
    try {
      text = String(text).replace(/\s+/g, '');
      if (text.indexOf(GIFT_PREFIX) !== 0) return null;
      var card = JSON.parse(fromBase64(text.slice(GIFT_PREFIX.length)));
      if (!isObj(card) || card.kind !== 'gift' || typeof card.id !== 'string' || !GIFT_ID.test(card.id)) return null;
      if (num(card.v, 1) > C.VERSION) return null;
      var items = BB.Logic.cleanGiftItems(card.items);
      if (!items) return null;
      return { id: card.id, from: Save.cleanName(card.from), at: num(card.at, 0, 0), items: items };
    } catch (err) {
      return null;
    }
  };

  // ---- Trade codes -------------------------------------------------------
  var TRADE_PREFIX = 'TRADE-', DEAL_PREFIX = 'DEAL-';

  function readCode(text, prefix, kind) {
    text = String(text).replace(/\s+/g, '');
    if (text.indexOf(prefix) !== 0) return null;
    var card = JSON.parse(fromBase64(text.slice(prefix.length)));
    if (!isObj(card) || card.kind !== kind || typeof card.id !== 'string' || !GIFT_ID.test(card.id)) return null;
    if (num(card.v, 1) > C.VERSION) return null;
    return card;
  }

  Save.tradeString = function (trade) { return TRADE_PREFIX + toBase64(JSON.stringify(trade)); };
  Save.dealString = function (deal) { return DEAL_PREFIX + toBase64(JSON.stringify(deal)); };

  /** Trade offer code -> { id, from, at, give, want }, or null. */
  Save.parseTrade = function (text) {
    try {
      var card = readCode(text, TRADE_PREFIX, 'trade');
      var give = card && BB.Logic.cleanGiftItems(card.give), want = card && BB.Logic.cleanGiftItems(card.want);
      if (!give || !want) return null;
      return { id: card.id, from: Save.cleanName(card.from), at: num(card.at, 0, 0), give: give, want: want };
    } catch (err) {
      return null;
    }
  };

  /** Trade reply code -> { id, from }, or null. */
  Save.parseDeal = function (text) {
    try {
      var card = readCode(text, DEAL_PREFIX, 'deal');
      return card ? { id: card.id, from: Save.cleanName(card.from) } : null;
    } catch (err) {
      return null;
    }
  };

  // ---- Storage (localStorage with an in-memory fallback) --------------
  var memory = {};
  function storage() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
    } catch (err) { /* blocked, e.g. private mode */ }
    return null;
  }
  Save.read = function (key) {
    try { var s = storage(); return s ? s.getItem(key) : (memory[key] || null); }
    catch (err) { return memory[key] || null; }
  };
  Save.write = function (key, value) {
    memory[key] = value;
    try { var s = storage(); if (!s) return false; s.setItem(key, value); return true; }
    catch (err) { return false; }
  };
  Save.remove = function (key) {
    delete memory[key];
    try { var s = storage(); if (s) s.removeItem(key); } catch (err) { /* ignore */ }
  };

  Save.hasSave = function () { return !!Save.read(C.SAVE_KEY); };
  Save.saveGame = function (state) {
    state.lastSeen = Date.now();
    return Save.write(C.SAVE_KEY, Save.serialize(state));
  };
  /** Returns { state, corrupted }. state is null when there is nothing usable. */
  Save.loadGame = function () {
    var text = Save.read(C.SAVE_KEY);
    if (!text) return { state: null, corrupted: false };
    var state = Save.parse(text);
    return { state: state, corrupted: !state };
  };
  Save.clearGame = function () { Save.remove(C.SAVE_KEY); };

  // ---- Settings (kept separately so they survive a new game) ----------
  Save.defaultSettings = function () {
    return {
      master: 0.8, music: 0.5, sfx: 0.8, muted: false,
      speed: 1, events: true, particles: true, shake: true, reducedMotion: false,
      colorblind: false, uiScale: 1, fps: false,
      theme: 0,                                    // 0 = follow the computer, 1 = light, 2 = dark
      adminNoCaps: false, adminNoCooldown: false   // admin panel switches (only used on the owner's computer)
    };
  };
  Save.loadSettings = function () {
    var def = Save.defaultSettings(), found = false;
    try {
      var raw = JSON.parse(Save.read(C.SETTINGS_KEY) || 'null');
      if (isObj(raw)) {
        found = true;
        for (var k in def) {
          if (typeof def[k] === 'boolean') { if (typeof raw[k] === 'boolean') def[k] = raw[k]; }
          else def[k] = num(raw[k], def[k], 0, 3);
        }
        def.uiScale = num(def.uiScale, 1, 0.8, 1.3);
        def.speed = def.speed >= 3 ? 3 : (def.speed >= 2 ? 2 : 1);
        def.theme = def.theme >= 2 ? 2 : (def.theme >= 1 ? 1 : 0);
      }
    } catch (err) { /* keep defaults */ }
    def.isDefault = !found;
    return def;
  };
  Save.saveSettings = function (settings) {
    var copy = {};
    for (var k in settings) if (k !== 'isDefault') copy[k] = settings[k];
    Save.write(C.SETTINGS_KEY, JSON.stringify(copy));
  };

  BB.Save = Save;
  if (typeof module !== 'undefined' && module.exports) module.exports = BB;
})(typeof window !== 'undefined' ? window : globalThis);
