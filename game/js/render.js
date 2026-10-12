/*
 * Barn Bloom - render.js
 * ------------------------------------------------------------------
 * The barn scene on Canvas 2D: layout of shelves and pots, the wall
 * and floor (cached), day/night sky and lighting, critters, particles
 * and screen shake. Reads the game state, never changes it.
 */
(function (root) {
  'use strict';
  var BB = root.BB = root.BB || {};
  var C = BB.CONFIG, L = BB.Logic, Art = BB.Art, PAL = C.PALETTE;
  var PI = Math.PI;
  var FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  var R = { w: 0, h: 0, dpr: 1, t: 0, insets: { top: 0, bottom: 0, right: 0 }, state: null };
  var canvas, ctx;
  var lay = null, layKey = '', wall = null;
  var particles = [], glows = [], cones = [], hot = [], fx = [], motes = [];
  var wiggle = {};
  var opt = { particles: true, shake: true, reducedMotion: false, colorblind: false };
  var shake = 0, hogHop = 0, ambientAcc = 0;
  var cat = { x: 0.42, tx: 0.42, walking: false, timer: 7, dir: 1, happy: 0, blink: 0 };
  var mouse = { active: false, x: 0, dir: 1, timer: 28 };

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function rand(a, b) { return a + Math.random() * (b - a); }

  // ==================================================================
  // Setup
  // ==================================================================
  R.init = function (el) {
    canvas = el;
    ctx = canvas.getContext('2d');
    for (var i = 0; i < 26; i++) motes.push({ u: Math.random(), v: Math.random(), sp: rand(0.01, 0.04), ph: rand(0, 6) });
    R.resize();
  };

  R.resize = function () {
    var rect = canvas.getBoundingClientRect();
    R.dpr = Math.min(2, root.devicePixelRatio || 1);
    R.w = Math.max(240, rect.width);
    R.h = Math.max(240, rect.height);
    canvas.width = Math.round(R.w * R.dpr);
    canvas.height = Math.round(R.h * R.dpr);
    layKey = '';
  };

  R.setInsets = function (o) {
    if (o.top === R.insets.top && o.bottom === R.insets.bottom && o.right === R.insets.right) return;
    R.insets = { top: o.top, bottom: o.bottom, right: o.right };
    layKey = '';
  };

  R.setOptions = function (s) {
    opt.particles = !!s.particles && !s.reducedMotion;
    opt.shake = !!s.shake && !s.reducedMotion;
    opt.reducedMotion = !!s.reducedMotion;
    opt.colorblind = !!s.colorblind;
  };

  R.reset = function () { particles.length = 0; fx.length = 0; wiggle = {}; shake = 0; };

  // ==================================================================
  // Layout: where the window, shelves and pots go
  // ==================================================================
  function ensureLayout(n) {
    var ins = R.insets, w = R.w, h = R.h;
    var key = [n, w, h, ins.top, ins.bottom, ins.right].join('|');
    if (key === layKey) return;
    layKey = key;

    var narrow = w < 640;
    var bandTop = Math.max(10, ins.top + 8);
    var topH = Math.max(clamp(h * 0.26, 96, 230), bandTop + 86);
    var floorH = clamp(h * 0.1, 40, 88);
    var floorY = h - ins.bottom - floorH;
    var areaL = narrow ? 10 : 30, areaR = w - ins.right - (narrow ? 10 : 30);
    var areaW = Math.max(160, areaR - areaL);
    var areaTop = topH + 4, areaH = Math.max(120, floorY - 8 - areaTop);

    // Pick the column count that gives the biggest pots.
    var best = { u: 0, cols: 1, rows: n };
    for (var cols = 1; cols <= 10; cols++) {
      var rows = Math.ceil(n / cols);
      var u = Math.min(areaW / cols / 1.3, areaH / rows / 2.55);
      if (u > best.u + 0.01) best = { u: u, cols: cols, rows: rows };
    }
    var u = Math.min(best.u, 130), s = u / 100;
    var ch = Math.min(areaH / best.rows, u * 3.05);
    var cw = Math.min(areaW / best.cols, u * 1.75);
    var y0 = areaTop + (areaH - ch * best.rows) * 0.62;

    var pots = [], rowsInfo = [];
    for (var r = 0; r < best.rows; r++) {
      var m = r < best.rows - 1 ? best.cols : n - best.cols * (best.rows - 1);
      var rowW = m * cw, x0 = areaL + (areaW - rowW) / 2;
      var shelfY = y0 + (r + 1) * ch - 26 * s;
      rowsInfo.push({ x0: x0, x1: x0 + rowW, shelfY: shelfY, top: shelfY - ch + 26 * s });
      for (var j = 0; j < m; j++) {
        pots.push({ x: x0 + (j + 0.5) * cw, rimY: shelfY - 62 * s, shelfY: shelfY, s: s, cw: cw,
          top: shelfY - ch + 26 * s, row: r });
      }
    }

    var bandH = topH - bandTop - 16;
    var ww = clamp(areaW * 0.24, 84, 210), wh = Math.max(bandH, ww * 0.62);
    if (wh > bandH) { ww = Math.max(60, bandH / 0.62 * 0.9); wh = bandH; }
    var cx = areaL + areaW / 2;
    lay = {
      n: n, narrow: narrow, bandTop: bandTop, topH: topH, floorY: floorY, floorH: floorH, fs: clamp(floorH / 72, 0.62, 1.15),
      areaL: areaL, areaR: areaR, areaW: areaW, areaTop: areaTop, areaH: areaH, cx: cx,
      pots: pots, rows: rowsInfo, s: s,
      win: { x: cx - ww / 2, y: bandTop, w: ww, h: wh },
      win2: n >= 10 ? { round: true, x: areaL + areaW * 0.83, y: bandTop + bandH * 0.45, r: Math.min(bandH * 0.3, 34, areaW * 0.07) } : null
    };
    buildWall();
  }

  function windowPath(c, win) {
    c.beginPath();
    if (win.round) { c.arc(win.x, win.y, win.r, 0, PI * 2); return; }
    var r = win.w / 2;
    c.moveTo(win.x, win.y + win.h);
    c.lineTo(win.x, win.y + r);
    c.arc(win.x + r, win.y + r, r, PI, 0);
    c.lineTo(win.x + win.w, win.y + win.h);
    c.closePath();
  }

  /** The static part of the barn (planks, beams, window frames, floor, hay) on an offscreen canvas. */
  function buildWall() {
    wall = document.createElement('canvas');
    wall.width = canvas.width; wall.height = canvas.height;
    var g = wall.getContext('2d');
    g.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    var w = R.w, h = R.h, i, x;

    // Vertical wall planks with a little grain and the odd knot.
    var pw = clamp(w / 22, 34, 58);
    for (i = 0, x = 0; x < w; i++, x += pw) {
      g.fillStyle = Art.mix(PAL.wood, PAL.woodMid, Art.rnd(i * 3.3));
      g.fillRect(x, 0, pw + 1, lay.floorY);
      g.strokeStyle = 'rgba(60,35,22,0.5)'; g.lineWidth = 1.5; Art.line(g, x, 0, x, lay.floorY);
      g.strokeStyle = 'rgba(255,220,170,0.07)'; g.lineWidth = 1;
      Art.line(g, x + pw * 0.3, 0, x + pw * 0.3, lay.floorY); Art.line(g, x + pw * 0.7, 0, x + pw * 0.7, lay.floorY);
      if (Art.rnd(i * 7.1) > 0.6) {
        g.fillStyle = 'rgba(60,35,22,0.35)';
        Art.ellipse(g, x + pw * (0.3 + 0.4 * Art.rnd(i)), lay.floorY * (0.15 + 0.7 * Art.rnd(i * 2.9)), 3.5, 6);
      }
    }
    var shade = g.createLinearGradient(0, 0, 0, lay.topH);
    shade.addColorStop(0, 'rgba(30,16,10,0.5)'); shade.addColorStop(1, 'rgba(30,16,10,0)');
    g.fillStyle = shade; g.fillRect(0, 0, w, lay.topH);

    // Windows: punch holes for the sky, then frame them.
    var wins = [lay.win]; if (lay.win2) wins.push(lay.win2);
    for (i = 0; i < wins.length; i++) {
      var win = wins[i];
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = '#000'; windowPath(g, win); g.fill();
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = PAL.woodPale; g.lineWidth = 4;
      if (win.round) {
        Art.line(g, win.x - win.r, win.y, win.x + win.r, win.y); Art.line(g, win.x, win.y - win.r, win.x, win.y + win.r);
      } else {
        Art.line(g, win.x + win.w / 2, win.y, win.x + win.w / 2, win.y + win.h);
        Art.line(g, win.x, win.y + win.w / 2, win.x + win.w, win.y + win.w / 2);
      }
      g.strokeStyle = PAL.woodDark; g.lineWidth = 10; windowPath(g, win); g.stroke();
      g.strokeStyle = PAL.woodPale; g.lineWidth = 6; windowPath(g, win); g.stroke();
      if (!win.round) {
        g.fillStyle = PAL.woodPale; Art.rr(g, win.x - 10, win.y + win.h - 2, win.w + 20, 9, 3); g.fill();
        g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(win.x - 8, win.y + win.h + 7, win.w + 16, 3);
      }
    }

    // Top beam, side posts and corner braces.
    g.fillStyle = PAL.woodDark; g.fillRect(0, 0, w, 14);
    var postR = w - R.insets.right - (lay.narrow ? 6 : 18);
    g.fillRect(lay.narrow ? 0 : 6, 0, lay.narrow ? 6 : 14, lay.floorY);
    g.fillRect(postR, 0, lay.narrow ? 6 : 14, lay.floorY);
    if (!lay.narrow) {
      g.strokeStyle = PAL.woodDark; g.lineWidth = 12; g.lineCap = 'butt';
      Art.line(g, 16, 96, 96, 14); Art.line(g, postR + 4, 96, postR - 76, 14);
    }

    // A golden rosette for a completely full barn.
    if (lay.n >= 20) {
      var rx = lay.win.x - 30, ry = lay.win.y + 26;
      g.fillStyle = '#e8686b'; g.fillRect(rx - 6, ry + 6, 5, 18); g.fillRect(rx + 1, ry + 6, 5, 18);
      g.fillStyle = PAL.gold; Art.star(g, rx, ry, 14, 12, 0.75);
      g.fillStyle = '#fff3d6'; Art.circle(g, rx, ry, 7);
      g.fillStyle = PAL.hayDark; g.font = '700 8px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('1st', rx, ry + 0.5);
    }

    // Floor boards.
    var fy = lay.floorY;
    g.fillStyle = PAL.floor; g.fillRect(0, fy, w, h - fy);
    g.strokeStyle = 'rgba(70,40,25,0.35)'; g.lineWidth = 1.5;
    for (var y = fy + 16; y < h; y += 18) Art.line(g, 0, y, w, y);
    for (i = 0; i < w / 60; i++) {
      var bx = i * 60 + Art.rnd(i) * 40, by = fy + Math.floor(Art.rnd(i * 5) * 4) * 18;
      Art.line(g, bx, by - 2, bx, by + 16);
    }
    g.fillStyle = PAL.woodDark; g.fillRect(0, fy - 5, w, 7);
    var fshade = g.createLinearGradient(0, fy, 0, h);
    fshade.addColorStop(0, 'rgba(0,0,0,0.16)'); fshade.addColorStop(0.3, 'rgba(0,0,0,0)'); fshade.addColorStop(1, 'rgba(0,0,0,0.22)');
    g.fillStyle = fshade; g.fillRect(0, fy, w, h - fy);

    // Cozy rug once the barn is big.
    var fs = lay.fs, base = fy + lay.floorH * 0.55;
    if (lay.n >= 14) {
      g.fillStyle = '#b8505a'; Art.ellipse(g, lay.cx, base + 6 * fs, lay.areaW * 0.2, 13 * fs);
      g.strokeStyle = '#f2d9a8'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(lay.cx, base + 6 * fs, lay.areaW * 0.2 - 6, 9 * fs, 0, 0, PI * 2); g.stroke();
    }

    // Loose hay and a hay pile.
    g.strokeStyle = PAL.hay; g.lineWidth = 1.4; g.lineCap = 'round';
    for (i = 0; i < w / 14; i++) {
      var hx = Art.rnd(i * 1.9) * w, hy = fy + 6 + Art.rnd(i * 4.3) * (lay.floorH - 10), ha = Art.rnd(i * 8.8) * PI;
      Art.line(g, hx, hy, hx + Math.cos(ha) * 9, hy + Math.sin(ha) * 3);
    }
    var px = lay.areaL + 96 * fs;
    g.fillStyle = PAL.hayDark; Art.ellipse(g, px, base, 40 * fs, 14 * fs);
    g.fillStyle = PAL.hay;
    g.beginPath(); g.moveTo(px - 38 * fs, base); g.quadraticCurveTo(px - 10 * fs, base - 44 * fs, px + 36 * fs, base); g.closePath(); g.fill();
    g.strokeStyle = PAL.hayDark; g.lineWidth = 1.2;
    for (i = 0; i < 9; i++) {
      var sx = px - 26 * fs + i * 7 * fs;
      Art.line(g, sx, base - 3, sx + (Art.rnd(i) - 0.5) * 10, base - (12 + Art.rnd(i * 3) * 18) * fs);
    }
    // Pitchfork leaning on the wall.
    g.strokeStyle = PAL.woodPale; g.lineWidth = 3 * fs;
    Art.line(g, px + 46 * fs, base + 4, px + 56 * fs, fy - 26 * fs);
    g.strokeStyle = '#8a929a'; g.lineWidth = 2 * fs;
    for (i = -1; i <= 1; i++) Art.line(g, px + 56 * fs + i * 5 * fs, fy - 26 * fs, px + 58 * fs + i * 6 * fs, fy - 42 * fs);
    Art.line(g, px + 50 * fs, fy - 26 * fs, px + 62 * fs, fy - 26 * fs);

    // Hay bales on the right once there are six pots.
    if (lay.n >= 6) {
      var bxr = lay.areaR - 46 * fs;
      bale(g, bxr, base + 2, fs); bale(g, bxr - 50 * fs, base + 6, fs * 0.92);
      if (lay.n >= 12) bale(g, bxr - 24 * fs, base - 26 * fs, fs * 0.9);
    }
  }

  function bale(g, x, y, s) {
    g.fillStyle = PAL.hayDark; Art.rr(g, x - 26 * s, y - 28 * s, 52 * s, 30 * s, 5 * s); g.fill();
    g.fillStyle = PAL.hay; Art.rr(g, x - 26 * s, y - 30 * s, 52 * s, 27 * s, 5 * s); g.fill();
    g.strokeStyle = '#b5653a'; g.lineWidth = 2 * s;
    Art.line(g, x - 10 * s, y - 30 * s, x - 10 * s, y - 2 * s); Art.line(g, x + 10 * s, y - 30 * s, x + 10 * s, y - 2 * s);
  }

  // ==================================================================
  // Sky, light and hanging decorations
  // ==================================================================
  function skyAt(phase) {
    var K = C.SKY, i = 0;
    while (i < K.length - 2 && phase >= K[i + 1][0]) i++;
    var a = K[i], b = K[i + 1], t = clamp((phase - a[0]) / Math.max(1e-6, b[0] - a[0]), 0, 1);
    var night = phase >= C.NIGHT_START;
    return {
      top: Art.mix(a[1], b[1], t), bottom: Art.mix(a[2], b[2], t), dark: a[3] + (b[3] - a[3]) * t, night: night,
      dayProg: night ? null : phase / C.NIGHT_START,
      nightProg: night ? (phase - C.NIGHT_START) / (1 - C.NIGHT_START) : null
    };
  }

  function drawSky(c, win, sky, ev) {
    var x = win.round ? win.x - win.r : win.x, y = win.round ? win.y - win.r : win.y;
    var w = win.round ? win.r * 2 : win.w, h = win.round ? win.r * 2 : win.h, i;
    c.save(); windowPath(c, win); c.clip();
    var grad = c.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, sky.top); grad.addColorStop(1, sky.bottom);
    c.fillStyle = grad; c.fillRect(x, y, w, h);
    if (ev.heat > 0) { c.fillStyle = 'rgba(255,150,60,0.28)'; c.fillRect(x, y, w, h); }

    if (sky.dark > 0.3) {
      var sa = clamp((sky.dark - 0.3) / 0.22, 0, 1);
      for (i = 0; i < 16; i++) {
        c.fillStyle = 'rgba(255,255,240,' + (sa * (0.5 + 0.5 * Math.sin(R.t * 2 + i * 1.7))).toFixed(3) + ')';
        Art.circle(c, x + Art.rnd(i * 2.1) * w, y + Art.rnd(i * 5.3) * h * 0.72, 0.8 + Art.rnd(i) * 0.9);
      }
    }
    var d = sky.night ? sky.nightProg : sky.dayProg;
    var bx = x + w * (0.12 + 0.76 * d), by = y + h * (0.82 - 0.62 * Math.sin(PI * d)), br = Math.max(7, w * 0.085);
    if (!sky.night) {
      var hot = ev.heat > 0;
      c.fillStyle = hot ? 'rgba(255,170,60,0.35)' : 'rgba(255,244,190,0.35)'; Art.circle(c, bx, by, br * (hot ? 2.4 : 1.8));
      c.fillStyle = hot ? '#ffb347' : '#fff1a8'; Art.circle(c, bx, by, br * (hot ? 1.25 : 1));
    } else {
      c.fillStyle = 'rgba(230,235,255,0.18)'; Art.circle(c, bx, by, br * 1.9);
      c.fillStyle = '#f4f1de'; Art.circle(c, bx, by, br);
      c.fillStyle = 'rgba(190,190,180,0.6)'; Art.circle(c, bx - br * 0.3, by - br * 0.2, br * 0.2); Art.circle(c, bx + br * 0.3, by + br * 0.3, br * 0.14);
    }
    var rainy = ev.rain > 0, clouds = rainy ? 5 : 3;
    for (i = 0; i < clouds; i++) {
      var span = w * 1.7, cx = x + ((R.t * (3 + i * 1.6) + i * w * 0.55) % span) - w * 0.35;
      var cy = y + h * (0.2 + (i % 3) * 0.15), cs = w * 0.1 * (1 + (i % 2) * 0.3);
      c.fillStyle = rainy ? 'rgba(128,140,160,0.92)' : 'rgba(255,255,255,' + (0.8 * (1 - sky.dark * 1.3)).toFixed(3) + ')';
      Art.ellipse(c, cx, cy, cs * 1.5, cs * 0.6); Art.ellipse(c, cx - cs * 0.8, cy + cs * 0.15, cs, cs * 0.45);
      Art.ellipse(c, cx + cs * 0.9, cy + cs * 0.15, cs * 0.9, cs * 0.42);
    }
    c.fillStyle = Art.mix('#8ecb72', '#16233a', sky.dark * 1.5);
    Art.ellipse(c, x + w * 0.25, y + h * 1.04, w * 0.6, h * 0.22);
    c.fillStyle = Art.mix('#6fb35c', '#111c30', sky.dark * 1.5);
    Art.ellipse(c, x + w * 0.85, y + h * 1.06, w * 0.55, h * 0.2);
    if (rainy) {
      c.strokeStyle = 'rgba(215,232,255,0.7)'; c.lineWidth = 1.2;
      for (i = 0; i < 14; i++) {
        var rx = x + Art.rnd(i * 3.1) * w, ry = y + ((R.t * 240 + Art.rnd(i * 9.7) * h) % h);
        Art.line(c, rx, ry, rx - 2, ry + 9);
      }
    }
    c.restore();
  }

  /** Sun or moon light falling through the main window onto the floor, with dust motes. */
  function drawLight(c, sky) {
    var win = lay.win, d = sky.night ? sky.nightProg : sky.dayProg;
    var strength = sky.night ? 0.07 : 0.07 + 0.15 * Math.sin(PI * d);
    if (R.state && R.state.events.rain > 0) strength *= 0.4;
    var dx = (0.5 - d) * R.w * 0.45, spread = win.w * 0.55;
    var x1 = win.x, x2 = win.x + win.w, yT = win.y + win.h * 0.4, yB = R.h;
    var bx1 = x1 + dx - spread, bx2 = x2 + dx + spread;
    var grad = c.createLinearGradient(0, yT, 0, yB);
    var col = sky.night ? '200,215,255' : '255,238,190';
    grad.addColorStop(0, 'rgba(' + col + ',' + strength.toFixed(3) + ')');
    grad.addColorStop(1, 'rgba(' + col + ',' + (strength * 0.25).toFixed(3) + ')');
    c.fillStyle = grad;
    c.beginPath(); c.moveTo(x1, yT); c.lineTo(x2, yT); c.lineTo(bx2, yB); c.lineTo(bx1, yB); c.closePath(); c.fill();
    // two thin rays from gaps in the roof
    for (var i = 0; i < 2; i++) {
      var gx = lay.areaL + lay.areaW * (i ? 0.78 : 0.2);
      c.fillStyle = 'rgba(' + col + ',' + (strength * 0.45).toFixed(3) + ')';
      c.beginPath(); c.moveTo(gx, 14); c.lineTo(gx + 8, 14); c.lineTo(gx + dx * 0.5 + 34, yB); c.lineTo(gx + dx * 0.5 - 6, yB); c.closePath(); c.fill();
    }
    if (opt.reducedMotion || sky.night) return;
    for (var m = 0; m < motes.length; m++) {
      var mo = motes[m], v = mo.v;
      var mx = (x1 + (bx1 - x1) * v) + ((x2 + (bx2 - x2) * v) - (x1 + (bx1 - x1) * v)) * mo.u;
      var my = yT + (yB - yT) * v;
      c.fillStyle = 'rgba(255,248,220,' + (strength * 2.2 * (0.5 + 0.5 * Math.sin(R.t * 1.5 + mo.ph))).toFixed(3) + ')';
      Art.circle(c, mx, my, 1.3);
    }
  }

  function drawHanging(c, state, sky) {
    var n = state.pots.length, i, x, y;
    var top = 14, bandBottom = lay.topH - 22;
    // Bunting.
    if (n >= 8) {
      var colors = ['#e8686b', '#ffd166', '#5fb3e6', '#fff3d6', '#7bcf6a'];
      var x0 = lay.areaL + 8, x1 = lay.areaR - 8, sag = 22, count = Math.max(8, Math.floor((x1 - x0) / 26));
      var yb = Math.max(18, lay.bandTop + 2);
      c.strokeStyle = 'rgba(255,243,214,0.7)'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(x0, yb); c.quadraticCurveTo((x0 + x1) / 2, yb + sag * 2, x1, yb); c.stroke();
      for (i = 0; i < count; i++) {
        var t = (i + 0.5) / count, bx = x0 + (x1 - x0) * t, by = yb + sag * 4 * t * (1 - t) * 0.5 * 2;
        c.fillStyle = colors[i % colors.length];
        c.beginPath(); c.moveTo(bx - 7, by); c.lineTo(bx + 7, by); c.lineTo(bx, by + 13); c.closePath(); c.fill();
      }
    }
    // String lights along the bottom of the band.
    if (n >= 12) {
      var ly = lay.topH - 6, seg = 5;
      c.strokeStyle = 'rgba(40,26,20,0.7)'; c.lineWidth = 1.2;
      for (i = 0; i < seg; i++) {
        var sx0 = lay.areaL + lay.areaW * i / seg, sx1 = lay.areaL + lay.areaW * (i + 1) / seg;
        c.beginPath(); c.moveTo(sx0, ly - 6); c.quadraticCurveTo((sx0 + sx1) / 2, ly + 8, sx1, ly - 6); c.stroke();
        for (var b = 1; b < 4; b++) {
          var bt = b / 4, lx = sx0 + (sx1 - sx0) * bt, lyy = ly - 6 + 14 * 2 * bt * (1 - bt);
          var lc = ['#ffd166', '#ff9fd0', '#8fd3f4'][(i + b) % 3];
          c.fillStyle = lc; Art.circle(c, lx, lyy + 2, 2.6);
          glows.push({ x: lx, y: lyy + 2, r: 16, color: lc, a: 0.1 + sky.dark * 0.7 });
        }
      }
    }
    // Lantern(s).
    var lanterns = n >= 8 ? [0.07, 0.95] : [0.07];
    for (i = 0; i < lanterns.length; i++) {
      x = lay.areaL + lay.areaW * lanterns[i]; y = bandBottom - 8;
      var swing = opt.reducedMotion ? 0 : Math.sin(R.t * 0.9 + i) * 2;
      c.strokeStyle = PAL.woodDark; c.lineWidth = 1.5; Art.line(c, x, top, x + swing, y - 22);
      c.fillStyle = '#3a2a22'; Art.rr(c, x + swing - 7, y - 24, 14, 5, 2); c.fill(); Art.rr(c, x + swing - 8, y, 16, 4, 2); c.fill();
      c.fillStyle = Art.mix('#f6e3b0', '#ffc24a', clamp(sky.dark * 2, 0, 1));
      Art.rr(c, x + swing - 6, y - 19, 12, 19, 3); c.fill();
      c.strokeStyle = '#3a2a22'; c.lineWidth = 1; Art.line(c, x + swing, y - 19, x + swing, y);
      glows.push({ x: x + swing, y: y - 9, r: 120, color: '#ffc66b', a: 0.05 + sky.dark * 0.85 });
    }
    // Grow lamps.
    var lamps = L.level(state, 'lamps'), spots = [0.17, 0.74, 0.27, 0.66, 0.34];
    for (i = 0; i < lamps; i++) {
      x = lay.areaL + lay.areaW * spots[i]; y = bandBottom - (i % 2) * 14;
      c.strokeStyle = '#2a2a2e'; c.lineWidth = 1.5; Art.line(c, x, top, x, y - 12);
      c.fillStyle = '#4a4a52';
      c.beginPath(); c.moveTo(x - 6, y - 12); c.lineTo(x + 6, y - 12); c.lineTo(x + 15, y); c.lineTo(x - 15, y); c.closePath(); c.fill();
      c.fillStyle = PAL.lamp; Art.rr(c, x - 12, y, 24, 3.5, 1.5); c.fill();
      cones.push({ x: x, y: y + 3, w: 15, a: 0.07 + sky.dark * 0.3 });
    }
    // Hanging flower basket.
    if (n >= 16) {
      x = lay.areaL + lay.areaW * 0.82; y = bandBottom - 4;
      c.strokeStyle = PAL.woodPale; c.lineWidth = 1.2;
      Art.line(c, x, top, x - 12, y - 8); Art.line(c, x, top, x + 12, y - 8);
      c.fillStyle = '#9a6a3f'; c.beginPath(); c.arc(x, y - 8, 13, 0, PI); c.closePath(); c.fill();
      c.fillStyle = '#5fae5a'; Art.ellipse(c, x, y - 10, 15, 6);
      var fc = ['#ff8fb1', '#ffd166', '#c79bff'];
      for (i = 0; i < 5; i++) { c.fillStyle = fc[i % 3]; Art.circle(c, x - 11 + i * 5.5, y - 13 - (i % 2) * 3, 3); }
      c.strokeStyle = '#5fae5a'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(x - 11, y - 6); c.quadraticCurveTo(x - 17, y + 6, x - 13, y + 14); c.stroke();
      c.beginPath(); c.moveTo(x + 11, y - 6); c.quadraticCurveTo(x + 18, y + 4, x + 14, y + 10); c.stroke();
    }
  }

  // ==================================================================
  // Shelves and pots
  // ==================================================================
  function drawShelves(c, state) {
    var s = lay.s, cover = L.sprinklerCoverage(state);
    for (var r = 0; r < lay.rows.length; r++) {
      var row = lay.rows[r], y = row.shelfY, x0 = row.x0 + 4, x1 = row.x1 - 4, t = 24 * s;
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(x0 + 6, y + t, x1 - x0 - 12, 5 * s);
      c.fillStyle = PAL.woodDark;
      c.beginPath(); c.moveTo(x0 + 14 * s, y + t); c.lineTo(x0 + 14 * s, y + t + 20 * s); c.lineTo(x0 + 40 * s, y + t); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(x1 - 14 * s, y + t); c.lineTo(x1 - 14 * s, y + t + 20 * s); c.lineTo(x1 - 40 * s, y + t); c.closePath(); c.fill();
      c.fillStyle = PAL.woodLight; Art.rr(c, x0, y, x1 - x0, t, 4 * s); c.fill();
      c.fillStyle = PAL.woodPale; Art.rr(c, x0, y, x1 - x0, 4 * s, 2 * s); c.fill();
      c.fillStyle = 'rgba(60,35,22,0.25)'; c.fillRect(x0, y + t - 3 * s, x1 - x0, 3 * s);
    }
    // Sprinkler drip lines above the covered pots.
    if (cover > 0) {
      c.strokeStyle = '#c98a4a'; c.lineWidth = Math.max(2, 3 * s); c.lineCap = 'round';
      for (var rr2 = 0; rr2 < lay.rows.length; rr2++) {
        var first = null, last = null;
        for (var i = 0; i < lay.pots.length && i < cover; i++) {
          if (lay.pots[i].row === rr2) { if (!first) first = lay.pots[i]; last = lay.pots[i]; }
        }
        if (!first) continue;
        var py = first.top + 5 * s;
        Art.line(c, first.x - first.cw * 0.4, py, last.x + last.cw * 0.4, py);
        for (i = 0; i < lay.pots.length && i < cover; i++) {
          var pc = lay.pots[i];
          if (pc.row !== rr2) continue;
          Art.line(c, pc.x, py, pc.x, py + 7 * s);
          c.fillStyle = '#8a5a2a'; Art.circle(c, pc.x, py + 8 * s, 2.6 * s);
        }
      }
    }
  }

  function drawBars(c, p, sp) {
    var x = -32, w = 64, lo = sp.water[0], hi = sp.water[1], max = C.WATER.max;
    c.fillStyle = 'rgba(40,26,20,0.65)'; Art.rr(c, x, 66, w, 4.5, 2); c.fill();
    if (p.growth > 0.02) { c.fillStyle = p.growth >= 1 ? PAL.gold : PAL.growth; Art.rr(c, x, 66, w * clamp(p.growth, 0, 1), 4.5, 2); c.fill(); }
    c.fillStyle = 'rgba(40,26,20,0.65)'; Art.rr(c, x, 73, w, 6.5, 3); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.24)'; c.fillRect(x + w * lo / max, 73, w * (hi - lo) / max, 6.5);
    var f = clamp(p.water / max, 0, 1), ok = p.water >= lo && p.water <= hi;
    if (f > 0.02) {
      c.fillStyle = ok ? PAL.water : (p.water < lo ? '#f0a35a' : '#8f8be8');
      Art.rr(c, x, 73, w * f, 6.5, 3); c.fill();
      if (opt.colorblind && !ok) {
        c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1;
        for (var tx = x + 2; tx < x + w * f - 1; tx += 4) Art.line(c, tx, 79, tx + 2.5, 73.5);
      }
    }
    c.fillStyle = '#fff8e6';
    c.fillRect(x + w * lo / max - 0.7, 71.8, 1.4, 9); c.fillRect(x + w * hi / max - 0.7, 71.8, 1.4, 9);
  }

  function drawPips(c, p) {
    var active = [], i;
    for (i = 0; i < C.NUTRIENTS.length; i++) if (p.nutrients[C.NUTRIENTS[i].id] > 0) active.push(C.NUTRIENTS[i]);
    if (!active.length) return;
    var gap = 14, x = -(active.length - 1) * gap / 2;
    for (i = 0; i < active.length; i++) {
      var amt = p.nutrients[active[i].id];
      c.fillStyle = 'rgba(40,26,20,0.75)'; Art.circle(c, x + i * gap, 36, 6.4);
      c.globalAlpha = clamp(0.45 + amt / C.NUTRIENT.dose * 0.55, 0.45, 1);
      c.fillStyle = active[i].color; Art.shape(c, active[i].shape, x + i * gap, 36, 3.6);
      c.globalAlpha = 1;
    }
  }

  function label(c, text, x, y, size, color) {
    c.font = '800 ' + size + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = Math.max(2.5, size * 0.28); c.strokeStyle = 'rgba(40,24,18,0.9)'; c.lineJoin = 'round';
    c.strokeText(text, x, y);
    c.fillStyle = color; c.fillText(text, x, y);
  }

  /** Status icons floating above a plant: ready star, thirsty / soggy droplet, low health heart. */
  function drawIndicators(c, p, pc, sp) {
    var s = pc.s, h = Art.plantHeight(p), icons = [];
    if (p.dead) return;
    if (p.growth >= 1) icons.push(L.stage(p) === 'overgrown' ? 'over' : 'ready');
    if (p.water < sp.water[0]) icons.push(p.water <= 0.5 ? 'parched' : 'dry');
    else if (L.isSoggy(p)) icons.push('wet');
    if (p.health < 50) icons.push('hurt');
    var gap = 22 * s, x0 = pc.x - (icons.length - 1) * gap / 2;
    var bob = opt.reducedMotion ? 0 : Math.abs(Math.sin(R.t * 3 + pc.x)) * 5 * s;
    var y = Math.max(pc.top + 14 * s, pc.rimY - (h + 20) * s);
    for (var i = 0; i < icons.length; i++) {
      var x = x0 + i * gap, kind = icons[i];
      if (kind === 'ready' || kind === 'over') {
        var r = (p.golden ? 12 : 9.5) * s;
        c.fillStyle = 'rgba(40,24,18,0.85)'; Art.star(c, x, y - bob, r + 2.5 * s, 5, 0.5);
        c.fillStyle = kind === 'over' ? '#cdb37a' : PAL.gold; Art.star(c, x, y - bob, r, 5, 0.5);
        if (p.golden) { c.fillStyle = '#fff8cf'; Art.star(c, x, y - bob, r * 0.45, 4, 0.4); }
        if (opt.colorblind) label(c, kind === 'over' ? 'LATE' : 'RIPE', x, y + 14 * s, Math.max(8, 9 * s), '#fff3d6');
      } else if (kind === 'dry' || kind === 'parched') {
        var pulse = opt.reducedMotion ? 1 : 1 + Math.sin(R.t * 6) * 0.1;
        Art.droplet(c, x, y, 7 * s * pulse, false, kind === 'parched' ? '#e8686b' : PAL.waterDark);
        if (kind === 'parched') label(c, '!', x, y + 1.5 * s, Math.max(9, 11 * s), '#e8686b');
        if (opt.colorblind) label(c, 'DRY', x, y + 15 * s, Math.max(8, 9 * s), '#fff3d6');
      } else if (kind === 'wet') {
        Art.droplet(c, x, y, 7 * s, true, '#8f8be8');
        c.strokeStyle = '#fff'; c.lineWidth = 1.3 * s;
        c.beginPath(); c.moveTo(x - 4 * s, y + 2 * s); c.quadraticCurveTo(x - 2 * s, y, x, y + 2 * s); c.quadraticCurveTo(x + 2 * s, y + 4 * s, x + 4 * s, y + 2 * s); c.stroke();
        if (opt.colorblind) label(c, 'WET', x, y + 15 * s, Math.max(8, 9 * s), '#fff3d6');
      } else if (kind === 'hurt') {
        c.fillStyle = 'rgba(40,24,18,0.85)'; Art.heart(c, x, y, 9 * s);
        c.fillStyle = PAL.health; Art.heart(c, x, y, 7 * s);
        c.strokeStyle = 'rgba(40,24,18,0.9)'; c.lineWidth = 1.3 * s;
        c.beginPath(); c.moveTo(x, y - 3 * s); c.lineTo(x - 2 * s, y); c.lineTo(x + 1.5 * s, y + 1.5 * s); c.lineTo(x, y + 5 * s); c.stroke();
      }
    }
  }

  function drawPotCell(c, state, i, sky, view) {
    var pc = lay.pots[i], pot = state.pots[i], p = pot.plant, s = pc.s;
    var style = C.POT_STYLES_BY_ID[state.potStyle] || C.POT_STYLES[0];

    // Selection / hover plate behind the pot.
    if (!view.menu && (view.selected === i || view.hover === i)) {
      var sel = view.selected === i;
      c.fillStyle = sel ? 'rgba(255,243,214,0.2)' : 'rgba(255,243,214,0.1)';
      Art.rr(c, pc.x - pc.cw / 2 + 3, pc.top + 2, pc.cw - 6, pc.shelfY - pc.top - 2, 12); c.fill();
      if (sel) {
        c.strokeStyle = 'rgba(255,243,214,0.9)'; c.lineWidth = 2;
        c.setLineDash([7, 6]); c.lineDashOffset = opt.reducedMotion ? 0 : -R.t * 14;
        Art.rr(c, pc.x - pc.cw / 2 + 3, pc.top + 2, pc.cw - 6, pc.shelfY - pc.top - 2, 12); c.stroke();
        c.setLineDash([]);
      }
    }

    c.save(); c.translate(pc.x, pc.rimY); c.scale(s, s);
    Art.drawPot(c, style, p && !p.dead ? p.water / 100 : 0.1);
    if (p) {
      var w = wiggle[i] || 0;
      var sway = opt.reducedMotion ? 0 : Math.sin(R.t * 1.4 + i * 1.7) * 0.03 + Math.sin(w * 30) * 0.09 * w / 0.6;
      Art.drawPlant(c, p, {
        seed: i * 1.618 + 1, t: opt.reducedMotion ? 0 : R.t, sway: sway, night: clamp(sky.dark / 0.55, 0, 1),
        dayProg: sky.dayProg,
        glow: function (ux, uy, ur, color, a) { glows.push({ x: pc.x + ux * s, y: pc.rimY + uy * s, r: ur * s, color: color, a: a }); }
      });
      if (!p.dead) { drawPips(c, p); drawBars(c, p, L.species(p)); }
    } else {
      if (pot.memo && L.level(state, 'squirrel') > 0) {
        c.globalAlpha = 0.55; c.fillStyle = C.SPECIES_BY_ID[pot.memo].colors.seed; Art.ellipse(c, 0, -2, 4, 3, 0.4); c.globalAlpha = 1;
      }
      if (!view.menu && view.tool === 'seed') {
        c.strokeStyle = 'rgba(255,243,214,' + (0.45 + 0.25 * Math.sin(R.t * 4)).toFixed(2) + ')'; c.lineWidth = 3.5; c.lineCap = 'round';
        Art.line(c, -8, -24, 8, -24); Art.line(c, 0, -32, 0, -16);
      }
    }
    c.restore();

    if (p && !view.menu) {
      var sp = L.species(p);
      drawIndicators(c, p, pc, sp);
      if (p.pest > 0 && !p.dead) {
        var h = Art.plantHeight(p);
        var bx = pc.x + Math.sin(R.t * 2.2 + i) * 9 * s, by = pc.rimY - Math.max(10, h * 0.5) * s + Math.cos(R.t * 3.1 + i) * 4 * s;
        Art.bug(c, bx, by, s * 1.5, R.t);
        if (opt.colorblind) label(c, 'BUG', bx, by - 13 * s, Math.max(8, 9 * s), '#fff3d6');
      }
      if (p.golden && p.growth >= 1 && !p.dead) glows.push({ x: pc.x, y: pc.rimY - Art.plantHeight(p) * 0.5 * s, r: 55 * s, color: PAL.gold, a: 0.22 });
    }
  }

  // ==================================================================
  // Floor props and critters
  // ==================================================================
  function drawCritters(c, state, sky, view) {
    var fs = lay.fs, base = lay.floorY + lay.floorH * 0.55, ev = state.events, i;
    hot.length = 0;

    Art.barrel(c, lay.areaL + 30 * fs, base + 4, fs, state.tank / L.tankCapacity(state));

    if (L.level(state, 'hedgehog') > 0) {
      Art.hedgehog(c, lay.areaR - (lay.n >= 6 ? 128 : 60) * fs, base + 8 * fs, fs * 1.05, R.t, Math.max(0, Math.sin(hogHop * PI / 0.4)) * 12 * fs * (hogHop > 0 ? 1 : 0));
    }
    if (L.level(state, 'squirrel') > 0) {
      Art.squirrel(c, lay.win.x + lay.win.w + 4, lay.win.y + lay.win.h - 2, clamp(lay.win.w / 150, 0.6, 1), R.t);
    }
    if (ev.merchant > 0) {
      var mx = lay.areaL + lay.areaW * 0.7, ms = fs * 0.95;
      Art.merchant(c, mx, base + 10 * fs, ms, R.t);
      hot.push({ id: 'merchant', x: mx, y: base - 20 * fs, r: 44 * ms });
      if (!view.menu) label(c, 'Shop!', mx, base - 78 * ms + Math.sin(R.t * 4) * 2, 12, '#ffd166');
    }
    if (mouse.active) Art.mouse(c, mouse.x, base + 16 * fs, fs, mouse.dir, R.t);
    if (state.cat) {
      var cx = lay.areaL + lay.areaW * cat.x, cs = fs * 1.05;
      Art.cat(c, cx, base + 10 * fs, cs, { t: R.t, walking: cat.walking, dir: cat.dir, happy: cat.happy > 0, blink: cat.blink > 0 });
      hot.push({ id: 'cat', x: cx, y: base - 12 * cs, r: 30 * cs });
    }

    // Daytime butterfly, night-time fireflies.
    if (!opt.reducedMotion) {
      if (sky.dark < 0.3) {
        var bx = lay.cx + Math.sin(R.t * 0.23) * lay.areaW * 0.42, by = lay.areaTop + lay.areaH * (0.4 + 0.3 * Math.sin(R.t * 0.37)) + Math.sin(R.t * 3) * 6;
        Art.butterfly(c, bx, by, 0.8, R.t, '#ffb3d1');
        if (lay.n >= 10) Art.butterfly(c, lay.cx + Math.cos(R.t * 0.19 + 2) * lay.areaW * 0.4, lay.areaTop + lay.areaH * (0.5 + 0.35 * Math.cos(R.t * 0.31)), 0.7, R.t + 1, '#ffe08a');
      } else {
        for (i = 0; i < 7; i++) {
          var fx2 = lay.areaL + lay.areaW * (0.5 + 0.48 * Math.sin(R.t * (0.11 + i * 0.023) + i * 2.1));
          var fy = lay.areaTop + lay.areaH * (0.5 + 0.45 * Math.cos(R.t * (0.13 + i * 0.019) + i * 1.3));
          var fa = (0.5 + 0.5 * Math.sin(R.t * 2.2 + i * 1.9)) * clamp((sky.dark - 0.3) * 4, 0, 1);
          glows.push({ x: fx2, y: fy, r: 9, color: '#e9ff8a', a: fa * 0.9 });
        }
      }
    }

    // The lucky bee.
    if (ev.bee > 0 && !ev.beeClicked) {
      var t = R.t * (opt.reducedMotion ? 0.3 : 1);
      var beeX = lay.cx + Math.sin(t * 0.9) * lay.areaW * 0.38, beeY = lay.areaTop + lay.areaH * (0.42 + 0.3 * Math.sin(t * 1.3 + 1));
      Art.bee(c, beeX, beeY, 1.25, R.t, Math.cos(t * 0.9) >= 0 ? 1 : -1);
      hot.push({ id: 'bee', x: beeX, y: beeY, r: 30 });
      glows.push({ x: beeX, y: beeY, r: 26, color: '#ffe27a', a: 0.35 });
    }
  }

  // ==================================================================
  // Particles and effects
  // ==================================================================
  function spawn(p) {
    if (particles.length > 500) return;
    p.age = 0; p.delay = p.delay || 0; p.vx = p.vx || 0; p.vy = p.vy || 0; p.g = p.g || 0;
    p.rot = p.rot || 0; p.vr = p.vr || 0;
    particles.push(p);
  }

  R.floatText = function (x, y, text, color, big) {
    spawn({ kind: 'text', x: x, y: y, vy: -42, life: 1.25, text: text, color: color || '#fff3d6', size: big ? 22 : 16 });
  };
  R.textAtSlot = function (i, text, color, big) {
    var pc = lay && lay.pots[i];
    if (pc) R.floatText(pc.x, pc.rimY - 46 * pc.s, text, color, big);
  };
  R.slotPos = function (i) {
    var pc = lay && lay.pots[i];
    return pc ? { x: pc.x, y: pc.rimY, s: pc.s } : null;
  };
  R.shake = function (m) { if (opt.shake) shake = Math.max(shake, m); };
  R.wiggle = function (i) { wiggle[i] = 0.6; };
  R.hop = function () { hogHop = 0.4; };
  R.pet = function () {
    cat.happy = 2.2; cat.walking = false; cat.timer = Math.max(cat.timer, 4);
    if (!lay) return;
    var x = lay.areaL + lay.areaW * cat.x, y = lay.floorY + lay.floorH * 0.55 - 40 * lay.fs;
    for (var i = 0; i < 3; i++) spawn({ kind: 'heart', x: x + rand(-12, 12), y: y, vx: rand(-14, 14), vy: rand(-55, -35), life: 1.1, size: 7, color: '#ff7f9f', delay: i * 0.12 });
  };

  /** Spawns a themed burst of particles at pot i. */
  R.burst = function (kind, i, o) {
    var pc = lay && lay.pots[i];
    if (!pc) return;
    o = o || {};
    var s = pc.s, x = pc.x, y = pc.rimY, n;
    var plant = R.state && R.state.pots[i] && R.state.pots[i].plant;
    var h = plant ? Art.plantHeight(plant) : 30;
    if (kind === 'water') {
      if (!o.quiet) fx.push({ kind: 'can', slot: i, t: 0, dur: 0.5, h: h });
      R.wiggle(i);
    }
    if (!opt.particles) return;
    switch (kind) {
      case 'water':
        for (n = 0; n < 9; n++) spawn({ kind: 'drop', x: x + rand(-14, 6) * s, y: y - (h + 30) * s, vx: rand(-10, 10) * s, vy: 90 * s, g: 620 * s, life: 0.55, size: 2.8 * s, color: PAL.water, delay: n * 0.035 });
        for (n = 0; n < 6; n++) spawn({ kind: 'dot', x: x + rand(-20, 20) * s, y: y, vx: rand(-60, 60) * s, vy: rand(-110, -50) * s, g: 420 * s, life: 0.45, size: 2.2 * s, color: '#c9ecff', delay: 0.32 });
        break;
      case 'sprinkle':
        for (n = 0; n < 4; n++) spawn({ kind: 'drop', x: x + rand(-3, 3), y: pc.top + 14 * s, vx: rand(-8, 8), vy: 60, g: 500, life: 0.6, size: 2.2 * s, color: PAL.water, delay: n * 0.05 });
        break;
      case 'feed':
        for (n = 0; n < 11; n++) spawn({ kind: o.shape || 'spark', x: x + rand(-26, 26) * s, y: y - rand(0, h) * s, vy: rand(-55, -20), life: rand(0.6, 1.1), size: rand(2.5, 4.5) * s, color: o.color || PAL.gold, delay: n * 0.03 });
        break;
      case 'harvest':
        spawn({ kind: 'ring', x: x, y: y - h * 0.5 * s, life: 0.45, size: 46 * s, color: '#fff3d6' });
        for (n = 0; n < 12; n++) spawn({ kind: 'leaf', x: x, y: y - h * 0.5 * s, vx: rand(-150, 150) * s, vy: rand(-200, -40) * s, g: 480 * s, life: rand(0.5, 0.9), size: rand(4, 7) * s, color: o.color || '#63b95f', rot: rand(0, 6), vr: rand(-8, 8) });
        var coins = clamp(2 + Math.floor(Math.log(1 + (o.coins || 1)) / Math.LN10 * 2.2), 2, 9);
        for (n = 0; n < coins; n++) spawn({ kind: 'coin', x: x + rand(-10, 10) * s, y: y - h * 0.5 * s, vx: rand(-70, 70), vy: rand(-260, -150), g: 620, life: 0.9, size: 5.5, delay: n * 0.04 });
        if (o.golden) for (n = 0; n < 14; n++) spawn({ kind: 'spark', x: x, y: y - h * 0.5 * s, vx: rand(-120, 120), vy: rand(-160, 40), life: rand(0.6, 1.2), size: rand(3, 6), color: PAL.gold });
        break;
      case 'plant': case 'clear':
        for (n = 0; n < 8; n++) spawn({ kind: 'dot', x: x + rand(-14, 14) * s, y: y, vx: rand(-60, 60) * s, vy: rand(-110, -40) * s, g: 400 * s, life: 0.5, size: rand(2, 3.5) * s, color: kind === 'plant' ? PAL.soilLight : '#a39280' });
        break;
      case 'matured':
        spawn({ kind: 'ring', x: x, y: y - h * 0.6 * s, life: 0.6, size: 52 * s, color: PAL.gold });
        for (n = 0; n < 8; n++) spawn({ kind: 'spark', x: x + rand(-24, 24) * s, y: y - rand(0.2, 1) * h * s, vy: rand(-50, -20), life: rand(0.6, 1), size: rand(3, 5) * s, color: o.golden ? PAL.gold : '#fff3d6', delay: n * 0.04 });
        break;
      case 'died':
        for (n = 0; n < 9; n++) spawn({ kind: 'dot', x: x + rand(-18, 18) * s, y: y - rand(0, 30) * s, vx: rand(-20, 20), vy: rand(-40, -15), life: rand(0.7, 1.2), size: rand(3, 6) * s, color: 'rgba(120,110,100,0.7)' });
        break;
      case 'pop':
        for (n = 0; n < 7; n++) spawn({ kind: 'dot', x: x, y: y - h * 0.5 * s, vx: rand(-110, 110), vy: rand(-110, 60), g: 200, life: 0.4, size: rand(2, 3.5), color: o.color || '#b98be0' });
        break;
    }
  };

  /** Coins flying up from an arbitrary point (bee tip, order reward). */
  R.coinsAt = function (x, y, count) {
    if (!opt.particles) return;
    for (var n = 0; n < count; n++) spawn({ kind: 'coin', x: x + rand(-8, 8), y: y, vx: rand(-90, 90), vy: rand(-280, -150), g: 620, life: 0.95, size: 5.5, delay: n * 0.03 });
  };
  R.critterPos = function (id) {
    for (var i = 0; i < hot.length; i++) if (hot[i].id === id) return hot[i];
    return null;
  };

  function drawParticle(c, p) {
    var k = p.age / p.life, a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    c.globalAlpha = clamp(a, 0, 1);
    switch (p.kind) {
      case 'drop': c.fillStyle = p.color; Art.ellipse(c, p.x, p.y, p.size * 0.7, p.size * 1.4); break;
      case 'dot': c.fillStyle = p.color; Art.circle(c, p.x, p.y, p.size * (1 - k * 0.4)); break;
      case 'spark': c.fillStyle = p.color; Art.star(c, p.x, p.y, p.size * (0.6 + 0.4 * Math.sin(k * PI)), 4, 0.35); break;
      case 'circle': case 'square': case 'triangle': case 'diamond': case 'star':
        c.fillStyle = p.color; Art.shape(c, p.kind, p.x, p.y, p.size * (0.6 + 0.4 * Math.sin(k * PI))); break;
      case 'leaf': c.fillStyle = p.color; Art.leaf(c, p.x, p.y, p.rot, p.size * 2, p.size * 0.7); break;
      case 'coin':
        c.fillStyle = '#c98f1c'; Art.ellipse(c, p.x, p.y + 1, p.size * Math.abs(Math.cos(p.age * 9)) + 1, p.size);
        c.fillStyle = PAL.gold; Art.ellipse(c, p.x, p.y, p.size * Math.abs(Math.cos(p.age * 9)) + 1, p.size);
        break;
      case 'heart': c.fillStyle = p.color; Art.heart(c, p.x, p.y, p.size); break;
      case 'ring':
        c.strokeStyle = p.color; c.lineWidth = 3 * (1 - k); c.globalAlpha = 1 - k;
        c.beginPath(); c.arc(p.x, p.y, p.size * (0.3 + 0.7 * k), 0, PI * 2); c.stroke();
        break;
    }
    c.globalAlpha = 1;
  }

  function drawFx(c) {
    for (var i = 0; i < fx.length; i++) {
      var f = fx[i], pc = lay.pots[f.slot];
      if (!pc) continue;
      if (f.kind === 'can') {
        var k = f.t / f.dur, tilt = -0.75 * Math.sin(Math.min(1, k * 1.4) * PI * 0.5) * (k > 0.8 ? (1 - k) / 0.2 : 1);
        c.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1;
        Art.wateringCan(c, pc.x + 22 * pc.s, pc.rimY - (f.h + 44) * pc.s, pc.s * 1.5, tilt);
        c.globalAlpha = 1;
      }
    }
  }

  // ==================================================================
  // Per-frame update of purely visual things
  // ==================================================================
  R.update = function (dt, state) {
    R.t += dt;
    var i, p;
    for (i = particles.length - 1; i >= 0; i--) {
      p = particles[i];
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.age += dt;
      if (p.age >= p.life) { particles.splice(i, 1); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
    for (i = fx.length - 1; i >= 0; i--) { fx[i].t += dt; if (fx[i].t >= fx[i].dur) fx.splice(i, 1); }
    for (var k in wiggle) { wiggle[k] -= dt; if (wiggle[k] <= 0) delete wiggle[k]; }
    shake = Math.max(0, shake - dt * 22);
    hogHop = Math.max(0, hogHop - dt);
    for (i = 0; i < motes.length; i++) {
      motes[i].v += motes[i].sp * dt; motes[i].u += Math.sin(R.t * 0.4 + motes[i].ph) * 0.02 * dt;
      if (motes[i].v > 1) { motes[i].v = 0; motes[i].u = Math.random(); }
    }
    if (!state || !lay) return;

    // The cat potters about, sits, blinks.
    cat.happy = Math.max(0, cat.happy - dt);
    cat.blink -= dt;
    if (cat.blink < -rand(2.5, 6)) cat.blink = 0.15;
    cat.timer -= dt;
    if (!cat.walking && cat.timer <= 0 && !opt.reducedMotion) { cat.tx = rand(0.3, 0.62); cat.walking = true; cat.dir = cat.tx > cat.x ? 1 : -1; }
    if (cat.walking) {
      var step = 46 / lay.areaW * dt;
      if (Math.abs(cat.tx - cat.x) <= step) { cat.x = cat.tx; cat.walking = false; cat.timer = rand(9, 22); }
      else cat.x += cat.dir * step;
    }
    // A mouse scurries by now and then.
    if (mouse.active) {
      mouse.x += mouse.dir * 170 * dt;
      if (mouse.x < -30 || mouse.x > R.w + 30) { mouse.active = false; mouse.timer = rand(35, 80); }
    } else if (!opt.reducedMotion) {
      mouse.timer -= dt;
      if (mouse.timer <= 0) { mouse.active = true; mouse.dir = Math.random() < 0.5 ? 1 : -1; mouse.x = mouse.dir > 0 ? -20 : R.w + 20; }
    }

    if (!opt.particles) return;
    // Ambient sparkles for fed and golden plants, leaky-roof drips in the rain.
    ambientAcc += dt;
    if (ambientAcc >= 0.3) {
      ambientAcc = 0;
      for (i = 0; i < state.pots.length && i < lay.pots.length; i++) {
        p = state.pots[i].plant;
        if (!p || p.dead) continue;
        var pc = lay.pots[i], h = Art.plantHeight(p);
        for (var n = 0; n < C.NUTRIENTS.length; n++) {
          var nu = C.NUTRIENTS[n];
          if (p.nutrients[nu.id] > 0 && Math.random() < 0.16) {
            spawn({ kind: nu.shape, x: pc.x + rand(-24, 24) * pc.s, y: pc.rimY - rand(0.1, 1) * h * pc.s, vy: -16, life: 1.1, size: 2.6 * pc.s, color: nu.color });
          }
        }
        if (p.golden && p.growth >= 1 && Math.random() < 0.5) {
          spawn({ kind: 'spark', x: pc.x + rand(-26, 26) * pc.s, y: pc.rimY - rand(0.1, 1.1) * h * pc.s, vy: -14, life: 0.9, size: 3.6 * pc.s, color: PAL.gold });
        }
      }
      if (state.events.rain > 0) {
        for (i = 0; i < 2; i++) spawn({ kind: 'drop', x: rand(lay.areaL, lay.areaR), y: 16, vy: 260, g: 500, life: 1.4, size: 2.2, color: 'rgba(170,215,255,0.8)' });
      }
    }
  };

  // ==================================================================
  // Main draw
  // ==================================================================
  R.draw = function (state, view) {
    if (!ctx || !state) return;
    R.state = state;
    view = view || {};
    ensureLayout(state.pots.length);
    var c = ctx, i;
    c.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    c.clearRect(0, 0, R.w, R.h);
    glows.length = 0; cones.length = 0;
    c.save();
    if (shake > 0.2) c.translate(rand(-shake, shake), rand(-shake, shake));

    var sky = skyAt(L.phase(state)), ev = state.events;
    drawSky(c, lay.win, sky, ev);
    if (lay.win2) drawSky(c, lay.win2, sky, ev);
    c.drawImage(wall, 0, 0, R.w, R.h);
    drawHanging(c, state, sky);
    drawLight(c, sky);
    drawShelves(c, state);
    for (i = 0; i < state.pots.length && i < lay.pots.length; i++) drawPotCell(c, state, i, sky, view);
    drawCritters(c, state, sky, view);
    drawFx(c);
    for (i = 0; i < particles.length; i++) if (particles[i].kind !== 'text' && particles[i].delay <= 0) drawParticle(c, particles[i]);

    // Night falls: a blue veil, then every light source glows through it.
    if (sky.dark > 0.01) { c.fillStyle = 'rgba(14,18,52,' + (sky.dark * 0.66).toFixed(3) + ')'; c.fillRect(-20, -20, R.w + 40, R.h + 40); }
    if (ev.heat > 0) { c.fillStyle = 'rgba(255,130,50,0.09)'; c.fillRect(-20, -20, R.w + 40, R.h + 40); }
    if (ev.rain > 0) { c.fillStyle = 'rgba(60,90,130,0.12)'; c.fillRect(-20, -20, R.w + 40, R.h + 40); }
    c.globalCompositeOperation = 'lighter';
    for (i = 0; i < cones.length; i++) {
      var co = cones[i], len = lay.areaH * 0.55;
      var cg = c.createLinearGradient(0, co.y, 0, co.y + len);
      cg.addColorStop(0, Art.rgba(PAL.lamp, co.a)); cg.addColorStop(1, Art.rgba(PAL.lamp, 0));
      c.fillStyle = cg;
      c.beginPath(); c.moveTo(co.x - co.w, co.y); c.lineTo(co.x + co.w, co.y); c.lineTo(co.x + co.w * 5, co.y + len); c.lineTo(co.x - co.w * 5, co.y + len); c.closePath(); c.fill();
    }
    for (i = 0; i < glows.length; i++) {
      var gl = glows[i];
      if (gl.a <= 0.01 || gl.r <= 0.5) continue;
      var gg = c.createRadialGradient(gl.x, gl.y, 0, gl.x, gl.y, gl.r);
      gg.addColorStop(0, Art.rgba(gl.color, Math.min(1, gl.a).toFixed(3))); gg.addColorStop(1, Art.rgba(gl.color, 0));
      c.fillStyle = gg; c.fillRect(gl.x - gl.r, gl.y - gl.r, gl.r * 2, gl.r * 2);
    }
    c.globalCompositeOperation = 'source-over';

    for (i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (p.kind !== 'text' || p.delay > 0) continue;
      var k = p.age / p.life;
      c.globalAlpha = k < 0.7 ? 1 : clamp(1 - (k - 0.7) / 0.3, 0, 1);
      label(c, p.text, p.x, p.y, p.size * (k < 0.12 ? 0.6 + k / 0.12 * 0.4 : 1), p.color);
      c.globalAlpha = 1;
    }
    c.restore();

    if (view.menu) {
      var vg = c.createRadialGradient(R.w / 2, R.h / 2, Math.min(R.w, R.h) * 0.25, R.w / 2, R.h / 2, Math.max(R.w, R.h) * 0.75);
      vg.addColorStop(0, 'rgba(30,16,10,0.25)'); vg.addColorStop(1, 'rgba(30,16,10,0.78)');
      c.fillStyle = vg; c.fillRect(0, 0, R.w, R.h);
    }
  };

  // ==================================================================
  // Hit testing
  // ==================================================================
  R.slotAt = function (x, y) {
    if (!lay) return -1;
    for (var i = 0; i < lay.pots.length; i++) {
      var pc = lay.pots[i];
      if (Math.abs(x - pc.x) <= pc.cw / 2 && y >= pc.top && y <= pc.shelfY + 26 * pc.s) return i;
    }
    return -1;
  };
  R.critterAt = function (x, y) {
    for (var i = hot.length - 1; i >= 0; i--) {
      var hz = hot[i], dx = x - hz.x, dy = y - hz.y;
      if (dx * dx + dy * dy <= hz.r * hz.r) return hz.id;
    }
    return null;
  };

  BB.Render = R;
})(typeof window !== 'undefined' ? window : globalThis);
