/**
 * Grading a freehand attempt.
 *
 * The child draws with nothing to trace. We compare the drawing to the glyph
 * she was asked for — and, crucially, to that glyph's backwards, upside-down
 * and turned-around twins. A drawing that matches the mirror image better than
 * the real thing is a reversal, and the game says so specifically ("that five
 * is facing the wrong way") instead of a vague "try again". It also notices a
 * different letter entirely (a d for a b), and a good shape drawn from the
 * wrong end.
 *
 * How the matching works: the drawing is moved and scaled onto the template,
 * then compared as a *sequence* of points with dynamic time warping. Warping
 * forgives proportions (a fat belly on the 5, a long hat) but not order or
 * direction, which is exactly what tells a c from a backwards c — an
 * unordered comparison can't, because their ink overlaps almost everywhere.
 * Every stroke order and every stroke direction of the template is tried, so
 * drawing the hat of the 5 first costs nothing, and the winning combination
 * reveals which strokes were drawn backwards.
 *
 * No machine learning; the thresholds are pinned by tests/grader.test.js,
 * which grades hundreds of synthetic wobbly, shrunken, tilted and mirrored
 * drawings.
 */

import { flattenPath, pathLength } from './path.js';
import { resampleStrokes, alignTo, bbox, centroid, cloudDistance, coverage, transformStrokes, TRANSFORMS } from './geometry.js';

export const GRADE = {
  /** Points per drawing, shared out across strokes by length. */
  n: 64,
  /** Warping window as a fraction of n (how far the parametrisation may drift). */
  window: 0.25,
  /** Match score (warped distance plus the coverage penalty) at or under which the shape is… */
  bands: { great: 5.5, good: 8.5, okay: 12.5 },
  /** A twin has to beat the real thing by this ratio to be called a reversal. */
  twinRatio: 0.7,
  /** Another glyph has to beat the asked-for one by this ratio, and fit it well, to be a look-alike. */
  lookalikeRatio: 0.5,
  /** A transform whose result matches the original under this is not a distinct twin. */
  distinct: 6,
  /** Strokes shorter than this are accidental taps (unless the glyph has a dot). */
  minStrokeLen: 3,
  /** Coverage radius for the "did she draw all of it, and nothing else" check… */
  tau: 7,
  /** …and what each missing tenth of coverage adds to the score. */
  coverWeight: 25,
  /** A stroke whose ends are this close is a closed loop, which may start anywhere along it. */
  closedGap: 5,
  /** Start points tried for a closed loop. */
  loopStarts: 8,
  /** A mirror twin within this factor of the best twin is reported instead: it is the common reversal. */
  mirrorPreference: 1.2,
  /** A drawn stroke smaller than this fraction of the glyph's height is a dot (when the glyph has one). */
  dotFraction: 0.35,
};

/**
 * Dynamic time warping between two point sequences: the mean distance along
 * the best monotonic alignment, constrained to a band so a whole stroke can't
 * collapse onto one point.
 */
export function dtw(a, b, windowFrac = GRADE.window) {
  const n = a.length;
  const m = b.length;
  const w = Math.max(Math.ceil(Math.max(n, m) * windowFrac), Math.abs(n - m), 1);
  const cost = new Float64Array((n + 1) * (m + 1)).fill(Infinity);
  const steps = new Float64Array((n + 1) * (m + 1));
  const W = m + 1;
  cost[0] = 0;
  for (let i = 1; i <= n; i++) {
    const lo = Math.max(1, i - w);
    const hi = Math.min(m, i + w);
    const ax = a[i - 1][0];
    const ay = a[i - 1][1];
    for (let j = lo; j <= hi; j++) {
      const d = Math.hypot(ax - b[j - 1][0], ay - b[j - 1][1]);
      const up = cost[(i - 1) * W + j];
      const left = cost[i * W + j - 1];
      const diag = cost[(i - 1) * W + j - 1];
      let best = diag;
      let from = (i - 1) * W + j - 1;
      if (up < best) {
        best = up;
        from = (i - 1) * W + j;
      }
      if (left < best) {
        best = left;
        from = i * W + j - 1;
      }
      cost[i * W + j] = best + d;
      steps[i * W + j] = steps[from] + 1;
    }
  }
  const end = n * W + m;
  return cost[end] / steps[end];
}

function permutations(k) {
  if (k === 1) return [[0]];
  const out = [];
  for (const p of permutations(k - 1)) {
    for (let i = 0; i <= p.length; i++) out.push([...p.slice(0, i), k - 1, ...p.slice(i)]);
  }
  return out;
}

const isClosed = (pts) =>
  pts.length > 8 &&
  Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) <= GRADE.closedGap &&
  pathLength(pts) >= 20;

/**
 * The ways one stroke may legitimately be drawn: forwards or backwards, and
 * for a closed loop (an o, a 0) starting anywhere along it. A dot has one way.
 */
function variantsOf(pts) {
  // A dot has no direction, and reversing it must not count as "drawn backwards".
  if (pts.length < 2 || pathLength(pts) < GRADE.minStrokeLen) return [{ pts, reversed: 0 }];
  const starts = isClosed(pts) ? GRADE.loopStarts : 1;
  const out = [];
  for (let r = 0; r < starts; r++) {
    const offset = Math.round((r * (pts.length - 1)) / starts);
    const rotated = r === 0 ? pts : [...pts.slice(offset, pts.length - 1), ...pts.slice(0, offset + 1)];
    out.push({ pts: rotated, reversed: 0 });
    out.push({ pts: [...rotated].reverse(), reversed: 1 });
  }
  return out;
}

/** Every stroke order × every way of drawing each stroke, as concatenated sequences. */
function combosOf(sampledStrokes) {
  const variants = sampledStrokes.map(variantsOf);
  const combos = [];
  const build = (order, slot, chosen) => {
    if (slot === order.length) {
      const seq = [];
      let reversed = 0;
      for (const v of chosen) {
        reversed += v.reversed;
        for (const p of v.pts) seq.push(p);
      }
      combos.push({ seq, order, reversed });
      return;
    }
    for (const v of variants[order[slot]]) build(order, slot + 1, [...chosen, v]);
  };
  for (const order of permutations(sampledStrokes.length)) build(order, 0, []);
  return combos;
}

function candidateOf(strokes) {
  const { points, strokes: sampled } = resampleStrokes(strokes, GRADE.n);
  return { points, sampled, combos: combosOf(sampled), strokeCount: strokes.length };
}

const cache = new Map();

/** Sampled strokes, all stroke-order/direction variants, and distinct twins for a glyph — computed once. */
export function templateOf(glyph) {
  let t = cache.get(glyph.id);
  if (t) return t;
  const strokes = glyph.strokes.map((d) => flattenPath(d));
  const hasDot = strokes.some((s) => pathLength(s) < GRADE.minStrokeLen);
  const base = candidateOf(strokes);
  const twins = {};
  for (const name of TRANSFORMS) {
    const twin = candidateOf(transformStrokes(strokes, name));
    // A mirrored 0 is a 0; only keep twins that actually look different —
    // from the glyph, and from each other (a turned 3 is just a mirrored 3).
    if (matchScore(base.points, twin).score <= GRADE.distinct) continue;
    if (Object.values(twins).some((kept) => matchScore(kept.points, twin).score <= GRADE.distinct)) continue;
    twins[name] = twin;
  }
  t = { id: glyph.id, kind: glyph.kind, strokes, hasDot, ...base, twins };
  cache.set(glyph.id, t);
  return t;
}

/** Which of mirror / flip / rot produce a visibly different shape for this glyph. */
export const distinctTransforms = (glyph) => Object.keys(templateOf(glyph).twins);

/**
 * Best warped match of a drawn sequence against a candidate, over all of the
 * candidate's stroke orders and directions. `reversed` counts the strokes the
 * child drew the wrong way round in the winning combination.
 */
export function matchScore(drawnPoints, candidate) {
  const aligned = alignTo(drawnPoints, candidate.points);
  let best = { score: Infinity, reversed: 0, order: null };
  for (const c of candidate.combos) {
    const score = dtw(aligned, c.seq);
    // Strict less-than: on a tie the forward, natural-order combination wins.
    if (score < best.score) best = { score, reversed: c.reversed, order: c.order };
  }
  // Warping can stretch a short stroke over a long one; coverage catches
  // what warping forgives — a missing hat, an extra crossbar.
  best.cover = Math.min(coverage(aligned, candidate.points, GRADE.tau), coverage(candidate.points, aligned, GRADE.tau));
  best.mean = cloudDistance(aligned, candidate.points);
  best.warp = best.score;
  best.score = best.warp + (1 - best.cover) * GRADE.coverWeight;
  return best;
}

/** great / good / okay / null for a match score. */
export function band(score) {
  for (const name of ['great', 'good', 'okay']) if (score <= GRADE.bands[name]) return name;
  return null;
}

function clean(strokes, keepDots) {
  return strokes
    .filter((s) => Array.isArray(s) && s.length >= 1)
    .map((s) => s.map(([x, y]) => [Number(x), Number(y)]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)))
    .filter((s) => s.length >= 1 && (keepDots || pathLength(s) >= GRADE.minStrokeLen));
}

const sameLetter = (a, b) => a.id.toLowerCase() === b.id.toLowerCase();

/** alignTo, but keeping the stroke boundaries. */
function splitAligned(strokes, target) {
  const aligned = alignTo(strokes.flat(), target);
  const out = [];
  let i = 0;
  for (const s of strokes) {
    out.push(aligned.slice(i, i + s.length));
    i += s.length;
  }
  return out;
}

/**
 * @param {number[][][]} strokes  the child's strokes, in glyph-box units, in the order drawn
 * @param {object} glyph          the glyph she was asked to write
 * @param {object} [options]
 * @param {object[]} [options.others]  glyphs to consider as look-alikes (default: none)
 * @returns {{ outcome: string, stars: number, score: number, reversed: number, twin?: string, lookalike?: string }}
 *
 * Outcomes: great · good · backward · okay · flipped · upside · looks-like · try-again
 */
export function gradeDrawing(strokes, glyph, { others = [] } = {}) {
  const template = templateOf(glyph);
  const drawn = clean(strokes, template.hasDot);
  if (!drawn.length || drawn.flat().length < 2) {
    return { outcome: 'try-again', stars: 0, score: Infinity, reversed: 0, reason: 'empty' };
  }
  // Work in template units from here: move the whole drawing onto the
  // template once, then a dot is a dot regardless of how big she drew.
  const moved = splitAligned(drawn, template.points);
  const dotSize = bbox(template.points).h * GRADE.dotFraction;
  const strokesForMatch = template.hasDot
    ? moved.map((s) => {
        const b = bbox(s);
        return Math.hypot(b.w, b.h) < dotSize ? [centroid(s)] : s;
      })
    : moved;
  const { points } = resampleStrokes(strokesForMatch, GRADE.n);

  const direct = matchScore(points, template);
  const shape = band(direct.score);
  const base = { score: direct.score, cover: direct.cover, reversed: direct.reversed, strokeCount: drawn.length };

  // Twins: backwards, upside down, turned around. A mirrored z is also a
  // flipped z drawn the other way; when twins tie, "backwards" is the one to say.
  const twinMatches = Object.entries(template.twins).map(([name, candidate]) => [name, matchScore(points, candidate)]);
  twinMatches.sort((a, b) => a[1].score - b[1].score);
  let twin = twinMatches[0]?.[0] ?? null;
  let twinMatch = twinMatches[0]?.[1] ?? null;
  const mirror = twinMatches.find(([name]) => name === 'mirror');
  if (mirror && twinMatch && mirror[1].score <= twinMatch.score * GRADE.mirrorPreference) {
    twin = 'mirror';
    twinMatch = mirror[1];
  }
  if (twin && band(twinMatch.score) && twinMatch.score < direct.score * GRADE.twinRatio) {
    return { outcome: twin === 'mirror' ? 'flipped' : 'upside', stars: 0, twin, twinScore: twinMatch.score, ...base };
  }

  // Other glyphs she might have drawn instead.
  if (others.length) {
    let lookalike = null;
    let lookMatch = null;
    for (const other of others) {
      if (other.id === glyph.id || sameLetter(other, glyph)) continue;
      const m = matchScore(points, templateOf(other));
      if (!lookMatch || m.score < lookMatch.score) {
        lookMatch = m;
        lookalike = other.id;
      }
    }
    if (lookalike && band(lookMatch.score) === 'great' && lookMatch.score < direct.score * GRADE.lookalikeRatio) {
      return { outcome: 'looks-like', stars: 0, lookalike, lookScore: lookMatch.score, ...base };
    }
  }

  const backward = direct.reversed > 0 && direct.reversed >= Math.ceil(template.strokeCount / 2);
  if (shape === 'great') return backward ? { outcome: 'backward', stars: 2, ...base } : { outcome: 'great', stars: 3, ...base };
  if (shape === 'good') return backward ? { outcome: 'backward', stars: 2, ...base } : { outcome: 'good', stars: 2, ...base };
  if (shape === 'okay') return { outcome: 'okay', stars: 1, ...base };
  return { outcome: 'try-again', stars: 0, reason: 'shape', ...base };
}
