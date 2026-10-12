/*
 * Barn Bloom - main.js
 * ------------------------------------------------------------------
 * Glue: boots the game, runs the fixed-step loop, turns pointer and
 * keyboard input into game actions, reacts to logic events with
 * sounds / particles / toasts, and handles saving and loading.
 */
(function (root) {
  'use strict';
  var BB = root.BB;
  var C = BB.CONFIG, L = BB.Logic, S = BB.State, Save = BB.Save, Sound = BB.Audio, R = BB.Render, UI = BB.UI;

  var G = {
    state: null, settings: null, mode: 'menu',
    tool: 'hand', seed: 'mint', nutrient: 'nitro',
    selected: -1, hover: -1, photo: false, debug: {}
  };
  BB.Game = G;

  var canvas, demo;
  var env = { events: true, offline: false };
  var acc = 0, lastTs = 0, autosaveT = 0, insetT = 0;
  var fpsT = 0, fpsFrames = 0;
  var hiddenAt = 0, rainOn = false;
  var drag = { active: false, last: -1 };
  var lastClick = { x: 0, y: 0 };
  var complainedAt = {};

  function $(id) { return document.getElementById(id); }
  function nutrientDef(id) { return id === 'crumbs' ? C.CRUMBS : C.NUTRIENTS_BY_ID[id]; }

  /** Error feedback: always a soft buzz, but the same toast at most every few seconds. */
  function complain(key, text) {
    Sound.play('error');
    var now = Date.now();
    if (now - (complainedAt[key] || 0) < 3000) return;
    complainedAt[key] = now;
    UI.toast(text, { kind: 'bad' });
  }

  // ==================================================================
  // Settings
  // ==================================================================
  G.applySettings = function (skipSave) {
    var s = G.settings;
    if (!skipSave) Save.saveSettings(s);
    Sound.applySettings(s);
    R.setOptions(s);
    env.events = !!s.events;
    document.documentElement.style.fontSize = (16 * s.uiScale) + 'px';
    document.body.classList.toggle('reduced', !!s.reducedMotion);
    document.body.classList.toggle('cb', !!s.colorblind);
    insetT = 0;
    UI.setFps(0);
  };
  G.cycleSpeed = function () {
    G.settings.speed = G.settings.speed >= 3 ? 1 : G.settings.speed + 1;
    G.applySettings();
  };
  G.toggleMute = function () {
    G.settings.muted = !G.settings.muted;
    G.applySettings();
    UI.toast(G.settings.muted ? 'Sound muted.' : 'Sound on.', { icon: G.settings.muted ? 'mute' : 'sound', time: 1600 });
  };
  G.photoMode = function (on) {
    G.photo = on;
    document.body.classList.toggle('photo', on);
    $('photoHint').hidden = !on;
    if (on) { Sound.play('shutter'); G.selected = -1; setTimeout(function () { $('photoHint').hidden = true; }, 2600); }
    insetT = 0;
  };
  G.onModalChange = function () { drag.active = false; };

  // ==================================================================
  // Tools and actions
  // ==================================================================
  G.setTool = function (tool, nutrient) {
    G.tool = tool;
    if (nutrient) G.nutrient = nutrient;
    UI.closePopover();
    UI.tutorialEvent('tool:' + tool);
  };
  G.setSeed = function (id) { G.seed = id; G.setTool('seed'); };
  G.select = function (i) { G.selected = i; };

  function cycleSeed() {
    var st = G.state, list = C.SPECIES.filter(function (sp) { return st.unlocked[sp.id] || st.seeds[sp.id] > 0; });
    var idx = 0;
    for (var i = 0; i < list.length; i++) if (list[i].id === G.seed) idx = i;
    G.seed = list[(idx + 1) % list.length].id;
  }

  /**
   * Uses a tool on a pot, with feedback. viaDrag suppresses complaints
   * so sweeping across the shelf stays quiet.
   */
  G.act = function (tool, slot, arg, viaDrag) {
    var st = G.state, pot = st && st.pots[slot], r, name;
    if (!pot) return false;
    switch (tool) {
      case 'hand':
        G.select(slot);
        return true;

      case 'water':
        r = L.water(st, slot);
        if (!r.ok && !viaDrag) {
          if (r.reason === 'tank') complain('tank', 'The water tank is empty. It refills on its own; a bigger tank or a pump helps.');
          else if (r.reason === 'full') complain('full', 'That pot has had enough. More water would only make it soggy.');
          else complain('nowater', 'Nothing to water here.');
        }
        return r.ok;

      case 'harvest':
        r = L.harvest(st, slot);
        if (!r.ok && !viaDrag) {
          if (r.reason === 'unripe') complain('unripe', 'Not ripe yet. Wait for the gold star.');
          else complain('noharvest', pot.plant ? 'This one has withered. Clear it with the shovel.' : 'Nothing to harvest here.');
        }
        return r.ok;

      case 'seed':
        var id = arg || G.seed;
        name = C.SPECIES_BY_ID[id].name;
        if (pot.plant) { if (!viaDrag) complain('occupied', 'This pot is taken. Harvest or clear it first.'); return false; }
        if (!(st.seeds[id] > 0)) {
          // Convenience: buy a single seed on the spot if possible.
          if (!st.unlocked[id] || !L.buySeed(st, id, 1).ok) {
            if (!viaDrag) complain('noseed', st.unlocked[id] ? 'Not enough coins for a ' + name + ' seed.' : 'You have no ' + name + ' seeds.');
            return false;
          }
        }
        return L.plant(st, slot, id).ok;

      case 'feed':
        var nid = arg || G.nutrient;
        name = nutrientDef(nid).name;
        r = L.feed(st, slot, nid);
        if (!r.ok && !viaDrag) {
          if (r.reason === 'none') complain('nofeed', 'You are out of ' + name + '. The shop sells more.');
          else if (r.reason === 'full') complain('fedfull', 'This plant still has plenty of ' + name + '.');
          else if (r.reason === 'mature') complain('crumbmature', 'Comet Crumbs only work on plants that are still growing.');
          else complain('nofeedplant', 'Nothing to feed here.');
        }
        return r.ok;

      case 'shovel':
        if (!pot.plant) {
          r = L.clear(st, slot);
          if (r.ok && r.memoOnly && L.level(st, 'squirrel') > 0) UI.toast('The squirrel will leave this pot alone.', { time: 2200 });
          return r.ok;
        }
        if (pot.plant.dead) return L.clear(st, slot).ok;
        if (viaDrag) return false;
        UI.confirm({
          title: 'Dig up this plant?', yes: 'Dig it up', danger: true,
          text: 'The ' + L.species(pot.plant).name + ' is still alive. Digging it up throws it away and you get nothing for it.'
        }, function () { L.clear(st, slot); });
        return true;

      case 'shoo':
        return L.shoo(st, slot).ok;
    }
    return false;
  };

  G.waterAll = function () {
    var r = L.waterAll(G.state);
    if (r.ok) return true;
    if (r.reason === 'tank') complain('tank', 'The water tank is empty. It refills on its own; a bigger tank or a pump helps.');
    else if (r.reason === 'none') complain('wa', 'No plant is thirsty right now.');
    return false;
  };
  G.harvestAll = function () {
    var r = L.harvestAll(G.state);
    if (r.ok) { R.shake(3); return true; }
    if (r.reason === 'none') complain('ha', 'Nothing is ripe yet.');
    return false;
  };

  // ---- Shop wrappers (return true on success) -------------------------
  function bought(r, failText) {
    if (r.ok) { autosaveT = Math.max(autosaveT, C.AUTOSAVE_SECONDS - 2); return true; }
    complain('shop:' + r.reason, failText[r.reason] || 'That did not work.');
    return false;
  }
  var NO_FUNDS = 'Not enough coins.';
  G.buySeed = function (id, qty) { return bought(L.buySeed(G.state, id, qty), { funds: NO_FUNDS, locked: 'Unlock this species first.' }); };
  G.buyNutrient = function (id, qty) { return bought(L.buyNutrient(G.state, id, qty), { funds: NO_FUNDS, stock: 'The shop does not have that many left.' }); };
  G.restock = function () { return bought(L.restock(G.state), { funds: NO_FUNDS, full: 'The shelves are already full.' }); };
  G.buyOffer = function () { return bought(L.buyOffer(G.state), { funds: NO_FUNDS, gone: 'The merchant has left.', sold: 'Already bought.' }); };
  G.buyCrumbs = function () { return bought(L.buyCrumbs(G.state), { sunshine: 'Not enough Sunshine.' }); };
  G.buyStyle = function (id) { return bought(L.buyPotStyle(G.state, id), { funds: NO_FUNDS, sunshine: 'Not enough Sunshine.' }); };
  G.buyCatSkin = function (id) { return bought(L.buyCatSkin(G.state, id), { funds: NO_FUNDS }); };
  G.unlock = function (id) {
    var ok = bought(L.unlockSpecies(G.state, id), { funds: NO_FUNDS, sunshine: 'Not enough Sunshine.' });
    if (ok) G.saveNow(false);
    return ok;
  };
  G.buyUpgrade = function (id) {
    var ok = bought(L.buyUpgrade(G.state, id), { funds: 'You cannot afford that yet.', locked: 'That upgrade is still locked.', max: 'Already at the maximum level.' });
    if (ok) G.saveNow(false);
    return ok;
  };
  G.skipOrder = function (k) { return L.skipOrder(G.state, k).ok; };

  // ==================================================================
  // Reactions to logic events (juice)
  // ==================================================================
  var CREAM = '#fff3d6', GOLD = '#ffd24a';

  var EVENT_TOASTS = {
    heat: { title: 'Heatwave!', text: 'Water drains much faster for a while. Keep the can handy.', icon: 'heat', sound: 'notify' },
    rain: { title: 'Rainy day', text: 'Free water for every plant, and the tank is filling up.', icon: 'rain', sound: 'thunder' },
    bee: { title: 'Lucky bee', text: 'Everything grows faster while it visits. Catch it for a tip!', icon: 'bee', sound: 'bee' },
    merchant: { title: 'Travelling merchant', text: 'A cart has rolled in with a special offer.', icon: 'cart', sound: 'notify' }
  };
  var EVENT_ENDS = { heat: 'The heatwave has passed.', rain: 'The rain has stopped.', merchant: 'The merchant has moved on.' };

  var HANDLERS = {
    water: function (e) {
      R.burst('water', e.slot, { quiet: e.quiet || e.splash });
      if (!e.quiet) Sound.play('water');
      UI.tutorialEvent('water');
    },
    sprinkle: function (e) { R.burst('sprinkle', e.slot); R.wiggle(e.slot); Sound.play('sprinkle'); },
    plant: function (e) { R.burst('plant', e.slot); if (!e.auto) Sound.play('plant'); UI.tutorialEvent('plant'); },
    feed: function (e) {
      var n = nutrientDef(e.nutrient);
      R.burst('feed', e.slot, { color: n.color, shape: n.shape });
      R.wiggle(e.slot);
      if (!e.auto) Sound.play(e.nutrient === 'crumbs' ? 'crumbs' : 'feed');
    },
    harvest: function (e) {
      var sp = C.SPECIES_BY_ID[e.species];
      R.burst('harvest', e.slot, { coins: e.coins, golden: e.golden, color: sp.colors.leaf });
      R.textAtSlot(e.slot, '+' + UI.fmt(e.coins), e.golden ? GOLD : CREAM, e.golden);
      Sound.play('harvest'); Sound.play('coin');
      if (e.auto) R.hop();
      if (e.golden) {
        Sound.play('golden'); R.shake(5);
        UI.toast('A golden ' + sp.name + '! Triple price and +1 Sunshine.', { kind: 'gold', icon: 'star', title: 'Golden harvest' });
      } else if (e.sunshine > 0) {
        UI.toast('A fine ' + sp.name + ' bloom: +' + e.sunshine + ' Sunshine.', { kind: 'gold', icon: 'sun' });
      }
      if (G.selected === e.slot && !e.regrow && window.innerWidth < 900) G.selected = -1;
      UI.tutorialEvent('harvest');
    },
    matured: function (e) { R.burst('matured', e.slot, { golden: e.golden }); Sound.play('matured'); UI.tutorialEvent('matured'); },
    died: function (e) {
      R.burst('died', e.slot); Sound.play('died'); R.shake(4);
      UI.toast('A ' + C.SPECIES_BY_ID[e.species].name + ' has withered. Clear the pot with the shovel to plant again.', { kind: 'bad', title: 'Oh no' });
    },
    clear: function (e) { R.burst('clear', e.slot); Sound.play('shovel'); },
    pestHit: function (e) { R.burst('pop', e.slot); Sound.play('squish'); R.wiggle(e.slot); },
    pestGone: function (e) {
      R.burst('pop', e.slot); Sound.play('squish');
      R.textAtSlot(e.slot, e.by === 'ladybugs' ? 'Ladybugs!' : 'Bug gone!', '#c9f7c0');
    },
    eventStart: function (e) {
      if (e.kind === 'pest') {
        var p = G.state.pots[e.slot].plant;
        Sound.play('pest');
        UI.toast('A bug is nibbling your ' + (p ? L.species(p).name : 'plant') + '. Shoo it away or use Bug-Off Tonic.', {
          kind: 'event', icon: 'bug', title: 'Pest alert',
          action: { label: 'Show me', fn: function () { G.select(e.slot); G.setTool('hand'); } }
        });
        return;
      }
      var t = EVENT_TOASTS[e.kind];
      if (!t) return;
      Sound.play(t.sound);
      if (e.kind === 'heat' || e.kind === 'rain') R.shake(3);
      var opts = { kind: 'event', icon: t.icon, title: t.title };
      var text = t.text;
      if (e.kind === 'merchant') {
        if (G.state.events.offer) text = 'On offer: ' + G.state.events.offer.title + '.';
        opts.action = { label: 'See offer', fn: function () { UI.openShop('special'); } };
        UI.refreshModals();
      }
      UI.toast(text, opts);
    },
    eventEnd: function (e) {
      if (EVENT_ENDS[e.kind]) UI.toast(EVENT_ENDS[e.kind], { time: 2400 });
      var shop = e.kind === 'merchant';
      if (shop) UI.refreshModals();
    },
    achievement: function (e) {
      var a = C.ACHIEVEMENTS_BY_ID[e.id];
      Sound.play('achievement'); R.shake(3);
      UI.toast(a.desc + ' +' + C.ACHIEVEMENT_REWARD + ' Sunshine.', { kind: 'gold', icon: 'trophy', title: 'Award: ' + a.name, time: 6000 });
    },
    order: function (e) {
      var o = e.order;
      Sound.play('order');
      UI.toast(o.who + ' is delighted and pays ' + UI.fmt(o.reward) + ' coins' + (o.sun ? ' and ' + o.sun + ' Sunshine' : '') + (o.crumbs ? ' plus Comet Crumbs' : '') + '.',
        { kind: 'good', icon: 'clip', title: 'Order complete' });
    },
    newOrder: function (e) {
      if (e.order.id === 1) UI.toast('Customers now leave orders on the chalkboard. Fill them for bonus coins.', { kind: 'event', icon: 'clip', title: 'First order' });
    },
    charity: function () {
      UI.toast('A kindly neighbour left two Pepperwink seeds on your doorstep.', { kind: 'good', icon: 'seed', title: 'A helping hand' });
      Sound.play('notify');
    },
    catArrives: function () {
      UI.toast('A barn cat has wandered in and decided to stay. It likes being petted.', { kind: 'event', icon: 'heart', title: 'New resident' });
      Sound.play('purr');
    },
    catPet: function () { R.pet(); Sound.play('purr'); },
    beeTip: function (e) {
      R.coinsAt(lastClick.x, lastClick.y, 7);
      R.floatText(lastClick.x, lastClick.y - 18, '+' + UI.fmt(e.coins), GOLD, true);
      Sound.play('coin');
      UI.toast('The lucky bee tips you ' + UI.fmt(e.coins) + ' coins.', { kind: 'good', icon: 'bee', time: 2600 });
    },
    upgrade: function (e) { Sound.play('upgrade'); if (e.id === 'slots') R.shake(3); },
    unlock: function (e) {
      Sound.play('unlock');
      UI.toast(C.SPECIES_BY_ID[e.id].name + ' seeds are now for sale.', { kind: 'good', icon: 'seed', title: 'New species unlocked' });
    },
    buy: function () { Sound.play('coin'); },
    newDay: function (e) { UI.toast('Day ' + e.day + ' begins. The shop shelves have been restocked.', { icon: 'sun', time: 2600 }); }
  };

  function handleEvents(queue) {
    for (var i = 0; i < queue.length; i++) {
      var h = HANDLERS[queue[i].type];
      if (h) h(queue[i]);
    }
  }

  // ==================================================================
  // Save / load / session
  // ==================================================================
  function startPlay() {
    var st = G.state;
    G.mode = 'play';
    G.tool = 'hand'; G.selected = -1; G.hover = -1; G.photo = false;
    G.seed = 'mint';
    for (var i = 0; i < C.SPECIES.length; i++) if (st.seeds[C.SPECIES[i].id] > 0) { G.seed = C.SPECIES[i].id; break; }
    acc = 0; autosaveT = 0; insetT = 0;
    L.drain();
    R.reset();
    UI.closeAll();
    UI.showGame();
    Sound.startMusic();
  }

  G.newGame = function () {
    G.state = S.newGame();
    startPlay();
    G.saveNow(false);
  };

  G.continueGame = function () {
    var res = Save.loadGame();
    if (!res.state) {
      UI.toast(res.corrupted ? 'Your save could not be read, sorry. You can start a new game or import a backup in Settings.' : 'No saved game found.', { kind: 'bad', time: 7000 });
      Sound.play('error');
      return;
    }
    G.state = res.state;
    var away = (Date.now() - res.state.lastSeen) / 1000;
    startPlay();
    if (away >= C.OFFLINE.minSeconds) {
      var sum = L.simulateOffline(G.state, away);
      handleEvents(L.drain());
      UI.welcomeBack(sum);
      G.saveNow(false);
    }
  };

  G.saveNow = function (announce) {
    if (!G.state || G.mode !== 'play') return false;
    var ok = Save.saveGame(G.state);
    autosaveT = 0;
    if (announce) UI.toast(ok ? 'Game saved.' : 'Saving failed: this browser is blocking storage. Use Export save to back up.', { kind: ok ? 'good' : 'bad', icon: ok ? 'check' : null, time: 2200 });
    return ok;
  };

  function toMenu() {
    UI.closeAll();
    G.mode = 'menu';
    G.state = null;
    G.selected = -1; G.hover = -1;
    document.body.classList.remove('has-selection');
    $('tutorial').hidden = true;
    $('debug').hidden = true;
    R.reset();
    R.setInsets({ top: 0, bottom: 0, right: 0 });
    UI.showMenu();
  }
  G.quitToMenu = function () { G.saveNow(false); toMenu(); };
  G.resetSave = function () {
    Save.clearGame();
    toMenu();
    UI.toast('Save deleted. A fresh barn awaits.', { time: 3000 });
  };

  G.exportSave = function () {
    if (G.state) { G.saveNow(false); return Save.exportString(G.state); }
    var res = Save.loadGame();
    return res.state ? Save.exportString(res.state) : null;
  };
  G.importSave = function (text) {
    var st = Save.importString(text);
    if (!st) return false;
    G.state = st;
    startPlay();
    G.saveNow(false);
    UI.toast('Save imported. Welcome back to your barn!', { kind: 'good', icon: 'check' });
    return true;
  };

  /** The tab was hidden for `away` seconds: catch up fairly. */
  function catchUp(away) {
    if (!G.state || G.mode !== 'play' || UI.isBlocking()) return;
    if (away >= C.OFFLINE.minSeconds) {
      var sum = L.simulateOffline(G.state, away);
      handleEvents(L.drain());
      UI.welcomeBack(sum);
      G.saveNow(false);
    } else if (away > 1) {
      // Short absence: just keep the simulation going, without surprise events.
      var quiet = { events: false, offline: false }, steps = Math.floor(away / C.TICK);
      L.muted = true;
      for (var i = 0; i < steps; i++) L.tick(G.state, C.TICK, quiet);
      L.muted = false;
    }
  }

  // ==================================================================
  // Debug cheats
  // ==================================================================
  G.debug.coins = function (n) { G.state.coins += n; };
  G.debug.sunshine = function (n) { G.state.sunshine += n; };
  G.debug.unlockAll = function () { C.SPECIES.forEach(function (sp) { G.state.unlocked[sp.id] = true; }); UI.refreshModals(); };
  G.debug.skip = function (seconds) {
    var steps = Math.round(seconds / 0.5);
    for (var i = 0; i < steps; i++) { L.tick(G.state, 0.5, env); if (L.queue.length > 60) handleEvents(L.drain().slice(0, 5)); }
  };
  G.debug.growAll = function () {
    G.state.pots.forEach(function (pot) { if (pot.plant && !pot.plant.dead && pot.plant.growth < 1) pot.plant.growth = 0.999; });
  };
  G.debug.event = function (kind) { L.triggerEvent(G.state, kind); };
  G.debug.night = function () {
    var ph = L.phase(G.state), target = 0.75;
    G.state.time += ((target - ph + 1) % 1) * C.DAY_LENGTH;
  };
  G.debug.away = function (seconds) { var sum = L.simulateOffline(G.state, seconds); UI.welcomeBack(sum); };
  G.debug.reset = function () { G.newGame(); };

  // ==================================================================
  // Input
  // ==================================================================
  function canvasPos(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function toolArg() { return G.tool === 'seed' ? G.seed : (G.tool === 'feed' ? G.nutrient : undefined); }

  function onPointerDown(e) {
    Sound.init(); Sound.startMusic();
    if (G.photo) { G.photoMode(false); return; }
    if (G.mode !== 'play' || e.button > 0) return;
    var pos = canvasPos(e);
    lastClick = pos;
    var critter = R.critterAt(pos.x, pos.y);
    if (critter === 'bee') { L.clickBee(G.state); return; }
    if (critter === 'merchant') { UI.openShop('special'); return; }
    var slot = R.slotAt(pos.x, pos.y);
    if (slot < 0) {
      if (critter === 'cat') { L.petCat(G.state); return; }
      G.select(-1);
      return;
    }
    drag.active = true; drag.last = slot;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* not critical */ }
    G.act(G.tool, slot, toolArg(), false);
  }

  function onPointerMove(e) {
    if (G.mode !== 'play') return;
    var pos = canvasPos(e), slot = R.slotAt(pos.x, pos.y);
    if (e.pointerType === 'mouse') {
      G.hover = slot;
      canvas.style.cursor = slot >= 0 || R.critterAt(pos.x, pos.y) ? 'pointer' : 'default';
    }
    if (drag.active && slot >= 0 && slot !== drag.last && G.tool !== 'hand') {
      drag.last = slot;
      G.act(G.tool, slot, toolArg(), true);
    }
  }
  function onPointerUp() { drag.active = false; drag.last = -1; }

  /** Moves the selection to the nearest pot in the given direction. */
  function moveSelection(dx, dy) {
    var n = G.state.pots.length;
    if (G.selected < 0) { G.select(0); return; }
    var from = R.slotPos(G.selected), best = -1, bestD = Infinity;
    if (!from) return;
    for (var i = 0; i < n; i++) {
      if (i === G.selected) continue;
      var p = R.slotPos(i);
      if (!p) continue;
      var ox = p.x - from.x, oy = p.y - from.y;
      var along = ox * dx + oy * dy, across = Math.abs(ox * dy) + Math.abs(oy * dx);
      if (along <= 4) continue;
      var d = along + across * 2.5;
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best >= 0) G.select(best);
  }

  /** Space bar: with the hand tool, do the obvious thing for the selected plant. */
  function useOnSelected() {
    if (G.selected < 0) return;
    var pot = G.state.pots[G.selected], p = pot.plant;
    if (G.tool !== 'hand') { G.act(G.tool, G.selected, toolArg(), false); return; }
    if (!p) G.act('seed', G.selected, G.seed, false);
    else if (p.dead) G.act('shovel', G.selected);
    else if (p.growth >= 1) G.act('harvest', G.selected);
    else if (p.pest > 0) G.act('shoo', G.selected);
    else G.act('water', G.selected);
  }

  function onKeyDown(e) {
    var tag = e.target && e.target.tagName;
    var typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    var key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    Sound.init();
    if (G.photo) { G.photoMode(false); e.preventDefault(); return; }

    if (key === 'Escape') {
      if (!$('popover').hidden) { UI.closePopover(); return; }
      if (UI.closeTop()) return;
      if (G.mode === 'play') { if (G.selected >= 0) G.select(-1); else UI.openPause(); }
      return;
    }
    if (typing && e.target.type !== 'checkbox' && e.target.type !== 'range') return;
    if (key === 'm') { G.toggleMute(); return; }
    if (G.mode !== 'play') return;
    if (key === '`') { UI.toggleDebug(); return; }
    if (UI.isBlocking()) { if (key === 'p') UI.closeTop(); return; }

    switch (key) {
      case 'p': UI.openPause(); return;
      case 's': UI.openShop(); return;
      case 'u': UI.openUpgrades(); return;
      case 'l': UI.openAlmanac(); return;
      case 'k': UI.openAchievements(); return;
      case 'o': UI.openOrders(); return;
    }
    if (UI.anyModal()) return;
    var buttonFocused = tag === 'BUTTON';
    switch (key) {
      case '1': G.setTool('hand'); break;
      case '2': G.setTool('water'); break;
      case '3': G.setTool('harvest'); break;
      case '4': G.setTool('shovel'); break;
      case '5': if (G.tool === 'seed') cycleSeed(); else G.setTool('seed'); break;
      case 'q': G.setTool('feed', 'nitro'); break;
      case 'w': G.setTool('feed', 'gel'); break;
      case 'e': G.setTool('feed', 'jam'); break;
      case 'r': G.setTool('feed', 'tonic'); break;
      case 't': if (G.state.crumbs > 0 || G.state.discovered.nutrients.crumbs) G.setTool('feed', 'crumbs'); break;
      case 'a': if (L.level(G.state, 'whistle') > 0) G.waterAll(); break;
      case 'h': if (L.level(G.state, 'scythe') > 0) G.harvestAll(); break;
      case 'f': G.photoMode(true); break;
      case 'ArrowLeft': moveSelection(-1, 0); e.preventDefault(); break;
      case 'ArrowRight': moveSelection(1, 0); e.preventDefault(); break;
      case 'ArrowUp': moveSelection(0, -1); e.preventDefault(); break;
      case 'ArrowDown': moveSelection(0, 1); e.preventDefault(); break;
      case ' ': case 'Enter':
        if (!buttonFocused) { useOnSelected(); e.preventDefault(); }
        break;
      default: return;
    }
    if (key.length === 1 && key !== ' ') Sound.play('click');
  }

  function bindInput() {
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') G.hover = -1; });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.addEventListener('keydown', onKeyDown);
    // Any first interaction anywhere unlocks audio.
    document.addEventListener('pointerdown', function () { Sound.init(); Sound.startMusic(); }, true);
    window.addEventListener('resize', function () { R.resize(); insetT = 0; UI.closePopover(); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { hiddenAt = Date.now(); G.saveNow(false); }
      else if (hiddenAt) { var away = (Date.now() - hiddenAt) / 1000; hiddenAt = 0; lastTs = 0; catchUp(away); }
    });
    window.addEventListener('pagehide', function () { G.saveNow(false); });
    window.addEventListener('beforeunload', function () { G.saveNow(false); });
  }

  // ==================================================================
  // Main loop: requestAnimationFrame + fixed logic step
  // ==================================================================
  function frame(ts) {
    root.requestAnimationFrame(frame);
    var dt = lastTs ? (ts - lastTs) / 1000 : 0.016;
    lastTs = ts;
    if (dt > C.MAX_FRAME_DT) dt = C.MAX_FRAME_DT;   // background tab, breakpoint, hiccup
    if (dt < 0) dt = 0;

    fpsFrames++; fpsT += dt;
    if (fpsT >= 0.5) { UI.setFps(Math.round(fpsFrames / fpsT)); fpsFrames = 0; fpsT = 0; }

    if (G.mode === 'play' && G.state) {
      var st = G.state;
      if (!UI.isBlocking()) {
        acc += dt * G.settings.speed;
        var steps = 0;
        while (acc >= C.TICK && steps < C.MAX_STEPS_PER_FRAME) { L.tick(st, C.TICK, env); acc -= C.TICK; steps++; }
        if (steps >= C.MAX_STEPS_PER_FRAME) acc = 0;
        autosaveT += dt;
        if (autosaveT >= C.AUTOSAVE_SECONDS) G.saveNow(false);
      }
      handleEvents(L.drain());
      if (G.mode !== 'play' || !G.state) return;   // an event handler may have left the game

      var raining = st.events.rain > 0;
      if (raining !== rainOn) { rainOn = raining; Sound.setRain(raining); }

      insetT -= dt;
      if (insetT <= 0) {
        insetT = 0.4;
        var ins = G.photo ? { top: 0, bottom: 0, right: 0 } : UI.insets();
        R.setInsets(ins);
        // The side panel and toasts sit just below the HUD, however many rows it wraps to.
        if (!G.photo) document.documentElement.style.setProperty('--hud-h', ins.top + 'px');
      }
      if (G.selected >= st.pots.length) G.selected = -1;
      R.update(dt, st);
      R.draw(st, { selected: G.selected, hover: G.photo ? -1 : G.hover, tool: G.tool });
      UI.update(false);
    } else {
      // Main menu: a showcase barn with a quick day/night cycle.
      if (rainOn) { rainOn = false; Sound.setRain(false); }
      demo.time += dt * 5;
      R.update(dt, demo);
      R.draw(demo, { menu: true, selected: -1, hover: -1 });
    }
  }

  function boot() {
    canvas = $('scene');
    G.settings = Save.loadSettings();
    if (G.settings.isDefault && root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      G.settings.reducedMotion = true;
    }
    demo = S.demo();
    R.init(canvas);
    UI.init();
    G.applySettings(true);
    bindInput();
    UI.showMenu();
    root.requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
