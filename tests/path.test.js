import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePath, flattenPath, pathLength, resample, pointsToPath } from '../src/core/path.js';

const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test('parsePath splits commands and rejects relative ones', () => {
  assert.deepEqual(parsePath('M1,2 L3,4'), [
    { cmd: 'M', args: [1, 2] },
    { cmd: 'L', args: [3, 4] },
  ]);
  assert.throws(() => parsePath('m1,2 l3,4'), /relative/);
});

test('flattenPath keeps straight lines as their endpoints and measures length', () => {
  const pts = flattenPath('M0,0 L10,0 L10,10');
  assert.deepEqual(pts, [[0, 0], [10, 0], [10, 10]]);
  assert.ok(close(pathLength(pts), 20));
});

test('flattenPath handles H, V, Q, C and Z', () => {
  const pts = flattenPath('M0,0 H10 V10 Q5,15 0,10 Z');
  assert.deepEqual(pts[0], [0, 0]);
  assert.deepEqual(pts[1], [10, 0]);
  assert.deepEqual(pts[2], [10, 10]);
  assert.deepEqual(pts[pts.length - 1], [0, 0], 'Z closes back to the start');
  const cubic = flattenPath('M0,0 C0,10 10,10 10,0');
  assert.deepEqual(cubic[cubic.length - 1], [10, 0]);
  for (const [, y] of cubic) assert.ok(y >= 0 && y <= 7.5 + 1e-9, `cubic stays under its hull, got y=${y}`);
});

test('flattenPath samples arcs on the circle', () => {
  const pts = flattenPath('M0,10 A10,10 0 0 1 10,0');
  assert.deepEqual(pts[pts.length - 1], [10, 0]);
  const centres = [[0, 0], [10, 10]];
  const onCircle = centres.filter((c) => pts.every((p) => close(Math.hypot(p[0] - c[0], p[1] - c[1]), 10, 1e-4)));
  assert.equal(onCircle.length, 1, 'every sample is 10 from one consistent centre');
});

test('a stroke with two M commands is an authoring error', () => {
  assert.throws(() => flattenPath('M0,0 L1,1 M5,5 L6,6'), /more than one M/);
});

test('resample spaces points evenly by arc length and keeps the ends', () => {
  const pts = resample([[0, 0], [10, 0], [10, 10]], 5);
  assert.deepEqual(pts, [[0, 0], [5, 0], [10, 0], [10, 5], [10, 10]]);
  const many = resample(flattenPath('M0,0 C0,40 40,40 40,0'), 33);
  assert.equal(many.length, 33);
  const steps = [];
  for (let i = 1; i < many.length; i++) steps.push(Math.hypot(many[i][0] - many[i - 1][0], many[i][1] - many[i - 1][1]));
  const mean = steps.reduce((a, b) => a + b) / steps.length;
  for (const s of steps) assert.ok(Math.abs(s - mean) < mean * 0.05, 'steps within 5% of each other');
});

test('resample of a dot repeats the point', () => {
  assert.deepEqual(resample([[3, 4]], 3), [[3, 4], [3, 4], [3, 4]]);
  assert.deepEqual(resample([[3, 4], [3, 4]], 2), [[3, 4], [3, 4]]);
});

test('pointsToPath round-trips through flattenPath', () => {
  const d = pointsToPath([[1.234, 2], [3, 4.5]]);
  assert.equal(d, 'M1.23,2 L3,4.5');
  assert.deepEqual(flattenPath(d), [[1.23, 2], [3, 4.5]]);
});
