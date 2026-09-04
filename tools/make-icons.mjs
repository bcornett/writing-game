#!/usr/bin/env node
/**
 * Draws the home-screen icons: Dot — a round coral face with big eyes — on a
 * sunny gradient, with a crayon stroke curling behind her.
 *
 * The icon is described as a function of (u, v) in [0,1] and supersampled 3×
 * for anti-aliasing, so it renders at any size. Run with:
 *
 *   npm run icons
 *
 * Output: icons/icon-180.png (iPad home screen), icon-192.png, icon-512.png.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { encodePng } from './png.mjs';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
const SIZES = [180, 192, 512];
const SS = 3;

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smoothstep = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
/** Anti-aliased disc coverage: 1 inside, soft edge of width `soft`. */
const disc = (u, v, cx, cy, r, soft = 0.006) => smoothstep(r + soft, r - soft, Math.hypot(u - cx, v - cy));

/** Distance from (u,v) to a quadratic Bézier, by sampling — plenty for an icon. */
function curveDistance(u, v, p0, p1, p2) {
  let best = Infinity;
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const s = 1 - t;
    const x = s * s * p0[0] + 2 * s * t * p1[0] + t * t * p2[0];
    const y = s * s * p0[1] + 2 * s * t * p1[1] + t * t * p2[1];
    const d = Math.hypot(u - x, v - y);
    if (d < best) best = d;
  }
  return best;
}

const FACE = { cx: 0.5, cy: 0.54, r: 0.3 };

function sample(u, v) {
  // Sunny background with a soft warm glow behind the face.
  let col = mix([255, 214, 102], [255, 170, 80], smoothstep(0, 1, v * 0.8 + u * 0.2));
  col = mix(col, [255, 240, 190], smoothstep(0.5, 0.05, Math.hypot(u - 0.5, v - 0.5)) * 0.45);

  // Crayon stroke swooping behind Dot: teal, rounded, with a paler core.
  const d1 = curveDistance(u, v, [0.08, 0.34], [0.5, -0.02], [0.92, 0.36]);
  const stroke = smoothstep(0.075, 0.062, d1);
  col = mix(col, [33, 178, 176], stroke);
  col = mix(col, [110, 220, 210], smoothstep(0.03, 0.0, d1) * stroke * 0.5);

  // Shadow under the face.
  col = mix(col, [180, 100, 40], disc(u, v, FACE.cx + 0.012, FACE.cy + 0.03, FACE.r, 0.03) * 0.35);

  // Face: coral, lit from the upper left.
  const body = disc(u, v, FACE.cx, FACE.cy, FACE.r);
  if (body > 0) {
    const nx = (u - FACE.cx) / FACE.r;
    const ny = (v - FACE.cy) / FACE.r;
    const light = clamp01(0.7 - nx * 0.25 - ny * 0.35);
    let face = mix([230, 80, 80], [255, 130, 110], light);
    face = mix(face, [255, 190, 170], smoothstep(0.35, 0, Math.hypot(nx + 0.4, ny + 0.45)) * 0.5);
    col = mix(col, face, body);
  }

  // Eyes: white, dark pupil looking slightly right, a highlight each.
  for (const ex of [FACE.cx - 0.105, FACE.cx + 0.105]) {
    const ey = FACE.cy - 0.05;
    col = mix(col, [255, 255, 255], disc(u, v, ex, ey, 0.062));
    col = mix(col, [40, 38, 60], disc(u, v, ex + 0.012, ey + 0.006, 0.036));
    col = mix(col, [255, 255, 255], disc(u, v, ex + 0.024, ey - 0.012, 0.012));
  }

  // Blush.
  for (const bx of [FACE.cx - 0.17, FACE.cx + 0.17]) {
    col = mix(col, [255, 150, 150], disc(u, v, bx, FACE.cy + 0.06, 0.045, 0.02) * 0.6);
  }

  // Smile: a thick arc, open, with rounded ends.
  const smile = curveDistance(u, v, [FACE.cx - 0.11, FACE.cy + 0.08], [FACE.cx, FACE.cy + 0.2], [FACE.cx + 0.11, FACE.cy + 0.08]);
  col = mix(col, [120, 30, 50], smoothstep(0.022, 0.012, smile));

  return col;
}

function render(size) {
  const W = size * SS;
  const acc = new Float64Array(size * size * 3);
  for (let y = 0; y < W; y++) {
    const v = (y + 0.5) / W;
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W;
      const c = sample(u, v);
      const o = (Math.floor(y / SS) * size + Math.floor(x / SS)) * 3;
      acc[o] += c[0];
      acc[o + 1] += c[1];
      acc[o + 2] += c[2];
    }
  }
  const n = SS * SS;
  const rgba = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    rgba[i * 4] = Math.round(clamp01(acc[i * 3] / n / 255) * 255);
    rgba[i * 4 + 1] = Math.round(clamp01(acc[i * 3 + 1] / n / 255) * 255);
    rgba[i * 4 + 2] = Math.round(clamp01(acc[i * 3 + 2] / n / 255) * 255);
    rgba[i * 4 + 3] = 255;
  }
  return encodePng(size, size, rgba);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const png = render(size);
  const path = join(OUT_DIR, `icon-${size}.png`);
  writeFileSync(path, png);
  console.log(`wrote ${path} (${png.length.toLocaleString()} bytes)`);
}
