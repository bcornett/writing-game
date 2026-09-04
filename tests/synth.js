/**
 * Synthetic child drawings for the grader tests: the template, roughed up.
 *
 * Wobble is low-frequency (a shaky hand, not white noise), and the drawing
 * can be shrunk, moved, tilted, mirrored, drawn from the wrong end, or drawn
 * with the strokes in a different order.
 */
import { flattenPath, resample } from '../src/core/path.js';
import { transformStrokes, bbox } from '../src/core/geometry.js';

export function synthDrawing(
  glyph,
  rng,
  { jitter = 1.2, scale = 1, dx = 0, dy = 0, rot = 0, transform = null, reverse = false, order = null, pointsPerStroke = 28 } = {},
) {
  let strokes = glyph.strokes.map((d) => flattenPath(d));
  strokes = transformStrokes(strokes, transform);
  if (order) strokes = order.map((i) => strokes[i]);
  const b = bbox(strokes.flat());
  const rad = (rot * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return strokes.map((s) => {
    let pts = s.length > 1 ? resample(s, pointsPerStroke) : [[s[0][0], s[0][1]]];
    if (reverse) pts = [...pts].reverse();
    const phaseX = rng() * Math.PI * 2;
    const phaseY = rng() * Math.PI * 2;
    const freq = 0.35 + rng() * 0.4;
    return pts.map(([x, y], i) => {
      const wx = jitter * (Math.sin(i * freq + phaseX) + 0.5 * (rng() - 0.5));
      const wy = jitter * (Math.cos(i * freq * 1.3 + phaseY) + 0.5 * (rng() - 0.5));
      const px = x - b.cx;
      const py = y - b.cy;
      const rx = px * cos - py * sin;
      const ry = px * sin + py * cos;
      return [b.cx + rx * scale + dx + wx, b.cy + ry * scale + dy + wy];
    });
  });
}

/** A random walk that is not any letter. */
export function scribble(rng, n = 40) {
  let x = 50;
  let y = 50;
  const pts = [];
  for (let i = 0; i < n; i++) {
    x += (rng() - 0.5) * 18;
    y += (rng() - 0.5) * 18;
    pts.push([x, y]);
  }
  return [pts];
}
