/**
 * Sound effects, synthesised with Web Audio. No files.
 *
 * iOS refuses to start an AudioContext outside a user gesture, so nothing is
 * built until `unlock()` is called from a tap. Everything is deliberately
 * soft: this gets played at the kitchen table.
 */

export function createSfx() {
  let ctx = null;
  let master = null;
  let enabled = true;

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
    // A silent blip inside the gesture is what actually unlocks the context on iOS.
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    o.connect(g).connect(master);
    o.start();
    o.stop(ctx.currentTime + 0.02);
    return ctx;
  }

  function tone(freq, at, dur, { type = 'sine', peak = 0.25, slideTo = null } = {}) {
    if (!ctx || !enabled) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(master);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  function noise(at, dur, { peak = 0.2, freq = 1800, q = 1 } = {}) {
    if (!ctx || !enabled) return;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = freq;
    band.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(band).connect(g).connect(master);
    src.start(at);
  }

  const SOUNDS = {
    tap: (t) => tone(660, t, 0.08, { type: 'triangle', peak: 0.12 }),
    pop: (t) => {
      tone(420, t, 0.12, { type: 'square', peak: 0.12, slideTo: 900 });
      noise(t, 0.08, { peak: 0.12, freq: 2500 });
    },
    ding: (t) => {
      tone(880, t, 0.35, { peak: 0.2 });
      tone(1318.5, t + 0.08, 0.4, { peak: 0.14 });
    },
    stroke: (t) => tone(523.25, t, 0.18, { type: 'triangle', peak: 0.16, slideTo: 784 }),
    sparkle: (t) => {
      [1046.5, 1318.5, 1568, 2093].forEach((f, i) => tone(f, t + i * 0.06, 0.25, { peak: 0.1 }));
    },
    star: (t) => {
      [783.99, 987.77, 1174.66].forEach((f, i) => tone(f, t + i * 0.09, 0.3, { type: 'triangle', peak: 0.14 }));
    },
    fanfare: (t) => {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.11, 0.35, { type: 'triangle', peak: 0.16 }));
      tone(1318.5, t + 0.44, 0.7, { peak: 0.14 });
      tone(1046.5, t + 0.44, 0.7, { type: 'triangle', peak: 0.1 });
    },
    boop: (t) => tone(300, t, 0.22, { type: 'sine', peak: 0.16, slideTo: 200 }),
    whoosh: (t) => noise(t, 0.25, { peak: 0.1, freq: 900, q: 0.6 }),
    wobble: (t) => {
      tone(330, t, 0.12, { type: 'triangle', peak: 0.1 });
      tone(280, t + 0.13, 0.16, { type: 'triangle', peak: 0.1 });
    },
    unlock: (t) => {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, t + i * 0.07, 0.4, { peak: 0.12 }));
    },
  };

  return {
    unlock,
    get context() {
      return ctx;
    },
    get enabled() {
      return enabled;
    },
    setEnabled(on) {
      enabled = Boolean(on);
    },
    play(name) {
      if (!ctx || !enabled) return;
      const fn = SOUNDS[name];
      if (!fn) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      fn(ctx.currentTime + 0.01);
    },
  };
}
