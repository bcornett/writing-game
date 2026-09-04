#!/usr/bin/env node
/**
 * Threshold tuning for the grader: prints, per glyph, how far synthetic
 * "child" drawings land from the template (self, mirrored, and the nearest
 * other glyph). Run with `node dev/grade-sweep.mjs`.
 */
import { GLYPHS } from '../src/core/glyphs.js';
import { templateOf, gradeDrawing, matchScore } from '../src/core/grader.js';
import { synthDrawing } from '../tests/synth.js';
import { makeRng } from '../src/core/rng.js';
import { resampleStrokes } from '../src/core/geometry.js';

const rng = makeRng(7);
const rows = [];
for (const g of GLYPHS) {
  const t = templateOf(g);
  const fit = (strokes) => matchScore(resampleStrokes(strokes, 64).points, t);
  const self = [];
  const outcomes = {};
  for (let i = 0; i < 20; i++) {
    const d = synthDrawing(g, rng, { jitter: 1.6, scale: 0.6 + rng() * 0.8, rot: (rng() - 0.5) * 12 });
    self.push(fit(d));
    const o = gradeDrawing(d, g, { others: GLYPHS.filter((x) => x.kind === g.kind) }).outcome;
    outcomes[o] = (outcomes[o] ?? 0) + 1;
  }
  let mirror = null;
  if (t.twins.mirror) {
    const ms = [];
    for (let i = 0; i < 10; i++) ms.push(fit(synthDrawing(g, rng, { transform: 'mirror', jitter: 1.6 })));
    mirror = ms;
  }
  let nearest = { id: '-', score: Infinity };
  for (const o of GLYPHS) {
    if (o.id === g.id || o.kind !== g.kind || o.id.toLowerCase() === g.id.toLowerCase()) continue;
    const m = matchScore(templateOf(o).points, t);
    if (m.score < nearest.score) nearest = { id: o.id, score: m.score };
  }
  const scores = (arr) => arr.map((m) => m.score);
  const avg = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
  rows.push(
    `${g.id.padEnd(2)} self avg ${avg(scores(self))} max ${Math.max(...scores(self)).toFixed(1)} | mirror ${mirror ? `min ${Math.min(...scores(mirror)).toFixed(1)}` : 'n/a    '} | twins ${Object.keys(t.twins).join(',').padEnd(15)} | nearest ${nearest.id} ${nearest.score.toFixed(1)} | ${JSON.stringify(outcomes)}`,
  );
}
console.log(rows.join('\n'));
