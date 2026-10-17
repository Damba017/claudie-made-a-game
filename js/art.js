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
  var HEIGHT = { mint: 78, fern: 82, cactus: 88, sunflower: 146, berry: 70, pumpkin: 62, shroom: 62, orchid: 122,
    pepper: 92, lotus: 84, crystal: 112, lily: 108, agave: 100, honey: 86, mandrake: 64 };

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

  SPECIES_ART.pumpkin = function (P) {
    var c = P.ctx, k = P.k, i;
    // Big lobed leaves on a sprawling vine, drawn first so the pumpkin sits in front.
    var nl = 2 + Math.floor(k * 3.5);
    for (i = 0; i < nl; i++) {
      var side = i % 2 ? 1 : -1, f = (i + 1) / (nl + 1);
      var len = (12 + 28 * k) * (0.8 + 0.2 * rnd(P.seed + i * 1.9));
      var ang = (side > 0 ? -0.35 - f * 0.9 : PI + 0.35 + f * 0.9) + side * P.droop * 0.6 + P.sway * 2;
      var lx = Math.cos(ang) * len, ly = Math.sin(ang) * len * 0.85 - 3, r = 6 + 9 * k;
      c.strokeStyle = tint(P, P.pal.leaf2); c.lineWidth = 2; c.lineCap = 'round';
      line(c, 0, -2, lx, ly);
      c.fillStyle = tint(P, i % 2 ? P.pal.leaf : P.pal.leaf2);
      circle(c, lx, ly - r * 0.15, r * 0.72);
      circle(c, lx - r * 0.5, ly + r * 0.2, r * 0.52);
      circle(c, lx + r * 0.5, ly + r * 0.2, r * 0.52);
      c.strokeStyle = tint(P, P.pal.leaf2); c.lineWidth = 1;
      line(c, lx, ly + r * 0.3, lx, ly - r * 0.6);
    }
    if (k > 0.25) {          // a curly tendril
      c.strokeStyle = tint(P, P.pal.leaf); c.lineWidth = 1.3;
      c.beginPath(); c.arc(-16 - 6 * k, -14 - 8 * k, 3 + 2 * k, 0, PI * 1.5); c.stroke();
    }
    if (k <= 0.3) return;
    // The pumpkin: green, then yellow, then orange, and rounder all the time.
    var pk = (k - 0.3) / 0.7, R = 4 + 20 * pk;
    var w = R * 1.3, h = R * (0.85 - P.wilt * 0.12), cx = 2 + P.sway * 10, cy = -h + 2;
    var col = P.mature ? [P.pal.accent, '#c9661a', '#ffb05a']
      : (pk > 0.7 ? ['#e8c24a', '#c9a032', '#f6dd78'] : ['#8cc152', '#6a9f3a', '#b3dd7a']);
    c.fillStyle = tint(P, col[1]);
    ellipse(c, cx - w * 0.42, cy, w * 0.42, h); ellipse(c, cx + w * 0.42, cy, w * 0.42, h);
    c.fillStyle = tint(P, col[0]);
    ellipse(c, cx - w * 0.2, cy, w * 0.4, h * 0.98); ellipse(c, cx + w * 0.2, cy, w * 0.4, h * 0.98);
    c.fillStyle = tint(P, col[2]);
    ellipse(c, cx, cy, w * 0.26, h * 0.99);
    if (!P.silhouette) { c.fillStyle = 'rgba(255,255,255,0.28)'; ellipse(c, cx - w * 0.3, cy - h * 0.4, w * 0.12, h * 0.25, -0.4); }
    c.fillStyle = tint(P, '#7a5a2a'); rr(c, cx - 2.2, cy - h - 5, 4.4, 7, 2); c.fill();
  };

  SPECIES_ART.pepper = function (P) {
    var c = P.ctx, k = P.k, i, pt = stem(P, 0, 18 + 70 * k, 0.04, 2.4 + 1.2 * k, tint(P, P.pal.leaf2));
    var nb = 2 + Math.floor(k * 4);
    for (i = 0; i < nb; i++) {
      var q = pt((i + 1) / (nb + 1)), side = i % 2 ? 1 : -1, len = (8 + 13 * k) * (1 - i / (nb + 1) * 0.3);
      c.fillStyle = tint(P, i % 2 ? P.pal.leaf : P.pal.leaf2);
      leaf(c, q.x, q.y, leafAng(P, side, 0.3), len * 1.4, len * 0.5);
      leaf(c, q.x, q.y, leafAng(P, -side, 0.9), len, len * 0.4);
    }
    var top = pt(1);
    c.fillStyle = tint(P, P.pal.leaf);
    leaf(c, top.x, top.y, -PI / 2 - 0.45, 7 + 5 * k, 3.2); leaf(c, top.x, top.y, -PI / 2 + 0.45, 7 + 5 * k, 3.2);
    if (k <= 0.55) return;
    // Chillies hanging from the branches: green, then orange, then fiery red.
    var fk = (k - 0.55) / 0.45, n = 2 + Math.floor(fk * 3);
    for (i = 0; i < n; i++) {
      var q2 = pt(0.38 + i * 0.12), s2 = i % 2 ? 1 : -1, px = q2.x + s2 * (4 + 3 * fk), py = q2.y + 2;
      var len2 = 6 + 11 * fk, w2 = 2.2 + 2.4 * fk;
      var col = P.mature ? P.pal.accent : (fk > 0.6 ? '#f2a03a' : '#7fbf4f');
      c.save(); c.translate(px, py); c.rotate(s2 * 0.25 + P.sway * 3 + P.droop * s2 * 0.5);
      c.fillStyle = tint(P, col);
      c.beginPath(); c.moveTo(-w2, 0); c.quadraticCurveTo(-w2, len2 * 0.7, s2 * w2 * 0.6, len2);
      c.quadraticCurveTo(w2, len2 * 0.5, w2, 0); c.closePath(); c.fill();
      if (!P.silhouette) { c.fillStyle = 'rgba(255,255,255,0.35)'; ellipse(c, -w2 * 0.35, len2 * 0.3, w2 * 0.25, len2 * 0.22); }
      c.fillStyle = tint(P, P.pal.leaf2); rr(c, -w2 * 0.8, -2.5, w2 * 1.6, 3, 1.5); c.fill();
      c.restore();
      if (P.mature && !P.dead && !P.silhouette) {     // crackling sparks
        var tw = (Math.sin(P.t * 7 + i * 2.1) + 1) / 2;
        c.fillStyle = 'rgba(255,214,90,' + (0.35 + 0.65 * tw).toFixed(2) + ')';
        star(c, px + s2 * (w2 + 4), py + len2 * 0.5 - tw * 7, 1.2 + tw * 2, 4, 0.35);
      }
    }
  };

  // Glass facets of the Crystalbloom Rose: [count, radius, rotation, colour, second colour] per ring.
  var CRYSTAL_RINGS = [[7, 22, 0, '#7fd6f5', '#5cc3ea'], [6, 15.5, 0.45, '#b4ecff', '#93def7'], [5, 9, 0.2, '#e4f9ff', '#c8f1ff']];

  SPECIES_ART.crystal = function (P) {
    var c = P.ctx, k = P.k, i, pt = stem(P, 0, 20 + 86 * k, 0.05, 2.1, tint(P, P.pal.leaf2));
    var nl = 1 + Math.floor(k * 3);
    for (i = 0; i < nl; i++) {
      var q = pt(0.22 + i * 0.2), side = i % 2 ? 1 : -1, s = 6 + 6 * k;
      c.fillStyle = tint(P, i % 2 ? P.pal.leaf : P.pal.leaf2);
      leaf(c, q.x, q.y, leafAng(P, side, 0.55), s * 1.4, s * 0.6);
      c.fillStyle = tint(P, P.pal.leaf2);        // a thorn
      c.beginPath(); c.moveTo(q.x, q.y + 7); c.lineTo(q.x - side * 4, q.y + 4.5); c.lineTo(q.x, q.y + 3); c.fill();
    }
    if (k <= 0.4) return;
    var bk = (k - 0.4) / 0.6, tip = pt(1);
    c.save(); c.translate(tip.x, tip.y); c.rotate(P.sway * 1.5 + P.droop * 0.8);
    if (!P.mature) {           // a closed, slowly frosting bud
      var s2 = 4 + 8 * bk;
      c.fillStyle = tint(P, P.pal.leaf);
      leaf(c, 0, 2, -PI / 2 - 0.55, s2 * 1.1, s2 * 0.38); leaf(c, 0, 2, -PI / 2 + 0.55, s2 * 1.1, s2 * 0.38);
      c.fillStyle = tint(P, bk > 0.5 ? P.pal.accent : P.pal.leaf);
      c.beginPath(); c.moveTo(0, -s2 * 1.7); c.lineTo(s2 * 0.7, -s2 * 0.6); c.lineTo(0, s2 * 0.2); c.lineTo(-s2 * 0.7, -s2 * 0.6);
      c.closePath(); c.fill();
    } else {
      c.save(); c.scale(1, 0.82);
      for (var rg = 0; rg < CRYSTAL_RINGS.length; rg++) {
        var ring = CRYSTAL_RINGS[rg], n = ring[0], R = ring[1], spread = PI / n * 0.95;
        for (var j = 0; j < n; j++) {
          var a = -PI / 2 + ring[2] + j * PI * 2 / n;
          c.fillStyle = tint(P, j % 2 ? ring[3] : ring[4]);
          c.beginPath(); c.moveTo(0, 0);
          c.lineTo(Math.cos(a - spread) * R * 0.75, Math.sin(a - spread) * R * 0.75);
          c.lineTo(Math.cos(a) * R, Math.sin(a) * R);
          c.lineTo(Math.cos(a + spread) * R * 0.75, Math.sin(a + spread) * R * 0.75);
          c.closePath(); c.fill();
          if (!P.silhouette) { c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 0.7; c.stroke(); }
        }
      }
      c.fillStyle = tint(P, '#ffffff'); circle(c, 0, 0, 2.2);
      c.restore();
      if (!P.silhouette && !P.dead) {        // glints that come and go
        c.fillStyle = '#ffffff';
        for (i = 0; i < 3; i++) {
          var tw = (Math.sin(P.t * 2.2 + i * 2.1) + 1) / 2;
          if (tw > 0.55) star(c, Math.cos(i * 2.1) * 17, -4 + Math.sin(i * 2.1) * 12, (tw - 0.55) * 8, 4, 0.3);
        }
      }
    }
    c.restore();
    if (P.glow && !P.dead) P.glow(tip.x, tip.y - 4, 42 * bk, P.pal.accent, (0.08 + 0.3 * P.night) * bk);
  };

  // ---- Rare plants ----------------------------------------------------
  var RAINBOW = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa'];

  SPECIES_ART.lily = function (P) {
    var c = P.ctx, k = P.k, nl = 2 + Math.floor(k * 3), i, j;
    for (i = 0; i < nl; i++) {          // long strap leaves
      var side = i % 2 ? 1 : -1, len = (16 + 34 * k) * (1 - i * 0.08);
      var ang = side > 0 ? -1.2 + i * 0.12 + P.droop * 0.8 : PI + 1.2 - i * 0.12 - P.droop * 0.8;
      c.fillStyle = tint(P, i % 2 ? P.pal.leaf : P.pal.leaf2);
      leaf(c, side * 2, 0, ang + P.sway * 2, len, 3 + 2 * k);
    }
    if (k <= 0.3) return;
    var sk = (k - 0.3) / 0.7, pt = stem(P, 0, 24 + 76 * sk, -0.04, 2.2, tint(P, P.pal.leaf2));
    if (sk < 0.4) return;
    var nf = P.mature ? 3 : 2;
    for (i = 0; i < nf; i++) {
      var q = pt(1 - i * 0.17), s2 = i === 0 ? 0 : (i % 2 ? 1 : -1), fx = q.x + s2 * 9, fy = q.y + 2 + i * 2;
      if (s2) { c.strokeStyle = tint(P, P.pal.leaf2); c.lineWidth = 1.4; line(c, q.x, q.y, fx, fy); }
      c.save(); c.translate(fx, fy); c.rotate(s2 * 0.55 + P.droop * 0.7 + P.sway * 2);
      if (!P.mature) {
        c.fillStyle = tint(P, sk > 0.75 ? '#ffd1e6' : P.pal.leaf);
        ellipse(c, 0, -5, 2.4 + 1.6 * sk, 5.5 + 4 * sk);
      } else {                  // a trumpet with six petals, every one a different colour
        var r = 15 - i * 1.8;
        for (j = 0; j < 6; j++) {
          c.fillStyle = tint(P, RAINBOW[(j + i * 2) % 6]);
          leaf(c, 0, 0, -PI / 2 + (j - 2.5) * 0.4, r * 1.25, r * 0.36);
        }
        c.strokeStyle = tint(P, '#c98a2a'); c.lineWidth = 0.9;
        for (j = -1; j <= 1; j++) line(c, 0, 0, j * 3, -r * 0.85);
        c.fillStyle = tint(P, '#fff6d0'); circle(c, 0, -1, 2.2);
      }
      c.restore();
    }
    if (P.glow && P.mature && !P.dead) { var top = pt(1); P.glow(top.x, top.y - 6, 46, '#c9a6ff', 0.1 + 0.3 * P.night); }
  };

  SPECIES_ART.agave = function (P) {
    var c = P.ctx, k = P.k, n = 5 + Math.floor(k * 6), i, order = [];
    for (i = 0; i < n; i++) order.push((i / (n - 1)) * 2 - 1);
    order.sort(function (a, b) { return Math.abs(b) - Math.abs(a); });   // outer leaves first
    for (i = 0; i < order.length; i++) {
      var f = order[i], len = (12 + 34 * k) * (1 - Math.abs(f) * 0.32) * (0.88 + 0.12 * rnd(P.seed + i * 2.3));
      var ang = -PI / 2 + f * (1.2 + P.droop * 0.5) + P.sway * 1.5;
      var tx = Math.cos(ang) * len, ty = Math.sin(ang) * len * (1 - P.droop * 0.4) - 2;
      c.fillStyle = tint(P, i % 2 ? P.pal.leaf : P.pal.leaf2);
      leaf(c, 0, -2, Math.atan2(ty + 2, tx), Math.sqrt(tx * tx + (ty + 2) * (ty + 2)), 3.5 + 3.5 * k);
      c.fillStyle = tint(P, P.pal.accent);              // a glowing ember tip
      circle(c, tx, ty, 1.4 + 1.2 * k);
    }
    if (!P.mature) return;
    // A tall flower spike crowned with smouldering blossoms.
    var tip = stem(P, 0, 82, 0.02, 3, tint(P, '#9a7a4a'))(1);
    for (i = 0; i < 7; i++) {
      var a2 = i * 0.9, bx = tip.x + Math.cos(a2) * (4 + i * 0.6), by = tip.y + Math.sin(a2) * 3 - i * 0.4;
      var flicker = P.dead || P.silhouette ? 0 : Math.sin(P.t * 6 + i * 1.7) * 0.6;
      c.fillStyle = tint(P, i % 2 ? '#ffb347' : P.pal.accent);
      circle(c, bx, by, 4 + (i % 3) * 1.2 + flicker);
    }
    if (P.glow && !P.dead) P.glow(tip.x, tip.y, 46, P.pal.accent, 0.18 + 0.32 * P.night);
  };

  SPECIES_ART.honey = function (P) {
    var c = P.ctx, k = P.k, ns = 1 + Math.floor(k * 2.6), j, i;
    var xs = [0, -9, 10], hs = [1, 0.78, 0.86], leans = [0.02, -0.32, 0.3];
    for (j = ns - 1; j >= 0; j--) {
      var pt = stem(P, xs[j] * 0.5, (16 + 58 * k) * hs[j], leans[j], 1.9, tint(P, P.pal.leaf2));
      var nl = 1 + Math.floor(k * 3);
      for (i = 0; i < nl; i++) {          // heart-shaped leaves, tip on the stem
        var t = 0.3 + i * 0.22, q = pt(t), side = (i + j) % 2 ? 1 : -1, r = (4 + 5 * k) * (1 - t * 0.3);
        c.save(); c.translate(q.x, q.y); c.rotate(side * (1.1 + P.droop * 0.8) + P.sway * 2);
        c.fillStyle = tint(P, i % 2 ? P.pal.leaf : P.pal.leaf2);
        Art.heart(c, 0, -r * 0.9, r);
        c.restore();
      }
      var tip = pt(1);
      if (P.mature) {            // a golden bell with a honey drop that slides down and falls
        c.save(); c.translate(tip.x, tip.y); c.rotate(P.droop * 0.8 + P.sway * 2); c.scale(1.3, 1.3);
        c.fillStyle = tint(P, P.pal.accent);
        c.beginPath(); c.moveTo(-6, 6); c.quadraticCurveTo(-6, -4, 0, -5); c.quadraticCurveTo(6, -4, 6, 6);
        c.quadraticCurveTo(0, 8.5, -6, 6); c.fill();
        c.fillStyle = tint(P, '#e09a1a'); ellipse(c, 0, 6.3, 6, 1.6);
        if (!P.silhouette && !P.dead) {
          var d = (P.t * 0.6 + j * 0.37) % 1;
          Art.droplet(c, 2, 8 + d * 10, 1.6 + d * 0.6, true, '#f2b21c');
        }
        c.restore();
      } else if (k > 0.5) {
        c.fillStyle = tint(P, k > 0.8 ? '#ffe08a' : P.pal.leaf); ellipse(c, tip.x, tip.y + 2, 2.6, 3.6);
      }
    }
    if (P.glow && P.mature && !P.dead) P.glow(0, -50, 50, P.pal.accent, 0.1 + 0.25 * P.night);
  };

  SPECIES_ART.mandrake = function (P) {
    var c = P.ctx, k = P.k, i;
    var rk = clamp01((k - 0.35) / 0.65), bh = 3 + 20 * rk, bw = 8 + 8 * rk, lean = P.sway * 8 + P.droop * 3;
    if (rk > 0) {
      // The root's head peeking out of the soil.
      c.fillStyle = tint(P, '#e2c49a');
      c.beginPath(); c.moveTo(-bw, 2);
      c.bezierCurveTo(-bw, -bh * 0.9, lean - bw * 0.5, -bh - 2, lean, -bh - 2);
      c.bezierCurveTo(lean + bw * 0.5, -bh - 2, bw, -bh * 0.9, bw, 2); c.closePath(); c.fill();
      c.strokeStyle = tint(P, '#b8936a'); c.lineWidth = 1;
      line(c, -bw * 0.55, -bh * 0.25, -bw * 0.2, -bh * 0.3); line(c, bw * 0.3, -bh * 0.15, bw * 0.6, -bh * 0.2);
      if (P.mature) {          // little root arms, waving to be picked
        var wave = P.dead || P.silhouette ? 0 : Math.sin(P.t * 3) * 0.4;
        c.strokeStyle = tint(P, '#d9b98a'); c.lineWidth = 2.4; c.lineCap = 'round';
        c.beginPath(); c.moveTo(-bw * 0.9, -bh * 0.35); c.quadraticCurveTo(-bw * 1.5, -bh * 0.6, -bw * 1.4, -bh * (0.95 + wave)); c.stroke();
        c.beginPath(); c.moveTo(bw * 0.9, -bh * 0.35); c.quadraticCurveTo(bw * 1.5, -bh * 0.6, bw * 1.4, -bh * (0.95 - wave)); c.stroke();
      }
      if (rk > 0.45 && !P.silhouette) {
        var ey = -bh * 0.55, ex = bw * 0.32, fx = lean * 0.5;
        c.strokeStyle = PAL.ink; c.fillStyle = PAL.ink; c.lineWidth = 1.3; c.lineCap = 'round';
        if (P.dead) {
          line(c, fx - ex - 1.5, ey - 1.5, fx - ex + 1.5, ey + 1.5); line(c, fx - ex + 1.5, ey - 1.5, fx - ex - 1.5, ey + 1.5);
          line(c, fx + ex - 1.5, ey - 1.5, fx + ex + 1.5, ey + 1.5); line(c, fx + ex + 1.5, ey - 1.5, fx + ex - 1.5, ey + 1.5);
        } else if (P.mature) {   // wide awake and about to complain
          circle(c, fx - ex, ey, 1.7); circle(c, fx + ex, ey, 1.7);
          c.fillStyle = '#7a2a3a'; ellipse(c, fx, ey + 5, 2.2, 2.8);
        } else {                  // fast asleep
          c.beginPath(); c.arc(fx - ex, ey, 1.8, 0.15, PI - 0.15); c.stroke();
          c.beginPath(); c.arc(fx + ex, ey, 1.8, 0.15, PI - 0.15); c.stroke();
          line(c, fx - 1.5, ey + 5, fx + 1.5, ey + 5);
        }
        c.fillStyle = 'rgba(255,130,150,0.45)'; circle(c, fx - ex - 2.5, ey + 3, 1.9); circle(c, fx + ex + 2.5, ey + 3, 1.9);
      }
    }
    // The leafy tuft on its head.
    var topY = rk > 0 ? -bh - 1 : -1, tx = rk > 0 ? lean : 0, nl = 3 + Math.floor(k * 4);
    for (i = 0; i < nl; i++) {
      var f = (i / (nl - 1)) * 2 - 1, len = (8 + 22 * k) * (1 - Math.abs(f) * 0.25);
      c.fillStyle = tint(P, i % 2 ? P.pal.leaf : P.pal.leaf2);
      leaf(c, tx, topY, -PI / 2 + f * (0.85 + P.droop * 0.6) + P.sway * 2, len, 3 + 2 * k);
    }
    if (P.mature) {
      c.fillStyle = tint(P, P.pal.accent);
      for (i = 0; i < 3; i++) circle(c, tx + (i - 1) * 7, topY - 18 - (i === 1 ? 5 : 0), 2.6);
    }
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
  /**
   * The barn cat. o: { t, walking, dir, happy, blink, skin }.
   * skin is an entry of CONFIG.CAT_SKINS: colours plus the flags
   * stripes (tabby), fluffy (long hair), points (Siamese mask) and round (chubby face).
   */
  Art.cat = function (c, x, y, s, o) {
    var k = o.skin || C.CAT_SKINS[0];
    var fur = k.fur, dark = k.dark, t = o.t, fluffy = !!k.fluffy, i;
    var limbs = k.points ? dark : fur, tail = k.tail || dark;
    c.save(); c.translate(x, y); c.scale(s * (o.dir < 0 ? -1 : 1), s);
    c.fillStyle = 'rgba(0,0,0,0.2)'; ellipse(c, 0, 0, 22, 4);
    if (o.walking) {
      var step = Math.sin(t * 10);
      var feet = [[-11, step * 5], [-5, -step * 5], [9, -step * 5], [14, step * 5]];
      c.strokeStyle = limbs; c.lineWidth = 5; c.lineCap = 'round';
      for (i = 0; i < 4; i++) line(c, feet[i][0], -12, feet[i][0] + feet[i][1], -1);
      if (k.paws) { c.fillStyle = k.paws; for (i = 0; i < 4; i++) circle(c, feet[i][0] + feet[i][1], -1, 2.7); }
      c.strokeStyle = tail; c.lineWidth = fluffy ? 8 : 4;
      c.beginPath(); c.moveTo(-15, -17); c.quadraticCurveTo(-26, -22, -24, -34 + step * 2); c.stroke();
      c.fillStyle = fur; rr(c, -17, fluffy ? -27 : -24, 36, fluffy ? 18 : 15, 7.5); c.fill();
      if (k.stripes) { c.fillStyle = dark; for (i = 0; i < 3; i++) c.fillRect(-9 + i * 7, -24, 2.6, 6); }
      c.translate(20, -24);
    } else {
      var sw = Math.sin(t * 2.2) * 5;
      c.strokeStyle = tail; c.lineWidth = fluffy ? 8.5 : 4.5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-10, -4); c.quadraticCurveTo(-26, -2, -24 + sw * 0.5, -16 - sw); c.stroke();
      c.fillStyle = fur;
      c.beginPath(); c.moveTo(-13, 0); c.quadraticCurveTo(-16, -26, 0, -28); c.quadraticCurveTo(15, -26, 13, 0); c.closePath(); c.fill();
      if (fluffy) { circle(c, -13, -7, 5.5); circle(c, 13, -7, 5.5); circle(c, -12, -16, 4.5); circle(c, 12, -16, 4.5); }
      if (k.white) { c.fillStyle = k.white; ellipse(c, 2, -9, fluffy ? 7.5 : 6, fluffy ? 10 : 9); }
      if (k.stripes) { c.fillStyle = dark; c.fillRect(-11, -18, 5, 2.4); c.fillRect(-12, -12, 5, 2.4); }
      c.fillStyle = k.paws || fur; ellipse(c, -3, -1, 4, 2.4); ellipse(c, 7, -1, 4, 2.4);
      c.translate(2, -32);
    }
    // head
    c.fillStyle = limbs;
    c.beginPath(); c.moveTo(-10, -5); c.lineTo(-8, -17); c.lineTo(-1, -9); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(10, -5); c.lineTo(8, -17); c.lineTo(1, -9); c.closePath(); c.fill();
    c.fillStyle = fur;
    if (fluffy) { leaf(c, -8, 2, PI * 0.8, 9.5, 3.6); leaf(c, 8, 2, PI * 0.2, 9.5, 3.6); }
    ellipse(c, 0, 0, k.round ? 12.6 : 11, 11);
    c.fillStyle = '#f7b7b0';
    c.beginPath(); c.moveTo(-7.5, -8); c.lineTo(-7, -13.5); c.lineTo(-3.5, -9.5); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(7.5, -8); c.lineTo(7, -13.5); c.lineTo(3.5, -9.5); c.closePath(); c.fill();
    if (k.points) { c.fillStyle = dark; ellipse(c, 0, 2.2, 7.6, 7.2); }
    if (k.muzzle) { c.fillStyle = k.muzzle; ellipse(c, 0, 4, 6, 4.5); }
    if (k.stripes) { c.fillStyle = dark; c.fillRect(-1.2, -11, 2.4, 5); c.fillRect(-5, -10, 2, 3.5); c.fillRect(3, -10, 2, 3.5); }
    if (k.blaze) { c.fillStyle = k.blaze; ellipse(c, 0, -3.2, 1.7, 4.2); }
    // eyes: coloured iris with a slit pupil, or happy little arcs
    var line2 = k.points ? '#f6ead6' : PAL.ink;
    c.lineWidth = 1.4; c.lineCap = 'round';
    if (o.happy || o.blink) {
      c.strokeStyle = line2;
      c.beginPath(); c.arc(-4.2, -1, 2, PI * 1.1, PI * 1.9); c.stroke();
      c.beginPath(); c.arc(4.2, -1, 2, PI * 1.1, PI * 1.9); c.stroke();
    } else if (k.eye) {
      c.fillStyle = k.eye; ellipse(c, -4.2, -1, 2.2, 2.5); ellipse(c, 4.2, -1, 2.2, 2.5);
      c.fillStyle = PAL.ink; ellipse(c, -4.2, -1, 0.9, 2); ellipse(c, 4.2, -1, 0.9, 2);
    } else { c.fillStyle = PAL.ink; ellipse(c, -4.2, -1, 1.5, 2.1); ellipse(c, 4.2, -1, 1.5, 2.1); }
    c.fillStyle = k.nose || '#e8837e';
    c.beginPath(); c.moveTo(-1.5, 2.5); c.lineTo(1.5, 2.5); c.lineTo(0, 4.2); c.closePath(); c.fill();
    c.strokeStyle = k.points ? 'rgba(255,255,255,0.55)' : 'rgba(58,42,34,0.5)'; c.lineWidth = 0.8;
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
  // Bosses: mutated plants. Unit space: origin at the ground under the
  // boss, up is negative y, about 240 units tall and 300 wide.
  // o: { t, hurt (0..1 white flash), state (idle | shield | armorUp |
  // snap | grab | weak | pods), phase (1 | 2) }
  // ==================================================================
  var BOSS_ART = {};

  BOSS_ART.thornzilla = function (c, o, col) {
    var t = o.t || 0, shield = o.state === 'shield', sw = Math.sin(t * 1.7) * 0.06, i;
    var body = col('#6cbf4a'), dark = col('#3f8a3a'), spineC = col('#fff3c4');
    function arm(side) {
      c.save(); c.translate(side * 50, -118);
      c.rotate(side * (shield ? -0.25 : 0.55 + sw));
      c.fillStyle = body; rr(c, -15, -78, 30, 88, 15); c.fill();
      c.strokeStyle = dark; c.lineWidth = 3; line(c, 0, -66, 0, 0);
      c.strokeStyle = spineC; c.lineWidth = 2;
      for (var k = 0; k < 5; k++) { var y = -68 + k * 15; line(c, -15, y, -24, y - 5); line(c, 15, y - 6, 24, y - 11); }
      c.restore();
    }
    arm(-1); arm(1);
    c.fillStyle = body; rr(c, -62, -212, 124, 216, 60); c.fill();
    c.fillStyle = col('#8f4fae');                     // mutation blotches
    ellipse(c, -32, -62, 14, 10, 0.4); ellipse(c, 30, -158, 10, 8); ellipse(c, 36, -40, 8, 12); ellipse(c, -38, -170, 7, 6);
    c.strokeStyle = dark; c.lineWidth = 4; c.lineCap = 'round';
    for (i = -1; i <= 1; i++) line(c, i * 30, -186, i * 30, -12);
    c.strokeStyle = spineC; c.lineWidth = 2;
    for (i = 0; i < 12; i++) {
      var sy = -24 - i * 15, len = shield ? 17 : 9;
      line(c, -62, sy, -62 - len, sy - 4); line(c, 62, sy - 7, 62 + len, sy - 11);
      if (i % 2) { line(c, -30, sy, -30 - len * 0.6, sy - 6); line(c, 30, sy - 4, 30 + len * 0.6, sy - 10); }
    }
    // the furious face
    var ey = -150;
    c.fillStyle = '#ffffff'; ellipse(c, -24, ey, 15, 17); ellipse(c, 24, ey, 15, 17);
    c.fillStyle = '#d9365a'; circle(c, -21, ey + 3, 8); circle(c, 21, ey + 3, 8);
    c.fillStyle = PAL.ink; circle(c, -20, ey + 4, 4); circle(c, 20, ey + 4, 4);
    c.beginPath(); c.moveTo(-46, ey - 27); c.lineTo(-6, ey - 12); c.lineTo(-8, ey - 4); c.lineTo(-46, ey - 16); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(46, ey - 27); c.lineTo(6, ey - 12); c.lineTo(8, ey - 4); c.lineTo(46, ey - 16); c.closePath(); c.fill();
    c.fillStyle = '#3a1020';
    var jaw = -76 + Math.sin(t * 3) * 3;
    c.beginPath(); c.moveTo(-32, -104); c.quadraticCurveTo(0, -92, 32, -104); c.quadraticCurveTo(0, jaw, -32, -104); c.fill();
    c.fillStyle = '#ffffff';
    for (i = 0; i < 6; i++) {
      var tx = -24 + i * 9.6, ty = -104 + 6 * (1 - (tx / 32) * (tx / 32));
      c.beginPath(); c.moveTo(tx - 4, ty); c.lineTo(tx + 4, ty); c.lineTo(tx, ty + 7); c.closePath(); c.fill();
    }
    // its old flower, knocked askew
    c.save(); c.translate(20, -214); c.rotate(0.5 + sw);
    c.fillStyle = col('#ff8fb1');
    for (i = 0; i < 5; i++) circle(c, Math.cos(i * 1.257) * 8, Math.sin(i * 1.257) * 7, 7);
    c.fillStyle = col('#ffe27a'); circle(c, 0, 0, 5);
    c.restore();
  };

  BOSS_ART.fernkraken = function (c, o, col) {
    var t = o.t || 0, grab = o.state === 'grab', i, k;
    var stalk = col('#2f7a5a'), leafA = col('#4fae7a'), leafB = col('#3d9a6a');
    for (i = 0; i < 8; i++) {
      var side = i % 2 ? 1 : -1, n = Math.floor(i / 2);
      var wave = Math.sin(t * 1.4 + i * 1.3) * 0.25;
      var ang = side * (0.55 + n * 0.35) + wave, len = 150 - n * 12;
      var x0 = side * 26, y0 = -110;
      var x2 = x0 + Math.sin(ang) * len, y2 = y0 - Math.cos(ang) * len * 0.8 + n * 30;
      if (grab && i === 1) { x2 = 168; y2 = 6; }
      var cx = x0 + Math.sin(ang) * len * 0.5 + side * 30, cy = y0 - len * 0.85;
      c.strokeStyle = stalk; c.lineCap = 'round'; c.lineWidth = 9;
      c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(cx, cy, x2, y2); c.stroke();
      for (k = 1; k < 9; k++) {
        var tt = k / 9, a = (1 - tt) * (1 - tt), b = 2 * (1 - tt) * tt, e = tt * tt;
        var px = a * x0 + b * cx + e * x2, py = a * y0 + b * cy + e * y2;
        var dx = 2 * (1 - tt) * (cx - x0) + 2 * tt * (x2 - cx), dy = 2 * (1 - tt) * (cy - y0) + 2 * tt * (y2 - cy);
        var ta = Math.atan2(dy, dx), size = 18 * (1 - tt * 0.6);
        c.fillStyle = k % 2 ? leafA : leafB;
        leaf(c, px, py, ta + 1.2, size, size * 0.35); leaf(c, px, py, ta - 1.2, size, size * 0.35);
      }
      c.strokeStyle = stalk; c.lineWidth = 4;
      c.beginPath(); c.arc(x2 + side * 6, y2, 7, 0, PI * 1.5); c.stroke();
      if (grab && i === 1) {           // your stolen sprayer
        c.fillStyle = '#58b368'; rr(c, x2 - 9, y2 - 26, 18, 28, 5); c.fill();
        c.fillStyle = '#2f5a2a'; c.fillRect(x2 - 3, y2 - 34, 6, 9);
      }
    }
    c.fillStyle = col('#2f7a5a'); ellipse(c, 0, -96, 74, 86);
    c.fillStyle = col('#3d9a6a'); ellipse(c, -16, -118, 44, 52);
    c.fillStyle = 'rgba(255,255,255,0.12)'; ellipse(c, -30, -140, 14, 22, -0.4);
    c.fillStyle = col('#9fe0b0');
    for (i = 0; i < 6; i++) circle(c, -40 + i * 16, -40 - (i % 2) * 10, 4);
    var look = Math.sin(t * 0.9) * 8;
    c.fillStyle = '#fffbe9'; ellipse(c, 0, -112, 36, 30);
    c.fillStyle = col('#ffcf3f'); circle(c, look, -110, 19);
    c.fillStyle = PAL.ink; ellipse(c, look, -110, 5, 15);
    c.fillStyle = 'rgba(255,255,255,0.8)'; circle(c, look - 6, -118, 4);
    c.fillStyle = col('#2f7a5a');                    // a heavy, suspicious eyelid
    c.beginPath(); c.moveTo(-39, -116); c.quadraticCurveTo(0, -152, 39, -116); c.quadraticCurveTo(0, -126, -39, -116); c.fill();
    c.fillStyle = col('#4fae7a');
    for (i = -3; i <= 3; i++) leaf(c, i * 16, -18, PI / 2 + i * 0.12, 22, 7);
  };

  BOSS_ART.snapdragon = function (c, o, col) {
    var t = o.t || 0, snap = o.state === 'snap', plate = o.state === 'armorUp', i;
    var green = col('#6cb84a'), dark = col('#3f7f32'), metal = plate ? col('#c9d3da') : col('#5a9a3f');
    c.strokeStyle = col('#7a5a3a'); c.lineWidth = 10; c.lineCap = 'round';
    line(c, -16, 0, -22, -50); line(c, 16, 0, 22, -50);
    c.fillStyle = green; rr(c, -34, -150, 68, 110, 30); c.fill();
    // shield arm: a round leaf shield
    c.fillStyle = metal; ellipse(c, -60, -100, 26, 34);
    c.strokeStyle = plate ? '#ffffff' : dark; c.lineWidth = 3;
    c.beginPath(); c.ellipse(-60, -100, 26, 34, 0, 0, PI * 2); c.stroke();
    c.fillStyle = col('#ffd24a'); leaf(c, -60, -86, -PI / 2, 26, 7);
    // breastplate and shoulder pads
    c.fillStyle = metal;
    c.beginPath(); c.moveTo(-36, -140); c.lineTo(36, -140); c.lineTo(30, -80); c.quadraticCurveTo(0, -50, -30, -80); c.closePath(); c.fill();
    c.stroke();
    c.fillStyle = col('#ffd24a'); leaf(c, -9, -108, -0.6, 20, 7);
    c.fillStyle = metal; leaf(c, -30, -140, PI + 0.5, 46, 16); leaf(c, 30, -140, -0.5, 46, 16);
    if (plate) {
      c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 2;
      line(c, -20, -132, -6, -96); line(c, 12, -132, 20, -112);
    }
    // sword arm with a twig blade and a leaf crossguard
    c.save(); c.translate(40, -118); c.rotate(-0.4 + Math.sin(t * 2) * 0.15);
    c.strokeStyle = green; c.lineWidth = 9; line(c, 0, 0, 30, 0);
    c.strokeStyle = col('#8a6a3a'); c.lineWidth = 5; line(c, 34, 8, 34, -70);
    c.fillStyle = col('#4fae5a'); leaf(c, 34, 0, 0, 14, 7); leaf(c, 34, 0, PI, 14, 7);
    c.restore();
    // the head: a flytrap seen from the side, jaws hinged at the back
    var open = snap ? 1.05 : 0.32 + Math.sin(t * 2.4) * 0.08;
    c.save(); c.translate(-6, -168);
    function jaw(up) {
      c.save(); c.rotate(up ? -open * 0.55 : open * 0.55); c.scale(1, up ? 1 : -1);
      c.fillStyle = green;
      c.beginPath(); c.moveTo(-40, 0); c.quadraticCurveTo(0, -62, 72, 0); c.closePath(); c.fill();
      c.fillStyle = col('#d9465a');
      c.beginPath(); c.moveTo(-30, 0); c.quadraticCurveTo(5, -36, 62, 0); c.closePath(); c.fill();
      c.strokeStyle = col('#fff3c4'); c.lineWidth = 2.5;
      for (var k = 0; k < 8; k++) { var tx = -26 + k * 12; line(c, tx, 0, tx + 3, 10); }
      if (up) {
        c.fillStyle = col('#e8686b'); leaf(c, -24, -30, -PI * 0.75, 38, 10);     // knightly plume
        c.fillStyle = '#ffffff'; ellipse(c, 12, -30, 8, 9);
        c.fillStyle = PAL.ink; circle(c, 15, -29, 4);
        c.strokeStyle = PAL.ink; c.lineWidth = 3; line(c, 2, -42, 22, -36);
      }
      c.restore();
    }
    jaw(false); jaw(true);
    c.restore();
  };

  BOSS_ART.mold = function (c, o, col) {
    var t = o.t || 0, i;
    function baby(x, s) {
      c.fillStyle = col('#efe3cc'); rr(c, x - 5 * s, -18 * s, 10 * s, 18 * s, 4 * s); c.fill();
      c.fillStyle = col('#9a62c4');
      c.beginPath(); c.moveTo(x - 16 * s, -16 * s); c.bezierCurveTo(x - 16 * s, -34 * s, x + 16 * s, -34 * s, x + 16 * s, -16 * s); c.closePath(); c.fill();
      c.fillStyle = col('#58e6d9'); circle(c, x - 4 * s, -24 * s, 2.5 * s);
    }
    baby(-112, 1.1); baby(-84, 0.8); baby(98, 1); baby(124, 0.7);
    c.fillStyle = col('#efe3cc');
    c.beginPath(); c.moveTo(-46, 0); c.quadraticCurveTo(-40, -60, -34, -112); c.lineTo(34, -112); c.quadraticCurveTo(40, -60, 46, 0); c.closePath(); c.fill();
    c.fillStyle = col('#d9cdb4');
    c.beginPath(); c.moveTo(14, 0); c.quadraticCurveTo(22, -60, 20, -112); c.lineTo(34, -112); c.quadraticCurveTo(40, -60, 46, 0); c.closePath(); c.fill();
    // a sleepy, sinister face
    c.fillStyle = col('#58e6d9'); ellipse(c, -16, -78, 10, 6); ellipse(c, 16, -78, 10, 6);
    c.fillStyle = col('#efe3cc'); c.fillRect(-28, -86, 56, 7);
    c.fillStyle = PAL.ink; circle(c, -14, -77, 2.4); circle(c, 18, -77, 2.4);
    c.fillStyle = '#3a1a3a';
    c.beginPath(); c.moveTo(-24, -56); c.quadraticCurveTo(0, -34, 24, -56); c.quadraticCurveTo(0, -46, -24, -56); c.fill();
    // gills and the enormous cap
    c.fillStyle = col('#c9b9a0'); ellipse(c, 0, -112, 122, 16);
    c.strokeStyle = col('#a8987e'); c.lineWidth = 1.5;
    for (i = -5; i <= 5; i++) line(c, i * 10, -112, i * 22, -100);
    c.fillStyle = col('#7b4fa0');
    c.beginPath(); c.moveTo(-152, -108); c.bezierCurveTo(-152, -238, 152, -238, 152, -108); c.quadraticCurveTo(0, -92, -152, -108); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.1)'; ellipse(c, -60, -190, 50, 16, -0.3);
    var pulse = 0.85 + 0.15 * Math.sin(t * 2.5);
    var spots = [[-90, -150, 14], [-40, -188, 11], [20, -172, 16], [82, -150, 12], [112, -122, 8], [-122, -126, 8], [-10, -140, 9], [52, -205, 8]];
    c.fillStyle = col('#58e6d9');
    for (i = 0; i < spots.length; i++) circle(c, spots[i][0], spots[i][1], spots[i][2] * pulse);
    c.fillStyle = 'rgba(200,150,240,0.55)';         // drifting spores
    for (i = 0; i < 10; i++) circle(c, Math.sin(t * 0.5 + i * 2.1) * 140, -120 - ((t * 20 + i * 31) % 160), 3);
  };

  BOSS_ART.eclipse = function (c, o, col) {
    var t = o.t || 0, p2 = o.phase === 2, dark = o.state === 'armorUp', i, a;
    c.fillStyle = col('#1f3a4a');
    c.beginPath(); c.ellipse(-92, -6, 62, 14, 0, 0.3, PI * 2 - 0.3); c.lineTo(-92, -6); c.closePath(); c.fill();
    c.beginPath(); c.ellipse(96, -4, 56, 12, 0, PI + 0.3, PI * 3 - 0.3); c.lineTo(96, -4); c.closePath(); c.fill();
    c.strokeStyle = col('#2a2a5a'); c.lineWidth = 14; c.lineCap = 'round'; line(c, 0, 0, 0, -112);
    var edge = col(p2 ? '#ff5a7a' : '#ff8fd8');
    function petalAt(ang, len, wid, fill) {
      c.save(); c.translate(0, -120); c.rotate(ang);
      c.fillStyle = fill;
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(wid, -len * 0.5, 0, -len); c.quadraticCurveTo(-wid, -len * 0.5, 0, 0); c.fill();
      c.strokeStyle = edge; c.lineWidth = 3; c.stroke();
      if (p2) { c.strokeStyle = 'rgba(255,90,122,0.85)'; c.lineWidth = 1.5; line(c, 0, -len * 0.3, wid * 0.3, -len * 0.62); }
      c.restore();
    }
    var open = p2 ? 1.25 : 1;
    for (i = -3; i <= 3; i++) petalAt(i * 0.42 * open, 150, 36, col(p2 ? '#3a1450' : '#232463'));
    for (i = -2; i <= 2; i++) petalAt(i * 0.36 * open, 118, 30, col(p2 ? '#521a6a' : '#34358a'));
    var cy = -150, g = c.createRadialGradient(0, cy, 20, 0, cy, 72);
    g.addColorStop(0, p2 ? 'rgba(255,90,90,0.95)' : 'rgba(255,214,110,0.95)');
    g.addColorStop(1, 'rgba(255,180,80,0)');
    c.fillStyle = g; circle(c, 0, cy, 72);
    c.fillStyle = '#05040e'; circle(c, 0, cy, 34);
    c.strokeStyle = p2 ? '#ff7a7a' : '#ffe9a8'; c.lineWidth = 2.5;
    c.beginPath(); c.arc(0, cy, 34, 0, PI * 2); c.stroke();
    var blink = Math.sin(t * 0.7) > 0.97 ? 0.15 : 1;
    c.fillStyle = p2 ? '#ff5a5a' : '#ffd24a'; ellipse(c, 0, cy, 6, 18 * blink);
    for (i = 0; i < 6; i++) {
      a = t * 0.6 + i * PI / 3;
      c.fillStyle = col(i % 2 ? '#ffd3f0' : '#9fa8ff');
      star(c, Math.cos(a) * 140, cy + Math.sin(a) * 50, 7, 4, 0.4);
    }
    if (dark) {
      c.fillStyle = 'rgba(10,6,30,0.45)';
      c.beginPath(); c.ellipse(0, -130, 165, 122, 0, 0, PI * 2); c.fill();
      c.strokeStyle = 'rgba(160,140,255,0.6)'; c.lineWidth = 3; c.stroke();
    }
  };

  /** Draws a boss in unit space at the current origin. */
  Art.boss = function (c, id, o) {
    var hurt = o.hurt || 0;
    var col = hurt > 0.02 ? function (h) { return mix(h, '#ffffff', hurt * 0.5); } : function (h) { return h; };
    c.save();
    c.fillStyle = 'rgba(0,0,0,0.35)'; ellipse(c, 0, 2, 125, 16);
    var breathe = Math.sin((o.t || 0) * 2.1) * 0.02;
    c.scale(1 + breathe, 1 - breathe);
    BOSS_ART[id](c, o, col);
    if (o.state === 'shield') {          // a translucent shield dome
      c.fillStyle = 'rgba(170,255,190,0.16)'; c.strokeStyle = 'rgba(200,255,210,0.85)'; c.lineWidth = 3;
      c.beginPath(); c.ellipse(0, -112, 150, 132, 0, 0, PI * 2); c.fill(); c.stroke();
    }
    c.restore();
  };

  /** A small golden trophy for a beaten boss (windowsill decoration). */
  Art.trophy = function (c, x, y, s, gem) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.fillStyle = '#8a6a2a'; c.fillRect(-6, -4, 12, 4);
    c.fillStyle = '#e0a82a'; c.fillRect(-1.5, -10, 3, 6);
    c.fillStyle = PAL.gold;
    c.beginPath(); c.moveTo(-7, -21); c.lineTo(7, -21); c.quadraticCurveTo(7, -9, 0, -9); c.quadraticCurveTo(-7, -9, -7, -21); c.fill();
    c.strokeStyle = '#e0a82a'; c.lineWidth = 1.6;
    c.beginPath(); c.arc(-7, -16, 3, PI * 0.5, PI * 1.5); c.stroke();
    c.beginPath(); c.arc(7, -16, 3, -PI * 0.5, PI * 0.5); c.stroke();
    c.fillStyle = gem; circle(c, 0, -15.5, 2.4);
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
    if (sp.rare) {           // rare seeds come in a gold-trimmed packet
      c.strokeStyle = '#e0a82a'; c.lineWidth = 2; rr(c, -15, -21, 30, 40, 4); c.stroke();
      c.fillStyle = '#ffd24a'; star(c, 11, -17, 5, 5, 0.45);
    }
  };

  /** A sitting cat in the given coat, for the shop. */
  Art.drawCatIcon = function (canvas, skinId) {
    var I = prepIcon(canvas), c = I.c;
    var s = Math.min(I.w / 62, I.h / 60);
    Art.cat(c, I.w / 2 + 3 * s, I.h - 5 * s, s, { t: 0, walking: false, dir: 1, happy: false, blink: false,
      skin: C.CAT_SKINS_BY_ID[skinId] });
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

  /** A boss portrait for the Wild Patch list. opts: { silhouette } for bosses not yet reached. */
  Art.drawBossIcon = function (canvas, id, opts) {
    opts = opts || {};
    var I = prepIcon(canvas), c = I.c;
    var s = Math.min(I.w / 340, I.h / 262);
    c.save();
    c.translate(I.w / 2, I.h - (I.h - 248 * s) / 2 - 6 * s);
    c.scale(s, s);
    Art.boss(c, id, { t: 1.2, hurt: 0, state: 'idle', phase: 1 });
    c.restore();
    if (opts.silhouette) {
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = '#26352e'; c.fillRect(0, 0, I.w, I.h);
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = 'rgba(255,243,214,0.75)';
      c.font = '900 ' + Math.round(I.h * 0.32) + 'px system-ui, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('?', I.w / 2, I.h * 0.55);
    }
  };

  BB.Art = Art;
})(typeof window !== 'undefined' ? window : globalThis);
