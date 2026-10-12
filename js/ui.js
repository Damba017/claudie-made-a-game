/*
 * Barn Bloom - ui.js
 * ------------------------------------------------------------------
 * Everything DOM: HUD, toolbar, plant info panel, orders board, all
 * dialogs (shop, upgrades, almanac, achievements, pause, settings,
 * how to play, credits, welcome back), main menu, toasts, tooltips,
 * tutorial and the debug panel.
 *
 * The UI never changes the game state directly; it calls BB.Game.
 */
(function (root) {
  'use strict';
  var BB = root.BB = root.BB || {};
  var C = BB.CONFIG, L = BB.Logic, Art = BB.Art, Save = BB.Save, Sound = BB.Audio;
  var UI = {};
  var G = null;                       // BB.Game, assigned in UI.init
  var refs = {};                      // frequently updated DOM nodes
  var modals = [];                    // open dialogs, top last
  var shopState = { tab: 'seeds', qty: 1 };
  var upgradeTab = 'tools';
  var almanacTab = 'plants';
  var shownCoins = 0;
  var info = { key: '', update: null };
  var ordersKey = '', toolbarKey = '', chipsKey = '';
  var timers = { hud: 0, info: 0, live: 0 };

  function $(id) { return document.getElementById(id); }

  // ==================================================================
  // Helpers
  // ==================================================================
  /** Tiny DOM builder: el('div', { class, text, html, tip, onclick, ... }, [children]). */
  function el(tag, props, kids) {
    var e = document.createElement(tag), k;
    if (props) {
      for (k in props) {
        var v = props[k];
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k === 'tip') e.setAttribute('data-tip', v);
        else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      }
    }
    if (kids) {
      for (var i = 0; i < kids.length; i++) {
        if (kids[i] === null || kids[i] === undefined || kids[i] === false) continue;
        e.appendChild(typeof kids[i] === 'string' ? document.createTextNode(kids[i]) : kids[i]);
      }
    }
    return e;
  }

  var ICONS = {
    coin: '<circle cx="12" cy="12" r="9.5" fill="#ffd24a" stroke="#b9801a" stroke-width="1.8"/><circle cx="12" cy="12" r="5" fill="none" stroke="#b9801a" stroke-width="1.6"/>',
    sun: '<path d="M12 1.8v3M12 19.2v3M1.8 12h3M19.2 12h3M4.8 4.8l2.1 2.1M17.1 17.1l2.1 2.1M4.8 19.2l2.1-2.1M17.1 6.9l2.1-2.1" stroke="#f29a2e" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="12" r="5.2" fill="#ffc94a" stroke="#f29a2e" stroke-width="1.5"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" fill="#f4f1de" stroke="#8a8fb5" stroke-width="1.2"/>',
    drop: '<path d="M12 2.5c4 5.5 7 8.6 7 12.2a7 7 0 0 1-14 0c0-3.6 3-6.7 7-12.2z" fill="#58b7ea" stroke="#2f86c4" stroke-width="1.4"/>',
    drops: '<path d="M7 3c2.4 3.4 4.2 5.2 4.2 7.4a4.2 4.2 0 0 1-8.4 0C2.8 8.2 4.6 6.4 7 3zM17 3c2.4 3.4 4.2 5.2 4.2 7.4a4.2 4.2 0 0 1-8.4 0c0-2.2 1.8-4 4.2-7.4zM12 12c2.4 3.4 4.2 5.2 4.2 7.4a4.2 4.2 0 0 1-8.4 0c0-2.2 1.8-4 4.2-7.4z" fill="#58b7ea" stroke="#2f86c4" stroke-width="1"/>',
    hand: '<path d="M6 3v16l4.2-3.8 2.9 6 2.7-1.3-2.9-5.9H19z" fill="currentColor"/>',
    can: '<path d="M8 9h9a1.5 1.5 0 0 1 1.5 1.5V19a1.500 1.500 0 0 1-1.500 1.500H9.500A1.500 1.500 0 0 1 8 19z" fill="#6fb2c9"/><path d="M8 13 2.500 8.500" stroke="#6fb2c9" stroke-width="2.6" stroke-linecap="round"/><path d="M18.500 11.500a3.600 3.600 0 0 1 0 7" fill="none" stroke="#4c8499" stroke-width="2"/><circle cx="2.8" cy="8" r="1.8" fill="#4c8499"/>',
    basket: '<path d="M3.5 10.5h17l-2 9.5h-13z" fill="#c99a3c"/><path d="M7 10.5a5 5 0 0 1 10 0" fill="none" stroke="#8a6a2a" stroke-width="2"/><path d="M8 13v5M12 13v5M16 13v5" stroke="#8a6a2a" stroke-width="1.4"/>',
    scythe: '<path d="M5 21 15 5" stroke="#b9835a" stroke-width="2.4" stroke-linecap="round"/><path d="M14 4.5c4-1.5 7 0 8 3.5-3-1.8-5.5-1.6-8.5-.3z" fill="#9aa3ad"/>',
    shovel: '<path d="M17.5 3.5 9.5 11.5M15.5 2.5l6 6" stroke="#b9835a" stroke-width="2.6" stroke-linecap="round"/><path d="M10.8 10.200l3 3-5.300 6.600c-1.300 1.300-3.600 1.600-4.500.700s-.600-3.200.700-4.500z" fill="#9aa3ad"/>',
    shop: '<path d="M5 8h14l1.200 12.500H3.800z" fill="#e8686b"/><path d="M8.500 10V7a3.500 3.500 0 0 1 7 0v3" fill="none" stroke="#7b2f33" stroke-width="2" stroke-linecap="round"/>',
    upgrade: '<circle cx="12" cy="12" r="10" fill="#7bcf6a"/><path d="M12 5.500l5.500 6h-3.300V18h-4.400v-6.500H6.500z" fill="#fff"/>',
    book: '<path d="M3 5c3-1.300 6-1.300 9 0v15c-3-1.300-6-1.300-9 0z" fill="#5fb3e6"/><path d="M21 5c-3-1.300-6-1.300-9 0v15c3-1.300 6-1.300 9 0z" fill="#8fd3f4"/>',
    trophy: '<path d="M7 3h10v5a5 5 0 0 1-10 0z" fill="#ffd24a"/><path d="M7 4.500H3.500c0 3 1.300 5 4 5.300M17 4.500h3.500c0 3-1.300 5-4 5.300" fill="none" stroke="#e0a82a" stroke-width="1.8"/><path d="M10.500 13h3v4h-3zM7.500 17h9v3.500h-9z" fill="#e0a82a"/>',
    pause: '<rect x="5.5" y="4" width="4.5" height="16" rx="1.5" fill="currentColor"/><rect x="14" y="4" width="4.5" height="16" rx="1.5" fill="currentColor"/>',
    clip: '<rect x="4.5" y="4" width="15" height="17.5" rx="2" fill="#f2e2bd" stroke="#8a5a3c" stroke-width="1.6"/><rect x="8.5" y="2" width="7" height="4.5" rx="1.5" fill="#8a5a3c"/><path d="M8 11h8M8 14.500h8M8 18h5" stroke="#8a5a3c" stroke-width="1.5" stroke-linecap="round"/>',
    close: '<path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10.5" rx="2.5" fill="currentColor"/><path d="M8 10.500V8a4 4 0 0 1 8 0v2.500" fill="none" stroke="currentColor" stroke-width="2.2"/>',
    check: '<path d="M4.500 12.500l5 5 10-11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
    sound: '<path d="M3.500 9.500h4l5-4.500v14l-5-4.500h-4z" fill="currentColor"/><path d="M15.500 8.500a5 5 0 0 1 0 7M18 6a8.500 8.500 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    mute: '<path d="M3.500 9.500h4l5-4.500v14l-5-4.500h-4z" fill="currentColor"/><path d="M16 9.500l5 5M21 9.500l-5 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    camera: '<path d="M3 7.500h4l1.500-2.500h7L17 7.500h4V19H3z" fill="currentColor"/><circle cx="12" cy="13" r="3.6" fill="#fff3d6"/>',
    star: '<path d="M12 2.500l2.900 6 6.600.900-4.800 4.600 1.200 6.500L12 17.400 6.100 20.500l1.200-6.500L2.500 9.400l6.600-.900z" fill="#ffd24a" stroke="#b9801a" stroke-width="1.2"/>',
    bug: '<ellipse cx="12" cy="13" rx="6" ry="7" fill="#7b3fa0"/><circle cx="12" cy="6" r="3" fill="#5a2a7a"/><path d="M6 10 2.500 8M6 14H2.500M6.500 18l-3 2M18 10l3.500-2M18 14h3.500M17.500 18l3 2" stroke="#5a2a7a" stroke-width="1.6" stroke-linecap="round"/>',
    gear: '<circle cx="12" cy="12" r="3.8" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 2.500v3M12 18.500v3M2.500 12h3M18.500 12h3M5.300 5.300l2.100 2.100M16.600 16.600l2.100 2.100M5.300 18.700l2.100-2.100M16.600 7.400l2.100-2.100" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
    clock: '<circle cx="12" cy="12" r="9" fill="#fff3d6" stroke="currentColor" stroke-width="2"/><path d="M12 7v5.500l3.500 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    heart: '<path d="M12 20.500C5 15.500 2.500 12 2.500 8.600A4.600 4.600 0 0 1 12 6.500a4.600 4.600 0 0 1 9.500 2.100c0 3.400-2.500 6.900-9.500 11.900z" fill="#e8686b"/>',
    leaf: '<path d="M4 20C4 9 10 4 20 4c0 10-5 16-16 16z" fill="#63b95f"/><path d="M4 20 14 10" stroke="#3f9a55" stroke-width="1.6" stroke-linecap="round"/>',
    seed: '<path d="M12 21c-4.500 0-7-3-7-6.500C5 10 9 8 12 8s7 2 7 6.500c0 3.500-2.500 6.500-7 6.500z" fill="#a5793f"/><path d="M12 9c0-3 1.500-5.500 5-6.500 0 3.500-1.500 5.500-5 6.500z" fill="#63b95f"/>',
    play: '<path d="M7 4.500v15l12-7.500z" fill="currentColor"/>',
    heat: '<path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.500 2-4.500.500 1.500 1 2 2 2.500C11 8 10.500 5 12 2z" fill="#f2793a"/>',
    rain: '<path d="M7 14a4.500 4.500 0 0 1 .500-9A6 6 0 0 1 19 7a3.500 3.500 0 0 1-1 7z" fill="#9db4c9"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" stroke="#58b7ea" stroke-width="2" stroke-linecap="round"/>',
    bee: '<ellipse cx="12" cy="14" rx="7" ry="5.500" fill="#ffcf3f"/><path d="M10 9v10M14 9v10" stroke="#3a2a22" stroke-width="2"/><ellipse cx="9" cy="7" rx="4" ry="2.500" fill="#dfefff"/><ellipse cx="15" cy="7" rx="4" ry="2.500" fill="#dfefff"/>',
    cart: '<path d="M3 9h18v7H3z" fill="#96633f"/><path d="M2 5h20l-1.500 4h-17z" fill="#e8686b"/><circle cx="7.500" cy="18.500" r="2.800" fill="#4e3224"/><circle cx="16.500" cy="18.500" r="2.800" fill="#4e3224"/>'
  };
  function icon(name, cls) {
    return el('span', { class: 'ic ' + (cls || ''), 'aria-hidden': 'true',
      html: '<svg viewBox="0 0 24 24" focusable="false">' + (ICONS[name] || '') + '</svg>' });
  }
  function iconHtml(name) { return '<span class="ic" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">' + ICONS[name] + '</svg></span>'; }

  UI.fmt = function (n) {
    n = Math.floor(n || 0);
    if (n < 100000) return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    var units = ['K', 'M', 'B', 'T', 'Qa'], u = -1;
    while (n >= 1000 && u < units.length - 1) { n /= 1000; u++; }
    return (n >= 100 ? n.toFixed(0) : n.toFixed(1)) + units[u];
  };
  UI.time = function (s) {
    if (!isFinite(s)) return '--:--';
    s = Math.max(0, Math.ceil(s));
    if (s >= 3600) { var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h + 'h ' + (m < 10 ? '0' : '') + m + 'm'; }
    var mm = Math.floor(s / 60), ss = s % 60;
    return mm + ':' + (ss < 10 ? '0' : '') + ss;
  };
  var fmt = UI.fmt;

  function scaled(px) { return Math.round(px * ((G && G.settings.uiScale) || 1)); }
  function iconCanvas(size) {
    var px = scaled(size);
    var cv = el('canvas', { class: 'pic', 'data-size': px, width: px, height: px, 'aria-hidden': 'true' });
    cv.style.width = px + 'px'; cv.style.height = px + 'px';
    return cv;
  }
  function plantPic(id, size, growth, opts) { var cv = iconCanvas(size); Art.drawPlantIcon(cv, id, growth, opts); return cv; }
  function seedPic(id, size) { var cv = iconCanvas(size); Art.drawSeedIcon(cv, id); return cv; }
  function nutrientPic(id, size) { var cv = iconCanvas(size); Art.drawNutrientIcon(cv, id); return cv; }
  function nutrientDef(id) { return id === 'crumbs' ? C.CRUMBS : C.NUTRIENTS_BY_ID[id]; }

  function click() { Sound.play('click'); }
  /** A standard button. opts: { cls, tip, icon, key, label (aria) } */
  function btn(text, onClick, opts) {
    opts = opts || {};
    var b = el('button', { type: 'button', class: 'btn ' + (opts.cls || ''), tip: opts.tip, 'aria-label': opts.label,
      onclick: function (ev) { if (b.disabled) return; if (!opts.silent) click(); onClick(ev); } },
      [opts.icon ? icon(opts.icon) : null, text ? el('span', { class: 'btn-label', text: text }) : null,
        opts.key ? el('kbd', { text: opts.key }) : null]);
    return b;
  }
  function setHtml(node, html) { if (node._html !== html) { node._html = html; node.innerHTML = html; } }
  function setText(node, text) { if (node._text !== text) { node._text = text; node.textContent = text; } }
  function price(n, cur) { return '<span class="price">' + iconHtml(cur === 'sunshine' ? 'sun' : 'coin') + fmt(n) + '</span>'; }
  function stars(n) {
    var s = '';
    for (var i = 1; i <= 5; i++) s += i <= n ? '★' : '☆';
    return s;
  }
  function likesText(sp) {
    return sp.likes.map(function (id) { return C.NUTRIENTS_BY_ID[id].name; }).join(' and ');
  }
  function lovedBy(id) {
    var names = C.SPECIES.filter(function (sp) { return sp.likes.indexOf(id) >= 0; }).map(function (sp) { return sp.name; });
    return names.length ? names.join(', ') : 'Everyone, equally';
  }
  function thirstWord(sp) {
    return sp.thirst < 0.5 ? 'barely drinks' : (sp.thirst < 1.05 ? 'normal thirst' : (sp.thirst < 1.5 ? 'thirsty' : 'very thirsty'));
  }

  // ==================================================================
  // Tooltips
  // ==================================================================
  function initTooltips() {
    var tip = $('tooltip'), current = null;
    function show(target) {
      var text = target.getAttribute('data-tip');
      if (!text) return;
      current = target;
      tip.textContent = text;
      tip.hidden = false;
      var r = target.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
      var x = Math.max(6, Math.min(window.innerWidth - tw - 6, r.left + r.width / 2 - tw / 2));
      var y = r.top - th - 8;
      if (y < 6) y = r.bottom + 8;
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    }
    function hide() { current = null; tip.hidden = true; }
    function find(node) {
      while (node && node !== document.body) {
        if (node.getAttribute && node.getAttribute('data-tip')) return node;
        node = node.parentNode;
      }
      return null;
    }
    document.addEventListener('mouseover', function (e) { var t = find(e.target); if (t) { if (t !== current) show(t); } else if (current) hide(); });
    document.addEventListener('focusin', function (e) { var t = find(e.target); if (t) show(t); });
    document.addEventListener('focusout', hide);
    document.addEventListener('pointerdown', hide);
    window.addEventListener('scroll', hide, true);
  }

  // ==================================================================
  // Toasts
  // ==================================================================
  /** opts: { title, kind: info|good|bad|event|gold, icon, action: { label, fn }, time } */
  UI.toast = function (text, opts) {
    opts = opts || {};
    var box = $('toasts');
    while (box.children.length >= 4) box.removeChild(box.firstChild);
    var t = el('div', { class: 'toast ' + (opts.kind || 'info') }, [
      opts.icon ? icon(opts.icon, 'toast-ic') : null,
      el('div', { class: 'toast-body' }, [
        opts.title ? el('strong', { text: opts.title }) : null,
        el('span', { text: text })
      ]),
      opts.action ? btn(opts.action.label, function () { opts.action.fn(); dismiss(); }, { cls: 'small' }) : null
    ]);
    var gone = false;
    function dismiss() {
      if (gone) return;
      gone = true;
      t.classList.add('out');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 260);
    }
    t.addEventListener('click', function (e) { if (e.target.tagName !== 'BUTTON') dismiss(); });
    box.appendChild(t);
    setTimeout(dismiss, opts.time || (opts.action ? 9000 : 4600));
  };

  // ==================================================================
  // Dialog framework
  // ==================================================================
  function focusables(node) {
    return Array.prototype.slice.call(node.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter(function (n) { return !n.disabled && n.offsetParent !== null; });
  }

  /**
   * Opens a dialog. opts: { id, title, icon, wide, body, footer: [nodes],
   * blocking (pauses the game), closable, onClose }
   */
  function openModal(opts) {
    var titleId = 'dlg-' + opts.id + '-title';
    var m = { id: opts.id, blocking: !!opts.blocking, updaters: [], onClose: opts.onClose, lastFocus: document.activeElement };
    var closable = opts.closable !== false;
    m.body = opts.body || el('div');
    m.body.classList.add('modal-body');
    m.dialog = el('div', { class: 'modal' + (opts.wide ? ' wide' : '') + (opts.cls ? ' ' + opts.cls : ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, tabindex: '-1' }, [
      el('header', { class: 'modal-head' }, [
        opts.icon ? icon(opts.icon) : null,
        el('h2', { id: titleId, text: opts.title }),
        closable ? btn('', function () { m.close(); }, { cls: 'icon-btn close', icon: 'close', label: 'Close' }) : null
      ]),
      m.body,
      opts.footer ? el('footer', { class: 'modal-foot' }, opts.footer) : null
    ]);
    m.overlay = el('div', { class: 'overlay', onpointerdown: function (e) { if (closable && e.target === m.overlay) m.close(); } }, [m.dialog]);
    m.close = function () {
      var idx = modals.indexOf(m);
      if (idx < 0) return;
      modals.splice(idx, 1);
      if (m.overlay.parentNode) m.overlay.parentNode.removeChild(m.overlay);
      if (m.onClose) m.onClose();
      if (m.lastFocus && m.lastFocus.focus && document.body.contains(m.lastFocus)) { try { m.lastFocus.focus(); } catch (err) { /* ignore */ } }
      if (G) G.onModalChange();
    };
    m.closable = closable;
    m.dialog.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = focusables(m.dialog);
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    $('modals').appendChild(m.overlay);
    modals.push(m);
    var f = focusables(m.body);
    (f[0] || m.dialog).focus();
    if (G) G.onModalChange();
    return m;
  }
  function findModal(id) { for (var i = 0; i < modals.length; i++) if (modals[i].id === id) return modals[i]; return null; }
  /** Pressing a dialog's shortcut again closes it. Returns true if it did. */
  function toggleOff(id) { var m = findModal(id); if (m) { m.close(); return true; } return false; }
  /** Closes the non-blocking dialogs (shop, upgrades, ...) so they never stack on each other. */
  function closeLight() {
    for (var i = modals.length - 1; i >= 0; i--) if (!modals[i].blocking) modals[i].close();
  }

  UI.anyModal = function () { return modals.length > 0; };
  UI.isBlocking = function () { for (var i = 0; i < modals.length; i++) if (modals[i].blocking) return true; return false; };
  UI.closeTop = function () {
    var m = modals[modals.length - 1];
    if (m && m.closable) { m.close(); return true; }
    return !!m;
  };
  UI.closeAll = function () { while (modals.length) { var m = modals[modals.length - 1]; m.onClose = null; m.close(); } };

  /** opts: { title, text, yes, no, danger } */
  UI.confirm = function (opts, onYes) {
    var m = openModal({
      id: 'confirm', title: opts.title || 'Are you sure?', blocking: true, cls: 'narrow',
      body: el('div', {}, [el('p', { text: opts.text })]),
      footer: [
        btn(opts.no || 'Cancel', function () { m.close(); }),
        btn(opts.yes || 'Yes', function () { m.close(); onYes(); }, { cls: opts.danger ? 'danger' : 'primary' })
      ]
    });
    return m;
  };

  function tabs(list, current, onPick) {
    return el('div', { class: 'tabs', role: 'tablist' }, list.map(function (t) {
      return el('button', { type: 'button', role: 'tab', class: 'tab' + (t.id === current ? ' active' : ''),
        'aria-selected': t.id === current ? 'true' : 'false',
        onclick: function () { Sound.play('tab'); onPick(t.id); } },
        [t.icon ? icon(t.icon) : null, el('span', { text: t.name }), t.badge ? el('span', { class: 'badge', text: t.badge }) : null]);
    }));
  }

  // ==================================================================
  // HUD
  // ==================================================================
  function pill(cls, kids, tip) { return el('div', { class: 'pill ' + cls, tip: tip }, kids); }
  function hudBtn(ic, label, key, fn, cls) {
    return btn(label, fn, { cls: 'hud-btn ' + (cls || ''), icon: ic, key: key, tip: label + ' (' + key + ')', label: label });
  }

  function buildHud() {
    var hud = $('hud');
    hud.innerHTML = '';
    refs.coin = el('span', { class: 'num', text: '0' });
    refs.sun = el('span', { class: 'num', text: '0' });
    refs.tankFill = el('i');
    refs.tankText = el('span', { class: 'num small' });
    refs.dayIcon = el('span', { class: 'day-ic' });
    refs.clock = el('span', { class: 'num small' });
    refs.speed = btn('1x', function () { G.cycleSpeed(); }, { cls: 'pill speed', tip: 'Game speed (click to change)' });
    refs.coinPill = pill('coins', [icon('coin'), refs.coin], 'Coins. Earned by harvesting plants and filling orders.');
    refs.sunPill = pill('sunshine', [icon('sun'), refs.sun], 'Sunshine. A rare currency from achievements, golden plants and picky orders. Spend it on Sunshine upgrades.');
    refs.tankPill = pill('tank', [icon('drop'), el('span', { class: 'tankbar' }, [refs.tankFill]), refs.tankText],
      'Water tank. Every pour uses tank water; it refills on its own and in the rain.');
    refs.chips = el('div', { class: 'chips' });
    hud.appendChild(el('div', { class: 'hud-group' }, [
      refs.coinPill, refs.sunPill, refs.tankPill,
      pill('clock', [refs.dayIcon, refs.clock], 'Day and time in the barn.'), refs.speed
    ]));
    hud.appendChild(el('div', { class: 'hud-group right' }, [
      hudBtn('shop', 'Shop', 'S', function () { UI.openShop(); }),
      hudBtn('upgrade', 'Upgrades', 'U', function () { UI.openUpgrades(); }),
      hudBtn('book', 'Almanac', 'L', function () { UI.openAlmanac(); }),
      hudBtn('trophy', 'Awards', 'K', function () { UI.openAchievements(); }),
      hudBtn('clip', 'Orders', 'O', function () { UI.openOrders(); }, 'mobile-only'),
      hudBtn('pause', 'Pause', 'P', function () { UI.openPause(); })
    ]));
    hud.appendChild(refs.chips);
  }

  var EVENT_INFO = {
    heat: { name: 'Heatwave', icon: 'heat', tip: 'Water drains much faster. Keep the can handy or use Gulp-Gel.' },
    rain: { name: 'Rainy day', icon: 'rain', tip: 'Free water for every plant and the tank fills quickly.' },
    bee: { name: 'Lucky bee', icon: 'bee', tip: 'Everything grows 50% faster. Catch the bee for a tip!' },
    merchant: { name: 'Merchant', icon: 'cart', tip: 'A travelling merchant has a special offer. Click to look.' }
  };

  function updateHud() {
    var st = G.state;
    // Coins count up smoothly.
    if (Math.abs(st.coins - shownCoins) < 1.5) shownCoins = st.coins;
    else shownCoins += (st.coins - shownCoins) * 0.4;
    setText(refs.coin, fmt(Math.round(shownCoins)));
    setText(refs.sun, fmt(st.sunshine));
    var cap = L.tankCapacity(st), frac = st.tank / cap;
    refs.tankFill.style.width = Math.round(frac * 100) + '%';
    setText(refs.tankText, Math.floor(st.tank) + '/' + cap);
    refs.tankPill.classList.toggle('low', frac < 0.15);
    var night = L.isNight(st);
    setHtml(refs.dayIcon, iconHtml(night ? 'moon' : 'sun'));
    setText(refs.clock, 'Day ' + L.day(st) + ' · ' + L.clock(st));
    setText(refs.speed.querySelector('.btn-label'), G.settings.speed + 'x');

    // Event chips.
    var ev = st.events, pests = 0, i;
    for (i = 0; i < st.pots.length; i++) { var p = st.pots[i].plant; if (p && !p.dead && p.pest > 0) pests++; }
    var active = ['heat', 'rain', 'bee', 'merchant'].filter(function (k) { return ev[k] > 0; });
    var key = active.join(',') + '|' + pests;
    if (key !== chipsKey) {
      chipsKey = key;
      refs.chips.innerHTML = '';
      refs.chipTimes = {};
      active.forEach(function (k) {
        var inf = EVENT_INFO[k], time = el('span', { class: 'num small' });
        refs.chipTimes[k] = time;
        var chip = el(k === 'merchant' ? 'button' : 'div', { class: 'chip ' + k, tip: inf.tip, type: k === 'merchant' ? 'button' : null,
          onclick: k === 'merchant' ? function () { click(); UI.openShop('special'); } : null },
          [icon(inf.icon), el('span', { text: inf.name }), time]);
        refs.chips.appendChild(chip);
      });
      if (pests > 0) {
        refs.chips.appendChild(el('div', { class: 'chip pest', tip: 'A pest is nibbling a plant. Select it and shoo the bug, or use Bug-Off Tonic.' },
          [icon('bug'), el('span', { text: pests + (pests === 1 ? ' pest' : ' pests') })]));
      }
    }
    for (var k in refs.chipTimes) setText(refs.chipTimes[k], UI.time(ev[k]));
  }

  // ==================================================================
  // Toolbar
  // ==================================================================
  var TOOL_INFO = {
    hand: { name: 'Select', key: '1', icon: 'hand', tip: 'Select: tap a pot to inspect it.', help: 'Tap a pot to see how the plant is doing and what it needs.' },
    water: { name: 'Water', key: '2', icon: 'can', tip: 'Watering can: tap or drag across plants to water them.', help: 'Tap a plant to water it, or hold and drag across several. Watch the blue bar: stay between the white marks.' },
    harvest: { name: 'Harvest', key: '3', icon: 'basket', tip: 'Basket: harvest and sell ripe plants.', help: 'Tap ripe plants (gold star) to harvest and sell them. Dragging works too.' },
    shovel: { name: 'Shovel', key: '4', icon: 'shovel', tip: 'Shovel: clear a pot.', help: 'Clears withered plants for free. Digging up a living plant asks first.' }
  };

  function toolButton(id, content, key, tip, onClick, label) {
    return el('button', { type: 'button', id: 'tool-' + id, class: 'tool', tip: tip + ' (' + key + ')', 'aria-label': label,
      'aria-pressed': 'false', onclick: function () { click(); onClick(); } }, content.concat([el('kbd', { text: key })]));
  }

  function buildToolbar() {
    var st = G.state, bar = $('toolbar');
    bar.innerHTML = '';
    refs.tools = {}; refs.counts = {};
    ['hand', 'water', 'harvest', 'shovel'].forEach(function (id) {
      var t = TOOL_INFO[id];
      refs.tools[id] = toolButton(id, [icon(t.icon, 'tool-ic')], t.key, t.tip, function () { G.setTool(id); }, t.name);
      bar.appendChild(refs.tools[id]);
    });
    bar.appendChild(el('span', { class: 'sep' }));

    // Seed tool: shows the chosen species; clicking it again opens the seed picker.
    refs.seedPic = el('span', { class: 'tool-pic' });
    refs.counts.seed = el('span', { class: 'count' });
    refs.tools.seed = toolButton('seed', [refs.seedPic, refs.counts.seed, el('span', { class: 'caret', text: '▾' })], '5',
      'Seeds: tap an empty pot to plant. Tap this button again to choose another seed.', function () {
        if (G.tool === 'seed') toggleSeedPopover(); else { G.setTool('seed'); }
      }, 'Seeds');
    bar.appendChild(refs.tools.seed);
    bar.appendChild(el('span', { class: 'sep' }));

    var list = C.NUTRIENTS.slice();
    if (st.crumbs > 0 || st.discovered.nutrients.crumbs) list.push(C.CRUMBS);
    list.forEach(function (n) {
      refs.counts[n.id] = el('span', { class: 'count' });
      var holder = el('span', { class: 'tool-pic' }, [nutrientPic(n.id, 34)]);
      refs.tools['feed:' + n.id] = toolButton('feed-' + n.id, [holder, refs.counts[n.id]], n.key,
        n.name + ': ' + n.effect, function () { G.setTool('feed', n.id); }, n.name);
      bar.appendChild(refs.tools['feed:' + n.id]);
    });

    var hasWhistle = L.level(st, 'whistle') > 0, hasScythe = L.level(st, 'scythe') > 0;
    if (hasWhistle || hasScythe) bar.appendChild(el('span', { class: 'sep' }));
    if (hasWhistle) {
      refs.tools.waterAll = toolButton('waterAll', [icon('drops', 'tool-ic')], 'A', 'Water every thirsty plant', function () { G.waterAll(); }, 'Water all thirsty plants');
      refs.tools.waterAll.classList.add('action');
      bar.appendChild(refs.tools.waterAll);
    }
    if (hasScythe) {
      refs.tools.harvestAll = toolButton('harvestAll', [icon('scythe', 'tool-ic')], 'H', 'Harvest every ripe plant', function () { G.harvestAll(); }, 'Harvest all ripe plants');
      refs.tools.harvestAll.classList.add('action');
      bar.appendChild(refs.tools.harvestAll);
    }
    refs.seedShown = null;
  }

  function updateToolbar() {
    var st = G.state;
    var key = [L.level(st, 'whistle'), L.level(st, 'scythe'), st.crumbs > 0 || !!st.discovered.nutrients.crumbs, G.settings.uiScale].join('|');
    if (key !== toolbarKey) { toolbarKey = key; buildToolbar(); }
    var active = G.tool === 'feed' ? 'feed:' + G.nutrient : G.tool;
    for (var id in refs.tools) {
      var on = id === active;
      refs.tools[id].classList.toggle('active', on);
      refs.tools[id].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    if (refs.seedShown !== G.seed) {
      refs.seedShown = G.seed;
      refs.seedPic.innerHTML = '';
      refs.seedPic.appendChild(seedPic(G.seed, 36));
    }
    var seeds = st.seeds[G.seed] || 0;
    setText(refs.counts.seed, String(seeds));
    refs.counts.seed.classList.toggle('zero', seeds === 0);
    C.NUTRIENTS.forEach(function (n) {
      setText(refs.counts[n.id], String(st.nutrients[n.id] || 0));
      refs.counts[n.id].classList.toggle('zero', !st.nutrients[n.id]);
    });
    if (refs.counts.crumbs) { setText(refs.counts.crumbs, String(st.crumbs)); refs.counts.crumbs.classList.toggle('zero', !st.crumbs); }
    if (refs.tools.harvestAll) refs.tools.harvestAll.classList.toggle('ready', L.readyCount(st) > 0);
  }

  function closePopover() { var p = $('popover'); p.hidden = true; p.innerHTML = ''; }
  function toggleSeedPopover() {
    var pop = $('popover');
    if (!pop.hidden) { closePopover(); return; }
    var st = G.state;
    pop.innerHTML = '';
    pop.appendChild(el('h3', { text: 'Choose a seed' }));
    C.SPECIES.forEach(function (sp) {
      var have = st.seeds[sp.id] || 0;
      if (!st.unlocked[sp.id] && !have) return;
      pop.appendChild(el('button', { type: 'button', class: 'pop-item' + (sp.id === G.seed ? ' active' : ''),
        onclick: function () { click(); G.setSeed(sp.id); closePopover(); } }, [
        seedPic(sp.id, 30), el('span', { class: 'grow', text: sp.name }),
        el('span', { class: 'pop-count', html: have > 0 ? '×' + have : (st.unlocked[sp.id] ? price(L.seedCost(st, sp.id)) : '') })
      ]));
    });
    pop.appendChild(el('p', { class: 'hint', text: 'Out of seeds? Planting buys one automatically if you can afford it.' }));
    pop.hidden = false;
    var r = refs.tools.seed.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(window.innerWidth - pop.offsetWidth - 8, r.left + r.width / 2 - pop.offsetWidth / 2)) + 'px';
    pop.style.bottom = (window.innerHeight - r.top + 10) + 'px';
  }
  UI.closePopover = closePopover;

  // ==================================================================
  // Plant info panel
  // ==================================================================
  function bar(label, cls) {
    var fill = el('i'), zone = el('b', { class: 'zone' }), text = el('span', { class: 'bar-text' });
    var root2 = el('div', { class: 'stat' }, [
      el('span', { class: 'stat-label', text: label }),
      el('span', { class: 'bar ' + cls }, [zone, fill]), text
    ]);
    return { root: root2, fill: fill, zone: zone, text: text };
  }
  function setBar(b, frac, text) {
    b.fill.style.width = Math.round(L.clamp(frac, 0, 1) * 100) + '%';
    setText(b.text, text);
  }

  function seedsKey(st) {
    return C.SPECIES.map(function (sp) { return (st.unlocked[sp.id] ? 'u' : '') + (st.seeds[sp.id] || 0); }).join(',');
  }

  function buildInfoNone(box) {
    var t = G.tool === 'feed' ? null : TOOL_INFO[G.tool];
    var title, help;
    if (G.tool === 'seed') { title = 'Planting ' + C.SPECIES_BY_ID[G.seed].name; help = 'Tap an empty pot to plant. Drag across pots to plant a whole row.'; }
    else if (G.tool === 'feed') { var n = nutrientDef(G.nutrient); title = n.name; help = n.effect + ' Tap a plant to apply one dose.'; }
    else { title = t.name + ' tool'; help = t.help; }
    box.appendChild(el('h3', { text: title }));
    box.appendChild(el('p', { class: 'hint', text: help }));
    box.appendChild(el('p', { class: 'hint', text: 'Hover over or tap a pot to see the details of its plant.' }));
    info.update = null;
  }

  function buildInfoEmpty(box, slot) {
    var st = G.state, pot = st.pots[slot];
    box.appendChild(el('header', { class: 'info-head' }, [
      el('div', { class: 'grow' }, [el('h3', { text: 'Empty pot' }), el('p', { class: 'sub', text: 'Pot ' + (slot + 1) + ' is ready for a seed.' })]),
      btn('', function () { G.select(-1); }, { cls: 'icon-btn close mobile-only', icon: 'close', label: 'Close' })
    ]));
    var list = el('div', { class: 'seed-list' });
    C.SPECIES.forEach(function (sp) {
      var have = st.seeds[sp.id] || 0;
      if (!st.unlocked[sp.id] && !have) return;
      list.appendChild(el('button', { type: 'button', class: 'pop-item', tip: sp.quirk,
        onclick: function () { G.act('seed', slot, sp.id); } }, [
        seedPic(sp.id, 30), el('span', { class: 'grow', text: sp.name }),
        el('span', { class: 'pop-count', html: have > 0 ? '×' + have : 'buy ' + price(L.seedCost(st, sp.id)) })
      ]));
    });
    box.appendChild(list);
    if (pot.memo && L.level(st, 'squirrel') > 0) {
      box.appendChild(el('p', { class: 'hint', text: 'The squirrel will replant ' + C.SPECIES_BY_ID[pot.memo].name + ' here. Use the shovel on the empty pot to tell it not to.' }));
    }
    info.update = null;
  }

  function buildInfoPlant(box, slot) {
    var st = G.state, p = st.pots[slot].plant, sp = L.species(p);
    var stageText = el('p', { class: 'sub' }), starText = el('span', { class: 'stars' });
    box.appendChild(el('header', { class: 'info-head' }, [
      plantPic(sp.id, 52, 1, { pot: false, golden: p.golden }),
      el('div', { class: 'grow' }, [el('h3', {}, [sp.name, ' ', starText]), stageText]),
      btn('', function () { G.select(-1); }, { cls: 'icon-btn close mobile-only', icon: 'close', label: 'Close' })
    ]));

    if (p.dead) {
      setText(stageText, 'Withered');
      box.appendChild(el('p', { text: 'This plant did not make it. Clear the pot to plant something new; it happens to the best gardeners.' }));
      box.appendChild(el('div', { class: 'actions' }, [btn('Clear pot', function () { G.act('shovel', slot); }, { icon: 'shovel', cls: 'primary' })]));
      info.update = null;
      return;
    }

    var bWater = bar('Water', 'water'), bHealth = bar('Health', 'health'), bGrowth = bar('Growth', 'growth'), bQual = bar('Quality', 'quality');
    bWater.zone.style.left = (sp.water[0] / C.WATER.max * 100) + '%';
    bWater.zone.style.width = ((sp.water[1] - sp.water[0]) / C.WATER.max * 100) + '%';
    box.appendChild(el('div', { class: 'stats' }, [bWater.root, bHealth.root, bGrowth.root, bQual.root]));

    // Nutrient bars.
    var nutBars = {}, nutBox = el('div', { class: 'nutbars', tip: 'Active nutrients. One dose is half a bar; the effect lasts until the bar is empty.' });
    C.NUTRIENTS.forEach(function (n) {
      var fill = el('i');
      fill.style.background = n.color;
      nutBars[n.id] = fill;
      nutBox.appendChild(el('div', { class: 'nutbar' + (sp.likes.indexOf(n.id) >= 0 ? ' loved' : '') }, [
        nutrientPic(n.id, 20), el('span', { class: 'bar nut' }, [fill])
      ]));
    });
    box.appendChild(nutBox);
    var synergy = el('p', { class: 'synergy' });
    box.appendChild(synergy);

    var eta = el('strong'), value = el('strong');
    box.appendChild(el('ul', { class: 'facts' }, [
      el('li', {}, [icon('clock'), eta]),
      el('li', {}, [icon('coin'), value]),
      el('li', {}, [icon('heart'), el('span', { text: 'Loves ' + likesText(sp) })]),
      el('li', {}, [icon('leaf'), el('span', { text: sp.quirk })])
    ]));

    var bHarvest = btn('Harvest', function () { G.act('harvest', slot); }, { icon: 'basket', cls: 'primary' });
    var bShoo = btn('Shoo bug!', function () { G.act('shoo', slot); }, { icon: 'bug', cls: 'danger' });
    var feedBtns = {};
    var feedRow = el('div', { class: 'feed-row' });
    var feedList = C.NUTRIENTS.slice();
    if (st.crumbs > 0) feedList.push(C.CRUMBS);
    feedList.forEach(function (n) {
      var count = el('span', { class: 'count' });
      var b = el('button', { type: 'button', class: 'tool mini', tip: n.name + ': ' + n.effect, 'aria-label': 'Feed ' + n.name,
        onclick: function () { G.act('feed', slot, n.id); } }, [nutrientPic(n.id, 26), count]);
      feedBtns[n.id] = { b: b, count: count };
      feedRow.appendChild(b);
    });
    box.appendChild(el('div', { class: 'actions' }, [
      btn('Water', function () { G.act('water', slot); }, { icon: 'drop' }), bHarvest, bShoo
    ]));
    box.appendChild(feedRow);
    box.appendChild(el('div', { class: 'actions' }, [btn('Dig up', function () { G.act('shovel', slot); }, { icon: 'shovel', cls: 'small ghost' })]));

    info.update = function () {
      if (st.pots[slot].plant !== p) { info.key = ''; return; }   // replaced (e.g. replanted): rebuild
      var stage = L.stage(p), q = L.quality(p), ready = p.growth >= 1;
      setText(stageText, C.STAGE_NAMES[stage] + (p.golden && ready ? ' · Golden!' : '') + (sp.harvests > 1 ? ' · ' + p.harvestsLeft + ' harvest' + (p.harvestsLeft === 1 ? '' : 's') + ' left' : ''));
      setText(starText, stars(L.stars(q)));
      var wState = p.water <= 0.5 ? 'Parched!' : (p.water < sp.water[0] ? 'Thirsty' : (L.isSoggy(p) ? 'Soggy!' : (p.water > sp.water[1] ? 'A bit wet' : 'Comfy')));
      setBar(bWater, p.water / C.WATER.max, wState);
      bWater.root.classList.toggle('warn', wState !== 'Comfy');
      setBar(bHealth, p.health / 100, Math.round(p.health) + '%');
      bHealth.root.classList.toggle('warn', p.health < 50);
      setBar(bGrowth, p.growth, Math.floor(p.growth * 100) + '%');
      setBar(bQual, q, L.stars(q) + ' / 5');
      for (var id in nutBars) nutBars[id].style.width = Math.round(p.nutrients[id] / C.NUTRIENT.max * 100) + '%';
      var syn = L.synergies(p).map(function (sid) { for (var i = 0; i < C.SYNERGIES.length; i++) if (C.SYNERGIES[i].id === sid) return C.SYNERGIES[i]; });
      setText(synergy, syn.length ? 'Synergy: ' + syn.map(function (s) { return s.name; }).join(' + ') : '');
      synergy.hidden = !syn.length;
      if (ready) {
        setText(eta, stage === 'overgrown' ? 'Past its prime: losing value' : 'Ripe and ready');
        setText(value, 'Sells for ' + fmt(L.sellValue(st, p)));
      } else {
        var t = L.timeToMature(st, p);
        setText(eta, isFinite(t) ? 'Ripe in ' + UI.time(t) : (p.water < sp.water[0] ? 'Stalled: too dry' : 'Stalled: needs care'));
        setText(value, 'Worth about ' + fmt(L.projectedValue(st, p)) + ' when ripe');
      }
      bHarvest.disabled = !ready;
      bShoo.hidden = !(p.pest > 0);
      if (p.pest > 0) setText(bShoo.querySelector('.btn-label'), 'Shoo bug! (' + p.pest + ')');
      for (var nid in feedBtns) {
        var have = nid === 'crumbs' ? st.crumbs : st.nutrients[nid];
        setText(feedBtns[nid].count, String(have));
        feedBtns[nid].b.disabled = !have;
        feedBtns[nid].count.classList.toggle('zero', !have);
      }
    };
  }

  function updateInfo() {
    var st = G.state, box = $('info');
    var slot = G.selected >= 0 ? G.selected : G.hover;
    var pot = slot >= 0 ? st.pots[slot] : null, p = pot && pot.plant, key;
    if (!pot) key = 'none|' + G.tool + '|' + G.seed + '|' + G.nutrient;
    else if (!p) key = 'empty|' + slot + '|' + seedsKey(st) + '|' + (pot.memo || '') + '|' + L.level(st, 'squirrel');
    else key = ['plant', slot, p.species, p.dead, p.golden && p.growth >= 1, st.crumbs > 0, p.age < 0.3 ? 'new' : ''].join('|');
    document.body.classList.toggle('has-selection', G.selected >= 0);
    if (key !== info.key) {
      info.key = key;
      box.innerHTML = '';
      if (!pot) buildInfoNone(box);
      else if (!p) buildInfoEmpty(box, slot);
      else buildInfoPlant(box, slot);
    }
    if (info.update) info.update();
  }

  // ==================================================================
  // Orders board
  // ==================================================================
  function orderNode(o, k, compact) {
    var sp = C.SPECIES_BY_ID[o.species];
    var pips = el('span', { class: 'pips' });
    for (var i = 0; i < o.qty; i++) pips.appendChild(el('i', { class: i < o.done ? 'on' : '' }));
    return el('div', { class: 'order' }, [
      plantPic(sp.id, compact ? 40 : 48, 1, { pot: false }),
      el('div', { class: 'grow' }, [
        el('strong', { text: o.who }),
        el('span', { class: 'order-want', text: 'wants ' + o.qty + ' × ' + sp.name + (o.minStars > 1 ? ' (' + o.minStars + '★ or better)' : '') }),
        pips,
        el('span', { class: 'order-reward', html: 'Reward ' + price(o.reward) + (o.sun ? ' + ' + price(o.sun, 'sunshine') : '') + (o.crumbs ? ' + Comet Crumbs' : '') })
      ]),
      btn('', function () { G.skipOrder(k); }, { cls: 'icon-btn ghost', icon: 'close', label: 'Decline order', tip: 'Decline this order. A new one arrives in a minute.' })
    ]);
  }

  function fillOrders(box, compact) {
    var st = G.state;
    box.innerHTML = '';
    if (!compact) box.appendChild(el('h3', {}, [icon('clip'), ' Chalkboard orders']));
    if (st.stats.harvests < C.ORDERS.unlockHarvests) {
      box.appendChild(el('p', { class: 'hint', text: 'Customers start leaving orders after your first ' + C.ORDERS.unlockHarvests + ' harvests (' + st.stats.harvests + ' so far).' }));
      return {};
    }
    var waits = {};
    box.appendChild(el('p', { class: 'hint', text: 'Harvest matching plants to fill an order. You still get the normal sale price too.' }));
    for (var k = 0; k < C.ORDERS.count; k++) {
      if (st.orders[k]) box.appendChild(orderNode(st.orders[k], k, compact));
      else { waits[k] = el('span', { class: 'num small' }); box.appendChild(el('div', { class: 'order waiting' }, [icon('clock'), el('span', { text: 'Next customer in ' }), waits[k]])); }
    }
    return waits;
  }

  function updateOrders() {
    var st = G.state;
    var key = (st.stats.harvests < C.ORDERS.unlockHarvests ? 'locked' + st.stats.harvests : st.orders.map(function (o) { return o ? o.id + ':' + o.done : 'x'; }).join('|')) + G.settings.uiScale;
    if (key !== ordersKey) {
      ordersKey = key;
      refs.orderWaits = fillOrders($('orders'), false);
      var m = findModal('orders');
      if (m) m.waits = fillOrders(m.body, true);
    }
    var sets = [refs.orderWaits], om = findModal('orders');
    if (om && om.waits) sets.push(om.waits);
    sets.forEach(function (w) { for (var k in w) setText(w[k], UI.time(st.orderCooldown[k])); });
  }

  UI.openOrders = function () {
    if (toggleOff('orders')) return;
    closeLight();
    var m = openModal({ id: 'orders', title: 'Chalkboard orders', icon: 'clip', body: el('div', { class: 'orders-modal' }) });
    m.waits = fillOrders(m.body, true);
  };

  // ==================================================================
  // Shop
  // ==================================================================
  function qtyFor(maxFn) { return shopState.qty === 'max' ? Math.max(1, maxFn()) : shopState.qty; }

  function seedCard(sp, m) {
    var st = G.state;
    var known = st.unlocked[sp.id] || st.discovered.species[sp.id];
    var owned = el('span', { class: 'owned' }), buy = el('button', { type: 'button', class: 'btn buy' }), note = el('span', { class: 'need' });
    var card = el('div', { class: 'item' }, [
      known ? plantPic(sp.id, 64, 1) : plantPic(sp.id, 64, 1, { silhouette: '#6b5544' }),
      el('div', { class: 'grow' }, [
        el('h4', { text: sp.name }),
        el('p', { text: sp.quirk }),
        el('p', { class: 'meta', text: 'Grows in ' + UI.time(sp.growTime) + ' · ' + thirstWord(sp) + ' · loves ' + likesText(sp) })
      ]),
      el('div', { class: 'item-side' }, [owned, buy, note])
    ]);
    buy.addEventListener('click', function () {
      if (buy.disabled) return;
      if (st.unlocked[sp.id]) G.buySeed(sp.id, qtyFor(function () { return L.maxSeeds(st, sp.id); }));
      else if (G.unlock(sp.id)) m.render();
    });
    m.updaters.push(function () {
      var have = st.seeds[sp.id] || 0;
      setText(owned, 'In your bag: ' + have);
      if (st.unlocked[sp.id]) {
        var q = qtyFor(function () { return L.maxSeeds(st, sp.id); }), cost = L.seedCost(st, sp.id) * q;
        setHtml(buy, 'Buy ×' + q + ' ' + price(cost));
        buy.disabled = st.coins < cost;
        setText(note, st.coins < cost ? 'Need ' + fmt(cost - st.coins) + ' more' : 'Sells for about ' + fmt(sp.value * 1.7 * L.sellMultiplier(st)));
        card.classList.remove('locked');
      } else {
        setHtml(buy, iconHtml('lock') + ' Unlock ' + price(sp.unlock) + (sp.unlockSun ? ' + ' + price(sp.unlockSun, 'sunshine') : ''));
        var short = st.coins < sp.unlock || (sp.unlockSun && st.sunshine < sp.unlockSun);
        buy.disabled = short;
        setText(note, short ? (st.coins < sp.unlock ? 'Need ' + fmt(sp.unlock - st.coins) + ' more coins' : 'Need more Sunshine') : 'A new species!');
        card.classList.add('locked');
      }
      note.classList.toggle('bad', buy.disabled);
    });
    return card;
  }

  function nutrientCard(n, m) {
    var st = G.state;
    var owned = el('span', { class: 'owned' }), buy = el('button', { type: 'button', class: 'btn buy' }), note = el('span', { class: 'need' });
    var card = el('div', { class: 'item' }, [
      nutrientPic(n.id, 56),
      el('div', { class: 'grow' }, [
        el('h4', { text: n.name }),
        el('p', { text: n.effect }),
        el('p', { class: 'meta', text: 'Loved by: ' + lovedBy(n.id) + ' (+50% effect)' })
      ]),
      el('div', { class: 'item-side' }, [owned, buy, note])
    ]);
    buy.addEventListener('click', function () {
      if (!buy.disabled) G.buyNutrient(n.id, qtyFor(function () { return L.maxNutrient(st, n.id); }));
    });
    m.updaters.push(function () {
      var stock = st.shopStock[n.id] || 0, q = Math.min(qtyFor(function () { return L.maxNutrient(st, n.id); }), Math.max(1, stock));
      var cost = L.nutrientCost(st, n.id) * q;
      setText(owned, 'You have ' + (st.nutrients[n.id] || 0) + ' · shop has ' + stock);
      setHtml(buy, stock > 0 ? 'Buy ×' + q + ' ' + price(cost) : 'Sold out');
      buy.disabled = stock <= 0 || st.coins < cost;
      setText(note, stock <= 0 ? 'Restocks every morning' : (st.coins < cost ? 'Need ' + fmt(cost - st.coins) + ' more' : ''));
      note.classList.toggle('bad', buy.disabled);
    });
    return card;
  }

  function specialTab(list, m) {
    var st = G.state, ev = st.events;
    // Travelling merchant.
    if (ev.merchant > 0 && ev.offer) {
      var o = ev.offer, left = el('span', { class: 'num small' }), buy = el('button', { type: 'button', class: 'btn buy primary' });
      buy.addEventListener('click', function () { if (!buy.disabled && G.buyOffer()) m.render(); });
      list.appendChild(el('div', { class: 'item merchant' }, [
        icon('cart', 'big'),
        el('div', { class: 'grow' }, [el('h4', { text: 'Travelling merchant: ' + o.title }), el('p', { text: o.desc }),
          el('p', { class: 'meta' }, ['Leaves in ', left])]),
        el('div', { class: 'item-side' }, [buy])
      ]));
      m.updaters.push(function () {
        setText(left, UI.time(st.events.merchant));
        setHtml(buy, o.sold ? 'Sold!' : 'Buy ' + price(o.price));
        buy.disabled = o.sold || st.coins < o.price || st.events.merchant <= 0;
      });
    } else {
      list.appendChild(el('div', { class: 'item muted' }, [icon('cart', 'big'),
        el('div', { class: 'grow' }, [el('h4', { text: 'No merchant in town' }),
          el('p', { text: 'A travelling merchant drops by now and then with a one-off deal. Watch for the cart on the barn floor.' })])]));
    }
    // Comet Crumbs for Sunshine.
    var cBuy = el('button', { type: 'button', class: 'btn buy' }), cOwned = el('span', { class: 'owned' });
    cBuy.addEventListener('click', function () { if (!cBuy.disabled) G.buyCrumbs(); });
    list.appendChild(el('div', { class: 'item' }, [nutrientPic('crumbs', 56),
      el('div', { class: 'grow' }, [el('h4', { text: C.CRUMBS.sunQty + ' × ' + C.CRUMBS.name }), el('p', { text: C.CRUMBS.effect }),
        el('p', { class: 'meta', text: C.CRUMBS.blurb })]),
      el('div', { class: 'item-side' }, [cOwned, cBuy])]));
    m.updaters.push(function () {
      setText(cOwned, 'You have ' + st.crumbs);
      setHtml(cBuy, 'Buy ' + price(C.CRUMBS.sunCost, 'sunshine'));
      cBuy.disabled = st.sunshine < C.CRUMBS.sunCost;
    });
    // Pot paints.
    list.appendChild(el('h3', { class: 'section', text: 'Pot paint (purely for looks)' }));
    var grid = el('div', { class: 'paints' });
    C.POT_STYLES.forEach(function (ps) {
      var b = el('button', { type: 'button', class: 'btn buy small' });
      b.addEventListener('click', function () { if (!b.disabled && G.buyStyle(ps.id)) m.render(); });
      var card = el('div', { class: 'paint' }, [plantPic('mint', 64, 1, { style: ps.id }), el('strong', { text: ps.name }), b]);
      grid.appendChild(card);
      m.updaters.push(function () {
        var have = st.potStyles[ps.id], on = st.potStyle === ps.id;
        setHtml(b, on ? 'In use' : (have ? 'Use' : price(ps.cost, ps.currency)));
        b.disabled = on || (!have && st[ps.currency] < ps.cost);
        card.classList.toggle('active', on);
      });
    });
    list.appendChild(grid);

    // Cat coats.
    list.appendChild(el('h3', { class: 'section', text: 'Cat coats' }));
    list.appendChild(el('p', { class: 'hint', text: st.cat ? 'Dress up the barn cat. It does not mind. Much.'
      : 'The barn cat has not wandered in yet. Pick a coat now and it will arrive wearing it.' }));
    var cats = el('div', { class: 'paints' });
    C.CAT_SKINS.forEach(function (sk) {
      var cv = iconCanvas(72);
      Art.drawCatIcon(cv, sk.id);
      var b = el('button', { type: 'button', class: 'btn buy small' });
      b.addEventListener('click', function () { if (!b.disabled && G.buyCatSkin(sk.id)) m.render(); });
      var card = el('div', { class: 'paint' }, [cv, el('strong', { text: sk.name }), el('small', { class: 'hint', text: sk.breed }), b]);
      cats.appendChild(card);
      m.updaters.push(function () {
        var have = st.catSkins[sk.id], on = st.catSkin === sk.id;
        setHtml(b, on ? 'In use' : (have ? 'Use' : price(sk.cost)));
        b.disabled = on || (!have && st.coins < sk.cost);
        card.classList.toggle('active', on);
      });
    });
    list.appendChild(cats);
  }

  UI.openShop = function (tab) {
    if (!tab && toggleOff('shop')) return;
    var existing = findModal('shop');
    if (tab) shopState.tab = tab;
    if (existing) { existing.render(); return; }
    closeLight();
    var body = el('div', { class: 'shop' });
    var m = openModal({ id: 'shop', title: 'Shop', icon: 'shop', wide: true, body: body });
    m.render = function () {
      var st = G.state;
      body.innerHTML = '';
      m.updaters = [];
      body.appendChild(tabs([
        { id: 'seeds', name: 'Seeds', icon: 'seed' }, { id: 'nutrients', name: 'Nutrients', icon: 'drop' },
        { id: 'special', name: 'Special', icon: 'star', badge: st.events.merchant > 0 ? '!' : null }
      ], shopState.tab, function (id) { shopState.tab = id; m.render(); }));
      var list = el('div', { class: 'items' });
      if (shopState.tab !== 'special') {
        var qrow = el('div', { class: 'qty-row' }, [el('span', { text: 'Buy amount:' })]);
        [1, 5, 10, 'max'].forEach(function (q) {
          qrow.appendChild(el('button', { type: 'button', class: 'chip-btn' + (shopState.qty === q ? ' active' : ''), 'aria-pressed': shopState.qty === q ? 'true' : 'false',
            text: q === 'max' ? 'Max' : '×' + q, onclick: function () { Sound.play('tab'); shopState.qty = q; m.render(); } }));
        });
        body.appendChild(qrow);
      }
      if (shopState.tab === 'seeds') C.SPECIES.forEach(function (sp) { list.appendChild(seedCard(sp, m)); });
      else if (shopState.tab === 'nutrients') {
        var rb = el('button', { type: 'button', class: 'btn small' }), rnote = el('span', { class: 'hint' });
        rb.addEventListener('click', function () { if (!rb.disabled) G.restock(); });
        body.appendChild(el('div', { class: 'restock' }, [rnote, rb]));
        m.updaters.push(function () {
          var cost = L.restockCost(st);
          setText(rnote, 'Shelves restock to ' + L.eff(st, 'bulk') + ' of each every morning.');
          setHtml(rb, cost > 0 ? 'Restock now ' + price(cost) : 'Shelves are full');
          rb.disabled = cost <= 0 || st.coins < cost;
        });
        C.NUTRIENTS.forEach(function (n) { list.appendChild(nutrientCard(n, m)); });
      } else specialTab(list, m);
      body.appendChild(list);
      m.updaters.forEach(function (u) { u(); });
    };
    m.render();
    UI.tutorialEvent('shop');
  };

  // ==================================================================
  // Upgrades
  // ==================================================================
  function upgradeCard(u, m, flash) {
    var st = G.state, lvl = L.level(st, u.id), maxed = lvl >= u.max, lock = L.upgradeLock(st, u.id);
    var cur = u.currency || 'coins';
    var pips = el('span', { class: 'lvl-pips', 'aria-label': 'Level ' + lvl + ' of ' + u.max });
    if (u.max <= 8) for (var i = 0; i < u.max; i++) pips.appendChild(el('i', { class: i < lvl ? 'on' : '' }));
    else pips.appendChild(el('span', { text: 'Level ' + lvl + ' / ' + u.max }));
    var effect = el('p', { class: 'effect' });
    // One-off purchases have nothing to compare; levelled upgrades show now and next.
    if (u.max > 1) effect.appendChild(el('span', { text: 'Now: ' + u.fmt(L.upgradeValue(u.id, lvl)) }));
    else if (maxed) effect.appendChild(el('span', { text: 'Owned' }));
    if (!maxed && u.max > 1) effect.appendChild(el('span', { class: 'next', text: ' → Next: ' + u.fmt(L.upgradeValue(u.id, lvl + 1)) }));
    var side;
    if (maxed) side = el('span', { class: 'maxed', text: 'MAX' });
    else if (lock) side = el('span', { class: 'locked-note' }, [icon('lock'), el('span', { text: lock })]);
    else {
      var b = el('button', { type: 'button', class: 'btn buy' }), note = el('span', { class: 'need' });
      b.addEventListener('click', function () { if (!b.disabled && G.buyUpgrade(u.id)) m.render(u.id); });
      side = el('div', { class: 'item-side' }, [b, note]);
      m.updaters.push(function () {
        var cost = L.upgradeCost(st, u.id), short = st[cur] < cost;
        setHtml(b, (lvl === 0 && u.max === 1 ? 'Buy ' : 'Upgrade ') + price(cost, cur));
        b.disabled = short;
        setText(note, short ? 'Need ' + fmt(cost - st[cur]) + ' more' : '');
        note.classList.toggle('bad', short);
      });
    }
    return el('div', { class: 'item upgrade' + (lock && !maxed ? ' locked' : '') + (flash ? ' shine' : '') + (maxed ? ' done' : '') }, [
      el('div', { class: 'grow' }, [el('h4', {}, [u.name, ' ', pips]), el('p', { text: u.desc }), effect]),
      side
    ]);
  }

  UI.openUpgrades = function () {
    if (toggleOff('upgrades')) return;
    closeLight();
    var body = el('div', { class: 'shop' });
    var m = openModal({ id: 'upgrades', title: 'Upgrades', icon: 'upgrade', wide: true, body: body });
    m.render = function (flashId) {
      var st = G.state, scroll = body.querySelector('.items') ? body.querySelector('.items').scrollTop : 0;
      body.innerHTML = '';
      m.updaters = [];
      body.appendChild(tabs(C.UPGRADE_CATEGORIES.map(function (cat) {
        return { id: cat.id, name: cat.name, icon: cat.id === 'sunshine' ? 'sun' : null };
      }), upgradeTab, function (id) { upgradeTab = id; m.render(); }));
      if (upgradeTab === 'sunshine') {
        body.appendChild(el('p', { class: 'hint', text: 'Sunshine comes from achievements, golden plants, picky orders and the Stardust Lotus. You have ' + st.sunshine + '.' }));
      }
      var list = el('div', { class: 'items' });
      C.UPGRADES.forEach(function (u) { if (u.cat === upgradeTab) list.appendChild(upgradeCard(u, m, u.id === flashId)); });
      body.appendChild(list);
      list.scrollTop = scroll;
      m.updaters.forEach(function (fn) { fn(); });
    };
    m.render();
  };

  // ==================================================================
  // Almanac
  // ==================================================================
  function almanacPlant(sp) {
    var st = G.state, known = st.discovered.species[sp.id];
    if (!known) {
      return el('div', { class: 'entry unknown' }, [
        plantPic(sp.id, 88, 1, { silhouette: '#6b5544' }),
        el('div', { class: 'grow' }, [el('h4', { text: '???' }),
          el('p', { text: st.unlocked[sp.id] ? 'Plant one to add it to your almanac.' : 'Still a mystery. Unlock it in the shop and plant one to learn more.' })])
      ]);
    }
    var stages = el('div', { class: 'stages' });
    [[0.05, 'Seed'], [0.3, 'Sprout'], [0.75, 'Young'], [1, 'Mature']].forEach(function (s) {
      stages.appendChild(el('figure', {}, [plantPic(sp.id, 44, s[0], { pot: false }), el('figcaption', { text: s[1] })]));
    });
    var zone = el('span', { class: 'bar water mini' }, [el('b', { class: 'zone' })]);
    zone.firstChild.style.left = (sp.water[0] / C.WATER.max * 100) + '%';
    zone.firstChild.style.width = ((sp.water[1] - sp.water[0]) / C.WATER.max * 100) + '%';
    var best = st.stats.bestQuality[sp.id] || 0;
    return el('div', { class: 'entry' }, [
      plantPic(sp.id, 88, 1),
      el('div', { class: 'grow' }, [
        el('h4', {}, [sp.name, ' ', el('em', { text: sp.latin })]),
        el('p', { text: sp.blurb }),
        el('p', { class: 'meta', text: sp.quirk }),
        el('dl', {}, [
          el('dt', { text: 'Grow time' }), el('dd', { text: UI.time(sp.growTime) + (sp.harvests > 1 ? ' (' + sp.harvests + ' harvests)' : '') }),
          el('dt', { text: 'Thirst' }), el('dd', { text: thirstWord(sp) }),
          el('dt', { text: 'Comfy water' }), el('dd', {}, [zone]),
          el('dt', { text: 'Loves' }), el('dd', { text: likesText(sp) }),
          el('dt', { text: 'Base value' }), el('dd', { html: price(sp.value) }),
          el('dt', { text: 'Harvested' }), el('dd', { text: (st.stats.bySpecies[sp.id] || 0) + (best ? ' · best ' + stars(best) : '') })
        ]),
        stages
      ])
    ]);
  }

  function almanacNutrient(n) {
    var st = G.state, known = st.discovered.nutrients[n.id];
    if (!known) {
      return el('div', { class: 'entry unknown' }, [icon('lock', 'big'),
        el('div', { class: 'grow' }, [el('h4', { text: '???' }), el('p', { text: n.id === 'crumbs' ? 'Something rare. Travelling merchants are said to carry it.' : 'Buy some in the shop to learn about it.' })])]);
    }
    var syn = C.SYNERGIES.filter(function (s) { return s.a === n.id || s.b === n.id; });
    return el('div', { class: 'entry' }, [
      nutrientPic(n.id, 72),
      el('div', { class: 'grow' }, [
        el('h4', { text: n.name }), el('p', { text: n.blurb }),
        el('dl', {}, [
          el('dt', { text: 'Effect' }), el('dd', { text: n.effect }),
          n.id !== 'crumbs' ? el('dt', { text: 'Loved by' }) : null, n.id !== 'crumbs' ? el('dd', { text: lovedBy(n.id) }) : null,
          syn.length ? el('dt', { text: 'Synergy' }) : null,
          syn.length ? el('dd', { text: syn.map(function (s) { return s.name + ' - ' + s.desc; }).join(' ') }) : null
        ])
      ])
    ]);
  }

  UI.openAlmanac = function () {
    if (toggleOff('almanac')) return;
    closeLight();
    var body = el('div', { class: 'shop' });
    var m = openModal({ id: 'almanac', title: 'Plant Almanac', icon: 'book', wide: true, body: body });
    m.render = function () {
      var st = G.state, found = 0;
      C.SPECIES.forEach(function (sp) { if (st.discovered.species[sp.id]) found++; });
      body.innerHTML = '';
      body.appendChild(tabs([{ id: 'plants', name: 'Plants', badge: found + '/' + C.SPECIES.length }, { id: 'nutrients', name: 'Nutrients' }],
        almanacTab, function (id) { almanacTab = id; m.render(); }));
      var list = el('div', { class: 'items' });
      if (almanacTab === 'plants') C.SPECIES.forEach(function (sp) { list.appendChild(almanacPlant(sp)); });
      else C.NUTRIENTS.concat([C.CRUMBS]).forEach(function (n) { list.appendChild(almanacNutrient(n)); });
      body.appendChild(list);
    };
    m.render();
  };

  // ==================================================================
  // Achievements
  // ==================================================================
  UI.openAchievements = function () {
    if (toggleOff('achievements')) return;
    closeLight();
    var st = G.state, done = 0;
    C.ACHIEVEMENTS.forEach(function (a) { if (st.achievements[a.id]) done++; });
    var list = el('div', { class: 'items' });
    C.ACHIEVEMENTS.forEach(function (a) {
      var got = !!st.achievements[a.id], v = Math.min(a.goal, a.value(st));
      var fill = el('i'); fill.style.width = Math.round(v / a.goal * 100) + '%';
      list.appendChild(el('div', { class: 'item ach' + (got ? ' done' : '') }, [
        icon(got ? 'trophy' : 'lock', 'big'),
        el('div', { class: 'grow' }, [el('h4', { text: a.name }), el('p', { text: a.desc }),
          el('span', { class: 'bar growth mini' }, [fill])]),
        el('div', { class: 'item-side' }, [el('span', { class: 'owned', text: got ? 'Done!' : fmt(v) + ' / ' + fmt(a.goal) }),
          el('span', { html: '+' + price(C.ACHIEVEMENT_REWARD, 'sunshine') })])
      ]));
    });
    var s = st.stats;
    openModal({ id: 'achievements', title: 'Awards (' + done + '/' + C.ACHIEVEMENTS.length + ')', icon: 'trophy', wide: true,
      body: el('div', { class: 'shop' }, [
        el('p', { class: 'hint', text: 'Played ' + UI.time(st.playTime) + ' · ' + fmt(s.harvests) + ' harvests · ' + fmt(s.coinsEarned) + ' coins earned · ' + s.goldens + ' golden plants · ' + s.deaths + ' plants lost' }),
        list
      ]) });
  };

  // ==================================================================
  // Pause, settings, save tools
  // ==================================================================
  UI.openPause = function () {
    if (toggleOff('pause')) return;
    closeLight();
    var m = openModal({
      id: 'pause', title: 'Paused', icon: 'pause', blocking: true, cls: 'narrow',
      body: el('div', { class: 'menu-list' }, [
        btn('Resume', function () { m.close(); }, { cls: 'primary big', icon: 'play' }),
        btn('Settings', function () { UI.openSettings(); }, { cls: 'big', icon: 'gear' }),
        btn('How to Play', function () { UI.openHowTo(); }, { cls: 'big', icon: 'book' }),
        btn('Friends', function () { UI.openFriends(); }, { cls: 'big', icon: 'leaf' }),
        btn('Photo mode', function () { m.close(); G.photoMode(true); }, { cls: 'big', icon: 'camera', key: 'F' }),
        btn('Save', function () { G.saveNow(true); }, { cls: 'big', icon: 'check' }),
        btn('Save & Quit to Menu', function () { G.quitToMenu(); }, { cls: 'big' })
      ])
    });
  };

  function toggleRow(label, key, hint, onChange) {
    var s = G.settings;
    var input = el('input', { type: 'checkbox', id: 'set-' + key });
    input.checked = !!s[key];
    input.addEventListener('change', function () { s[key] = input.checked; click(); G.applySettings(); if (onChange) onChange(); });
    return el('label', { class: 'set-row', for: 'set-' + key }, [
      el('span', { class: 'grow' }, [el('strong', { text: label }), hint ? el('small', { text: hint }) : null]),
      input, el('span', { class: 'switch', 'aria-hidden': 'true' })
    ]);
  }
  function sliderRow(label, key, min, max, step, show) {
    var s = G.settings, out = el('output', { text: show(s[key]) });
    var input = el('input', { type: 'range', id: 'set-' + key, min: min, max: max, step: step, 'aria-label': label });
    input.value = s[key];
    input.addEventListener('input', function () { s[key] = parseFloat(input.value); out.textContent = show(s[key]); G.applySettings(); });
    input.addEventListener('change', function () { Sound.play('click'); });
    return el('label', { class: 'set-row', for: 'set-' + key }, [el('strong', { class: 'grow', text: label }), input, out]);
  }

  UI.openSettings = function () {
    if (toggleOff('settings')) return;
    var s = G.settings;
    function pc(v) { return Math.round(v * 100) + '%'; }
    var speedRow = el('div', { class: 'set-row' }, [el('strong', { class: 'grow', text: 'Game speed' })]);
    var seg = el('div', { class: 'segmented', role: 'group', 'aria-label': 'Game speed' });
    [1, 2, 3].forEach(function (v) {
      seg.appendChild(el('button', { type: 'button', class: 'chip-btn' + (s.speed === v ? ' active' : ''), text: v + 'x',
        onclick: function () { s.speed = v; click(); G.applySettings(); Array.prototype.forEach.call(seg.children, function (c, i) { c.classList.toggle('active', i + 1 === v); }); } }));
    });
    speedRow.appendChild(seg);
    var body = el('div', { class: 'settings' }, [
      el('h3', { text: 'Sound' }),
      sliderRow('Master volume', 'master', 0, 1, 0.05, pc),
      sliderRow('Music', 'music', 0, 1, 0.05, pc),
      sliderRow('Sound effects', 'sfx', 0, 1, 0.05, pc),
      toggleRow('Mute everything', 'muted', 'Shortcut: M'),
      el('h3', { text: 'Game' }),
      speedRow,
      toggleRow('Random events', 'events', 'Pests, heatwaves, rain, the lucky bee and the merchant.'),
      el('h3', { text: 'Display & accessibility' }),
      toggleRow('Particles', 'particles', 'Splashes, sparkles and coin pops.'),
      toggleRow('Screen shake', 'shake', 'A gentle shake on big moments.'),
      toggleRow('Reduced motion', 'reducedMotion', 'Turns off swaying, shake, particles and UI animations.'),
      toggleRow('Colour-blind friendly mode', 'colorblind', 'Adds text labels and patterns so nothing depends on colour alone.'),
      sliderRow('Interface size', 'uiScale', 0.8, 1.3, 0.05, pc),
      toggleRow('Show FPS counter', 'fps'),
      el('h3', { text: 'Save data' }),
      el('div', { class: 'actions wrap' }, [
        btn('Export save', function () { UI.openExport(); }, { icon: 'clip' }),
        btn('Import save', function () { UI.openImport(); }, { icon: 'clip' }),
        btn('Reset save', function () {
          UI.confirm({ title: 'Reset save?', text: 'This deletes your barn, coins and progress for good. Settings are kept. There is no undo.', yes: 'Delete everything', danger: true },
            function () { G.resetSave(); });
        }, { cls: 'danger' })
      ]),
      el('p', { class: 'hint', text: 'The game autosaves every ' + C.AUTOSAVE_SECONDS + ' seconds and whenever you buy something.' })
    ]);
    openModal({ id: 'settings', title: 'Settings', icon: 'gear', blocking: true, body: body });
  };

  UI.openExport = function () {
    var text = G.exportSave();
    if (!text) { UI.toast('There is no game to export yet.', { kind: 'bad' }); return; }
    var area = el('textarea', { class: 'code', readonly: true, rows: 7, 'aria-label': 'Save data' });
    area.value = text;
    var m = openModal({
      id: 'export', title: 'Export save', blocking: true,
      body: el('div', {}, [el('p', { text: 'Copy this text and keep it somewhere safe. Paste it into "Import save" to restore your barn.' }), area]),
      footer: [
        btn('Copy to clipboard', function () {
          area.focus(); area.select();
          var done = function () { UI.toast('Save copied to the clipboard.', { kind: 'good', icon: 'check' }); };
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { try { document.execCommand('copy'); done(); } catch (err) { /* manual copy */ } });
          else { try { document.execCommand('copy'); done(); } catch (err) { /* manual copy */ } }
        }, { cls: 'primary' }),
        btn('Close', function () { m.close(); })
      ]
    });
    area.focus(); area.select();
  };

  UI.openImport = function () {
    var area = el('textarea', { class: 'code', rows: 7, placeholder: 'Paste your exported save text here', 'aria-label': 'Save data to import' });
    var err = el('p', { class: 'need bad' });
    var m = openModal({
      id: 'import', title: 'Import save', blocking: true,
      body: el('div', {}, [el('p', { text: 'Importing replaces your current barn with the one in the text.' }), area, err]),
      footer: [
        btn('Cancel', function () { m.close(); }),
        btn('Import', function () {
          if (!area.value.trim()) { err.textContent = 'Paste a save text first.'; return; }
          if (G.importSave(area.value)) { UI.closeAll(); }
          else { err.textContent = 'That text is not a valid Barn Bloom save. Nothing was changed.'; Sound.play('error'); }
        }, { cls: 'primary' })
      ]
    });
  };

  function kbd(keys) { return el('span', { class: 'keys' }, keys.split(' ').map(function (k) { return el('kbd', { text: k }); })); }

  UI.openHowTo = function () {
    if (toggleOff('howto')) return;
    var rows = [
      ['1 2 3 4', 'Select, watering can, basket, shovel'], ['5', 'Seed tool (press again to cycle through your seeds)'],
      ['Q W E R', 'Nutrients: Nitro-Bloom, Gulp-Gel, Glamour Jam, Bug-Off'], ['T', 'Comet Crumbs (once you own some)'],
      ['A', 'Water all thirsty plants (needs the whistle)'], ['H', 'Harvest all ripe plants (needs the scythe)'],
      ['← ↑ → ↓', 'Move the selection between pots'], ['Space', 'Use the current tool on the selected pot'],
      ['S U L K O', 'Shop, Upgrades, Almanac, Awards, Orders'], ['P Esc', 'Pause / close a dialog'],
      ['M', 'Mute'], ['F', 'Photo mode (hides the interface)'], ['`', 'Debug panel']
    ];
    var table = el('table', { class: 'keys-table' }, rows.map(function (r) { return el('tr', {}, [el('td', {}, [kbd(r[0])]), el('td', { text: r[1] })]); }));
    openModal({
      id: 'howto', title: 'How to Play', icon: 'book', wide: true, blocking: true,
      body: el('div', { class: 'prose' }, [
        el('h3', { text: 'The loop' }),
        el('p', { text: 'Plant seeds, keep them watered and fed, harvest them when a gold star appears, and spend the coins on more seeds, nutrients, upgrades and new species.' }),
        el('h3', { text: 'Water' }),
        el('p', { text: 'Every pot has a blue water bar with two white marks. Between the marks the plant is comfy and grows at full speed. Below the left mark it slows down and wilts; at zero it loses health. Far above the right mark it gets soggy, which also hurts. Each pour uses water from the tank, which refills on its own.' }),
        el('h3', { text: 'Quality and price' }),
        el('p', { text: 'Quality is the average of how well you cared for the plant while it grew, shown as stars. More stars means a higher price. Perfect watering gets you four stars; the fifth needs Glamour Jam. Do not leave ripe plants standing too long: past their prime they slowly lose value.' }),
        el('h3', { text: 'Nutrients' }),
        el('p', { text: 'Nitro-Bloom speeds up growth, Gulp-Gel slows water loss, Glamour Jam raises quality, Bug-Off heals and keeps pests away. A dose lasts about a minute and a half. Every species loves one nutrient and gets 50% more out of it. Nitro + Gel and Jam + Tonic form bonus synergies.' }),
        el('h3', { text: 'Events and helpers' }),
        el('p', { text: 'Heatwaves, rain, pests, a lucky bee and a travelling merchant keep things lively (you can switch events off in Settings). Later, the sprinkler, the Harvest Hedgehog and the Seed Squirrel take over the routine work. While you are away the barn keeps going at a slower pace, and nothing can die.' }),
        el('h3', { text: 'Friends' }),
        el('p', { text: 'Under Friends (main menu or pause menu) you can copy a visit code for your barn and send it to someone. Paste a code you received to stroll through a snapshot of their barn. Visits are look-only; your own barn is saved and waits for you.' }),
        el('p', { text: 'On the Gifts tab (pause menu) you can wrap coins, seeds and nutrients from your own stock into a gift code for a friend, and open codes you receive. A gift opens once per barn.' }),
        el('p', { text: 'The Trade tab is for swaps: make an offer (what you give and what you want) and send the code. Your friend accepts it and sends a reply code back; paste the reply and you receive your part. What you offer is set aside until the trade is done or you cancel it.' }),
        el('h3', { text: 'Controls' }),
        el('p', { text: 'Pick a tool, then tap a pot. Hold and drag across pots to use the tool on several in one go. The panel on the side (or bottom on phones) has buttons for everything too.' }),
        table
      ])
    });
  };

  UI.openCredits = function () {
    if (toggleOff('credits')) return;
    openModal({
      id: 'credits', title: 'Credits', icon: 'heart', blocking: true, cls: 'narrow',
      body: el('div', { class: 'prose center' }, [
        el('p', { text: 'Barn Bloom' }),
        el('p', { class: 'hint', text: 'A cozy plant-care game made of plain HTML, CSS and JavaScript.' }),
        el('p', { text: 'Design, code, drawings and sounds by Claude (Anthropic).' }),
        el('p', { text: 'Every plant, critter and plank is drawn in code on a canvas. Every sound is synthesised live with the Web Audio API. No images, fonts, audio files or libraries were harmed, or used.' }),
        el('p', { class: 'hint', text: 'Special thanks to the barn cat, who supervised.' })
      ])
    });
  };

  UI.welcomeBack = function (sum) {
    var rows = [
      ['You were away for', UI.time(sum.away)],
      ['The barn kept working for', UI.time(sum.simulated) + ' (' + Math.round(sum.efficiency * 100) + '% speed' + (sum.capped ? ', capped' : '') + ')'],
      ['Coins earned', fmt(sum.coins)],
      ['Plants harvested by helpers', String(sum.harvests)],
      ['Orders completed', String(sum.orders)],
      ['Ripe plants waiting for you', String(sum.ready)],
      ['Thirsty plants', String(sum.thirsty)]
    ];
    if (sum.sunshine > 0) rows.push(['Sunshine gained', String(sum.sunshine)]);
    var m = openModal({
      id: 'welcome', title: 'Welcome back!', icon: 'sun', blocking: true,
      body: el('div', {}, [
        el('p', { text: 'A kind neighbour looked in on your plants. Nothing withered while you were gone.' }),
        el('table', { class: 'summary' }, rows.map(function (r) { return el('tr', {}, [el('td', { text: r[0] }), el('td', { text: r[1] })]); })),
        el('p', { class: 'hint', text: 'The Cozy Hammock upgrade makes the barn work longer and faster while you are away.' })
      ]),
      footer: [btn('Back to the barn', function () { m.close(); }, { cls: 'primary' })]
    });
  };

  // ==================================================================
  // Friends: share a visit code, visit someone else's barn
  // ==================================================================
  function copyFrom(area, message) {
    area.focus(); area.select();
    var done = function () { UI.toast(message, { kind: 'good', icon: 'check' }); };
    var fallback = function () { try { document.execCommand('copy'); done(); } catch (err) { /* copy by hand */ } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(area.value).then(done, fallback);
    else fallback();
  }

  var friendsTab = 'visit';

  UI.openFriends = function () {
    if (toggleOff('friends')) return;
    var body = el('div', { class: 'settings' });
    var m = openModal({ id: 'friends', title: 'Friends', icon: 'heart', blocking: true, body: body });
    m.render = function () {
      body.innerHTML = '';
      body.appendChild(tabs([{ id: 'visit', name: 'Visit', icon: 'leaf' }, { id: 'gifts', name: 'Gifts', icon: 'heart' },
        { id: 'trade', name: 'Trade', icon: 'basket' }], friendsTab, function (id) { friendsTab = id; m.render(); }));
      if (friendsTab === 'visit') friendsVisit(body);
      else if (friendsTab === 'gifts') friendsGifts(body, m);
      else friendsTrade(body, m);
    };
    m.render();
  };

  /** "3 x Pepperwink seeds, 50 coins" for a gift's items. */
  UI.giftText = function (items) {
    var parts = [], k;
    if (items.coins) parts.push(fmt(items.coins) + (items.coins === 1 ? ' coin' : ' coins'));
    for (k in items.seeds) parts.push(items.seeds[k] + ' × ' + C.SPECIES_BY_ID[k].name + (items.seeds[k] === 1 ? ' seed' : ' seeds'));
    for (k in items.nutrients) parts.push(items.nutrients[k] + ' × ' + C.NUTRIENTS_BY_ID[k].name);
    if (items.crumbs) parts.push(items.crumbs + ' × ' + C.CRUMBS.name);
    return parts.join(', ');
  };

  function friendsGifts(body, m) {
    var st = G.state;
    if (!st || G.mode !== 'play') {
      body.appendChild(el('p', { class: 'hint', text: 'Gifts are sent and opened from inside your barn. Continue your game, then open Friends from the pause menu.' }));
      return;
    }

    // ---- Send ----
    body.appendChild(el('h3', { text: 'Send a gift' }));
    body.appendChild(el('p', { text: 'Pick things from your own stock. They leave your barn when you wrap the gift, and your friend receives them by pasting the code.' }));
    var fields = [], rows = el('div', { class: 'gift-rows' });
    function row(pic, name, have, kind, id) {
      var input = el('input', { type: 'number', class: 'text-input qty', min: 0, max: have, step: 1, value: 0, inputmode: 'numeric', 'aria-label': name + ' to give' });
      fields.push({ kind: kind, id: id, input: input, have: have });
      rows.appendChild(el('label', { class: 'gift-row' }, [pic,
        el('span', { class: 'grow' }, [el('strong', { text: name }), el('small', { text: 'You have ' + fmt(have) })]), input]));
    }
    if (Math.floor(st.coins) > 0) row(icon('coin', 'big'), 'Coins', Math.floor(st.coins), 'coins');
    C.SPECIES.forEach(function (sp) { if (st.seeds[sp.id] > 0) row(seedPic(sp.id, 36), sp.name + ' seeds', st.seeds[sp.id], 'seeds', sp.id); });
    C.NUTRIENTS.forEach(function (n) { if (st.nutrients[n.id] > 0) row(nutrientPic(n.id, 36), n.name, st.nutrients[n.id], 'nutrients', n.id); });
    if (st.crumbs > 0) row(nutrientPic('crumbs', 36), C.CRUMBS.name, st.crumbs, 'crumbs');
    var sendErr = el('p', { class: 'need bad' });
    if (!fields.length) body.appendChild(el('p', { class: 'hint', text: 'You have nothing to give right now. Earn some coins or buy seeds first.' }));
    else {
      body.appendChild(rows);
      body.appendChild(sendErr);
      body.appendChild(el('div', { class: 'actions' }, [btn('Wrap gift', function () {
        var raw = { coins: 0, crumbs: 0, seeds: {}, nutrients: {} };
        fields.forEach(function (f) {
          var v = Math.max(0, Math.min(f.have, Math.floor(Number(f.input.value) || 0)));
          if (!v) return;
          if (f.kind === 'coins' || f.kind === 'crumbs') raw[f.kind] = v; else raw[f.kind][f.id] = v;
        });
        var items = L.cleanGiftItems(raw);
        if (!items) { sendErr.textContent = 'Choose at least one thing to give.'; return; }
        UI.confirm({ title: 'Wrap this gift?', yes: 'Wrap it',
          text: 'You are giving away ' + UI.giftText(items) + '. It leaves your barn now and cannot be taken back.' },
          function () { if (G.makeGift(raw)) m.render(); });
      }, { cls: 'primary', icon: 'heart' })]));
    }
    if (st.lastGiftCode) {
      var out = el('textarea', { class: 'code', readonly: true, rows: 3, 'aria-label': 'Your latest gift code' });
      out.value = st.lastGiftCode;
      body.appendChild(el('h3', { text: 'Your latest gift' }));
      body.appendChild(el('p', { text: 'Send this code to your friend. A gift opens once per barn, and not in the barn that wrapped it.' }));
      body.appendChild(out);
      body.appendChild(el('div', { class: 'actions' }, [btn('Copy gift code', function () { copyFrom(out, 'Gift code copied. Paste it into a message to your friend.'); }, { icon: 'clip' })]));
    }

    // ---- Open ----
    var paste = el('textarea', { class: 'code', rows: 3, placeholder: 'Paste a gift code here (it starts with GIFT-)', 'aria-label': 'Gift code from a friend' });
    var openMsg = el('p', { class: 'need' });
    body.appendChild(el('h3', { text: 'Open a gift' }));
    body.appendChild(paste);
    body.appendChild(openMsg);
    body.appendChild(el('div', { class: 'actions' }, [btn('Open gift', function () {
      var REASONS = {
        invalid: 'That is not a valid gift code. Ask your friend to copy the whole code again.',
        own: 'This is a gift you wrapped yourself. Send it to a friend instead.',
        used: 'You have already opened this gift.'
      };
      if (!paste.value.trim()) { openMsg.className = 'need bad'; openMsg.textContent = 'Paste a gift code first.'; return; }
      var r = G.openGift(paste.value);
      openMsg.className = r.ok ? 'need' : 'need bad';
      openMsg.textContent = r.ok ? 'Unwrapped! ' + r.from + ' sent you ' + UI.giftText(r.items) + '.' : REASONS[r.reason];
      if (r.ok) paste.value = '';
    }, { cls: 'primary', icon: 'heart' })]));
  }

  /**
   * A list of amount inputs for coins, seeds, nutrients and crumbs.
   * owned = true lists only what the player has (capped at their stock);
   * owned = false lists everything that can be asked for.
   * Returns { node, count, collect() } where collect() gives raw items for the logic.
   */
  function itemFields(st, owned, label) {
    var fields = [], node = el('div', { class: 'gift-rows' });
    function row(pic, name, have, kind, id) {
      if (owned && !(have > 0)) return;
      var max = owned ? have : (kind === 'coins' ? C.GIFTS.maxCoins : C.GIFTS.maxCount);
      var input = el('input', { type: 'number', class: 'text-input qty', min: 0, max: max, step: 1, value: 0, inputmode: 'numeric', 'aria-label': name + ' ' + label });
      fields.push({ kind: kind, id: id, input: input, max: max });
      node.appendChild(el('label', { class: 'gift-row' }, [pic,
        el('span', { class: 'grow' }, [el('strong', { text: name }), el('small', { text: 'You have ' + fmt(have) })]), input]));
    }
    row(icon('coin', 'big'), 'Coins', Math.floor(st.coins), 'coins');
    C.SPECIES.forEach(function (sp) { row(seedPic(sp.id, 36), sp.name + ' seeds', st.seeds[sp.id] || 0, 'seeds', sp.id); });
    C.NUTRIENTS.forEach(function (n) { row(nutrientPic(n.id, 36), n.name, st.nutrients[n.id] || 0, 'nutrients', n.id); });
    row(nutrientPic('crumbs', 36), C.CRUMBS.name, st.crumbs, 'crumbs');
    return {
      node: node, count: fields.length,
      collect: function () {
        var raw = { coins: 0, crumbs: 0, seeds: {}, nutrients: {} };
        fields.forEach(function (f) {
          var v = Math.max(0, Math.min(f.max, Math.floor(Number(f.input.value) || 0)));
          if (!v) return;
          if (f.kind === 'coins' || f.kind === 'crumbs') raw[f.kind] = v; else raw[f.kind][f.id] = v;
        });
        return raw;
      }
    };
  }

  function codeBox(code, label, rows) {
    var area = el('textarea', { class: 'code', readonly: true, rows: rows || 3, 'aria-label': label });
    area.value = code;
    return area;
  }

  function friendsTrade(body, m) {
    var st = G.state;
    if (!st || G.mode !== 'play') {
      body.appendChild(el('p', { class: 'hint', text: 'Trades are made from inside your barn. Continue your game, then open Friends from the pause menu.' }));
      return;
    }
    body.appendChild(el('p', { class: 'hint', text: 'How a trade works: 1) you make an offer and send the code, 2) your friend accepts it and sends a reply code back, 3) you paste the reply and receive your part.' }));

    // ---- Answer a code (offer from a friend, or a reply to your own offer) ----
    var paste = el('textarea', { class: 'code', rows: 3, placeholder: 'Paste a trade code (TRADE-) or a reply code (DEAL-) here', 'aria-label': 'Trade or reply code from a friend' });
    var result = el('div', { class: 'trade-result' });
    body.appendChild(el('h3', { text: 'Got a code from a friend?' }));
    body.appendChild(paste);
    body.appendChild(el('div', { class: 'actions' }, [btn('Read code', function () {
      result.innerHTML = '';
      function say(text, bad) { result.appendChild(el('p', { class: 'need' + (bad ? ' bad' : ''), text: text })); }
      if (!paste.value.trim()) { say('Paste a code first.', true); return; }
      var r = G.readTradeCode(paste.value);
      if (r.type === 'invalid') { say('That is not a valid trade or reply code. Ask your friend to copy the whole code again.', true); return; }
      if (r.type === 'deal') {
        if (r.ok) { paste.value = ''; m.render(); }
        else say('This reply does not match any of your open offers. It may already be completed or cancelled.', true);
        return;
      }
      var t = r.trade;
      result.appendChild(el('div', { class: 'item' }, [el('div', { class: 'grow' }, [
        el('h4', { text: 'Offer from ' + t.from }),
        el('p', {}, [el('strong', { text: 'You get: ' }), UI.giftText(t.give)]),
        el('p', {}, [el('strong', { text: 'You pay: ' }), UI.giftText(t.want)])
      ])]));
      var PROBLEMS = {
        own: 'This is your own offer. Send it to a friend instead.',
        used: 'You have already accepted this trade.',
        short: 'You do not have everything they ask for.',
        invalid: 'This offer cannot be read.'
      };
      if (r.problem) { say(PROBLEMS[r.problem], true); return; }
      result.appendChild(el('div', { class: 'actions' }, [btn('Accept trade', function () {
        if (G.acceptTrade(t)) { paste.value = ''; m.render(); }
        else { result.innerHTML = ''; say('The trade could not be completed. Check that you still have what they ask for.', true); }
      }, { cls: 'primary', icon: 'check' })]));
    }, { cls: 'primary' })]));
    body.appendChild(result);

    if (st.lastDealCode) {
      var reply = codeBox(st.lastDealCode, 'Your latest reply code', 2);
      body.appendChild(el('h3', { text: 'Your latest reply code' }));
      body.appendChild(el('p', { text: 'You accepted a trade. Send this reply back so your friend receives their part.' }));
      body.appendChild(reply);
      body.appendChild(el('div', { class: 'actions' }, [btn('Copy reply code', function () { copyFrom(reply, 'Reply code copied. Send it back to your friend.'); }, { icon: 'clip' })]));
    }

    // ---- Open offers ----
    var ids = Object.keys(st.tradesOut);
    if (ids.length) {
      body.appendChild(el('h3', { text: 'Your open offers' }));
      body.appendChild(el('p', { class: 'hint', text: 'What you offered is set aside until your friend\'s reply arrives.' }));
      ids.forEach(function (id) {
        var t = st.tradesOut[id], box = codeBox(G.tradeCode(id), 'Trade code for this offer', 2);
        body.appendChild(el('div', { class: 'item trade-open' }, [el('div', { class: 'grow' }, [
          el('p', {}, [el('strong', { text: 'You give: ' }), UI.giftText(t.give)]),
          el('p', {}, [el('strong', { text: 'You want: ' }), UI.giftText(t.want)]),
          box,
          el('div', { class: 'actions' }, [
            btn('Copy trade code', function () { copyFrom(box, 'Trade code copied. Send it to your friend.'); }, { cls: 'small primary', icon: 'clip' }),
            btn('Cancel offer', function () {
              UI.confirm({ title: 'Cancel this offer?', yes: 'Cancel offer', no: 'Keep it', danger: true,
                text: 'You get back ' + UI.giftText(t.give) + '. Only do this if your friend has not accepted the trade, otherwise their reply code will no longer work.' },
                function () { if (G.cancelTrade(id)) m.render(); });
            }, { cls: 'small ghost' })
          ])
        ])]));
      });
    }

    // ---- New offer ----
    body.appendChild(el('h3', { text: 'Make an offer' }));
    var give = itemFields(st, true, 'to give'), want = itemFields(st, false, 'wanted');
    if (!give.count) {
      body.appendChild(el('p', { class: 'hint', text: 'You have nothing to offer right now. Earn some coins or buy seeds first.' }));
      return;
    }
    var err = el('p', { class: 'need bad' });
    body.appendChild(el('h4', { text: 'You give' }));
    body.appendChild(give.node);
    body.appendChild(el('h4', { text: 'You want in return' }));
    body.appendChild(want.node);
    body.appendChild(err);
    body.appendChild(el('div', { class: 'actions' }, [btn('Make trade offer', function () {
      var g = give.collect(), w = want.collect();
      var gi = L.cleanGiftItems(g), wi = L.cleanGiftItems(w);
      if (!gi || !wi) { err.textContent = 'Choose something to give and something you want in return.'; return; }
      UI.confirm({ title: 'Make this offer?', yes: 'Make offer',
        text: 'You offer ' + UI.giftText(gi) + ' and ask for ' + UI.giftText(wi) + '. Your part is set aside until the trade is done or you cancel it.' },
        function () { if (G.makeTrade(g, w)) m.render(); });
    }, { cls: 'primary', icon: 'basket' })]));
  }

  function friendsVisit(body) {
    var code = G.shareCode();
    var share;
    if (code) {
      var area = el('textarea', { class: 'code', readonly: true, rows: 4, 'aria-label': 'Your visit code' });
      area.value = code;
      var nameRow = null;
      if (G.state) {
        var input = el('input', { type: 'text', class: 'text-input', id: 'barn-name', maxlength: 24, 'aria-label': 'Barn name' });
        input.value = G.state.barnName;
        input.addEventListener('change', function () {
          G.setBarnName(input.value);
          input.value = G.state.barnName;
          area.value = G.shareCode();
        });
        nameRow = el('label', { class: 'set-row', for: 'barn-name' }, [el('strong', { class: 'grow', text: 'Barn name' }), input]);
      }
      share = el('div', {}, [
        el('p', { text: 'Send this code to a friend. They can look around a snapshot of your barn as it is right now: plants, decorations, helpers and the cat. It carries no coins and cannot change your game.' }),
        nameRow, area,
        el('div', { class: 'actions' }, [btn('Copy visit code', function () { copyFrom(area, 'Visit code copied. Paste it into a message to your friend.'); }, { cls: 'primary', icon: 'clip' })])
      ]);
    } else {
      share = el('p', { class: 'hint', text: 'Start a game first, then come back here to get a visit code for your barn.' });
    }

    var paste = el('textarea', { class: 'code', rows: 4, placeholder: 'Paste a visit code here (it starts with BARN-)', 'aria-label': 'Visit code from a friend' });
    var err = el('p', { class: 'need bad' });
    [
      el('h3', { text: 'Share my barn' }), share,
      el('h3', { text: 'Visit a barn' }),
      el('p', { text: 'Got a code from a friend? Paste it to visit their barn. Your own barn is saved and waits for you.' }),
      paste, err,
      el('div', { class: 'actions' }, [btn('Visit', function () {
        if (!paste.value.trim()) { err.textContent = 'Paste a visit code first.'; return; }
        if (!G.startVisit(paste.value)) {
          err.textContent = 'That is not a valid visit code. Ask your friend to copy the whole code again.';
          Sound.play('error');
        }
      }, { cls: 'primary', icon: 'leaf' })])
    ].forEach(function (node) { body.appendChild(node); });
  }

  /** Switches the interface to visiting mode. v: { name, at, state, from } */
  UI.showVisit = function (v) {
    var bar = $('visitBar'), st = v.state, awards = 0;
    for (var k in st.achievements) awards++;
    var when = v.at ? new Date(v.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : 'an unknown day';
    document.body.className = document.body.className.replace(/mode-\w+/, 'mode-visit');
    document.body.classList.remove('has-selection');
    $('menu').innerHTML = '';
    bar.innerHTML = '';
    bar.appendChild(icon('leaf'));
    bar.appendChild(el('strong', { text: 'Visiting ' + v.name }));
    bar.appendChild(el('span', { class: 'hint', text: st.pots.length + ' pots · ' + fmt(st.stats.harvests) + ' harvests · ' +
      awards + ' awards · snapshot from ' + when }));
    bar.appendChild(btn(v.from === 'play' ? 'Back to my barn' : 'Back to menu', function () { G.leaveVisit(); }, { cls: 'small primary', key: 'Esc' }));
    bar.hidden = false;
  };
  UI.hideVisit = function () { var bar = $('visitBar'); bar.hidden = true; bar.innerHTML = ''; };
  UI.visitInsets = function () {
    var r = $('visitBar').getBoundingClientRect();
    return { top: Math.round(r.bottom || 0), bottom: 0, right: 0 };
  };

  // ==================================================================
  // Main menu
  // ==================================================================
  UI.showMenu = function () {
    var menu = $('menu'), has = Save.hasSave();
    menu.innerHTML = '';
    var cont = btn('Continue', function () { G.continueGame(); }, { cls: 'primary big', icon: 'play' });
    cont.disabled = !has;
    if (!has) cont.setAttribute('data-tip', 'No saved barn yet. Start a new game!');
    menu.appendChild(el('div', { class: 'menu-card' }, [
      el('h1', { class: 'title', 'aria-label': 'Barn Bloom' }, [
        el('span', { class: 't1', text: 'Barn' }), icon('leaf', 'title-leaf'), el('span', { class: 't2', text: 'Bloom' })
      ]),
      el('p', { class: 'tagline', text: 'A cozy little plant-care game' }),
      el('div', { class: 'menu-list' }, [
        cont,
        btn('New Game', function () {
          if (Save.hasSave()) UI.confirm({ title: 'Start a new game?', text: 'Your current barn will be replaced by a brand new one.', yes: 'Start fresh', danger: true }, function () { G.newGame(); });
          else G.newGame();
        }, { cls: 'big' + (has ? '' : ' primary'), icon: 'seed' }),
        btn('Friends', function () { UI.openFriends(); }, { cls: 'big', icon: 'leaf' }),
        btn('How to Play', function () { UI.openHowTo(); }, { cls: 'big', icon: 'book' }),
        btn('Settings', function () { UI.openSettings(); }, { cls: 'big', icon: 'gear' }),
        btn('Credits', function () { UI.openCredits(); }, { cls: 'big', icon: 'heart' })
      ]),
      el('p', { class: 'version', text: 'Version ' + C.VERSION + '.0 · saves in this browser' })
    ]));
    document.body.className = document.body.className.replace(/mode-\w+/, 'mode-menu');
    (has ? cont : menu.querySelector('.btn:not([disabled])')).focus();
  };

  UI.showGame = function () {
    document.body.className = document.body.className.replace(/mode-\w+/, 'mode-play');
    $('menu').innerHTML = '';
    info.key = ''; ordersKey = ''; toolbarKey = ''; chipsKey = '';
    shownCoins = G.state.coins;
    buildHud();
    UI.update(true);
    showTutorial();
  };

  // ==================================================================
  // Tutorial
  // ==================================================================
  var TUTORIAL = [
    { text: 'Welcome to your barn! First, grab your seed packet from the toolbar below (or press 5).', target: 'tool-seed' },
    { text: 'Now tap an empty pot to plant a Pepperwink seed.', target: null },
    { text: 'Thirsty work! Pick the watering can (2) and tap your sprout. Keep the blue bar between the two white marks: not too dry, not too soggy.', target: 'tool-water' },
    { text: 'Lovely. Plant your other seeds while this one grows. A gold star appears when a plant is ripe.', target: 'tool-seed' },
    { text: 'It is ripe! Pick the basket (3) and tap the plant to harvest and sell it.', target: 'tool-harvest' },
    { text: 'Ka-ching! Open the Shop (S) to buy more seeds, and nutrients that boost your plants.', target: null },
    { text: 'That is the whole loop: plant, water, feed, harvest. Save up for Upgrades (U) and new species. Have fun!', target: null, last: true }
  ];
  // Each game event moves the tutorial to at least this step.
  var TUTORIAL_PROGRESS = { 'tool:seed': 1, plant: 2, water: 3, matured: 4, harvest: 5, shop: 6 };

  function showTutorial() {
    var box = $('tutorial'), st = G.state;
    var old = document.querySelector('.tut-glow');
    if (old) old.classList.remove('tut-glow');
    if (!st || st.tutorial.done || G.mode !== 'play') { box.hidden = true; return; }
    var step = TUTORIAL[Math.min(st.tutorial.step, TUTORIAL.length - 1)];
    box.innerHTML = '';
    box.appendChild(el('div', { class: 'tut-card', role: 'note' }, [
      el('span', { class: 'tut-step', text: 'Tip ' + (st.tutorial.step + 1) + ' of ' + TUTORIAL.length }),
      el('p', { text: step.text }),
      el('div', { class: 'actions' }, [
        step.last ? btn('Got it!', function () { endTutorial(); }, { cls: 'primary small' })
          : btn('Skip tutorial', function () { endTutorial(); }, { cls: 'small ghost' })
      ])
    ]));
    box.hidden = false;
    if (step.target && $(step.target)) $(step.target).classList.add('tut-glow');
  }
  function endTutorial() { G.state.tutorial.done = true; showTutorial(); G.saveNow(false); }

  UI.tutorialEvent = function (name) {
    var st = G && G.state;
    if (!st || st.tutorial.done || G.mode !== 'play') return;
    var to = TUTORIAL_PROGRESS[name];
    if (to === undefined || to <= st.tutorial.step || to > st.tutorial.step + 2) return;
    st.tutorial.step = to;
    showTutorial();
  };

  // ==================================================================
  // Debug panel and FPS
  // ==================================================================
  UI.toggleDebug = function () {
    var box = $('debug');
    if (!box.hidden) { box.hidden = true; return; }
    box.innerHTML = '';
    function b(text, fn) { return btn(text, fn, { cls: 'small' }); }
    box.appendChild(el('h3', { text: 'Debug cheats' }));
    box.appendChild(el('div', { class: 'debug-grid' }, [
      b('+1,000 coins', function () { G.debug.coins(1000); }), b('+100,000 coins', function () { G.debug.coins(100000); }),
      b('+10 sunshine', function () { G.debug.sunshine(10); }), b('Unlock all species', function () { G.debug.unlockAll(); }),
      b('Skip 1 minute', function () { G.debug.skip(60); }), b('Skip 10 minutes', function () { G.debug.skip(600); }),
      b('Skip 1 hour', function () { G.debug.skip(3600); }), b('Grow all plants', function () { G.debug.growAll(); }),
      b('Event: pest', function () { G.debug.event('pest'); }), b('Event: heatwave', function () { G.debug.event('heat'); }),
      b('Event: rain', function () { G.debug.event('rain'); }), b('Event: lucky bee', function () { G.debug.event('bee'); }),
      b('Event: merchant', function () { G.debug.event('merchant'); }), b('Jump to night', function () { G.debug.night(); }),
      b('Fake 2h away', function () { G.debug.away(7200); }), b('Reset game', function () { G.debug.reset(); })
    ]));
    box.appendChild(btn('Close', function () { box.hidden = true; }, { cls: 'small ghost' }));
    box.hidden = false;
  };
  UI.setFps = function (fps) { var f = $('fps'); f.hidden = !G.settings.fps; if (G.settings.fps) f.textContent = fps + ' fps'; };

  // ==================================================================
  // Init and per-frame update
  // ==================================================================
  UI.init = function () {
    G = BB.Game;
    initTooltips();
    document.addEventListener('pointerdown', function (e) {
      var pop = $('popover');
      if (!pop.hidden && !pop.contains(e.target) && !(refs.tools && refs.tools.seed && refs.tools.seed.contains(e.target))) closePopover();
    });
  };

  /** Space taken by the HUD, toolbar and side panel, so the scene can avoid it. */
  UI.insets = function () {
    var hud = $('hud').getBoundingClientRect(), bar = $('toolbar').getBoundingClientRect(), side = $('side');
    var wide = window.innerWidth >= 900 && getComputedStyle(side).display !== 'none';
    return {
      top: Math.round(hud.bottom || 0),
      bottom: Math.round(bar.height ? window.innerHeight - bar.top : 0),
      right: wide ? Math.round(window.innerWidth - side.getBoundingClientRect().left) : 0
    };
  };

  /** Called every frame; internally throttled. */
  UI.update = function (force) {
    if (!G || G.mode !== 'play' || !G.state) return;
    var now = Date.now();
    if (force || now - timers.hud > 100) { timers.hud = now; updateHud(); updateToolbar(); }
    if (force || now - timers.info > 150) { timers.info = now; updateInfo(); updateOrders(); }
    if (force || now - timers.live > 250) {
      timers.live = now;
      for (var i = 0; i < modals.length; i++) for (var j = 0; j < modals[i].updaters.length; j++) modals[i].updaters[j]();
    }
  };

  UI.refreshInfo = function () { info.key = ''; };
  UI.refreshModals = function () { modals.forEach(function (m) { if (m.render) m.render(); }); };

  BB.UI = UI;
})(typeof window !== 'undefined' ? window : globalThis);
