import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProgress,
  recordOutcome,
  mastery,
  reversalRate,
  pickGlyph,
  addStars,
  starsToNextSticker,
  unlockedStickers,
  normalizeProgress,
  STICKERS,
  STARS_PER_STICKER,
  DEFAULT_FOCUS,
} from '../src/core/progress.js';
import { makeRng } from '../src/core/rng.js';

test('a fresh save has the default focus and nothing earned', () => {
  const p = createProgress(1000);
  assert.deepEqual(p.focus, DEFAULT_FOCUS);
  assert.equal(p.stars, 0);
  assert.equal(p.stickers, 0);
  assert.equal(mastery(p, '5'), 0.3, 'unknown glyphs get the neutral prior');
});

test('outcomes move mastery the right way', () => {
  const p = createProgress();
  recordOutcome(p, '5', 'write', 'great');
  assert.ok(mastery(p, '5') > 0.9);
  recordOutcome(p, '5', 'write', 'flipped');
  assert.ok(mastery(p, '5') < 0.6, 'a reversal drags it down fast');
  recordOutcome(p, '5', 'write', 'flipped');
  recordOutcome(p, '5', 'write', 'flipped');
  assert.ok(mastery(p, '5') < 0.2);
  assert.equal(p.glyphs['5'].flips, 3);
  assert.equal(p.glyphs['5'].write, 4);
  assert.equal(p.glyphs['5'].writeOk, 1);
  assert.ok(reversalRate(p, '5') >= 0.75);
  assert.throws(() => recordOutcome(p, '5', 'write', 'perfect'), /unknown outcome/);
});

test('recent history is capped', () => {
  const p = createProgress();
  for (let i = 0; i < 40; i++) recordOutcome(p, 'b', 'spot', 'first');
  assert.equal(p.glyphs['b'].recent.length, 12);
  assert.equal(p.glyphs['b'].spot, 40);
});

test('the picker leans toward the glyph she finds hardest, and avoids repeats', () => {
  const p = createProgress();
  for (let i = 0; i < 6; i++) recordOutcome(p, 'b', 'write', 'great');
  for (let i = 0; i < 6; i++) recordOutcome(p, 'd', 'write', 'flipped');
  const rng = makeRng(42);
  const counts = { b: 0, d: 0, other: 0 };
  for (let i = 0; i < 2000; i++) {
    const id = pickGlyph(p, ['b', 'd', '5'], rng);
    counts[id === 'b' || id === 'd' ? id : 'other']++;
  }
  assert.ok(counts.d > counts.b * 3, `d (${counts.d}) should be picked far more than b (${counts.b})`);
  assert.ok(counts.other > 0, 'the unknown glyph still shows up');
  let repeats = 0;
  for (let i = 0; i < 500; i++) if (pickGlyph(p, ['b', 'd'], rng, { avoid: ['d'] }) === 'd') repeats++;
  assert.ok(repeats < 60, `avoid list mostly honoured (${repeats} repeats)`);
  assert.equal(pickGlyph(p, ['5'], rng, { avoid: ['5'] }), '5', 'with one option, it is the option');
});

test('stars turn into stickers, one every ten, in order', () => {
  const p = createProgress();
  assert.deepEqual(addStars(p, 3).unlocked, []);
  assert.equal(starsToNextSticker(p), STARS_PER_STICKER - 3);
  const { unlocked } = addStars(p, 18);
  assert.deepEqual(unlocked, [STICKERS[0], STICKERS[1]]);
  assert.equal(p.stickers, 2);
  assert.deepEqual(unlockedStickers(p), STICKERS.slice(0, 2));
  addStars(p, 10000);
  assert.equal(p.stickers, STICKERS.length, 'the book fills up and stops');
  assert.equal(starsToNextSticker(p), 0);
});

test('a save file round-trips and garbage falls back to defaults', () => {
  const p = createProgress(5);
  p.name = 'Maddie';
  p.focus = ['5', '2'];
  recordOutcome(p, '5', 'write', 'good', 7);
  addStars(p, 12);
  const back = normalizeProgress(JSON.parse(JSON.stringify(p)), 9);
  assert.deepEqual(back, p);

  const junk = normalizeProgress({ name: 42, focus: 'no', stars: -4, stickers: 999, glyphs: { z: { recent: [{ k: 'write', o: 'nope' }, { k: 'write', o: 'great' }] } } }, 1);
  assert.equal(junk.name, '');
  assert.deepEqual(junk.focus, DEFAULT_FOCUS);
  assert.equal(junk.stars, 0);
  assert.equal(junk.stickers, STICKERS.length);
  assert.equal(junk.glyphs.z.recent.length, 1, 'unknown outcomes are dropped');
  assert.deepEqual(normalizeProgress(null).focus, DEFAULT_FOCUS);
  assert.deepEqual(normalizeProgress('x').focus, DEFAULT_FOCUS);
});
