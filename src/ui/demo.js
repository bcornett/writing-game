/**
 * Dot demonstrates a glyph: each stroke draws itself in while a little Dot
 * runs along it. Used by the trace screen before the child's turn and by the
 * "Watch Dot" button on the write screen.
 */

import { svgEl, strokePath, guideLines, polylineLength, pointAt, glyphStrokes } from '../render/glyphSvg.js';
import { createMiniDot } from '../render/dot.js';

/**
 * Build the demo layers into `svg` and return a controller.
 * `onStroke(index)` fires as each stroke starts, so a caller can sync sounds.
 */
export function createDemo(svg, glyphId, { road = true, lines = true } = {}) {
  const strokes = glyphStrokes(glyphId);
  const layer = svgEl('g', { class: 'demo-layer' });
  if (lines) layer.appendChild(guideLines());
  if (road) for (const pts of strokes) layer.appendChild(strokePath(pts, { class: 'road' }));
  // The dash gap is longer than the stroke and the hidden offset overshoots
  // by 2 units: with round caps, a dash boundary sitting exactly on the
  // path's end draws a stray dot, so the boundary is kept off the path.
  const fills = strokes.map((pts) => {
    const len = Math.max(0.01, polylineLength(pts));
    const path = strokePath(pts, { class: 'trace-fill trace-fill--demo', 'stroke-dasharray': `${len} ${len + 4}`, 'stroke-dashoffset': len + 2 });
    layer.appendChild(path);
    return { path, len };
  });
  const mini = createMiniDot();
  mini.show(false);
  layer.appendChild(mini.el);
  svg.appendChild(layer);

  let raf = 0;
  let cancelled = false;

  const reset = () => {
    fills.forEach(({ path, len }) => path.setAttribute('stroke-dashoffset', len + 2));
    mini.show(false);
  };

  function play({ onStroke = () => {}, speed = 1 } = {}) {
    cancelled = false;
    reset();
    return new Promise((resolve) => {
      let i = 0;
      const next = () => {
        if (cancelled || i >= strokes.length) {
          mini.show(false);
          resolve(!cancelled);
          return;
        }
        const pts = strokes[i];
        const { path, len } = fills[i];
        onStroke(i);
        mini.show(true);
        const duration = pts.length === 1 ? 350 : (500 + len * 14) / speed;
        const start = performance.now();
        const step = (now) => {
          if (cancelled) return resolve(false);
          const t = Math.min(1, (now - start) / duration);
          const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
          path.setAttribute('stroke-dashoffset', ((len + 2) * (1 - eased)).toFixed(3));
          const p = pointAt(pts, eased);
          mini.moveTo(p[0], p[1]);
          if (t < 1) raf = requestAnimationFrame(step);
          else {
            i++;
            setTimeout(next, 220);
          }
        };
        raf = requestAnimationFrame(step);
      };
      next();
    });
  }

  function stop() {
    cancelled = true;
    cancelAnimationFrame(raf);
    mini.show(false);
  }

  return { play, stop, reset, layer };
}
