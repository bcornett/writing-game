import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bbox,
  mirrorX,
  flipY,
  rotate180,
  transformStrokes,
  resampleStrokes,
  alignTo,
  seqDistance,
  cloudDistance,
} from '../src/core/geometry.js';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test('transforms do what they say', () => {
  assert.deepEqual(mirrorX([[30, 10]]), [[70, 10]]);
  assert.deepEqual(flipY([[30, 10]], 50), [[30, 90]]);
  assert.deepEqual(rotate180([[30, 10]], 50, 50), [[70, 90]]);
});

test('transformStrokes keeps the shape in its box', () => {
  const strokes = [[[34, 12], [34, 84]], [[34, 50], [66, 62], [34, 80]]];
  const before = bbox(strokes.flat());
  for (const name of ['mirror', 'flip', 'rot']) {
    const after = bbox(transformStrokes(strokes, name).flat());
    assert.ok(near(after.w, before.w) && near(after.h, before.h), `${name} preserves size`);
    assert.ok(near(after.cy, before.cy), `${name} keeps the vertical centre`);
  }
  assert.throws(() => transformStrokes(strokes, 'spin'), /unknown transform/);
});

test('resampleStrokes shares points out by length, at least three per stroke', () => {
  const long = [[0, 0], [100, 0]];
  const short = [[0, 10], [2, 10]];
  const { points, strokes } = resampleStrokes([long, short], 32);
  assert.equal(points.length, 32);
  assert.equal(strokes.length, 2);
  assert.ok(strokes[0].length > strokes[1].length);
  assert.ok(strokes[1].length >= 3);
});

test('alignTo undoes a move and a scale', () => {
  const shape = [[20, 20], [60, 20], [60, 80], [20, 80], [40, 50]];
  const moved = shape.map(([x, y]) => [x * 0.3 + 5, y * 0.3 + 60]);
  const back = alignTo(moved, shape);
  back.forEach((p, i) => {
    assert.ok(near(p[0], shape[i][0], 1e-6) && near(p[1], shape[i][1], 1e-6));
  });
});

test('alignTo limits how far the two axes may disagree', () => {
  const target = [[20, 20], [60, 20], [60, 80], [20, 80]]; // 40 × 60
  const squashed = [[0, 0], [100, 0], [100, 20], [0, 20]]; // 100 × 20 — nothing like the target
  const out = bbox(alignTo(squashed, target));
  const aspectIn = 100 / 20;
  const aspectOut = out.w / out.h;
  assert.ok(aspectOut >= aspectIn / 2 - 1e-9 && aspectOut <= aspectIn * 2 + 1e-9, `aspect may change at most 2× (got ${aspectOut})`);
  assert.ok(Math.abs(out.w - 40) > 5 || Math.abs(out.h - 60) > 5, 'so it does not land on the target box');
});

test('alignTo copes with a thin shape like a 1', () => {
  const target = [[50, 12], [50, 84]];
  const drawn = [[10, 10], [11, 40]];
  const out = alignTo(drawn, target);
  const b = bbox(out);
  assert.ok(near(b.h, 72, 1e-6), 'height matched');
  assert.ok(b.w < 5, 'width scaled by the same factor, not blown up');
});

test('distances: identical is zero, direction matters only for seqDistance', () => {
  const a = [[0, 0], [10, 0], [20, 0]];
  const r = [...a].reverse();
  assert.equal(cloudDistance(a, a), 0);
  assert.equal(cloudDistance(a, r), 0);
  assert.equal(seqDistance(a, a), 0);
  assert.ok(seqDistance(a, r) > 10);
  assert.ok(near(cloudDistance(a, [[0, 3], [10, 3], [20, 3]]), 3));
});
