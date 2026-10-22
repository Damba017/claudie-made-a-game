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
  var C = BB.CONFIG, L = BB.Logic, S = BB.State, Save = BB.Save, Sound = BB.Audio, R = BB.Render, UI = BB.UI, K = BB.Combat;

  var G = {
    state: null, settings: null, mode: 'menu',
    tool: 'hand', seed: 'mint', nutrient: 'nitro',
    selected: -1, hover: -1, photo: false, debug: {}
  };
  BB.Game = G;

  // The admin panel only exists when the game is opened as a file on the
  // owner's own computer. On a website (GitHub Pages) it cannot be opened.
  G.isAdmin = !!(root.location && root.location.protocol === 'file:');

  var canvas, demo;
  var env = { events: true, offline: false };
  var acc = 0, lastTs = 0, autosaveT = 0, insetT = 0;
  var fpsT = 0, fpsFrames = 0;
  var hiddenAt = 0, rainOn = false;
  var drag = { active: false, last: -1 };
  var lastClick = { x: 0, y: 0 };
  var complainedAt = {};
  var fightView = { hurt: 0, shrink: 1 };

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
    applyTheme();
    L.ignoreCaps = G.isAdmin && !!s.adminNoCaps;
    insetT = 0;
    UI.setFps(0);
  };
  // Dark menus and panels: always, never, or following the computer's own setting.
  var darkQuery = root.matchMedia ? root.matchMedia('(prefers-color-scheme: dark)') : null;
  function applyTheme() {
    var t = G.settings.theme, dark = t === 2 || (t === 0 && !!(darkQuery && darkQuery.matches));
    document.documentElement.classList.toggle('dark', dark);
  }
  if (darkQuery) {
    var onSystemTheme = function () { if (G.settings && G.settings.theme === 0) applyTheme(); };
    if (darkQuery.addEventListener) darkQuery.addEventListener('change', onSystemTheme);
    else if (darkQuery.addListener) darkQuery.addListener(onSystemTheme);
  }

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
        if (viaDrag) return false;     // sweeping the shovel only clears withered plants
        if (!G.settings.confirmDig) return L.clear(st, slot).ok;
        UI.confirm({
          title: 'Dig up this plant?', yes: 'Dig it up', danger: true, dontAsk: 'Don\'t ask me again',
          text: 'The ' + L.species(pot.plant).name + ' is still alive. Digging it up throws it away and you get nothing for it.'
        }, function (dontAsk) {
          if (dontAsk) {
            G.settings.confirmDig = false;
            G.applySettings();
            UI.toast('No more questions. You can turn the warning back on in Settings.', { time: 3500 });
          }
          L.clear(st, slot);
        });
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
  G.buyRare = function () {
    var ok = bought(L.buyRare(G.state), { funds: NO_FUNDS, gone: 'That offer has gone.' });
    if (ok) { G.saveNow(false); UI.refreshModals(); }
    return ok;
  };
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

  /** Starts a New Season (prestige). The UI asks for confirmation first. */
  G.prestige = function () {
    if (!G.state || G.mode !== 'play') return false;
    var r = L.prestige(G.state);
    if (!r.ok) {
      complain('prestige:' + r.reason, r.reason === 'trades'
        ? 'Finish or cancel your open trade offers first (Friends > Trade).'
        : 'Earn this season\'s goal first.');
      return false;
    }
    G.state = r.state;
    startPlay();
    G.saveNow(false);
    Sound.play('achievement'); R.shake(6);
    UI.toast('You saved ' + UI.fmt(r.heirlooms) + ' Heirloom Seeds. Everything grows and sells ' +
      Math.round(L.prestigeBonus(G.state) * 100) + '% better from now on.',
      { kind: 'gold', icon: 'acorn', title: 'Season ' + (G.state.prestige + 1) + ' begins', time: 8000 });
    return true;
  };

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
      if (sp.sound) { Sound.play(sp.sound); R.wiggle(e.slot); }
      if (e.golden) {
        Sound.play('golden'); R.shake(5);
        UI.toast('A golden ' + sp.name + '! Triple price and +1 Sunshine.', { kind: 'gold', icon: 'star', title: 'Golden harvest' });
      } else if (e.sunshine > 0) {
        UI.toast('A fine ' + sp.name + ' bloom: +' + e.sunshine + ' Sunshine.', { kind: 'gold', icon: 'sun' });
      }
      // Rewards from rare plants.
      if (e.heirlooms > 0) {
        R.shake(3);
        UI.toast('The ' + sp.name + ' grumbles, then hands over ' + e.heirlooms + (e.heirlooms === 1 ? ' Heirloom Seed.' : ' Heirloom Seeds.'),
          { kind: 'gold', icon: 'acorn', title: 'Heirloom harvest' });
      } else if (sp.heirlooms && !e.auto) {
        UI.toast('That ' + sp.name + ' was not happy enough to share an Heirloom Seed. It needs 4 stars or better.', { icon: 'acorn', time: 4000 });
      }
      if (e.crumbs > 0) UI.toast('A Comet Crumb was tucked inside the ' + sp.name + '.', { kind: 'good', icon: 'star', time: 2600 });
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
      if (e.kind === 'pest' && e.eaten) {
        R.burst('pop', e.slot); R.wiggle(e.slot); Sound.play('squish');
        R.textAtSlot(e.slot, 'Crunch!', '#c9f7c0');
        UI.toast('A bug flew into the barn and straight into your Gobblepot Pitcher. It grew a little from the snack.',
          { kind: 'good', icon: 'bug', time: 3500 });
        return;
      }
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
    rareOffer: function (e) {
      var sp = C.SPECIES_BY_ID[e.species];
      Sound.play('rare'); R.shake(2);
      UI.toast(sp.offer + ' ' + UI.fmt(e.price) + ' coins, and it only waits ' + Math.round(C.RARE.offerTime / 60 * 10) / 10 + ' minutes.',
        { kind: 'gold', icon: 'star', title: 'Rare seed: ' + sp.name, time: 15000,
          action: { label: 'Buy', fn: function () { G.buyRare(); } } });
      UI.refreshModals();
    },
    rareGone: function (e) {
      UI.toast('The ' + C.SPECIES_BY_ID[e.species].name + ' offer has moved on.', { time: 2600 });
      UI.refreshModals();
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
    buy: function (e) {
      Sound.play('coin');
      if (e.kind !== 'rare') return;
      Sound.play('unlock');
      UI.toast('A ' + C.SPECIES_BY_ID[e.species].name + ' seed is in your seed bag. Plant it with the seed tool (5).',
        { kind: 'gold', icon: 'seed', title: 'Rare seed bought' });
    },
    seasonReady: function () {
      Sound.play('achievement');
      UI.toast('This season\'s goal is reached. Open Seasons (N) whenever you are ready to start a New Season and collect Heirloom Seeds.',
        { kind: 'gold', icon: 'acorn', title: 'Harvest festival!', time: 9000,
          action: { label: 'Seasons', fn: function () { UI.openSeasons(); } } });
    },
    giftSent: function () { Sound.play('feed'); },
    tradeOffered: function () { Sound.play('feed'); },
    tradeAccepted: function (e) {
      Sound.play('order');
      UI.toast('You received ' + UI.giftText(e.items) + '. Send the reply code back so ' + e.from + ' gets their part.',
        { kind: 'good', icon: 'heart', title: 'Trade accepted', time: 8000 });
    },
    tradeDone: function (e) {
      Sound.play('unlock'); R.shake(3);
      UI.toast(e.from + ' sent ' + UI.giftText(e.items) + '.', { kind: 'gold', icon: 'heart', title: 'Trade complete', time: 7000 });
    },
    giftOpened: function (e) {
      Sound.play('unlock'); R.shake(3);
      UI.toast(UI.giftText(e.items) + '.', { kind: 'gold', icon: 'heart', title: 'A gift from ' + e.from, time: 7000 });
    },
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
    if (!G.state || (G.mode !== 'play' && G.mode !== 'fight')) return false;
    var ok = Save.saveGame(G.state);
    autosaveT = 0;
    if (announce) UI.toast(ok ? 'Game saved.' : 'Saving failed: this browser is blocking storage. Use Export save to back up.', { kind: ok ? 'good' : 'bad', icon: ok ? 'check' : null, time: 2200 });
    return ok;
  };

  function toMenu() {
    UI.closeAll();
    if (G.fight) { G.fight = null; UI.hideFight(); canvas.style.cursor = 'default'; }
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

  // ---- Visiting a friend's barn ----------------------------------------
  // A visit shows a read-only snapshot. Your own barn is saved first and
  // stays paused and untouched until you come back.
  G.visit = null;

  G.setBarnName = function (name) {
    if (!G.state) return;
    G.state.barnName = Save.cleanName(name);
    G.saveNow(false);
  };
  /** The visit code for your own barn, or null if there is no barn yet. */
  G.shareCode = function () {
    if (G.state) return Save.visitString(G.state);
    var res = Save.loadGame();
    return res.state ? Save.visitString(res.state) : null;
  };
  G.startVisit = function (text) {
    var card = Save.parseVisit(text);
    if (!card) return false;
    var from = G.visit ? G.visit.from : G.mode;
    if (G.mode === 'play') G.saveNow(false);
    G.visit = { state: card.state, name: card.name, at: card.at, from: from };
    G.mode = 'visit';
    G.selected = -1; G.hover = -1;
    UI.closeAll();
    R.reset();
    insetT = 0;
    UI.showVisit(G.visit);
    Sound.play('notify');
    UI.toast('Have a look around. You cannot change anything here, but the cat does not mind a pet.',
      { kind: 'event', icon: 'leaf', title: 'Welcome to ' + card.name });
    return true;
  };
  G.leaveVisit = function () {
    if (!G.visit) return;
    var from = G.visit.from;
    G.visit = null;
    UI.hideVisit();
    R.reset();
    if (from === 'play' && G.state) { G.mode = 'play'; insetT = 0; UI.showGame(); }
    else toMenu();
  };

  // ---- Boss fights -----------------------------------------------------------
  // A fight pauses the barn. The fight itself is never saved; the retry wait,
  // used battle items and the boss's remaining health are, so closing the page
  // mid-fight gains nothing (and loses no damage).
  G.fight = null;

  G.startFight = function (id) {
    if (!G.state || G.mode !== 'play') return false;
    var r = K.start(G.state, id, Date.now());
    if (!r.ok) {
      complain('fight:' + r.reason, {
        prestige: 'This boss has not appeared yet. Keep starting New Seasons.',
        sharp: 'Your shears are too blunt for this one. Upgrade Shear Sharpness first.',
        beaten: 'You already beat this boss this season.',
        cooldown: 'This boss is still recovering from your last attempt.'
      }[r.reason]);
      return false;
    }
    if (G.isAdmin && G.settings.adminNoCooldown) delete G.state.bossRetryAt[id];
    G.saveNow(false);
    G.fight = r.fight;
    G.mode = 'fight';
    G.selected = -1; G.hover = -1;
    drag.active = false;
    UI.closeAll(); UI.closePopover();
    R.reset();
    insetT = 0; fightView.hurt = 0; fightView.shrink = 1;
    canvas.style.cursor = 'crosshair';
    UI.showFight(G.fight);
    Sound.play('roar'); R.shake(4);
    var b = K.boss(id), left = r.fight.hp / r.fight.maxHp;
    var names = b.moves.map(function (m) { return m.name; });
    UI.fightBanner(b.name, (left < 0.995 ? 'Still wounded from last time: ' + Math.max(1, Math.round(left * 100)) + '% health left. ' : '') +
      'Click it to snip! Watch out for ' + names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] + '.', 'warn');
    return true;
  };
  G.spray = function () {
    if (!G.fight) return;
    var r = K.spray(G.state, G.fight);
    if (!r.ok && r.reason === 'grabbed') complain('grabbed', 'Something is holding your sprayer! Wait until it lets go.');
    else if (!r.ok) Sound.play('error');
  };
  G.useItem = function (id) {
    if (!G.fight) return;
    var r = K.useItem(G.state, G.fight, id);
    if (r.ok) return;
    complain('item:' + r.reason + id, {
      none: 'You have no ' + C.NUTRIENTS_BY_ID[id].name + ' left. Buy more in the shop before the next fight.',
      used: 'Each battle item can be used ' + C.COMBAT.itemUses + ' times per fight.'
    }[r.reason] || 'That does not work right now.');
  };
  G.giveUp = function () {
    if (!G.fight || G.fight.done) return;
    UI.confirm({ title: 'Give up?', yes: 'Give up', no: 'Keep fighting', danger: true,
      text: 'The boss gets away and needs ' + Math.round(C.COMBAT.retryCooldown / 60) + ' minutes to recover before you can try again. The damage you dealt stays.' },
      function () { if (G.fight) K.giveUp(G.fight); });
  };
  G.endFight = function () {
    G.fight = null;
    G.mode = 'play';
    canvas.style.cursor = 'default';
    UI.hideFight();
    R.reset();
    insetT = 0;
    UI.showGame();
    G.saveNow(false);
  };

  var FIGHT_HANDLERS = {
    hit: function (e) {
      R.fightBurst(e.crit ? 'crit' : 'slash', lastClick.x, lastClick.y);
      R.floatText(lastClick.x + (Math.random() - 0.5) * 20, lastClick.y - 22, (e.crit ? 'CRIT ' : '') + UI.fmt(e.amount), e.crit ? GOLD : CREAM, e.crit);
      Sound.play('snip');
      fightView.hurt = 1;
    },
    tooWeak: function (e) {
      var p = e.spray ? R.bossCenter() : lastClick;
      R.fightBurst('block', p.x, p.y);
      R.floatText(p.x, p.y - 22, 'Too weak!', '#d9d2c4');
      Sound.play('block');
    },
    shielded: function () { R.fightBurst('block', lastClick.x, lastClick.y); R.floatText(lastClick.x, lastClick.y - 22, 'Blocked!', '#c9f7d0'); Sound.play('block'); },
    bitten: function (e) {
      R.floatText(lastClick.x, lastClick.y - 22, 'Ouch! -' + e.amount.toFixed(1) + 's', '#ff8a8a', true);
      R.shake(5); Sound.play('error');
    },
    spray: function (e) {
      var p = R.bossCenter();
      R.fightBurst('spray', p.x, p.y);
      R.floatText(p.x, p.y - 50, UI.fmt(e.amount), '#c9f7c0', true);
      Sound.play('spray'); fightView.hurt = 1;
    },
    brigade: function (e) { var p = R.brigadeSpot(); R.floatText(p.x, p.y, UI.fmt(e.amount), '#e8cfa8'); },
    move: function (e) { UI.fightBanner(e.def.name, e.def.text, 'warn'); Sound.play('roar'); R.shake(3); },
    pop: function (e) { var p = R.podPos(e.pod); R.fightBurst('pop', p.x, p.y, { look: e.pod.look }); Sound.play('squish'); },
    podHit: function (e) {
      var p = R.podPos(e.pod);
      if (e.heal) {
        var bc = R.bossCenter();
        R.fightBurst('heal', bc.x, bc.y);
        R.floatText(bc.x, bc.y - 60, '+' + UI.fmt(e.heal), '#7bcf6a', true);
      } else {
        R.floatText(p.x, p.y, '-' + e.time.toFixed(1) + 's', '#ff8a8a', true);
        R.shake(3);
      }
      Sound.play('error');
    },
    item: function (e) { Sound.play('feed'); UI.fightBanner(UI.itemInfo[e.id].name, UI.itemInfo[e.id].tip, 'good'); },
    phase: function (e) { UI.fightBanner('Second bloom!', e.text, 'warn'); Sound.play('roar'); R.shake(8); },
    won: function () { var p = R.bossCenter(); R.fightBurst('victory', p.x, p.y); Sound.play('victory'); R.shake(8); },
    lost: function (e) { Sound.play('defeat'); if (!e.gaveUp) UI.fightBanner('Time is up!', 'The boss is getting away...', 'warn'); }
  };

  function fightFrame(dt) {
    var f = G.fight;
    if (!UI.isBlocking() && !f.done) K.tick(G.state, f, dt);
    var events = f.events;
    f.events = [];
    for (var i = 0; i < events.length; i++) if (FIGHT_HANDLERS[events[i].type]) FIGHT_HANDLERS[events[i].type](events[i]);
    fightView.hurt = Math.max(0, fightView.hurt - dt * 6);
    if (f.done && !f.finished) {
      // A short pause so the victory burst (or the escape) can be seen.
      f.endDelay = (f.endDelay === undefined ? 1.4 : f.endDelay) - dt;
      if (f.won) fightView.shrink = Math.max(0.12, f.endDelay / 1.4);
      if (f.endDelay <= 0) {
        var result = K.finish(G.state, f);
        G.saveNow(false);
        UI.fightResult(result);
      }
    }
    insetT -= dt;
    if (insetT <= 0) { insetT = 0.4; R.setInsets(UI.fightInsets()); }
    R.update(dt, null);
    R.drawFight(G.state, f, fightView);
    UI.updateFight(f);
  }

  // ---- Gifts ---------------------------------------------------------------
  /** Wraps a gift from your own stock. Returns the gift code, or null if it could not be made. */
  G.makeGift = function (items) {
    if (!G.state || G.mode !== 'play') return null;
    var r = L.makeGift(G.state, items);
    if (!r.ok) {
      complain('gift:' + r.reason, r.reason === 'empty' ? 'Choose at least one thing to give.' : 'You do not have that much to give.');
      return null;
    }
    G.state.lastGiftCode = Save.giftString(r.gift);
    G.saveNow(false);
    return G.state.lastGiftCode;
  };
  /** Opens a gift code. Returns { ok, items, from } or { ok: false, reason: invalid | own | used }. */
  G.openGift = function (text) {
    if (!G.state || G.mode !== 'play') return { ok: false, reason: 'invalid' };
    var gift = Save.parseGift(text);
    if (!gift) { Sound.play('error'); return { ok: false, reason: 'invalid' }; }
    var r = L.openGift(G.state, gift);
    if (r.ok) G.saveNow(false); else Sound.play('error');
    return r;
  };

  // ---- Trading ---------------------------------------------------------------
  /** Proposes a trade. Returns true if the offer was made (its code is then listed under open offers). */
  G.makeTrade = function (give, want) {
    if (!G.state || G.mode !== 'play') return false;
    var r = L.makeTrade(G.state, give, want);
    if (!r.ok) {
      complain('trade:' + r.reason, {
        empty: 'Choose something to give and something you want in return.',
        short: 'You do not have that much to give.',
        toomany: 'You already have ' + C.GIFTS.maxOpenTrades + ' open offers. Cancel one first.'
      }[r.reason]);
      return false;
    }
    G.saveNow(false);
    return true;
  };
  /** The code to send for one of your open offers. */
  G.tradeCode = function (id) {
    var trade = G.state && L.tradeFor(G.state, id);
    return trade ? Save.tradeString(trade) : '';
  };
  G.cancelTrade = function (id) {
    var r = L.cancelTrade(G.state, id);
    if (r.ok) { Sound.play('click'); G.saveNow(false); }
    return r.ok;
  };
  /**
   * Reads a pasted trade code. Returns one of
   *   { type: 'trade', trade, problem }   an offer from a friend (problem is null if you can accept)
   *   { type: 'deal', ok, items, from, reason }   a reply to one of your offers, completed on the spot
   *   { type: 'invalid' }
   */
  G.readTradeCode = function (text) {
    if (!G.state || G.mode !== 'play') return { type: 'invalid' };
    var trade = Save.parseTrade(text);
    if (trade) return { type: 'trade', trade: trade, problem: L.tradeProblem(G.state, trade) };
    var deal = Save.parseDeal(text);
    if (deal) {
      var r = L.completeTrade(G.state, deal);
      if (r.ok) G.saveNow(false); else Sound.play('error');
      return { type: 'deal', ok: r.ok, items: r.items, from: deal.from, reason: r.reason };
    }
    Sound.play('error');
    return { type: 'invalid' };
  };
  /** Accepts a friend's offer. Returns the reply code to send back, or null. */
  G.acceptTrade = function (trade) {
    var r = L.acceptTrade(G.state, trade);
    if (!r.ok) { Sound.play('error'); return null; }
    G.state.lastDealCode = Save.dealString(r.deal);
    G.saveNow(false);
    return G.state.lastDealCode;
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
  G.debug.heirlooms = function (n) { G.state.heirlooms += n; };
  G.debug.prestigeUp = function () { G.state.prestige++; UI.showGame(); };
  G.debug.bossReset = function () {
    G.state.bossRetryAt = {}; G.state.bossesBeaten = {}; G.state.bossHealth = {}; G.state.bossTries = {};
    UI.refreshModals();
  };
  G.debug.seasonGoal = function () { G.state.seasonEarned = Math.max(G.state.seasonEarned, L.prestigeGoal(G.state)); };
  G.debug.unlockAll = function () { C.SPECIES.forEach(function (sp) { if (!sp.rare) G.state.unlocked[sp.id] = true; }); UI.refreshModals(); };
  G.debug.rare = function (id) { L.offerRare(G.state, id); };
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

  // ---- Admin panel actions (UI.toggleAdmin; only when G.isAdmin) ----------
  /** Redraws whatever is on screen after an admin change. */
  function adminRefresh() { if (G.mode === 'play') UI.showGame(); else UI.refreshModals(); }

  G.admin = {
    /** what: coins | sunshine | heirlooms | crumbs | n:<nutrient> | s:<species>. set = replace instead of add. */
    give: function (what, amount, set) {
      var st = G.state;
      if (!st) return;
      amount = Math.max(0, Math.floor(Number(amount) || 0));
      var parts = what.split(':'), map = st, key = what;
      if (parts[0] === 'n') { map = st.nutrients; key = parts[1]; st.discovered.nutrients[key] = true; }
      else if (parts[0] === 's') { map = st.seeds; key = parts[1]; }
      if (what === 'crumbs' && amount) st.discovered.nutrients.crumbs = true;
      map[key] = set ? amount : (map[key] || 0) + amount;
      Sound.play('coin');
    },
    setPrestige: function (n) {
      var st = G.state;
      if (!st) return;
      st.prestige = Math.max(0, Math.min(999, Math.floor(Number(n) || 0)));
      // A lower prestige also lowers the upgrade caps.
      for (var id in st.upgrades) if (st.upgrades[id] > L.upgradeMax(st, id)) G.admin.setUpgrade(id, L.upgradeMax(st, id));
      adminRefresh();
      Sound.play('upgrade');
    },
    /** Sets an upgrade to a level (limited by the current cap, or the absolute cap with "ignore caps"). */
    setUpgrade: function (id, level) {
      var st = G.state, u = C.UPGRADES_BY_ID[id];
      if (!st || !u) return;
      var lvl = Math.max(0, Math.min(L.upgradeMax(st, id), Math.floor(Number(level) || 0)));
      if (lvl) st.upgrades[id] = lvl; else delete st.upgrades[id];
      if (id === 'slots') {
        while (st.pots.length < C.START.slots + lvl) st.pots.push(S.newPot());
        while (st.pots.length > C.START.slots + lvl) st.pots.pop();
        G.selected = -1;
      }
      if (id === 'tank') st.tank = L.tankCapacity(st);
      if (id === 'bulk') L.fillStock(st);
    },
    maxAll: function () {
      if (!G.state) return;
      C.UPGRADES.forEach(function (u) { G.admin.setUpgrade(u.id, L.upgradeMax(G.state, u.id)); });
      adminRefresh();
      Sound.play('upgrade');
    },
    toggle: function (key, on) {
      G.settings[key] = !!on;
      G.applySettings();
      // Caps back on: anything above the normal cap drops back to it.
      if (key === 'adminNoCaps' && !on && G.state) {
        for (var id in G.state.upgrades) if (G.state.upgrades[id] > L.upgradeMax(G.state, id)) G.admin.setUpgrade(id, L.upgradeMax(G.state, id));
      }
      UI.refreshModals();
    },
    bossLow: function () { if (G.fight && !G.fight.done) G.fight.hp = Math.min(G.fight.hp, 1); },
    bossWin: function () {
      var f = G.fight;
      if (!f || f.done) return;
      f.dealt += f.hp;
      f.hp = 0; f.done = true; f.won = true; f.move = null; f.pods = [];
      f.events.push({ type: 'won' });
    },
    restartTutorial: function () {
      if (!G.state) return;
      G.state.tutorial = { step: 0, done: false };
      adminRefresh();
    },
    resetSave: function () {
      UI.confirm({ title: 'Reset the whole save?', yes: 'Delete everything', danger: true,
        text: 'This deletes this barn completely and goes back to the main menu.' }, function () { G.resetSave(); });
    }
  };

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
    if (G.mode === 'fight') {
      if (!G.fight || G.fight.done || e.button > 0 || UI.anyModal()) return;
      var fp = canvasPos(e);
      lastClick = fp;
      var pod = R.podAt(fp.x, fp.y, G.fight, G.state);
      if (pod) K.pop(G.fight, pod);
      else if (R.bossAt(fp.x, fp.y)) K.snip(G.state, G.fight);
      return;
    }
    if (G.mode === 'visit') {
      // Nothing can be changed on a visit, but petting the cat is always allowed.
      var vp = canvasPos(e);
      if (R.critterAt(vp.x, vp.y) === 'cat') { R.pet(); Sound.play('purr'); }
      return;
    }
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
    // The ` key; on some keyboard layouts it is a "dead key", so the physical key counts too.
    var adminKey = key === '`' || e.code === 'Backquote';
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    Sound.init();
    if (G.photo) { G.photoMode(false); e.preventDefault(); return; }
    if (G.mode === 'visit') {
      if (key === 'Escape' && !UI.closeTop()) G.leaveVisit();
      return;
    }
    if (G.mode === 'fight') {
      if (typing && key !== 'Escape') return;   // typing into the admin panel
      if (adminKey) { if (G.isAdmin) UI.toggleAdmin(); return; }
      if (key === 'Escape') { if (!UI.closeTop()) G.giveUp(); return; }
      if (UI.anyModal() || !G.fight || G.fight.done || e.repeat) return;
      var items = { q: 'nitro', w: 'gel', e: 'jam', r: 'tonic' };
      if (key === ' ' || key === 'Enter') { e.preventDefault(); lastClick = R.bossCenter(); K.snip(G.state, G.fight); }
      else if (key === 's') G.spray();
      else if (items[key]) G.useItem(items[key]);
      else if (key === 'm') G.toggleMute();
      return;
    }

    if (key === 'Escape') {
      if (!$('popover').hidden) { UI.closePopover(); return; }
      if (UI.closeTop()) return;
      if (G.mode === 'play') { if (G.selected >= 0) G.select(-1); else UI.openPause(); }
      return;
    }
    if (typing && e.target.type !== 'checkbox' && e.target.type !== 'range') return;
    if (key === 'm') { G.toggleMute(); return; }
    if (G.mode !== 'play') return;
    if (adminKey) { if (G.isAdmin) UI.toggleAdmin(); return; }
    if (UI.isBlocking()) { if (key === 'p') UI.closeTop(); return; }

    switch (key) {
      case 'p': UI.openPause(); return;
      case 's': UI.openShop(); return;
      case 'u': UI.openUpgrades(); return;
      case 'l': UI.openAlmanac(); return;
      case 'k': UI.openAchievements(); return;
      case 'o': UI.openOrders(); return;
      case 'n': UI.openSeasons(); return;
      case 'b': if (G.state.prestige > 0) UI.openWildPatch(); return;
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
    } else if (G.mode === 'fight' && G.fight && G.state) {
      if (rainOn) { rainOn = false; Sound.setRain(false); }
      fightFrame(dt);
    } else if (G.mode === 'visit' && G.visit) {
      // A friend's barn: the clock runs so day and night pass, nothing else changes.
      var vs = G.visit.state;
      if (rainOn) { rainOn = false; Sound.setRain(false); }
      vs.time += dt;
      insetT -= dt;
      if (insetT <= 0) { insetT = 0.4; R.setInsets(UI.visitInsets()); }
      R.update(dt, vs);
      R.draw(vs, { selected: -1, hover: -1, tool: 'hand' });
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
