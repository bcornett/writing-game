import test from 'node:test';
import assert from 'node:assert/strict';
import { GLYPHS, GLYPH_BY_ID } from '../src/core/glyphs.js';
import { gradeDrawing, templateOf, distinctTransforms, matchScore, band, dtw, GRADE } from '../src/core/grader.js';
import { REVERSAL_PRONE } from '../src/core/curriculum.js';
import { synthDrawing, scribble } from './synth.js';
import { makeRng } from '../src/core/rng.js';

const digits = GLYPHS.filter((g) => g.kind === 'digit');
const letters = GLYPHS.filter((g) => g.kind !== 'digit');
const othersFor = (g) => (g.kind === 'digit' ? digits : letters);

test('a wobbly, shrunken, tilted copy of every glyph earns at least two stars', () => {
  const rng = makeRng(101);
  const failures = [];
  for (const g of GLYPHS) {
    for (let i = 0; i < 12; i++) {
      const drawing = synthDrawing(g, rng, {
        jitter: 1.2 + rng() * 1.2,
        scale: 0.5 + rng() * 0.9,
        dx: (rng() - 0.5) * 30,
        dy: (rng() - 0.5) * 20,
        rot: (rng() - 0.5) * 10,
      });
      const r = gradeDrawing(drawing, g, { others: othersFor(g) });
      if (r.stars < 2) failures.push(`${g.id}#${i}: ${r.outcome} score ${r.score.toFixed(1)} ${r.lookalike ?? ''}`);
    }
  }
  assert.deepEqual(failures, []);
});

test('a neat copy is three stars', () => {
  const rng = makeRng(7);
  const failures = [];
  for (const g of GLYPHS) {
    const r = gradeDrawing(synthDrawing(g, rng, { jitter: 0.8 }), g, { others: othersFor(g) });
    if (r.outcome !== 'great') failures.push(`${g.id}: ${r.outcome} score ${r.score.toFixed(1)} reversed ${r.reversed}`);
  }
  assert.deepEqual(failures, []);
});

test('a mirrored drawing of a reversal-prone glyph is called a reversal, not a bad shape', () => {
  const rng = makeRng(202);
  const failures = [];
  for (const id of REVERSAL_PRONE) {
    const g = GLYPH_BY_ID[id];
    for (let i = 0; i < 6; i++) {
      const drawing = synthDrawing(g, rng, { transform: 'mirror', jitter: 1 + rng() * 1.2, scale: 0.6 + rng() * 0.7, rot: (rng() - 0.5) * 8 });
      const r = gradeDrawing(drawing, g, { others: othersFor(g) });
      if (r.outcome !== 'flipped') failures.push(`${id}#${i}: ${r.outcome} score ${r.score.toFixed(1)} twin ${r.twinScore?.toFixed(1)}`);
    }
  }
  assert.deepEqual(failures, []);
});

test('upside-down and turned-around drawings are called out too', () => {
  const rng = makeRng(303);
  for (const [id, how] of [['b', 'flip'], ['p', 'flip'], ['6', 'rot'], ['9', 'rot'], ['n', 'flip'], ['u', 'flip'], ['7', 'flip'], ['J', 'flip']]) {
    const g = GLYPH_BY_ID[id];
    assert.ok(distinctTransforms(g).includes(how), `${id} has a ${how} twin`);
    const r = gradeDrawing(synthDrawing(g, rng, { transform: how, jitter: 1.2 }), g, { others: othersFor(g) });
    assert.equal(r.outcome, 'upside', `${id} ${how}: got ${r.outcome} (score ${r.score.toFixed(1)})`);
  }
});

test('drawing a different letter is reported as a look-alike', () => {
  const rng = makeRng(404);
  const cases = [
    ['b', 'h'],
    ['c', 'o'],
    ['7', '1'],
    ['F', 'E'],
    ['P', 'R'],
    ['l', 't'],
  ];
  for (const [asked, drew] of cases) {
    const g = GLYPH_BY_ID[asked];
    const r = gradeDrawing(synthDrawing(GLYPH_BY_ID[drew], rng, { jitter: 1 }), g, { others: othersFor(g) });
    assert.ok(r.outcome === 'looks-like' || r.stars === 0, `${asked} drawn as ${drew}: ${r.outcome}`);
    if (r.outcome === 'looks-like') assert.equal(r.lookalike, drew, `${asked}: should name ${drew}, named ${r.lookalike}`);
  }
  // Without a list of other glyphs there is nothing to name, and a wrong shape simply scores low.
  const r = gradeDrawing(synthDrawing(GLYPH_BY_ID['h'], rng, { jitter: 1 }), GLYPH_BY_ID['b']);
  assert.notEqual(r.outcome, 'looks-like');
  assert.ok(r.stars <= 2, 'an h is at best a so-so b');
});

test('a good shape drawn from the wrong end is a gentle direction note, still two stars', () => {
  const rng = makeRng(505);
  for (const id of ['1', '7', 'l', 'c', 'L', 'J', 'z']) {
    const g = GLYPH_BY_ID[id];
    const r = gradeDrawing(synthDrawing(g, rng, { reverse: true, jitter: 1 }), g, { others: othersFor(g) });
    assert.equal(r.outcome, 'backward', `${id}: ${r.outcome}`);
    assert.equal(r.stars, 2);
    assert.ok(r.reversed > 0);
  }
});

test('stroke order does not matter for the shape; direction still does', () => {
  const rng = makeRng(606);
  const five = GLYPH_BY_ID['5'];
  const hatFirst = gradeDrawing(synthDrawing(five, rng, { order: [1, 0], jitter: 1 }), five, { others: digits });
  assert.equal(hatFirst.outcome, 'great');
  const e = GLYPH_BY_ID['E'];
  const armsFirst = gradeDrawing(synthDrawing(e, rng, { order: [1, 2, 3, 0], jitter: 1 }), e, { others: letters });
  assert.ok(armsFirst.stars >= 2);
});

test('scribbles, taps and nothing at all are a friendly try-again', () => {
  const rng = makeRng(707);
  const five = GLYPH_BY_ID['5'];
  for (let i = 0; i < 10; i++) {
    const r = gradeDrawing(scribble(rng), five, { others: digits });
    assert.ok(r.stars === 0, `scribble ${i} scored ${r.outcome}`);
  }
  assert.equal(gradeDrawing([], five).outcome, 'try-again');
  assert.equal(gradeDrawing([[[50, 50]]], five).outcome, 'try-again');
  assert.equal(gradeDrawing([[[50, 50], [51, 50]]], five).outcome, 'try-again');
  assert.equal(gradeDrawing([[[NaN, 1]]], five).outcome, 'try-again');
});

test('an accidental tap alongside a good drawing is ignored', () => {
  const rng = makeRng(808);
  const b = GLYPH_BY_ID['b'];
  const drawing = [...synthDrawing(b, rng, { jitter: 1 }), [[80, 90], [80.5, 90.5]]];
  assert.equal(gradeDrawing(drawing, b, { others: letters }).outcome, 'great');
});

test('the dot of an i counts', () => {
  const rng = makeRng(909);
  const i = GLYPH_BY_ID['i'];
  const withDot = gradeDrawing(synthDrawing(i, rng, { jitter: 0.8 }), i, { others: letters });
  assert.equal(withDot.outcome, 'great');
  const noDot = gradeDrawing([synthDrawing(i, rng, { jitter: 0.8 })[0]], i, { others: letters });
  assert.ok(noDot.outcome === 'looks-like' || noDot.stars < 3, `an i without its dot is not perfect: ${noDot.outcome}`);
});

test('matchScore, dtw and band behave at the edges', () => {
  const t = templateOf(GLYPH_BY_ID['5']);
  const perfect = matchScore(t.points, t);
  assert.ok(perfect.score < 1e-9);
  assert.equal(perfect.reversed, 0);
  assert.deepEqual(perfect.order, [0, 1], 'natural order wins a tie');
  assert.equal(band(perfect.score), 'great');
  assert.equal(band(99), null);
  assert.ok(GRADE.bands.great < GRADE.bands.good && GRADE.bands.good < GRADE.bands.okay);
  assert.equal(dtw([[0, 0], [1, 0], [2, 0]], [[0, 0], [1, 0], [2, 0]]), 0);
  const line = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]];
  assert.ok(dtw(line, [...line].reverse()) > 1, 'a reversed sequence does not warp onto itself');
  assert.ok(dtw(line, [[0, 0], [0.5, 0], [1, 0], [1.5, 0], [2, 0], [2.5, 0], [3, 0], [3.5, 0], [4, 0]]) < 0.3, 'a different parametrisation does');
});

test('twins are distinct where they should be, and only there', () => {
  assert.deepEqual(distinctTransforms(GLYPH_BY_ID['0']), []);
  assert.deepEqual(distinctTransforms(GLYPH_BY_ID['8']), []);
  assert.ok(distinctTransforms(GLYPH_BY_ID['c']).includes('mirror'));
  assert.ok(distinctTransforms(GLYPH_BY_ID['s']).includes('mirror'));
  assert.ok(distinctTransforms(GLYPH_BY_ID['z']).includes('mirror'));
  assert.ok(!distinctTransforms(GLYPH_BY_ID['1']).includes('mirror'));
  assert.deepEqual(distinctTransforms(GLYPH_BY_ID['o']), []);
  assert.deepEqual(distinctTransforms(GLYPH_BY_ID['O']), []);
  assert.deepEqual(distinctTransforms(GLYPH_BY_ID['1']), []);
  assert.deepEqual(distinctTransforms(GLYPH_BY_ID['l']), []);
});
