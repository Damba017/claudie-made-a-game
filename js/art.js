/*
 * Barn Bloom - art.js
 * ------------------------------------------------------------------
 * All procedural drawings: plants (every species, every stage, with
 * wilting), pots, nutrient bottles, critters and small props.
 * Flat-vector style on Canvas 2D. Pure drawing, no game state changes.
 *
 * Plants and pots are drawn in "unit space": the pot is 80 units wide,
 * the origin is the centre of the soil surface and up is negative y.
 */
(function (root) {
  'use strict';
  var BB = root.BB = root.BB || {};
  var C = BB.CONFIG, L = BB.Logic, PAL = C.PALETTE;
  var Art = {};
  var PI = Math.PI;

  // ==================================================================
  // Colour and shape helpers
  // ==================================================================
  var rgbCache = {};
  function rgb(hex) {
    var c = rgbCache[hex];
    if (!c) {
      var n = parseInt(hex.slice(1), 16);
      c = rgbCache[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    return c;
  }
  function clamp01(t) { return t < 0 ? 0 : (t > 1 ? 1 : t); }
  function mix(a, b, t) {
    var x = rgb(a), y = rgb(b);
    t = clamp01(t);
    return 'rgb(' + Math.round(x[0] + (y[0] - x[0]) * t) + ',' + Math.round(x[1] + (y[1] - x[1]) * t) + ',' +
      Math.round(x[2] + (y[2] - x[2]) * t) + ')';
  }
  function rgba(hex, a) { var c = rgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  /** Deterministic pseudo-random 0..1 from a number, for stable variation. */
  function rnd(seed) { var x = Math.sin(seed * 127.1 + 11.7) * 43758.5453; return x - Math.floor(x); }

  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0, r), 0, PI * 2); c.fill(); }
  function ellipse(c, x, y, rx, ry, rot) {
    c.beginPath(); c.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot || 0, 0, PI * 2); c.fill();
  }
  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }
  function line(c, x1, y1, x2, y2) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
  /** A pointed leaf / petal starting at (x, y) and pointing along `angle`. */
  function leaf(c, x, y, angle, len, wid) {
    c.save(); c.translate(x, y); c.rotate(angle);
    c.beginPath(); c.moveTo(0, 0);
    c.quadraticCurveTo(len * 0.45, -wid, len, 0);
    c.quadraticCurveTo(len * 0.45, wid, 0, 0);
    c.fill(); c.restore();
  }
  function star(c, x, y, r, points, inner) {
    points = points || 5; inner = inner || 0.45;
    c.beginPath();
    for (var i = 0; i < points * 2; i++) {
      var rad = i % 2 ? r * inner : r, a = -PI / 2 + i * PI / points;
      c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    c.closePath(); c.fill();
  }
  /** Shape-coded marker so nutrients never rely on colour alone. */
  function shape(c, kind, x, y, r) {
    c.beginPath();
    if (kind === 'square') c.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
    else if (kind === 'triangle') { c.moveTo(x, y - r); c.lineTo(x + r, y + r * 0.8); c.lineTo(x - r, y + r * 0.8); c.closePath(); }
    else if (kind === 'diamond') { c.moveTo(x, y - r * 1.15); c.lineTo(x + r, y); c.lineTo(x, y + r * 1.15); c.lineTo(x - r, y); c.closePath(); }
    else if (kind === 'star') { star(c, x, y, r * 1.2, 5, 0.45); return; }
    else c.arc(x, y, r, 0, PI * 2);
    c.fill();
  }

  Art.mix = mix; Art.rgba = rgba; Art.rnd = rnd; Art.circle = circle; Art.ellipse = ellipse; Art.rr = rr;
  Art.line = line; Art.leaf = leaf; Art.star = star; Art.shape = shape;

  // ==================================================================
  // Pots
  // ==================================================================
  /** Draws a pot. wet 0..1 darkens the soil. */
  Art.drawPot = function (c, style, wet) {
    c.fillStyle = 'rgba(0,0,0,0.2)';
    ellipse(c, 0, 62, 36, 4.5);
    function body() {
      c.beginPath(); c.moveTo(-33, 9); c.lineTo(33, 9); c.lineTo(26, 60);
      c.quadraticCurveTo(0, 64, -26, 60); c.closePath();
    }
    c.fillStyle = style.body; body(); c.fill();
    if (style.stripes) {
      c.save(); body(); c.clip();
      c.strokeStyle = style.stripes; c.lineWidth = 6;
      for (var x = -70; x < 60; x += 17) line(c, x, 64, x + 40, 6);
      c.restore();
    }
    c.fillStyle = rgba(style.shade, 0.55);
    c.beginPath(); c.moveTo(12, 9); c.lineTo(33, 9); c.lineTo(26, 60); c.lineTo(9, 62); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.2)';
    c.beginPath(); c.moveTo(-28, 14); c.lineTo(-22, 14); c.lineTo(-19, 54); c.lineTo(-23, 54); c.closePath(); c.fill();
    c.fillStyle = style.rim; rr(c, -39, -3, 78, 14, 5); c.fill();
    c.fillStyle = rgba(style.shade, 0.5); rr(c, -39, 6, 78, 5, 2.5); c.fill();
    c.fillStyle = mix(PAL.soilLight, PAL.soil, 0.25 + 0.75 * clamp01(wet));
    ellipse(c, 0, 1, 33, 4.6);
    c.fillStyle = 'rgba(255,255,255,0.07)';
    ellipse(c, -10, 0, 12, 1.6);
  };

  // ==================================================================
  // Plants
  // ==================================================================
  // Approximate full-grown height in units, used to place indicators.
  var HEIGHT = { mint: 78, fern: 82, cactus: 88, sunflower: 146, berry: 70, shroom: 62, orchid: 122, lotus: 84 };

  Art.plantHeight = function (p) {
    if (p.dead) return 30;
    var k = Math.max(0, (p.growth - C.GROWTH.sproutAt) / (1 - C.GROWTH.sproutAt));
    return 14 + HEIGHT[p.species] * Math.pow(k, 0.85);
  };

  /** How droopy a plant looks: 0 perky .. 1 collapsed. */
  Art.wiltOf = function (p) {
    if (p.dead) return 1;
    var fit = L.waterFit(C.SPECIES_BY_ID[p.species], p.water);
    return clamp01((1 - fit) * 0.9 + (1 - p.health / 100) * 0.65);
  };

  function tint(P, hex) {
    if (P.silhouette) return P.silhouette;
    var c = rgb(hex), r = c[0], g = c[1], b = c[2], t, o;
    function to(target, amt) { o = rgb(target); r += (o[0] - r) * amt; g += (o[1] - g) * amt; b += (o[2] - b) * amt; }
    if (P.dead) to(PAL.dead, 0.85);
    else {
      t = P.wilt * 0.7; if (t > 0) to(PAL.wilt, t);
      if (P.over > 0) to('#8f7f4a', P.over * 0.4);
      if (P.golden) to(PAL.gold, 0.5);
    }
    return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
  }

  /** Curved stem from (x0, 0); returns a function giving points along it (t = 0..1). */
  function stem(P, x0, h, lean, width, color) {
    var c = P.ctx, d = P.droop, side = lean >= 0 ? 1 : -1;
    var tx = x0 + lean * h + P.sway * h + side * d * h * 0.45;
    var ty = -h * (1 - d * 0.5);
    var cx = x0 + lean * h * 0.2, cy = -h * 0.75 * (1 - d * 0.15);
    c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x0, 0); c.quadraticCurveTo(cx, cy, tx, ty); c.stroke();
    return function (t) {
      var a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, e = t * t;
      return { x: a * x0 + b * cx + e * tx, y: b * cy + e * ty };
    };
  }
  /** Leaf angle for a leaf on the right (side 1) or left (side -1), drooping with wilt. */
  function leafAng(P, side, up) {
    return side > 0 ? -up + P.droop * 1.1 + P.sway * 2 : PI + up - P.droop * 1.1 + P.sway * 2;
  }

  function drawSeed(P) {
    var c = P.ctx, a = clamp01(P.g / C.GROWTH.sproutAt);
    c.fillStyle = P.silhouette || PAL.soilLight; ellipse(c, 0, -1, 12, 4);
    c.fillStyle = P.silhouette || P.pal.seed; ellipse(c, 0, -3.5, 4.2, 3, 0.4);
    if (a > 0.35) {
      c.strokeStyle = tint(P, P.pal.leaf); c.lineWidth = 1.8; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, -5); c.quadraticCurveTo(3, -7 - a * 4, 1, -7 - a * 8); c.stroke();
      c.fillStyle = tint(P, P.pal.leaf);
      leaf(c, 1, -7 - a * 8, -0.5, 3 + a * 3, 1.6);
    }
  }

  var SPECIES_ART = {};

  SPECIES_ART.mint = function (P) {
    var c = P.ctx, k = P.k, n = 2 + Math.floor(k * 3.2);
    for (var j = 0; j < n; j++) {
      var f = n === 1 ? 0 : (j / (n - 1)) * 2 - 1;
      var h = (20 + 52 * k) * (0.78 + 0.22 * rnd(P.seed + j * 3.1));
      var pt = stem(P, f * 7, h, f * 0.38, 2.4, tint(P, P.pal.leaf2));
      var pairs = 1 + Math.floor(k * 3.6);
      for (var m = 0; m < pairs; m++) {
        var t = (m + 1) / (pairs + 0.4), q = pt(t), size = (6 + 6 * k) * (1 - t * 0.25);
        c.fillStyle = tint(P, m % 2 ? P.pal.leaf : P.pal.leaf2);
        leaf(c, q.x, q.y, leafAng(P, 1, 0.5), size * 1.5, size * 0.7);
        leaf(c, q.x, q.y, leafAng(P, -1, 0.5), size * 1.5, size * 0.7);
      }
      var tip = pt(1);
      c.fillStyle = tint(P, P.pal.leaf);
      leaf(c, tip.x, tip.y, -PI / 2 + f * 0.4 + P.droop * (f || 0.5) * 1.5, 8 + 5 * k, 3.5 + 2 * k);
      if (P.mature) {
        c.fillStyle = tint(P, P.pal.accent);
        for (var s = 0; s < 3; s++) circle(c, tip.x + f * s * 1.4, tip.y - 5 - s * 4.4 * (1 - P.droop * 0.6), 3.3 - s * 0.7);
      }
    }
  };

  SPECIES_ART.fern = function (P) {
    var c = P.ctx, k = P.k, n = 3 + Math.floor(k * 6.2), d = P.droop;
    var order = [];
    for (var j = 0; j < n; j++) order.push(n === 1 ? 0 : (j / (n - 1)) * 2 - 1);
    order.sort(function (a, b) { return Math.abs(b) - Math.abs(a); });
    for (var o = 0; o < order.length; o++) {
      var f = order[o], ang = f * 1.15;
      var len = (22 + 62 * k) * (0.82 + 0.18 * rnd(P.seed + o * 2.7)) * (1 - Math.abs(f) * 0.15);
      var x0 = f * 4, y0 = 0;
      var x2 = Math.sin(ang) * len + P.sway * len;
      var y2 = -Math.cos(ang) * len * (1 - d * 0.7) + Math.abs(f) * len * 0.25 + d * len * 0.3;
      var cx = Math.sin(ang) * len * 0.35, cy = -len * 0.78 * (1 - d * 0.3);
      c.strokeStyle = tint(P, P.pal.leaf2); c.lineWidth = 1.7; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(cx, cy, x2, y2); c.stroke();
      var m = 5 + Math.floor(k * 5);
      for (var i = 0; i < m; i++) {
        var t = (i + 1) / (m + 1), a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, e = t * t;
        var px = a * x0 + b * cx + e * x2, py = a * y0 + b * cy + e * y2;
        var dx = 2 * (1 - t) * (cx - x0) + 2 * t * (x2 - cx), dy = 2 * (1 - t) * (cy - y0) + 2 * t * (y2 - cy);
        var ta = Math.atan2(dy, dx), size = (4.5 + 7 * k) * Math.pow(Math.sin(PI * (0.12 + t * 0.85)), 0.7);
        c.fillStyle = tint(P, i % 2 ? P.pal.leaf : (t > 0.75 ? P.pal.accent : P.pal.leaf2));
        leaf(c, px, py, ta + 1.15, size * 1.25, size * 0.36);
        leaf(c, px, py, ta - 1.15, size * 1.25, size * 0.36);
      }
      if (k < 0.5) {
        c.strokeStyle = tint(P, P.pal.leaf); c.lineWidth = 1.6;
        c.beginPath(); c.arc(x2 + (f >= 0 ? 2.5 : -2.5), y2 + 1, 2.6, 0, PI * 1.6); c.stroke();
      }
    }
  };

  SPECIES_ART.cactus = function (P) {
    var c = P.ctx, k = P.k;
    var W = (15 + 15 * k) * (1 - P.wilt * 0.22), H = 16 + 64 * k;
    var body = tint(P, P.pal.leaf), dark = tint(P, P.pal.leaf2);
    c.save();
    c.rotate(P.dead ? 0.4 : P.sway * 0.5 + P.droop * 0.14);
    function arm(side, y, a) {
      var len = 7 + 9 * a, up = 8 + 17 * a, aw = W * 0.42;
      var x0 = side > 0 ? W / 2 - 3 : -W / 2 + 3 - len;
      c.fillStyle = body;
      rr(c, x0, -y - aw / 2, len, aw, aw / 2); c.fill();
      var ax = side > 0 ? x0 + len - aw : x0;
      rr(c, ax, -y - up, aw, up + aw / 2, aw / 2); c.fill();
      c.strokeStyle = dark; c.lineWidth = 1.2;
      line(c, ax + aw / 2, -y - up + aw * 0.6, ax + aw / 2, -y - 2);
      if (P.mature && side < 0) { c.fillStyle = tint(P, P.pal.accent); circle(c, ax + aw / 2, -y - up - 1, 3.2); }
    }
    if (k > 0.45) arm(-1, H * 0.42, (k - 0.45) / 0.55);
    if (k > 0.68) arm(1, H * 0.58, (k - 0.68) / 0.32);
    c.fillStyle = body; rr(c, -W / 2, -H, W, H + 4, W / 2); c.fill();
    c.strokeStyle = dark; c.lineWidth = 1.5; c.lineCap = 'round';
    line(c, -W * 0.24, -H + W * 0.42, -W * 0.24, -3);
    line(c, W * 0.24, -H + W * 0.42, W * 0.24, -3);
    // spines
    c.strokeStyle = P.silhouette || 'rgba(255,255,255,0.75)'; c.lineWidth = 1;
    var spines = Math.floor(H / 11);
    for (var i = 0; i < spines; i++) {
      var sy = -6 - i * 11;
      line(c, -W / 2, sy, -W / 2 - 3.5, sy - 2);
      line(c, W / 2, sy - 5, W / 2 + 3.5, sy - 7);
    }
    // the famous grumpy face
    if (k > 0.22 && !P.silhouette) {
      var ey = -H * 0.66, ex = W * 0.2;
      c.fillStyle = PAL.ink;
      if (P.dead) {
        c.strokeStyle = PAL.ink; c.lineWidth = 1.3;
        line(c, -ex - 1.5, ey - 1.5, -ex + 1.5, ey + 1.5); line(c, -ex + 1.5, ey - 1.5, -ex - 1.5, ey + 1.5);
        line(c, ex - 1.5, ey - 1.5, ex + 1.5, ey + 1.5); line(c, ex + 1.5, ey - 1.5, ex - 1.5, ey + 1.5);
      } else {
        circle(c, -ex, ey, 1.5); circle(c, ex, ey, 1.5);
        c.strokeStyle = PAL.ink; c.lineWidth = 1.4;
        line(c, -ex - 3, ey - 4.6, -ex + 2.4, ey - 2.6);
        line(c, ex + 3, ey - 4.6, ex - 2.4, ey - 2.6);
        c.beginPath(); c.arc(0, ey + 6.5, 2.6, PI * 1.15, PI * 1.85); c.stroke();
        if (P.mature) { c.fillStyle = 'rgba(255,120,150,0.5)'; circle(c, -ex - 2.5, ey + 3, 2); circle(c, ex + 2.5, ey + 3, 2); }
      }
    }
    if (P.mature) {
      c.fillStyle = tint(P, P.pal.accent);
      for (var a = 0; a < 5; a++) circle(c, Math.cos(a * 1.257) * 3.6, -H - 2 + Math.sin(a * 1.257) * 3.2, 3.2);
      c.fillStyle = tint(P, '#ffe27a'); circle(c, 0, -H - 2, 2.2);
    }
    c.restore();
  };

  SPECIES_ART.sunflower = function (P) {
    var c = P.ctx, k = P.k, H = 18 + 110 * k;
    var pt = stem(P, 0, H, 0.03, 3 + 2.2 * k, tint(P, P.pal.leaf2));
    var n = 2 + Math.floor(k * 4);
    for (var i = 0; i < n; i++) {
      var t = (i + 0.7) / (n + 1.2), q = pt(t), side = i % 2 ? 1 : -1, size = (10 + 16 * k) * (1 - t * 0.3);
      c.fillStyle = tint(P, i % 2 ? P.pal.leaf : P.pal.leaf2);
      leaf(c, q.x, q.y, leafAng(P, side, 0.35), size * 1.5, size * 0.6);
    }
    if (k <= 0.5) {
      var top = pt(1);
      c.fillStyle = tint(P, P.pal.leaf);
      leaf(c, top.x, top.y, -PI / 2 - 0.5, 9 + 8 * k, 4); leaf(c, top.x, top.y, -PI / 2 + 0.5, 9 + 8 * k, 4);
      return;
    }
    var hk = (k - 0.5) / 0.5, r = 6 + 13 * hk, tip = pt(1);
    c.save(); c.translate(tip.x, tip.y);
    c.rotate(P.headTilt + P.droop * 1.0);
    if (!P.mature) {
      c.fillStyle = tint(P, P.pal.leaf);
      for (var s = 0; s < 6; s++) leaf(c, 0, 0, s * PI / 3, r * 1.1, r * 0.4);
      circle(c, 0, 0, r * 0.8);
      c.fillStyle = tint(P, P.pal.accent); circle(c, 0, -r * 0.1, r * 0.5 * hk);
    } else {
      for (var a = 0; a < 16; a++) {
        c.fillStyle = tint(P, a % 2 ? P.pal.accent : '#f5b52b');
        var ang = a * PI / 8 + (a % 2 ? 0.1 : 0);
        leaf(c, Math.cos(ang) * r * 0.5, Math.sin(ang) * r * 0.5, ang, r * 0.95, r * 0.26);
      }
      c.fillStyle = tint(P, '#6b4226'); circle(c, 0, 0, r * 0.62);
      c.fillStyle = tint(P, '#84552f'); circle(c, 0, 0, r * 0.46);
      if (!P.silhouette && !P.dead) {
        c.strokeStyle = PAL.ink; c.fillStyle = PAL.ink; c.lineWidth = 1.3; c.lineCap = 'round';
        if (P.asleep) {
          c.beginPath(); c.arc(-r * 0.2, -r * 0.08, 1.8, 0.15, PI - 0.15); c.stroke();
          c.beginPath(); c.arc(r * 0.2, -r * 0.08, 1.8, 0.15, PI - 0.15); c.stroke();
        } else {
          circle(c, -r * 0.2, -r * 0.1, 1.5); circle(c, r * 0.2, -r * 0.1, 1.5);
          c.beginPath(); c.arc(0, r * 0.05, r * 0.2, 0.2, PI - 0.2); c.stroke();
        }
      }
    }
    c.restore();
  };

  SPECIES_ART.berry = function (P) {
    var c = P.ctx, k = P.k, R = 16 + 36 * k, j, i;
    for (j = -1; j <= 1; j++) stem(P, j * 4, R * 0.85, j * 0.45, 2.2, tint(P, '#7a5a3a'));
    var n = 7 + Math.floor(k * 17);
    for (i = 0; i < n; i++) {
      var a = rnd(P.seed + i * 1.37) * PI, rad = R * (0.25 + 0.75 * Math.sqrt(rnd(P.seed + i * 2.3)));
      var x = Math.cos(a) * rad * 1.05 + P.sway * rad, y = -Math.sin(a) * rad * (1 - P.droop * 0.45) - 6;
      c.fillStyle = tint(P, i % 3 === 0 ? P.pal.leaf2 : P.pal.leaf);
      leaf(c, x, y, -a + P.droop * (Math.cos(a) >= 0 ? 0.9 : -0.9), 9 + 6 * k, 4 + 2.5 * k);
    }
    if (!P.mature && k > 0.6) {
      c.fillStyle = tint(P, '#fff6ee');
      for (i = 0; i < 4; i++) {
        var fa = rnd(P.seed + i * 5.1) * PI, fr = R * (0.5 + 0.4 * rnd(P.seed + i * 7.7));
        circle(c, Math.cos(fa) * fr, -Math.sin(fa) * fr - 6, 2.6);
      }
    }
    if (P.mature) {
      var count = 3 + (P.fruit || 1) * 2;
      for (i = 0; i < count; i++) {
        var ba = 0.25 + rnd(P.seed + i * 3.9) * (PI - 0.5), br = R * (0.45 + 0.5 * rnd(P.seed + i * 6.1));
        var bx = Math.cos(ba) * br + P.sway * br, by = -Math.sin(ba) * br * (1 - P.droop * 0.45) - 3;
        c.fillStyle = tint(P, P.pal.accent); circle(c, bx, by, 4.4);
        c.fillStyle = tint(P, '#a81f52'); circle(c, bx + 1.2, by + 1.2, 2.4);
        if (!P.silhouette) { c.fillStyle = 'rgba(255,255,255,0.7)'; circle(c, bx - 1.4, by - 1.5, 1.1); }
      }
    }
  };

  SPECIES_ART.shroom = function (P) {
    var c = P.ctx, k = P.k, n = 1 + Math.floor(k * 3.4);
    var xs = [0, 17, -18, 30, -31], hs = [1, 0.72, 0.82, 0.5, 0.55];
    for (var j = n - 1; j >= 0; j--) {
      var h = (8 + 36 * k) * hs[j], r = (7 + 14 * k) * (0.75 + 0.25 * hs[j]), x = xs[j] * (0.5 + 0.5 * k);
      var side = j % 2 ? 1 : -1, bend = side * 3 + P.sway * h + side * P.droop * h * 0.3;
      var topY = -h * (1 - P.droop * 0.35);
      c.strokeStyle = tint(P, P.pal.leaf); c.lineWidth = 5 + 2 * k; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x, 0); c.quadraticCurveTo(x, topY * 0.6, x + bend, topY); c.stroke();
      c.save(); c.translate(x + bend, topY); c.rotate(bend * 0.03 + side * P.droop * 0.45);
      var capH = r * (0.9 - P.wilt * 0.35);
      c.fillStyle = tint(P, P.pal.leaf2);
      ellipse(c, 0, 0.5, r * 0.9, r * 0.2);
      c.fillStyle = tint(P, P.pal.accent);
      c.beginPath(); c.moveTo(-r, 0); c.bezierCurveTo(-r, -capH * 1.35, r, -capH * 1.35, r, 0);
      c.quadraticCurveTo(0, r * 0.22, -r, 0); c.fill();
      c.fillStyle = P.silhouette || (P.dead ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.65)');
      circle(c, -r * 0.4, -capH * 0.45, r * 0.16); circle(c, r * 0.3, -capH * 0.62, r * 0.12); circle(c, r * 0.5, -capH * 0.25, r * 0.1);
      c.restore();
      if (P.glow && !P.dead) P.glow(x + bend, topY - capH * 0.4, r * 3.4, P.pal.accent, (0.14 + 0.5 * P.night) * k * (1 - P.wilt));
    }
  };

  function orchidBloom(P, x, y, r) {
    var c = P.ctx;
    c.save(); c.translate(x, y); c.rotate(P.sway * 2 + P.droop * 0.6);
    c.fillStyle = tint(P, '#ead7ff');
    leaf(c, 0, 0, -PI / 2, r * 1.25, r * 0.32);
    leaf(c, 0, 0, PI / 2 + 0.95, r * 1.2, r * 0.32);
    leaf(c, 0, 0, PI / 2 - 0.95, r * 1.2, r * 0.32);
    c.fillStyle = tint(P, P.pal.accent);
    leaf(c, 0, 0, -0.25, r * 1.2, r * 0.6);
    leaf(c, 0, 0, PI + 0.25, r * 1.2, r * 0.6);
    c.fillStyle = tint(P, '#a63f9a'); leaf(c, 0, 1, PI / 2, r * 0.75, r * 0.42);
    c.fillStyle = tint(P, '#ffe27a'); circle(c, 0, 0, r * 0.2);
    c.restore();
  }

  SPECIES_ART.orchid = function (P) {
    var c = P.ctx, k = P.k, nl = 2 + Math.floor(k * 2.5), i;
    for (i = 0; i < nl; i++) {
      var side = i % 2 ? 1 : -1, len = (18 + 26 * k) * (1 - 0.12 * i);
      var ang = side > 0 ? -0.45 + i * 0.12 + P.droop * 0.6 : PI + 0.45 - i * 0.12 - P.droop * 0.6;
      c.fillStyle = tint(P, i % 2 ? P.pal.leaf : P.pal.leaf2);
      leaf(c, side * 2, -2, ang, len, 5 + 3.5 * k);
    }
    if (k <= 0.25) return;
    var sk = (k - 0.25) / 0.75, H = 20 + 92 * sk;
    if (!P.silhouette) { c.strokeStyle = '#c9a877'; c.lineWidth = 1.6; line(c, -3, 0, -3, -H * 0.78); }
    var pt = stem(P, 0, H, 0.32, 2, tint(P, P.pal.leaf2));
    if (sk < 0.45) return;
    for (i = 0; i < 4; i++) {
      var q = pt(0.55 + i * 0.15);
      if (P.mature) orchidBloom(P, q.x, q.y + 4, 9.5 - i * 0.9);
      else { c.fillStyle = tint(P, i % 2 ? P.pal.accent : P.pal.leaf); ellipse(c, q.x, q.y + 3, 2.6, 4, 0.3); }
    }
  };

  SPECIES_ART.lotus = function (P) {
    var c = P.ctx, k = P.k, np = 1 + Math.floor(k * 2.4), i;
    var px = [-24, 25, -4], py = [10, 14, 6];
    for (i = 0; i < np; i++) {
      var x = px[i] * (0.6 + 0.4 * k), y = -py[i] * k * (1 - P.droop * 0.6) - 3, r = (9 + 9 * k) * (1 - 0.12 * i);
      c.strokeStyle = tint(P, P.pal.leaf2); c.lineWidth = 1.8; line(c, x * 0.3, 0, x, y);
      c.fillStyle = tint(P, i % 2 ? P.pal.leaf2 : P.pal.leaf);
      c.beginPath(); c.ellipse(x, y, r, r * 0.42, P.droop * (x > 0 ? 0.5 : -0.5), 0.35, PI * 2 - 0.35); c.lineTo(x, y); c.closePath(); c.fill();
    }
    if (k <= 0.3) return;
    var bk = (k - 0.3) / 0.7, H = 14 + 40 * bk;
    var tip = stem(P, 0, H, 0.02, 2.6, tint(P, P.pal.leaf2))(1);
    c.save(); c.translate(tip.x, tip.y); c.rotate(P.droop * 0.9 + P.sway);
    if (!P.mature) {
      var s = 5 + 9 * bk;
      c.fillStyle = tint(P, bk > 0.4 ? P.pal.accent : P.pal.leaf);
      c.beginPath(); c.moveTo(0, -s * 1.6);
      c.bezierCurveTo(s, -s * 0.4, s * 0.7, s * 0.5, 0, s * 0.5);
      c.bezierCurveTo(-s * 0.7, s * 0.5, -s, -s * 0.4, 0, -s * 1.6); c.fill();
    } else {
      var Rb = 22, a;
      c.fillStyle = tint(P, '#ffd3f0');
      for (a = -2; a <= 2; a++) leaf(c, 0, 0, -PI / 2 + a * 0.58, Rb * 1.05, Rb * 0.26);
      c.fillStyle = tint(P, P.pal.accent);
      for (a = -1.5; a <= 1.5; a++) leaf(c, 0, 0, -PI / 2 + a * 0.52, Rb * 0.9, Rb * 0.26);
      c.fillStyle = tint(P, '#ff7fd0');
      for (a = -1; a <= 1; a++) leaf(c, 0, 0, -PI / 2 + a * 0.4, Rb * 0.7, Rb * 0.24);
      c.fillStyle = tint(P, '#ffe27a'); circle(c, 0, -3, 3.6);
      if (!P.silhouette && !P.dead) {
        c.fillStyle = '#fff8cf';
        for (i = 0; i < 4; i++) {
          var oa = P.t * 0.8 + i * PI / 2;
          star(c, Math.cos(oa) * Rb * 1.3, -Rb * 0.55 + Math.sin(oa) * Rb * 0.6, 2.2 + Math.sin(P.t * 3 + i) * 1.1, 4, 0.35);
        }
      }
    }
    c.restore();
    if (P.glow && !P.dead) P.glow(tip.x, tip.y - 8, 60 * bk, P.mature ? P.pal.accent : '#7ad8ff', (0.12 + 0.35 * P.night) * bk);
  };

  /**
   * Draws a plant in unit space (origin = soil centre).
   * o: { seed, t, sway, night, dayProg, glow(x, y, r, color, alpha), silhouette }
   */
  Art.drawPlant = function (c, p, o) {
    var sp = C.SPECIES_BY_ID[p.species];
    var g = p.growth;
    var wilt = Art.wiltOf(p);
    var over = 0;
    if (g >= 1 && !p.dead) {
      var prime = L.primeWindow(sp);
      over = clamp01((p.ripeAge - prime) / prime);
    }
    var P = {
      ctx: c, g: g, k: g < C.GROWTH.sproutAt ? 0 : Math.pow((g - C.GROWTH.sproutAt) / (1 - C.GROWTH.sproutAt), 0.85),
      mature: g >= 1, wilt: wilt, droop: p.dead ? 1 : Math.min(1, wilt * 0.9 + over * 0.25), dead: p.dead, over: over,
      golden: p.golden && g >= 1, t: o.t || 0, sway: p.dead ? 0 : (o.sway || 0), seed: o.seed || 0,
      pal: sp.colors, night: o.night || 0, glow: o.glow, silhouette: o.silhouette || null,
      fruit: p.harvestsLeft || 1, asleep: (o.night || 0) > 0.35,
      headTilt: o.dayProg === undefined || o.dayProg === null ? 0 : (o.dayProg - 0.5) * 0.7
    };
    if (P.asleep) P.headTilt = 0.35;
    c.save();
    if (p.dead) c.scale(1, 0.78);
    else if (o.t) c.scale(1, 1 + Math.sin(o.t * 2 + P.seed) * 0.012);
    if (g < C.GROWTH.sproutAt) drawSeed(P);
    else SPECIES_ART[p.species](P);
    c.restore();
  };

  // ==================================================================
  // Small props and indicators (unit space or pixel space, see callers)
  // ==================================================================
  Art.droplet = function (c, x, y, r, filled, color) {
    c.beginPath();
    c.moveTo(x, y - r * 1.5);
    c.bezierCurveTo(x + r * 1.3, y - r * 0.1, x + r, y + r, x, y + r);
    c.bezierCurveTo(x - r, y + r, x - r * 1.3, y - r * 0.1, x, y - r * 1.5);
    if (filled) { c.fillStyle = color; c.fill(); }
    else { c.fillStyle = 'rgba(255,255,255,0.9)'; c.fill(); c.strokeStyle = color; c.lineWidth = r * 0.36; c.stroke(); }
  };

  Art.bug = function (c, x, y, s, t) {
    c.save(); c.translate(x, y); c.scale(s, s); c.rotate(Math.sin(t * 6) * 0.25);
    c.strokeStyle = '#3a1f3a'; c.lineWidth = 1.2; c.lineCap = 'round';
    for (var i = -1; i <= 1; i++) { line(c, i * 3, 0, i * 4.5, 6 + Math.sin(t * 20 + i) * 1.2); line(c, i * 3, 0, i * 4.5, -6 - Math.sin(t * 20 + i) * 1.2); }
    c.fillStyle = '#7b3fa0'; ellipse(c, 0, 0, 6.5, 4.6);
    c.fillStyle = '#5a2a7a'; ellipse(c, 5.5, 0, 3, 3.2);
    c.fillStyle = '#fff'; circle(c, 6.4, -1.4, 1.1); circle(c, 6.4, 1.4, 1.1);
    c.restore();
  };

  Art.heart = function (c, x, y, r) {
    c.beginPath(); c.moveTo(x, y + r * 0.9);
    c.bezierCurveTo(x - r * 1.5, y - r * 0.2, x - r * 0.7, y - r * 1.2, x, y - r * 0.4);
    c.bezierCurveTo(x + r * 0.7, y - r * 1.2, x + r * 1.5, y - r * 0.2, x, y + r * 0.9);
    c.fill();
  };

  Art.wateringCan = function (c, x, y, s, tilt) {
    c.save(); c.translate(x, y); c.scale(s, s); c.rotate(tilt);
    c.fillStyle = '#6fb2c9'; rr(c, -11, -9, 22, 20, 4); c.fill();
    c.fillStyle = '#5797ae'; rr(c, -11, 5, 22, 6, 3); c.fill();
    c.strokeStyle = '#6fb2c9'; c.lineWidth = 4; c.lineCap = 'round';
    line(c, -10, 2, -24, -10);
    c.fillStyle = '#5797ae'; ellipse(c, -25, -11, 4.5, 3, -0.7);
    c.strokeStyle = '#4c8499'; c.lineWidth = 3;
    c.beginPath(); c.arc(13, 0, 8, -PI / 2, PI / 2); c.stroke();
    c.restore();
  };

  /** The water tank barrel. level 0..1. Drawn with its base centre at (x, y). */
  Art.barrel = function (c, x, y, s, level) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.fillStyle = 'rgba(0,0,0,0.22)'; ellipse(c, 0, 0, 26, 5);
    c.fillStyle = PAL.woodMid;
    c.beginPath(); c.moveTo(-20, 0); c.quadraticCurveTo(-27, -27, -20, -54); c.lineTo(20, -54);
    c.quadraticCurveTo(27, -27, 20, 0); c.closePath(); c.fill();
    c.strokeStyle = PAL.woodDark; c.lineWidth = 1;
    for (var i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 9, 0); c.quadraticCurveTo(i * 12, -27, i * 9, -54); c.stroke(); }
    c.strokeStyle = '#7d8790'; c.lineWidth = 3.5;
    c.beginPath(); c.moveTo(-23, -13); c.quadraticCurveTo(0, -10, 23, -13); c.stroke();
    c.beginPath(); c.moveTo(-23, -41); c.quadraticCurveTo(0, -38, 23, -41); c.stroke();
    c.fillStyle = PAL.waterDark; ellipse(c, 0, -54, 20, 4.5);
    c.fillStyle = PAL.water; ellipse(c, 0, -54, 17 * (0.35 + 0.65 * clamp01(level)), 3.4 * (0.35 + 0.65 * clamp01(level)));
    // glass gauge
    c.fillStyle = 'rgba(30,40,60,0.55)'; rr(c, -4, -36, 8, 21, 3); c.fill();
    var lh = 17 * clamp01(level);
    c.fillStyle = PAL.water; rr(c, -2, -17 - lh, 4, lh, 1.5); c.fill();
    // tap
    c.fillStyle = '#c9a23f'; c.fillRect(20, -22, 8, 3.5); c.fillRect(26, -22, 3, 7);
    c.restore();
  };

  // ==================================================================
  // Critters. All drawn with their feet / base at (x, y).
  // ==================================================================
  Art.cat = function (c, x, y, s, o) {
    // o: { t, walking, dir, happy, blink }
    c.save(); c.translate(x, y); c.scale(s * (o.dir < 0 ? -1 : 1), s);
    var fur = '#e59a4c', dark = '#c97a30', white = '#fff3e0', t = o.t;
    c.fillStyle = 'rgba(0,0,0,0.2)'; ellipse(c, 0, 0, 22, 4);
    if (o.walking) {
      var step = Math.sin(t * 10);
      c.strokeStyle = fur; c.lineWidth = 5; c.lineCap = 'round';
      line(c, -11, -12, -11 + step * 5, -1); line(c, -5, -12, -5 - step * 5, -1);
      line(c, 9, -12, 9 - step * 5, -1); line(c, 14, -12, 14 + step * 5, -1);
      c.strokeStyle = dark; c.lineWidth = 4;
      c.beginPath(); c.moveTo(-15, -17); c.quadraticCurveTo(-26, -22, -24, -34 + step * 2); c.stroke();
      c.fillStyle = fur; rr(c, -17, -24, 36, 15, 7.5); c.fill();
      c.fillStyle = dark; for (var i = 0; i < 3; i++) c.fillRect(-9 + i * 7, -24, 2.6, 6);
      c.translate(20, -24);
    } else {
      var sw = Math.sin(t * 2.2) * 5;
      c.strokeStyle = dark; c.lineWidth = 4.5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-10, -4); c.quadraticCurveTo(-26, -2, -24 + sw * 0.5, -16 - sw); c.stroke();
      c.fillStyle = fur;
      c.beginPath(); c.moveTo(-13, 0); c.quadraticCurveTo(-16, -26, 0, -28); c.quadraticCurveTo(15, -26, 13, 0); c.closePath(); c.fill();
      c.fillStyle = white; ellipse(c, 2, -9, 6, 9);
      c.fillStyle = dark; c.fillRect(-11, -18, 5, 2.4); c.fillRect(-12, -12, 5, 2.4);
      c.fillStyle = white; ellipse(c, -3, -1, 4, 2.4); ellipse(c, 7, -1, 4, 2.4);
      c.translate(2, -32);
    }
    // head
    c.fillStyle = fur;
    c.beginPath(); c.moveTo(-10, -5); c.lineTo(-8, -17); c.lineTo(-1, -9); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(10, -5); c.lineTo(8, -17); c.lineTo(1, -9); c.closePath(); c.fill();
    circle(c, 0, 0, 11);
    c.fillStyle = '#f7b7b0';
    c.beginPath(); c.moveTo(-7.5, -8); c.lineTo(-7, -13.5); c.lineTo(-3.5, -9.5); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(7.5, -8); c.lineTo(7, -13.5); c.lineTo(3.5, -9.5); c.closePath(); c.fill();
    c.fillStyle = white; ellipse(c, 0, 4, 6, 4.5);
    c.fillStyle = dark; c.fillRect(-1.2, -11, 2.4, 5); c.fillRect(-5, -10, 2, 3.5); c.fillRect(3, -10, 2, 3.5);
    c.strokeStyle = PAL.ink; c.fillStyle = PAL.ink; c.lineWidth = 1.4; c.lineCap = 'round';
    if (o.happy || o.blink) {
      c.beginPath(); c.arc(-4.2, -1, 2, PI * 1.1, PI * 1.9); c.stroke();
      c.beginPath(); c.arc(4.2, -1, 2, PI * 1.1, PI * 1.9); c.stroke();
    } else { ellipse(c, -4.2, -1, 1.5, 2.1); ellipse(c, 4.2, -1, 1.5, 2.1); }
    c.fillStyle = '#e8837e';
    c.beginPath(); c.moveTo(-1.5, 2.5); c.lineTo(1.5, 2.5); c.lineTo(0, 4.2); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(58,42,34,0.5)'; c.lineWidth = 0.8;
    line(c, -6, 3.5, -14, 2); line(c, -6, 5, -13, 6.5); line(c, 6, 3.5, 14, 2); line(c, 6, 5, 13, 6.5);
    c.restore();
  };

  Art.mouse = function (c, x, y, s, dir, t) {
    c.save(); c.translate(x, y + Math.abs(Math.sin(t * 22)) * -2); c.scale(s * dir, s);
    c.strokeStyle = '#d9a5a5'; c.lineWidth = 1.4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-8, -3); c.quadraticCurveTo(-16, -8, -20, -2); c.stroke();
    c.fillStyle = '#9a9aa5'; ellipse(c, 0, -5, 9, 5.5);
    c.fillStyle = '#b7b7c2'; circle(c, 5, -10, 3.4);
    c.fillStyle = '#f0b8b8'; circle(c, 5, -10, 1.8); circle(c, 9.5, -4.5, 1.1);
    c.fillStyle = PAL.ink; circle(c, 6.5, -6, 0.9);
    c.restore();
  };

  Art.hedgehog = function (c, x, y, s, t, hop) {
    c.save(); c.translate(x, y - hop); c.scale(s, s);
    c.fillStyle = 'rgba(0,0,0,0.2)'; ellipse(c, 0, hop / s, 16, 3.2);
    c.fillStyle = '#6b4a35';
    for (var i = 0; i < 9; i++) {
      var a = PI + 0.15 + i * (PI - 0.5) / 8;
      c.beginPath(); c.moveTo(Math.cos(a - 0.2) * 12 - 2, Math.sin(a - 0.2) * 11 - 2);
      c.lineTo(Math.cos(a) * 19 - 2, Math.sin(a) * 17 - 2);
      c.lineTo(Math.cos(a + 0.2) * 12 - 2, Math.sin(a + 0.2) * 11 - 2); c.closePath(); c.fill();
    }
    c.beginPath(); c.arc(-2, -2, 13, PI, 0); c.lineTo(11, 0); c.lineTo(-15, 0); c.closePath(); c.fill();
    c.fillStyle = '#e8cfa8';
    c.beginPath(); c.moveTo(5, -9); c.quadraticCurveTo(15, -8, 20, -2); c.quadraticCurveTo(14, 1, 4, 0); c.closePath(); c.fill();
    c.fillStyle = PAL.ink; circle(c, 20, -2.4, 1.6); circle(c, 12, -5.5, 1.2);
    c.fillStyle = '#e8cfa8'; ellipse(c, -6, 0, 3, 1.8); ellipse(c, 6, 0, 3, 1.8);
    // tiny basket: this hedgehog means business
    c.fillStyle = '#c99a3c'; rr(c, -24, -8, 10, 8, 2); c.fill();
    c.strokeStyle = '#a57a28'; c.lineWidth = 1.2; c.beginPath(); c.arc(-19, -8, 5, PI, 0); c.stroke();
    c.restore();
  };

  Art.squirrel = function (c, x, y, s, t) {
    c.save(); c.translate(x, y); c.scale(s, s);
    var fur = '#b5653a', tw = Math.sin(t * 3) * 0.12;
    c.save(); c.translate(-7, -4); c.rotate(tw);
    c.fillStyle = '#c97c4c';
    c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-20, -4, -20, -30, -4, -28); c.bezierCurveTo(4, -26, -6, -12, 3, -4); c.closePath(); c.fill();
    c.restore();
    c.fillStyle = fur; ellipse(c, 0, -8, 8, 9);
    c.fillStyle = '#f2dcc0'; ellipse(c, 3, -6, 4, 6);
    c.fillStyle = fur; circle(c, 5, -19, 6.5);
    c.beginPath(); c.moveTo(1, -23); c.lineTo(2, -29); c.lineTo(5.5, -24); c.closePath(); c.fill();
    c.fillStyle = PAL.ink; circle(c, 7.5, -20, 1.2);
    c.fillStyle = '#8a6a3a'; ellipse(c, 10, -10, 2.6, 3.2);
    c.restore();
  };

  Art.bee = function (c, x, y, s, t, dir) {
    c.save(); c.translate(x, y); c.scale(s * dir, s);
    c.fillStyle = 'rgba(255,255,255,0.75)';
    var flap = Math.sin(t * 45) * 0.5;
    ellipse(c, -2, -8, 7, 4, -0.5 + flap); ellipse(c, 3, -8, 7, 4, 0.5 - flap);
    c.fillStyle = '#ffcf3f'; ellipse(c, 0, 0, 10, 7);
    c.fillStyle = PAL.ink; c.fillRect(-3.5, -6.5, 2.6, 13); c.fillRect(1.5, -6.5, 2.6, 13);
    circle(c, 8.5, -1.5, 1.3);
    c.beginPath(); c.moveTo(-10, 0); c.lineTo(-13.5, -1.5); c.lineTo(-13.5, 1.5); c.closePath(); c.fill();
    c.restore();
  };

  Art.butterfly = function (c, x, y, s, t, color) {
    c.save(); c.translate(x, y); c.scale(s, s);
    var flap = Math.abs(Math.sin(t * 9));
    c.fillStyle = color;
    c.save(); c.scale(0.25 + flap * 0.75, 1);
    c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-14, -14, -16, 2, 0, 3); c.bezierCurveTo(-11, 10, -4, 12, 0, 4); c.fill();
    c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(14, -14, 16, 2, 0, 3); c.bezierCurveTo(11, 10, 4, 12, 0, 4); c.fill();
    c.restore();
    c.fillStyle = PAL.ink; ellipse(c, 0, 2, 1.2, 5);
    c.restore();
  };

  /** The travelling merchant's cart. */
  Art.merchant = function (c, x, y, s, t) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.fillStyle = 'rgba(0,0,0,0.22)'; ellipse(c, 0, 0, 40, 5);
    c.fillStyle = PAL.woodMid; rr(c, -32, -30, 64, 22, 4); c.fill();
    c.fillStyle = PAL.woodDark; c.fillRect(-32, -18, 64, 3);
    c.strokeStyle = PAL.woodDark; c.lineWidth = 3; line(c, -28, -30, -28, -56); line(c, 28, -30, 28, -56);
    // striped awning
    for (var i = 0; i < 6; i++) {
      c.fillStyle = i % 2 ? '#fff3d6' : '#e8686b';
      c.beginPath(); c.moveTo(-36 + i * 12, -66); c.lineTo(-24 + i * 12, -66); c.lineTo(-24 + i * 12, -54);
      c.arc(-30 + i * 12, -54, 6, 0, PI); c.closePath(); c.fill();
    }
    // wares
    c.fillStyle = '#a58bff'; rr(c, -22, -42, 9, 12, 3); c.fill();
    c.fillStyle = '#4aa8e0'; rr(c, -8, -40, 8, 10, 3); c.fill();
    c.fillStyle = '#f2b53a'; circle(c, 9, -35, 5);
    // wheels
    c.fillStyle = PAL.woodDark; circle(c, -18, -5, 8); circle(c, 18, -5, 8);
    c.fillStyle = PAL.woodPale; circle(c, -18, -5, 3); circle(c, 18, -5, 3);
    // a friendly gnome hat peeking over the counter
    var bob = Math.sin(t * 2) * 1.5;
    c.fillStyle = '#f2d2b0'; circle(c, 20, -36 + bob, 5);
    c.fillStyle = '#58b368';
    c.beginPath(); c.moveTo(13, -38 + bob); c.lineTo(22, -56 + bob); c.lineTo(27, -38 + bob); c.closePath(); c.fill();
    c.restore();
  };

  // ==================================================================
  // Icons for the DOM (shop, toolbar, almanac)
  // ==================================================================
  function prepIcon(canvas) {
    var dpr = Math.min(2, root.devicePixelRatio || 1);
    var w = canvas.clientWidth || parseInt(canvas.getAttribute('data-size'), 10) || 48;
    var h = canvas.clientHeight || w;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    var c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    return { c: c, w: w, h: h };
  }

  /** Renders a potted plant into a small canvas. opts: { pot, silhouette, style, golden } */
  Art.drawPlantIcon = function (canvas, speciesId, growth, opts) {
    opts = opts || {};
    var I = prepIcon(canvas), c = I.c;
    var showPot = opts.pot !== false;
    var total = HEIGHT[speciesId] + 22 + (showPot ? 66 : 6);
    var s = Math.min(I.h / total, I.w / 96);
    c.translate(I.w / 2, I.h - (showPot ? 64 : 4) * s - (I.h - total * s) / 2);
    c.scale(s, s);
    if (showPot) {
      if (opts.silhouette) { c.fillStyle = opts.silhouette; rr(c, -36, -2, 72, 64, 8); c.fill(); }
      else Art.drawPot(c, C.POT_STYLES_BY_ID[opts.style || 'terracotta'], 0.6);
    }
    var sp = C.SPECIES_BY_ID[speciesId];
    var p = { species: speciesId, growth: growth, water: (sp.water[0] + sp.water[1]) / 2, health: 100, ripeAge: 0,
      dead: false, golden: !!opts.golden, harvestsLeft: sp.harvests || 1 };
    Art.drawPlant(c, p, { seed: 1.3, t: 0, sway: 0, night: 0, silhouette: opts.silhouette });
  };

  /** A seed packet icon for the given species. */
  Art.drawSeedIcon = function (canvas, speciesId) {
    var I = prepIcon(canvas), c = I.c, sp = C.SPECIES_BY_ID[speciesId];
    var s = Math.min(I.w, I.h) / 48;
    c.translate(I.w / 2, I.h / 2); c.scale(s, s);
    c.fillStyle = 'rgba(0,0,0,0.15)'; rr(c, -14, -19, 30, 40, 4); c.fill();
    c.fillStyle = '#fff3d6'; rr(c, -15, -21, 30, 40, 4); c.fill();
    c.fillStyle = sp.colors.leaf2; rr(c, -15, -21, 30, 9, 4); c.fill();
    c.fillRect(-15, -16, 30, 4);
    c.save(); c.translate(0, 15); c.scale(0.26, 0.26);
    Art.drawPlant(c, { species: speciesId, growth: 1, water: (sp.water[0] + sp.water[1]) / 2, health: 100, ripeAge: 0,
      dead: false, golden: false, harvestsLeft: 1 }, { seed: 1.3, t: 0, sway: 0, night: 0 });
    c.restore();
  };

  Art.drawNutrientIcon = function (canvas, id) {
    var I = prepIcon(canvas), c = I.c;
    var n = id === 'crumbs' ? C.CRUMBS : C.NUTRIENTS_BY_ID[id];
    var s = Math.min(I.w, I.h) / 48;
    c.translate(I.w / 2, I.h / 2); c.scale(s, s);
    var col = n.color, dark = mix(col, '#000000', 0.25), light = mix(col, '#ffffff', 0.45);
    c.fillStyle = 'rgba(0,0,0,0.15)'; ellipse(c, 0, 20, 14, 3);
    if (id === 'nitro') {            // tall fizzy bottle
      c.fillStyle = '#7b4f36'; rr(c, -4, -22, 8, 6, 2); c.fill();
      c.fillStyle = light; rr(c, -5, -17, 10, 9, 2); c.fill();
      c.fillStyle = col; rr(c, -11, -10, 22, 30, 7); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.7)'; circle(c, -6, -14, 1.5); circle(c, 5, -19, 1.2); circle(c, 8, -4, 1.4);
    } else if (id === 'gel') {       // round jar
      c.fillStyle = dark; rr(c, -11, -18, 22, 7, 3); c.fill();
      c.fillStyle = col; rr(c, -14, -12, 28, 32, 11); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.35)'; ellipse(c, -7, -2, 3, 8, 0.2);
    } else if (id === 'jam') {       // jam jar with cloth lid
      c.fillStyle = '#fff3d6';
      c.beginPath(); c.moveTo(-15, -11); c.quadraticCurveTo(0, -24, 15, -11); c.lineTo(12, -7); c.lineTo(-12, -7); c.closePath(); c.fill();
      c.fillStyle = '#e8686b'; c.fillRect(-12, -9, 24, 2.5);
      c.fillStyle = col; rr(c, -13, -7, 26, 27, 6); c.fill();
    } else if (id === 'tonic') {     // spray bottle
      c.fillStyle = dark; rr(c, -4, -22, 14, 6, 2); c.fill(); c.fillRect(-3, -17, 6, 6);
      c.fillStyle = '#3a2a22'; c.fillRect(9, -21, 4, 3);
      c.fillStyle = col;
      c.beginPath(); c.moveTo(-5, -12); c.lineTo(5, -12); c.lineTo(12, 0); c.lineTo(12, 16); c.quadraticCurveTo(12, 20, 8, 20);
      c.lineTo(-8, 20); c.quadraticCurveTo(-12, 20, -12, 16); c.lineTo(-12, 0); c.closePath(); c.fill();
    } else {                         // pouch of crumbs
      c.fillStyle = dark;
      c.beginPath(); c.moveTo(-6, -12); c.lineTo(-10, -21); c.lineTo(0, -17); c.lineTo(10, -21); c.lineTo(6, -12); c.closePath(); c.fill();
      c.fillStyle = col;
      c.beginPath(); c.moveTo(-6, -12); c.quadraticCurveTo(-20, 6, -12, 18); c.quadraticCurveTo(0, 23, 12, 18);
      c.quadraticCurveTo(20, 6, 6, -12); c.closePath(); c.fill();
      c.fillStyle = '#ffe27a'; c.fillRect(-7, -13, 14, 2.5);
    }
    // shape-coded label
    c.fillStyle = '#fffaf0'; rr(c, -8, -1, 16, 15, 3); c.fill();
    c.fillStyle = dark; shape(c, n.shape, 0, 6.5, 4.6);
  };

  BB.Art = Art;
})(typeof window !== 'undefined' ? window : globalThis);
