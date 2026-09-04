/**
 * Point-set maths shared by the tracer, the grader and the renderer.
 *
 * Everything works on plain `[x, y]` pairs in the 100 × 100 glyph box. The
 * transforms are how the game manufactures "backwards" letters: a mirrored b
 * is a d, a flipped b is a p, and the grader uses the same transforms to
 * recognise when a child has drawn one of those instead of what was asked.
 */

import { resample, pathLength } from './path.js';

export const BOX = 100;

export function bbox(pts) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

export function centroid(pts) {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of pts) {
    sx += x;
    sy += y;
  }
  return [sx / pts.length, sy / pts.length];
}

/** Mirror left↔right about a vertical axis (default: the box centre). */
export const mirrorX = (pts, cx = BOX / 2) => pts.map(([x, y]) => [2 * cx - x, y]);
/** Flip top↔bottom about a horizontal axis. */
export const flipY = (pts, cy) => pts.map(([x, y]) => [x, 2 * cy - y]);
/** Rotate 180° about a point. */
export const rotate180 = (pts, cx, cy) => pts.map(([x, y]) => [2 * cx - x, 2 * cy - y]);

export const TRANSFORMS = ['mirror', 'flip', 'rot'];

/**
 * Apply a named transform to a list of strokes, keeping the shape where it
 * was: mirror about the box's vertical centre line (so the glyph stays inside
 * the box), flip/rotate about the glyph's own bounding-box centre (so a
 * lowercase b flipped lands where a p would sit, not off the page).
 */
export function transformStrokes(strokes, name) {
  if (!name) return strokes;
  const all = strokes.flat();
  const b = bbox(all);
  switch (name) {
    case 'mirror':
      return strokes.map((s) => mirrorX(s));
    case 'flip':
      return strokes.map((s) => flipY(s, b.cy));
    case 'rot':
      return strokes.map((s) => rotate180(s, BOX / 2, b.cy));
    default:
      throw new Error(`unknown transform ${name}`);
  }
}

/**
 * Resample a multi-stroke drawing to a fixed total number of points, sharing
 * them out by stroke length (never fewer than `min` per stroke, so a dot on an
 * i still counts). Returns { points, strokes } where strokes keeps the split.
 */
export function resampleStrokes(strokes, n = 64, min = 3) {
  const lens = strokes.map((s) => pathLength(s));
  const total = lens.reduce((a, b) => a + b, 0);
  let counts = lens.map((l) => (total === 0 ? Math.floor(n / strokes.length) : Math.max(min, Math.round((l / total) * n))));
  // Nudge the counts so they sum to n exactly.
  let diff = n - counts.reduce((a, b) => a + b, 0);
  for (let i = 0; diff !== 0 && i < 1000; i++) {
    const k = i % counts.length;
    if (diff > 0) {
      counts[k]++;
      diff--;
    } else if (counts[k] > min) {
      counts[k]--;
      diff++;
    }
  }
  const out = strokes.map((s, i) => resample(s, Math.max(2, counts[i])));
  return { points: out.flat(), strokes: out };
}

/**
 * Move and scale a drawing so its bounding box lands on `target`'s bounding
 * box. Width and height scale separately so a fat 5 and a skinny 5 both
 * count, but the two factors may only disagree by 2× — beyond that a shape is
 * genuinely wrong, not just proportioned differently. Near-zero dimensions
 * (a 1, an l) borrow the other axis's scale.
 */
export function alignTo(pts, target) {
  const a = bbox(pts);
  const t = bbox(target);
  const THIN = 12;
  let sx = a.w < 1e-6 ? 1 : t.w / a.w;
  let sy = a.h < 1e-6 ? 1 : t.h / a.h;
  const thinT = t.w < THIN || t.h < THIN;
  const thinA = a.w < THIN || a.h < THIN;
  if (thinT || thinA) {
    // Use one uniform scale from the larger dimension of each.
    const s = Math.max(t.w, t.h) / Math.max(a.w, a.h, 1e-6);
    sx = s;
    sy = s;
  } else {
    const ratio = sx / sy;
    if (ratio > 2) sx = sy * 2;
    if (ratio < 0.5) sx = sy * 0.5;
  }
  return pts.map(([x, y]) => [t.cx + (x - a.cx) * sx, t.cy + (y - a.cy) * sy]);
}

/** Mean distance between corresponding points (order- and direction-aware). */
export function seqDistance(a, b) {
  const n = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1]);
  return sum / n;
}

/** Symmetric mean nearest-neighbour distance (order-free "same shape?"). */
export function cloudDistance(a, b) {
  const nearest = (p, set) => {
    let best = Infinity;
    for (const q of set) {
      const d = (p[0] - q[0]) * (p[0] - q[0]) + (p[1] - q[1]) * (p[1] - q[1]);
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  };
  let ab = 0;
  for (const p of a) ab += nearest(p, b);
  let ba = 0;
  for (const q of b) ba += nearest(q, a);
  return (ab / a.length + ba / b.length) / 2;
}

/**
 * Fraction of the points of `a` that lie within `tau` of some point of `b`.
 * The mean distance above is dominated by whatever matches; this is what
 * catches the part that doesn't — the missing hat on a 5, the extra stick
 * that turns a c into an a, the belly on the wrong side.
 */
export function coverage(a, b, tau) {
  const t2 = tau * tau;
  let hit = 0;
  for (const p of a) {
    for (const q of b) {
      const dx = p[0] - q[0];
      const dy = p[1] - q[1];
      if (dx * dx + dy * dy <= t2) {
        hit++;
        break;
      }
    }
  }
  return hit / a.length;
}

export const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
