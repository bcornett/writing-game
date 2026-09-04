import test from 'node:test';
import assert from 'node:assert/strict';
import { GLYPH_BY_ID, GLYPHS } from '../src/core/glyphs.js';
import {
  createTrace,
  traceDown,
  traceMove,
  traceUp,
  traceReset,
  traceProgress,
  tracePoint,
  TRACE,
} from '../src/core/tracer.js';
import { makeRng } from '../src/core/rng.js';

/** Run a finger along every stroke with a little wobble. */
function traceWhole(glyph, rng, wobble = 3) {
  const s = createTrace(glyph);
  const events = [];
  while (!s.done) {
    const st = s.strokes[s.index];
    const [sx, sy] = st.pts[0];
    events.push(traceDown(s, sx + (rng() - 0.5) * 4, sy + (rng() - 0.5) * 4));
    if (!st.isDot) {
      for (let i = 1; i < st.pts.length; i++) {
        const [x, y] = st.pts[i];
        events.push(traceMove(s, x + (rng() - 0.5) * wobble, y + (rng() - 0.5) * wobble));
      }
    }
    events.push(traceUp(s));
    if (events.length > 2000) throw new Error('tracing never finished');
  }
  return { state: s, events };
}

test('a careful finger completes every glyph without a slip', () => {
  const rng = makeRng(1);
  for (const g of GLYPHS) {
    const { state, events } = traceWhole(g, rng);
    assert.ok(state.done, `${g.id} done`);
    assert.equal(state.slips, 0, `${g.id} slips`);
    assert.equal(state.misses, 0, `${g.id} misses`);
    assert.equal(events.filter((e) => e.type === 'glyph-complete').length, 1);
    assert.equal(events.filter((e) => e.type === 'stroke-complete').length, g.strokes.length - 1);
  }
});

test('the finger has to land on the green dot', () => {
  const s = createTrace(GLYPH_BY_ID['5']);
  const end = s.strokes[0].pts[s.strokes[0].pts.length - 1];
  assert.equal(traceDown(s, 90, 90).type, 'miss');
  const atEnd = traceDown(s, end[0], end[1]);
  assert.equal(atEnd.type, 'miss');
  assert.equal(atEnd.nearEnd, true, 'starting from the wrong end is reported so Dot can say so');
  assert.equal(s.misses, 2);
  assert.equal(traceMove(s, 50, 50).type, 'ignored', 'moves without a start do nothing');
  assert.equal(traceUp(s).type, 'ignored');
});

test('the stroke cannot be skipped or run backwards', () => {
  const s = createTrace(GLYPH_BY_ID['1']);
  const pts = s.strokes[0].pts;
  traceDown(s, pts[0][0], pts[0][1]);
  const jump = traceMove(s, pts[pts.length - 1][0], pts[pts.length - 1][1]);
  assert.ok(jump.type !== 'progress' || jump.progress <= TRACE.lookahead / (pts.length - 1) + 1e-9, 'a jump to the end is not progress');
  assert.ok(traceProgress(s) < 0.5);
  const up = traceUp(s);
  assert.ok(up.type === 'incomplete' || up.type === 'ignored', 'either paused by the slip or lifted early — never complete');
  assert.equal(s.done, false);
});

test('wandering off the road pauses the stroke; coming back resumes it', () => {
  const s = createTrace(GLYPH_BY_ID['7']);
  const pts = s.strokes[0].pts;
  traceDown(s, pts[0][0], pts[0][1]);
  for (let i = 1; i < 10; i++) traceMove(s, pts[i][0], pts[i][1]);
  const reached = s.cur;
  assert.ok(reached >= 8);
  const slip = traceMove(s, pts[reached][0], pts[reached][1] + 60);
  assert.equal(slip.type, 'slip');
  assert.equal(s.active, false);
  assert.equal(s.slips, 1);
  assert.equal(s.cur, reached, 'progress is kept');
  const back = traceDown(s, pts[reached][0], pts[reached][1]);
  assert.equal(back.type, 'resume');
  for (let i = reached; i < pts.length; i++) traceMove(s, pts[i][0], pts[i][1]);
  assert.equal(traceUp(s).type, 'glyph-complete');
});

test('small wobbles are tolerated up to the limit, then it is a slip', () => {
  const s = createTrace(GLYPH_BY_ID['1'], { strictness: 'tricky' });
  const pts = s.strokes[0].pts;
  traceDown(s, pts[0][0], pts[0][1]);
  const off = traceMove(s, pts[2][0] + s.tolerance + 1, pts[2][1]);
  assert.equal(off.type, 'off', 'slightly off the road is only a warning');
  let slipAfter = null;
  for (let i = 0; i < TRACE.offEventsAllowed + 2; i++) {
    const e = traceMove(s, pts[2][0] + s.tolerance + 1, pts[2][1]);
    if (e.type === 'slip') {
      slipAfter = i;
      break;
    }
    assert.equal(e.type, 'off');
  }
  assert.ok(slipAfter !== null && slipAfter <= TRACE.offEventsAllowed, `slips after a while (${slipAfter})`);
  assert.equal(traceMove(s, pts[2][0], pts[2][1]).type, 'ignored', 'paused until the finger comes back down');
});

test('strictness changes the tolerance', () => {
  assert.ok(createTrace(GLYPH_BY_ID['b'], { strictness: 'easy' }).tolerance > createTrace(GLYPH_BY_ID['b'], { strictness: 'tricky' }).tolerance);
  assert.equal(createTrace(GLYPH_BY_ID['b'], { strictness: 'nonsense' }).tolerance, TRACE.tolerance.normal);
});

test('lifting early keeps progress and a second touch near the finger continues', () => {
  const s = createTrace(GLYPH_BY_ID['b']);
  const pts = s.strokes[0].pts;
  traceDown(s, pts[0][0], pts[0][1]);
  for (let i = 1; i < 20; i++) traceMove(s, pts[i][0], pts[i][1]);
  assert.equal(traceUp(s).type, 'incomplete');
  const p = tracePoint(s);
  assert.equal(traceDown(s, p[0], p[1]).type, 'resume');
  for (let i = s.cur; i < pts.length; i++) traceMove(s, pts[i][0], pts[i][1]);
  assert.equal(traceUp(s).type, 'stroke-complete');
  assert.equal(s.index, 1);
});

test('dots are completed by a tap', () => {
  const s = createTrace(GLYPH_BY_ID['i']);
  const line = s.strokes[0].pts;
  traceDown(s, line[0][0], line[0][1]);
  for (const [x, y] of line) traceMove(s, x, y);
  assert.equal(traceUp(s).type, 'stroke-complete');
  const dot = s.strokes[1];
  assert.ok(dot.isDot);
  assert.equal(traceDown(s, dot.pts[0][0] + 5, dot.pts[0][1] - 5).type, 'start');
  assert.equal(traceProgress(s), 1);
  assert.equal(traceUp(s).type, 'glyph-complete');
});

test('reset starts over', () => {
  const s = createTrace(GLYPH_BY_ID['7']);
  const pts = s.strokes[0].pts;
  traceDown(s, pts[0][0], pts[0][1]);
  for (const [x, y] of pts) traceMove(s, x, y);
  traceUp(s);
  assert.ok(s.done);
  traceReset(s);
  assert.equal(s.done, false);
  assert.equal(s.index, 0);
  assert.equal(traceProgress(s), 0);
});
