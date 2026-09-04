/**
 * SVG path strings → polylines, with no DOM.
 *
 * Every glyph in the game is authored as a handful of absolute SVG path
 * strings (one per pen stroke). The browser could sample those with
 * `getPointAtLength`, but the tracer, the grader and every test need the same
 * points in Node, so the sampling lives here and the renderer draws the
 * polylines instead of the raw path. One source of truth for the shape.
 *
 * Supported commands (absolute only, which is all the glyphs use):
 *   M x,y   L x,y   H x   V y   C x1,y1 x2,y2 x,y   Q x1,y1 x,y
 *   A rx,ry rot large sweep x,y   Z
 */

const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;

/** Split a path string into { cmd, args[] } records. Relative commands are rejected loudly. */
export function parsePath(d) {
  const out = [];
  const re = /([MLHVCQAZmlhvcqaz])([^MLHVCQAZmlhvcqaz]*)/g;
  let m;
  while ((m = re.exec(d))) {
    const cmd = m[1];
    if (cmd !== cmd.toUpperCase()) {
      throw new Error(`relative path command "${cmd}" is not supported: ${d}`);
    }
    const args = (m[2].match(NUMBER) ?? []).map(Number);
    out.push({ cmd, args });
  }
  return out;
}

const lerp = (a, b, t) => a + (b - a) * t;

function cubic(p0, p1, p2, p3, steps, out) {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const x =
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
    const y =
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
    out.push([x, y]);
  }
}

function quad(p0, p1, p2, steps, out) {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    out.push([
      u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
      u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
    ]);
  }
}

/** Elliptical arc, endpoint → centre parameterisation (SVG spec appendix F.6.5). */
function arc(p0, rx, ry, rotDeg, large, sweep, p1, steps, out) {
  const [x1, y1] = p0;
  const [x2, y2] = p1;
  if (x1 === x2 && y1 === y2) return;
  if (rx === 0 || ry === 0) {
    out.push([x2, y2]);
    return;
  }
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const phi = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx2 = (x1 - x2) / 2;
  const dy2 = (y1 - y2) / 2;
  const x1p = cos * dx2 + sin * dy2;
  const y1p = -sin * dx2 + cos * dy2;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const sign = large === sweep ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const coef = sign * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const angle = (ux, uy, vx, vy) => {
    const dot = ux * vx + uy * vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    let a = Math.acos(Math.max(-1, Math.min(1, dot / len)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };
  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dtheta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dtheta > 0) dtheta -= Math.PI * 2;
  if (sweep && dtheta < 0) dtheta += Math.PI * 2;
  for (let i = 1; i < steps; i++) {
    const th = theta1 + (dtheta * i) / steps;
    const ct = Math.cos(th);
    const st = Math.sin(th);
    out.push([cx + rx * ct * cos - ry * st * sin, cy + rx * ct * sin + ry * st * cos]);
  }
  // Land exactly on the endpoint rather than a rounding error away from it.
  out.push([x2, y2]);
}

/**
 * Sample a path into a polyline. Curves get `steps` segments each; straight
 * lines get their endpoints only (resample() evens things out afterwards).
 * A path that lifts the pen (a second M) is an authoring mistake for a single
 * stroke, so it throws.
 */
export function flattenPath(d, steps = 24) {
  const pts = [];
  let start = null;
  let cur = null;
  for (const { cmd, args } of parsePath(d)) {
    switch (cmd) {
      case 'M':
        if (pts.length) throw new Error(`stroke has more than one M: ${d}`);
        cur = [args[0], args[1]];
        start = cur;
        pts.push(cur);
        // Extra pairs after M are implicit L commands.
        for (let i = 2; i + 1 < args.length; i += 2) {
          cur = [args[i], args[i + 1]];
          pts.push(cur);
        }
        break;
      case 'L':
        for (let i = 0; i + 1 < args.length; i += 2) {
          cur = [args[i], args[i + 1]];
          pts.push(cur);
        }
        break;
      case 'H':
        for (const x of args) {
          cur = [x, cur[1]];
          pts.push(cur);
        }
        break;
      case 'V':
        for (const y of args) {
          cur = [cur[0], y];
          pts.push(cur);
        }
        break;
      case 'C':
        for (let i = 0; i + 5 < args.length; i += 6) {
          const end = [args[i + 4], args[i + 5]];
          cubic(cur, [args[i], args[i + 1]], [args[i + 2], args[i + 3]], end, steps, pts);
          cur = end;
        }
        break;
      case 'Q':
        for (let i = 0; i + 3 < args.length; i += 4) {
          const end = [args[i + 2], args[i + 3]];
          quad(cur, [args[i], args[i + 1]], end, steps, pts);
          cur = end;
        }
        break;
      case 'A':
        for (let i = 0; i + 6 < args.length; i += 7) {
          const end = [args[i + 5], args[i + 6]];
          arc(cur, args[i], args[i + 1], args[i + 2], args[i + 3] !== 0, args[i + 4] !== 0, end, steps, pts);
          cur = end;
        }
        break;
      case 'Z':
        if (start && (cur[0] !== start[0] || cur[1] !== start[1])) {
          cur = start;
          pts.push(cur);
        }
        break;
      default:
        throw new Error(`unsupported path command ${cmd}`);
    }
  }
  if (!pts.length) throw new Error(`empty path: ${d}`);
  return pts;
}

/** Total length of a polyline. */
export function pathLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return len;
}

/**
 * Resample a polyline to exactly `n` points spaced evenly by arc length, first
 * and last points preserved. A degenerate polyline (a dot) becomes n copies of
 * the same point, which keeps every downstream loop simple.
 */
export function resample(pts, n) {
  if (n < 2) throw new Error('resample needs at least 2 points');
  const total = pathLength(pts);
  if (total === 0 || pts.length === 1) return Array.from({ length: n }, () => [pts[0][0], pts[0][1]]);
  const step = total / (n - 1);
  const out = [[pts[0][0], pts[0][1]]];
  let acc = 0;
  let i = 1;
  let prev = pts[0];
  let target = step;
  while (out.length < n - 1 && i < pts.length) {
    const p = pts[i];
    const seg = Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    if (acc + seg >= target - 1e-9) {
      const t = seg === 0 ? 0 : (target - acc) / seg;
      const q = [lerp(prev[0], p[0], t), lerp(prev[1], p[1], t)];
      out.push(q);
      prev = q;
      acc = target;
      target += step;
      // Stay on this segment; it may hold several samples.
      continue;
    }
    acc += seg;
    prev = p;
    i++;
  }
  while (out.length < n - 1) out.push([out[out.length - 1][0], out[out.length - 1][1]]);
  out.push([pts[pts.length - 1][0], pts[pts.length - 1][1]]);
  return out;
}

/** Polyline → path string, for rendering. */
export function pointsToPath(pts) {
  if (!pts.length) return '';
  let d = `M${fmt(pts[0][0])},${fmt(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) d += ` L${fmt(pts[i][0])},${fmt(pts[i][1])}`;
  return d;
}

const fmt = (v) => Math.round(v * 100) / 100;
