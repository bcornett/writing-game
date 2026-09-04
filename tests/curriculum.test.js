import test from 'node:test';
import assert from 'node:assert/strict';
import {
  spotRound,
  popRound,
  twinPairsFor,
  twinsRound,
  buildQuest,
  eligibleForSpot,
  REVERSAL_PRONE,
  TWIN_PAIRS,
  GLYPH_GROUPS,
} from '../src/core/curriculum.js';
import { createProgress, recordOutcome, DEFAULT_FOCUS } from '../src/core/progress.js';
import { GLYPH_BY_ID } from '../src/core/glyphs.js';
import { makeRng } from '../src/core/rng.js';

test('every reversal-prone glyph and every default-focus glyph can be shown backwards', () => {
  for (const id of [...REVERSAL_PRONE, ...DEFAULT_FOCUS]) assert.ok(eligibleForSpot(id), id);
  assert.ok(!eligibleForSpot('0'));
  assert.ok(!eligibleForSpot('8'));
});

test('a spot round has exactly one real card and distinct twins', () => {
  const rng = makeRng(3);
  for (const id of ['5', '2', 'b', 'd', 'c', 'J']) {
    for (let i = 0; i < 20; i++) {
      const round = spotRound(id, 4, rng);
      assert.equal(round.cards.filter((c) => c.correct).length, 1);
      assert.ok(round.cards.length >= 2 && round.cards.length <= 4);
      const transforms = round.cards.filter((c) => !c.correct).map((c) => c.transform);
      assert.equal(new Set(transforms).size, transforms.length, 'no duplicate twins');
      assert.ok(transforms.every(Boolean));
    }
  }
  assert.throws(() => spotRound('0', 3, rng), /no distinct twins/);
});

test('a pop round mixes real and backwards bubbles with no doubles in a row', () => {
  const rng = makeRng(9);
  for (let i = 0; i < 30; i++) {
    const bubbles = popRound(DEFAULT_FOCUS, rng, { total: 12 });
    assert.equal(bubbles.length, 12);
    const back = bubbles.filter((b) => b.backwards).length;
    assert.ok(back >= 3 && back <= 9, `balanced mix (${back} backwards)`);
    for (const b of bubbles) assert.equal(Boolean(b.transform), b.backwards);
    for (let k = 1; k < bubbles.length; k++) assert.notEqual(bubbles[k].glyph, bubbles[k - 1].glyph);
    assert.equal(new Set(bubbles.map((b) => b.id)).size, 12);
  }
  // Symmetric-only focus can't make a pop round; a focus with one usable glyph can.
  assert.throws(() => popRound(['0', '8'], rng), /backwards/);
  assert.ok(popRound(['0', '5'], rng, { total: 6 }).every((b) => b.glyph === '5'));
});

test('twin pairs follow the focus, and a twins round asks about one of them', () => {
  const pairs = twinPairsFor(['b']);
  assert.deepEqual(pairs.map((p) => p.pair), [['b', 'd'], ['b', 'p']]);
  assert.equal(twinPairsFor(['0', '8']).length, 0);
  const rng = makeRng(5);
  for (let i = 0; i < 20; i++) {
    const r = twinsRound(TWIN_PAIRS, rng);
    assert.ok(r.pair.includes(r.shown));
    assert.deepEqual([...r.choices].sort(), [...r.pair].sort());
  }
});

test('a quest circles the weakest glyph and changes activity each step', () => {
  const p = createProgress();
  for (let i = 0; i < 5; i++) recordOutcome(p, '5', 'write', 'flipped');
  for (const id of DEFAULT_FOCUS) if (id !== '5') for (let i = 0; i < 4; i++) recordOutcome(p, id, 'write', 'great');
  const rng = makeRng(11);
  let firstIsFive = 0;
  for (let i = 0; i < 50; i++) {
    const steps = buildQuest(p, DEFAULT_FOCUS, rng);
    assert.equal(steps.length, 6);
    assert.equal(steps[0].type, 'trace');
    if (steps[0].glyph === '5') firstIsFive++;
    for (let k = 1; k < steps.length; k++) {
      assert.ok(['trace', 'write', 'spot', 'twins', 'pop'].includes(steps[k].type));
    }
    assert.ok(steps.some((s) => s.type === 'write'));
    assert.ok(steps.some((s) => s.type === 'pop'));
    const twins = steps.find((s) => s.type === 'twins');
    if (twins) assert.ok(twins.pairs.length > 0);
  }
  assert.ok(firstIsFive > 25, `the reversed 5 leads most quests (${firstIsFive}/50)`);
});

test('a quest still works when nothing in focus can be shown backwards', () => {
  const rng = makeRng(2);
  const steps = buildQuest(createProgress(), ['0', '8', 'l'], rng);
  assert.equal(steps.length, 6);
  assert.ok(steps.every((s) => s.type !== 'spot' && s.type !== 'pop' && s.type !== 'twins'));
  for (const s of steps) assert.ok(GLYPH_BY_ID[s.glyph]);
});

test('the focus picker groups cover every glyph exactly once', () => {
  const ids = GLYPH_GROUPS.flatMap((g) => g.ids);
  assert.equal(ids.length, 62);
  assert.equal(new Set(ids).size, 62);
});
