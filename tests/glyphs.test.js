import test from 'node:test';
import assert from 'node:assert/strict';
import { GLYPHS, GLYPH_BY_ID, LINES, DIGITS, LOWERCASE, UPPERCASE } from '../src/core/glyphs.js';
import { flattenPath, pathLength } from '../src/core/path.js';
import { bbox, alignTo, cloudDistance, transformStrokes, resampleStrokes } from '../src/core/geometry.js';
import { templateOf, distinctTransforms, GRADE } from '../src/core/grader.js';
import { REVERSAL_PRONE, TWIN_PAIRS } from '../src/core/curriculum.js';

test('there are ten digits and both alphabets, with unique, filesystem-safe slugs', () => {
  assert.equal(GLYPHS.length, 62);
  assert.equal(DIGITS.length, 10);
  assert.equal(LOWERCASE.length, 26);
  assert.equal(UPPERCASE.length, 26);
  const slugs = GLYPHS.map((g) => g.slug.toLowerCase());
  assert.equal(new Set(slugs).size, 62, 'slugs must stay unique on a case-insensitive disk');
  for (const g of GLYPHS) assert.match(g.slug, /^[dlu][0-9a-z]$/);
});

test('every stroke parses, stays inside the box and sits on the handwriting lines', () => {
  for (const g of GLYPHS) {
    assert.ok(g.strokes.length >= 1 && g.strokes.length <= 4, `${g.id} stroke count`);
    const pts = g.strokes.map((d) => flattenPath(d));
    const b = bbox(pts.flat());
    assert.ok(b.minX >= 20 && b.maxX <= 80, `${g.id} within horizontal margins (${b.minX}..${b.maxX})`);
    assert.ok(b.minY >= LINES.top - 3 && b.maxY <= LINES.desc + 3, `${g.id} within the lines (${b.minY}..${b.maxY})`);
    if (g.kind !== 'lower') {
      assert.ok(Math.abs(b.minY - LINES.top) <= 4, `${g.id} reaches the top line (minY ${b.minY})`);
      assert.ok(Math.abs(b.maxY - LINES.base) <= 5, `${g.id} sits on the baseline (maxY ${b.maxY})`);
    } else if (!['j', 'g', 'p', 'q', 'y'].includes(g.id)) {
      assert.ok(Math.abs(b.maxY - LINES.base) <= 4, `${g.id} sits on the baseline (maxY ${b.maxY})`);
    }
    // Kindergarten rule: start at the top (or at least not at the bottom).
    const start = pts[0][0];
    assert.ok(start[1] <= 70, `${g.id} first stroke starts in the upper part (y=${start[1]})`);
  }
});

test('only i and j have dot strokes', () => {
  for (const g of GLYPHS) {
    const dots = g.strokes.filter((d) => pathLength(flattenPath(d)) < 3).length;
    assert.equal(dots, ['i', 'j'].includes(g.id) ? 1 : 0, `${g.id} dots`);
  }
});

test('twins really are twins: a mirrored b is a d, a flipped b is a p, a turned 6 is a 9', () => {
  const twinDistance = (id, how, otherId) => {
    const src = GLYPH_BY_ID[id].strokes.map((d) => flattenPath(d));
    const moved = resampleStrokes(transformStrokes(src, how), GRADE.n).points;
    const target = templateOf(GLYPH_BY_ID[otherId]).points;
    return cloudDistance(alignTo(moved, target), target);
  };
  for (const { pair, how } of TWIN_PAIRS) {
    if (how === 'confused') continue;
    const d = twinDistance(pair[0], how, pair[1]);
    assert.ok(d < 5, `${pair[0]} ${how} should look like ${pair[1]} (distance ${d.toFixed(2)})`);
  }
});

test('symmetric glyphs have no mirror twin; reversal-prone ones do', () => {
  for (const id of ['0', '1', '8', 'l', 'o', 'v', 'w', 'x', 'A', 'H', 'I', 'M', 'O', 'T', 'U', 'V', 'W', 'X', 'Y']) {
    assert.ok(!distinctTransforms(GLYPH_BY_ID[id]).includes('mirror'), `${id} mirrors onto itself`);
  }
  for (const id of REVERSAL_PRONE) {
    assert.ok(distinctTransforms(GLYPH_BY_ID[id]).includes('mirror'), `${id} should have a distinct mirror`);
  }
  assert.ok(distinctTransforms(GLYPH_BY_ID['6']).includes('rot'), '6 turned around is different (a 9)');
});

test('spoken names and rhymes are ready for the voice', () => {
  for (const g of GLYPHS) {
    assert.match(g.rhyme, /!$/, `${g.id} rhyme ends with a bang`);
    assert.ok(g.rhyme.includes(g.spoken), `${g.id} rhyme names the glyph`);
    assert.ok(!/\b[a-z]\b/.test(g.spoken.replace(/-/g, '')), `${g.id} spoken form has no lone letters: ${g.spoken}`);
    if (g.flip) assert.ok(g.flip.length < 110, `${g.id} flip hint is short`);
  }
  assert.equal(GLYPH_BY_ID['5'].spoken, 'five');
  assert.equal(GLYPH_BY_ID['b'].spoken, 'little bee');
  assert.equal(GLYPH_BY_ID['B'].spoken, 'big bee');
  assert.match(GLYPH_BY_ID['8'].rhyme, /That's an eight!$/);
});
