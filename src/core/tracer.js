/**
 * Finger-follows-the-road tracing, as a pure state machine.
 *
 * A stroke is sampled into evenly spaced points. The finger has to land near
 * the start dot, then may advance only a few samples per move — it cannot
 * skip to the end or run the stroke backwards, which is the whole point when
 * a child's habit is drawing a 5 from the wrong side. Wandering off the road
 * is forgiven for a moment (fingers are wobbly), then the finger has to come
 * back to where it left off. Nothing here ever fails the child: a slip just
 * pauses progress.
 */

import { flattenPath, resample, pathLength } from './path.js';
import { dist } from './geometry.js';

export const TRACE = {
  samples: 48,
  /** Distance from the start dot within which a touch begins the stroke. */
  startRadius: 15,
  /** Distance from the last reached point within which a touch resumes it. */
  resumeRadius: 16,
  tolerance: { easy: 17, normal: 13, tricky: 10 },
  /** Samples the finger may advance in one move event. */
  lookahead: 6,
  /** Consecutive off-road moves tolerated before the stroke pauses. */
  offEventsAllowed: 10,
  /** Beyond tolerance × this, the finger is so far off the stroke pauses at once. */
  farFactor: 2.4,
  /** Fraction of a stroke that must be covered at pen-up for it to count. */
  finishFraction: 0.88,
  /** A stroke shorter than this is a dot (the top of an i), completed by a tap. */
  dotLength: 3,
};

export function strokeSamples(d) {
  const raw = flattenPath(d);
  const len = pathLength(raw);
  const isDot = len < TRACE.dotLength;
  return { pts: isDot ? [raw[0]] : resample(raw, TRACE.samples), len, isDot };
}

export function createTrace(glyph, { strictness = 'normal' } = {}) {
  return {
    glyphId: glyph.id,
    strokes: glyph.strokes.map(strokeSamples),
    index: 0,
    cur: 0,
    active: false,
    done: false,
    tolerance: TRACE.tolerance[strictness] ?? TRACE.tolerance.normal,
    off: 0,
    /** Times the finger wandered off and had to come back — a quality signal, never a penalty. */
    slips: 0,
    /** Times a stroke was started from the wrong place. */
    misses: 0,
  };
}

export const currentStroke = (s) => s.strokes[s.index];

/** Where the finger has got to on the current stroke, for drawing the guide. */
export function tracePoint(s) {
  const st = currentStroke(s);
  return st ? st.pts[Math.min(s.cur, st.pts.length - 1)] : null;
}

/** 0..1 along the current stroke. */
export function traceProgress(s) {
  const st = currentStroke(s);
  if (!st || st.isDot) return s.active ? 1 : 0;
  return s.cur / (st.pts.length - 1);
}

export function traceDown(s, x, y) {
  if (s.done) return { type: 'ignored' };
  const st = currentStroke(s);
  const p = [x, y];
  if (st.isDot) {
    if (dist(p, st.pts[0]) <= TRACE.startRadius) {
      s.active = true;
      return { type: 'start' };
    }
    s.misses++;
    return { type: 'miss' };
  }
  if (s.cur > 0 && dist(p, st.pts[s.cur]) <= TRACE.resumeRadius) {
    s.active = true;
    s.off = 0;
    return { type: 'resume' };
  }
  if (dist(p, st.pts[0]) <= TRACE.startRadius) {
    s.active = true;
    s.cur = 0;
    s.off = 0;
    return { type: 'start' };
  }
  s.misses++;
  return { type: 'miss', nearEnd: dist(p, st.pts[st.pts.length - 1]) <= TRACE.startRadius };
}

export function traceMove(s, x, y) {
  if (!s.active || s.done) return { type: 'ignored' };
  const st = currentStroke(s);
  if (st.isDot) return { type: 'progress', progress: 1 };
  const p = [x, y];
  const last = st.pts.length - 1;
  const hi = Math.min(last, s.cur + TRACE.lookahead);
  let best = s.cur;
  let bestD = Infinity;
  for (let i = s.cur; i <= hi; i++) {
    const d = dist(p, st.pts[i]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  if (bestD <= s.tolerance) {
    s.cur = best;
    s.off = 0;
    return { type: 'progress', progress: s.cur / last };
  }
  s.off++;
  if (bestD > s.tolerance * TRACE.farFactor || s.off > TRACE.offEventsAllowed) {
    s.active = false;
    s.off = 0;
    s.slips++;
    return { type: 'slip', progress: s.cur / last };
  }
  return { type: 'off', progress: s.cur / last };
}

export function traceUp(s) {
  if (!s.active || s.done) return { type: 'ignored' };
  s.active = false;
  const st = currentStroke(s);
  const progress = st.isDot ? 1 : s.cur / (st.pts.length - 1);
  if (progress < TRACE.finishFraction) return { type: 'incomplete', progress };
  s.index++;
  s.cur = 0;
  s.off = 0;
  if (s.index >= s.strokes.length) {
    s.done = true;
    return { type: 'glyph-complete', slips: s.slips, misses: s.misses };
  }
  return { type: 'stroke-complete', next: s.index };
}

export function traceReset(s) {
  s.index = 0;
  s.cur = 0;
  s.active = false;
  s.done = false;
  s.off = 0;
  s.slips = 0;
  s.misses = 0;
}
