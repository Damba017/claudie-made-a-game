/*
 * Barn Bloom - audio.js
 * ------------------------------------------------------------------
 * Every sound is synthesised with the Web Audio API, no files.
 * The AudioContext is only created after the first user interaction
 * (browser autoplay rules); until then all calls are harmless no-ops.
 */
(function (root) {
  'use strict';
  var BB = root.BB = root.BB || {};
  var A = { ctx: null, ready: false };

  var master, sfxGain, musicGain, delay, noiseBuffer;
  var settings = { master: 0.8, music: 0.5, sfx: 0.8, muted: false };
  var lastPlayed = {};
  var musicTimer = null, padTimer = null, musicOn = false;
  var rain = null;

  // Minimum gap (seconds) between two plays of the same effect.
  var THROTTLE = { coin: 0.07, water: 0.09, harvest: 0.06, click: 0.03, sprinkle: 0.25, error: 0.15, feed: 0.08, matured: 0.3 };

  /** Call from a user gesture. Safe to call repeatedly. */
  A.init = function () {
    if (A.ready) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    var Ctx = root.AudioContext || root.webkitAudioContext;
    if (!Ctx) return;
    try {
      A.ctx = new Ctx();
    } catch (err) { return; }
    var ctx = A.ctx;
    master = ctx.createGain();
    sfxGain = ctx.createGain();
    musicGain = ctx.createGain();
    delay = ctx.createDelay(1.5);
    delay.delayTime.value = 0.46;
    var feedback = ctx.createGain(); feedback.gain.value = 0.38;
    var wet = ctx.createGain(); wet.gain.value = 0.5;
    delay.connect(feedback); feedback.connect(delay); delay.connect(wet); wet.connect(musicGain);
    sfxGain.connect(master); musicGain.connect(master); master.connect(ctx.destination);

    // Two seconds of white noise, reused by every noisy effect.
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    var data = noiseBuffer.getChannelData(0);
    for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    A.ready = true;
    A.applySettings(settings);
    if (musicOn) startLoops();
  };

  A.applySettings = function (s) {
    settings = { master: s.master, music: s.music, sfx: s.sfx, muted: s.muted };
    if (!A.ready) return;
    var now = A.ctx.currentTime;
    master.gain.setTargetAtTime(s.muted ? 0 : s.master, now, 0.03);
    sfxGain.gain.setTargetAtTime(s.sfx, now, 0.03);
    musicGain.gain.setTargetAtTime(s.music * 0.6, now, 0.03);
  };

  // ---- Building blocks -------------------------------------------------
  function tone(freq, at, dur, opts) {
    opts = opts || {};
    var ctx = A.ctx, t = ctx.currentTime + (at || 0);
    var osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    var vol = opts.vol === undefined ? 0.2 : opts.vol;
    var attack = opts.attack === undefined ? 0.005 : opts.attack;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
    osc.connect(g);
    g.connect(opts.out || sfxGain);
    if (opts.echo) g.connect(delay);
    osc.start(t);
    osc.stop(t + attack + dur + 0.05);
  }

  function noise(at, dur, opts) {
    opts = opts || {};
    var ctx = A.ctx, t = ctx.currentTime + (at || 0);
    var src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuffer;
    src.loop = true;
    filter.type = opts.filter || 'bandpass';
    filter.Q.value = opts.q || 1;
    filter.frequency.setValueAtTime(opts.from || 1000, t);
    if (opts.to) filter.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    var vol = opts.vol === undefined ? 0.2 : opts.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(0.03, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter); filter.connect(g); g.connect(sfxGain);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  function arp(notes, step, dur, opts) {
    for (var i = 0; i < notes.length; i++) tone(notes[i], i * step, dur, opts);
  }

  // ---- Sound effects ---------------------------------------------------
  var SFX = {
    click: function () { tone(720, 0, 0.05, { type: 'triangle', vol: 0.12, to: 540 }); },
    tab: function () { tone(520, 0, 0.06, { type: 'triangle', vol: 0.1, to: 660 }); },
    water: function () {
      noise(0, 0.38, { from: 1500, to: 500, q: 0.8, vol: 0.22 });
      for (var i = 0; i < 4; i++) tone(700 + Math.random() * 700, 0.04 + i * 0.07, 0.06, { vol: 0.07, to: 400 + Math.random() * 200 });
    },
    sprinkle: function () { noise(0, 0.22, { from: 2600, to: 1400, q: 1.5, vol: 0.06 }); },
    coin: function () {
      tone(988, 0, 0.08, { type: 'square', vol: 0.07 });
      tone(1319, 0.07, 0.22, { type: 'square', vol: 0.07 });
      tone(1319, 0.07, 0.3, { vol: 0.1 });
    },
    harvest: function () {
      tone(320, 0, 0.1, { vol: 0.25, to: 760 });
      noise(0, 0.1, { from: 2400, to: 900, vol: 0.12, q: 0.7 });
    },
    plant: function () {
      tone(190, 0, 0.14, { vol: 0.28, to: 90 });
      noise(0, 0.08, { filter: 'lowpass', from: 700, vol: 0.12 });
    },
    feed: function () { arp([880, 1109, 1319, 1760], 0.055, 0.16, { vol: 0.09, type: 'triangle' }); },
    crumbs: function () { arp([1047, 1319, 1568, 2093, 2637], 0.05, 0.3, { vol: 0.08 }); },
    upgrade: function () {
      arp([523, 659, 784, 1047], 0.08, 0.22, { vol: 0.13, type: 'triangle' });
      tone(1568, 0.34, 0.5, { vol: 0.09 });
    },
    unlock: function () { arp([392, 523, 659, 784, 1047], 0.07, 0.3, { vol: 0.12, type: 'triangle' }); },
    error: function () {
      tone(150, 0, 0.12, { type: 'square', vol: 0.09 });
      tone(112, 0.1, 0.18, { type: 'square', vol: 0.09 });
    },
    achievement: function () {
      arp([784, 1047, 1319, 1568], 0.11, 0.35, { vol: 0.13, type: 'triangle' });
      tone(2093, 0.46, 0.8, { vol: 0.1 });
      tone(1568, 0.46, 0.8, { vol: 0.07 });
    },
    notify: function () { tone(784, 0, 0.25, { vol: 0.12 }); tone(1047, 0.12, 0.4, { vol: 0.12 }); },
    matured: function () { tone(1175, 0, 0.5, { vol: 0.1 }); tone(1760, 0.05, 0.5, { vol: 0.05 }); },
    golden: function () { arp([1319, 1568, 1976, 2637], 0.07, 0.6, { vol: 0.1 }); },
    died: function () { tone(420, 0, 0.5, { vol: 0.16, to: 140, type: 'triangle' }); },
    pest: function () { for (var i = 0; i < 3; i++) tone(1900, i * 0.07, 0.04, { type: 'square', vol: 0.05, to: 1500 }); },
    squish: function () { noise(0, 0.07, { from: 500, to: 200, vol: 0.2, q: 0.6 }); tone(260, 0, 0.07, { vol: 0.14, to: 120 }); },
    shovel: function () { noise(0, 0.2, { filter: 'lowpass', from: 1200, to: 300, vol: 0.2 }); },
    bee: function () { tone(210, 0, 0.35, { type: 'sawtooth', vol: 0.05, to: 250 }); tone(420, 0, 0.35, { type: 'sawtooth', vol: 0.02, to: 500 }); },
    purr: function () {
      for (var i = 0; i < 14; i++) noise(i * 0.055, 0.05, { filter: 'lowpass', from: 160, vol: 0.2, q: 2 });
    },
    squeak: function () { tone(1700, 0, 0.07, { vol: 0.06, to: 2300 }); },
    order: function () { arp([659, 784, 988, 1319], 0.09, 0.3, { vol: 0.12, type: 'triangle' }); },
    thunder: function () { noise(0, 1.1, { filter: 'lowpass', from: 220, to: 60, vol: 0.3, q: 0.5 }); },
    shutter: function () { noise(0, 0.05, { from: 3000, vol: 0.15 }); noise(0.09, 0.06, { from: 2000, vol: 0.12 }); }
  };

  A.play = function (name) {
    if (!A.ready || settings.muted || !SFX[name]) return;
    var now = A.ctx.currentTime, gap = THROTTLE[name] || 0;
    if (gap && lastPlayed[name] !== undefined && now - lastPlayed[name] < gap) return;
    lastPlayed[name] = now;
    try { SFX[name](); } catch (err) { /* never let a sound break the game */ }
  };

  // ---- Generative ambient music ---------------------------------------
  // A slow pad that walks through four chords, with sparse pentatonic
  // bell notes drifting over it through a feedback delay.
  var SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99];
  var PADS = [[130.81, 196.0], [110.0, 164.81], [87.31, 130.81], [98.0, 146.83]];
  var padIndex = 0;

  function playBell() {
    if (!musicOn || !A.ready) return;
    if (A.ctx.state === 'running') {
      var n = SCALE[Math.floor(Math.random() * SCALE.length)];
      tone(n, 0, 2.2, { vol: 0.1, attack: 0.03, out: musicGain, echo: true });
      tone(n * 2, 0, 1.2, { vol: 0.02, attack: 0.03, out: musicGain });
      if (Math.random() < 0.35) {
        var m = SCALE[Math.floor(Math.random() * SCALE.length)];
        tone(m, 0.35, 2.0, { vol: 0.07, attack: 0.03, out: musicGain, echo: true });
      }
    }
    musicTimer = setTimeout(playBell, 1400 + Math.random() * 2600);
  }

  function playPad() {
    if (!musicOn || !A.ready) return;
    if (A.ctx.state === 'running') {
      var chord = PADS[padIndex % PADS.length];
      padIndex++;
      for (var i = 0; i < chord.length; i++) {
        tone(chord[i], 0, 8.5, { vol: 0.07, attack: 2.5, out: musicGain });
        tone(chord[i] * 2.005, 0, 8.5, { vol: 0.025, attack: 3, type: 'triangle', out: musicGain });
      }
    }
    padTimer = setTimeout(playPad, 8000);
  }

  function startLoops() {
    clearTimeout(musicTimer); clearTimeout(padTimer);
    playPad();
    musicTimer = setTimeout(playBell, 1200);
  }

  A.startMusic = function () {
    if (musicOn) return;
    musicOn = true;
    if (A.ready) startLoops();
  };
  A.stopMusic = function () {
    musicOn = false;
    clearTimeout(musicTimer); clearTimeout(padTimer);
  };

  /** Soft looping rain noise while the rainy-day event is active. */
  A.setRain = function (on) {
    if (!A.ready) return;
    var ctx = A.ctx;
    if (on && !rain) {
      var src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noiseBuffer; src.loop = true;
      filter.type = 'lowpass'; filter.frequency.value = 2400;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.09, ctx.currentTime + 1.5);
      src.connect(filter); filter.connect(g); g.connect(sfxGain);
      src.start();
      rain = { src: src, gain: g };
    } else if (!on && rain) {
      var r = rain; rain = null;
      r.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.5);
      try { r.src.stop(ctx.currentTime + 2.5); } catch (err) { /* already stopped */ }
    }
  };

  BB.Audio = A;
})(typeof window !== 'undefined' ? window : globalThis);
