/**
 * What the games are made of: which glyphs get confused with which, how a
 * "spot the real one" round is dealt, how bubbles are mixed, and how a quest
 * is planned around what she needs most.
 */

import { GLYPHS, GLYPH_BY_ID, glyph } from './glyphs.js';
import { distinctTransforms } from './grader.js';
import { pickGlyph, mastery, DEFAULT_FOCUS } from './progress.js';

/** Glyphs that commonly come out backwards in kindergarten. */
export const REVERSAL_PRONE = [
  '2', '3', '4', '5', '6', '7', '9',
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'j', 'k', 'p', 'q', 'r', 's', 'z',
  'B', 'C', 'D', 'E', 'F', 'G', 'J', 'K', 'L', 'N', 'P', 'R', 'S', 'Z',
];

/**
 * Pairs that are each other's twins (a b mirrored is a d) plus the classic
 * two-and-five mix-up. Each has a spoken question for the voice.
 */
export const TWIN_PAIRS = [
  { pair: ['b', 'd'], how: 'mirror' },
  { pair: ['p', 'q'], how: 'mirror' },
  { pair: ['b', 'p'], how: 'flip' },
  { pair: ['d', 'q'], how: 'flip' },
  { pair: ['6', '9'], how: 'rot' },
  { pair: ['n', 'u'], how: 'flip' },
  { pair: ['m', 'w'], how: 'flip' },
  { pair: ['2', '5'], how: 'confused' },
];

export { DEFAULT_FOCUS };

/** Can this glyph be shown "backwards" in a way that looks different? */
export const eligibleForSpot = (id) => distinctTransforms(GLYPH_BY_ID[id]).length > 0;

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Deal a "find the real one" round: one true card, the rest twins.
 * `count` is the number of cards wanted; fewer are dealt if the glyph has
 * fewer distinct twins (a c has only one).
 */
export function spotRound(id, count, rng) {
  const g = glyph(id);
  const twins = shuffle(distinctTransforms(g), rng);
  if (!twins.length) throw new Error(`${id} has no distinct twins to spot against`);
  const cards = [{ transform: null, correct: true }];
  for (const t of twins.slice(0, Math.max(1, count - 1))) cards.push({ transform: t, correct: false });
  return { glyph: id, cards: shuffle(cards, rng) };
}

/**
 * Bubbles for a pop round: a mix of real and backwards glyphs from the focus
 * set, never two identical bubbles in a row.
 */
export function popRound(focus, rng, { total = 12, backwardsShare = 0.5 } = {}) {
  const pool = (focus.length ? focus : DEFAULT_FOCUS).filter(eligibleForSpot);
  if (!pool.length) throw new Error('no glyphs in focus can be shown backwards');
  const bubbles = [];
  let last = null;
  for (let i = 0; i < total; i++) {
    let id = pool[Math.floor(rng() * pool.length)];
    if (pool.length > 1 && id === last) id = pool[(pool.indexOf(id) + 1) % pool.length];
    last = id;
    const backwards = rng() < backwardsShare;
    const twins = distinctTransforms(GLYPH_BY_ID[id]);
    bubbles.push({
      id: `b${i}`,
      glyph: id,
      transform: backwards ? twins[Math.floor(rng() * twins.length)] : null,
      backwards,
    });
  }
  // Guarantee the round has at least a few of each, or it is no game.
  const back = bubbles.filter((b) => b.backwards).length;
  const want = Math.max(2, Math.floor(total * 0.3));
  if (back < want || total - back < want) {
    bubbles.forEach((b, i) => {
      b.backwards = i % 2 === 0;
      const twins = distinctTransforms(GLYPH_BY_ID[b.glyph]);
      b.transform = b.backwards ? twins[i % twins.length] : null;
    });
  }
  return bubbles;
}

/** Twin pairs worth asking about given the focus set (at least one side in focus). */
export function twinPairsFor(focus) {
  const set = new Set(focus.length ? focus : DEFAULT_FOCUS);
  return TWIN_PAIRS.filter((p) => p.pair.some((id) => set.has(id)));
}

/** One "which is it?" question: a glyph from a pair, and the two choices. */
export function twinsRound(pairs, rng) {
  const p = pairs[Math.floor(rng() * pairs.length)];
  const shown = p.pair[Math.floor(rng() * 2)];
  return { pair: p.pair, how: p.how, shown, choices: shuffle(p.pair, rng) };
}

/**
 * Plan a quest: six short steps that circle her weakest glyph, with a change
 * of activity every step so it feels like a game and not a worksheet.
 */
export function buildQuest(progress, focus, rng) {
  const pool = focus.length ? focus : DEFAULT_FOCUS;
  const first = pickGlyph(progress, pool, rng);
  const second = pickGlyph(progress, pool, rng, { avoid: [first] });
  const pairs = twinPairsFor(pool);
  const pairFor = (id) => pairs.filter((p) => p.pair.includes(id));
  const steps = [];
  steps.push({ type: 'trace', glyph: first });
  if (eligibleForSpot(first)) steps.push({ type: 'spot', glyph: first });
  else steps.push({ type: 'trace', glyph: second });
  steps.push({ type: 'write', glyph: first });
  const firstPairs = pairFor(first);
  if (firstPairs.length) steps.push({ type: 'twins', pairs: firstPairs });
  else if (pairs.length) steps.push({ type: 'twins', pairs });
  else if (eligibleForSpot(second)) steps.push({ type: 'spot', glyph: second });
  else steps.push({ type: 'trace', glyph: second });
  steps.push({ type: mastery(progress, second) >= 0.6 ? 'write' : 'trace', glyph: second });
  if (pool.some(eligibleForSpot)) steps.push({ type: 'pop' });
  else steps.push({ type: 'write', glyph: second });
  return steps;
}

/** All glyph ids grouped for the parent's focus picker. */
export const GLYPH_GROUPS = [
  { title: 'Numbers', ids: GLYPHS.filter((g) => g.kind === 'digit').map((g) => g.id) },
  { title: 'Little letters', ids: GLYPHS.filter((g) => g.kind === 'lower').map((g) => g.id) },
  { title: 'Big letters', ids: GLYPHS.filter((g) => g.kind === 'upper').map((g) => g.id) },
];
