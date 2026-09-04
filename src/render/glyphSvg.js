/**
 * Drawing glyphs on screen.
 *
 * Every letter in the game — on a card, in a bubble, as the road to trace —
 * comes from the same stroke data in src/core/glyphs.js, rendered here as
 * SVG polylines with round caps. Rendering the sampled polyline rather than
 * the raw path means a mirrored or flipped glyph is just the same points
 * transformed, and what the child traces is exactly what the grader knows.
 */

import { GLYPH_BY_ID, LINES } from '../core/glyphs.js';
import { flattenPath, pointsToPath } from '../core/path.js';
import { transformStrokes } from '../core/geometry.js';

export const SVG_NS = 'http://www.w3.org/2000/svg';

export function svgEl(tag, attrs = {}, children = []) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    el.setAttribute(k, String(v));
  }
  for (const c of children) el.appendChild(c);
  return el;
}

const strokeCache = new Map();

/** Point arrays for a glyph's strokes, optionally mirrored / flipped / turned. */
export function glyphStrokes(id, transform = null) {
  const key = `${id}|${transform ?? ''}`;
  let strokes = strokeCache.get(key);
  if (!strokes) {
    const g = GLYPH_BY_ID[id];
    if (!g) throw new Error(`unknown glyph ${id}`);
    strokes = transformStrokes(g.strokes.map((d) => flattenPath(d)), transform);
    strokeCache.set(key, strokes);
  }
  return strokes;
}

/** A <path> for one stroke's points. A dot becomes a tiny closed segment so round caps draw it. */
export function strokePath(pts, attrs = {}) {
  const d = pts.length === 1 ? `M${pts[0][0]},${pts[0][1]} L${pts[0][0] + 0.01},${pts[0][1]}` : pointsToPath(pts);
  return svgEl('path', { d, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...attrs });
}

/** The three handwriting lines: top, dashed middle, baseline. */
export function guideLines(attrs = {}) {
  const g = svgEl('g', { class: 'guide-lines', ...attrs });
  g.appendChild(svgEl('line', { x1: 4, y1: LINES.top, x2: 96, y2: LINES.top, class: 'guide-line' }));
  g.appendChild(svgEl('line', { x1: 4, y1: LINES.mid, x2: 96, y2: LINES.mid, class: 'guide-line guide-line--mid' }));
  g.appendChild(svgEl('line', { x1: 4, y1: LINES.base, x2: 96, y2: LINES.base, class: 'guide-line' }));
  return g;
}

/**
 * A complete little picture of a glyph: an <svg> with optional lines and
 * the strokes drawn in one colour. Used for cards, bubbles and stickers.
 */
export function glyphCard(id, { transform = null, lines = false, width = 9, className = '' } = {}) {
  const svg = svgEl('svg', { viewBox: '0 0 100 100', class: `glyph-svg ${className}`.trim(), 'aria-hidden': 'true' });
  if (lines) svg.appendChild(guideLines());
  const ink = svgEl('g', { class: 'glyph-ink', 'stroke-width': width });
  for (const pts of glyphStrokes(id, transform)) ink.appendChild(strokePath(pts));
  svg.appendChild(ink);
  return svg;
}

/** Direction arrows along a stroke: small chevrons at the given fractions of its length. */
export function strokeArrows(pts, fractions = [0.45, 0.8]) {
  const g = svgEl('g', { class: 'stroke-arrows' });
  if (pts.length < 4) return g;
  for (const f of fractions) {
    const i = Math.min(pts.length - 2, Math.max(1, Math.round(f * (pts.length - 1))));
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i + 1];
    const angle = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
    const [x, y] = pts[i];
    g.appendChild(
      svgEl('path', {
        d: 'M-3.2,-3.4 L1.2,0 L-3.2,3.4',
        transform: `translate(${x.toFixed(2)},${y.toFixed(2)}) rotate(${angle.toFixed(1)})`,
        class: 'stroke-arrow',
      }),
    );
  }
  return g;
}

/** The green start dot with the stroke number in it. */
export function startDot(pt, number) {
  const g = svgEl('g', { class: 'start-dot', transform: `translate(${pt[0].toFixed(2)},${pt[1].toFixed(2)})` });
  g.appendChild(svgEl('circle', { r: 6.5, class: 'start-dot__ring' }));
  g.appendChild(svgEl('circle', { r: 5, class: 'start-dot__fill' }));
  const t = svgEl('text', { y: 2.2, 'text-anchor': 'middle', class: 'start-dot__num' });
  t.textContent = String(number);
  g.appendChild(t);
  return g;
}

/** Total length of a polyline, for dash animations. */
export function polylineLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return len;
}

/** The point at a fraction of the way along a polyline. */
export function pointAt(pts, fraction) {
  if (pts.length === 1) return pts[0];
  const total = polylineLength(pts);
  let target = Math.max(0, Math.min(1, fraction)) * total;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (target <= seg || i === pts.length - 1) {
      const t = seg === 0 ? 0 : target / seg;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
    }
    target -= seg;
  }
  return pts[pts.length - 1];
}
