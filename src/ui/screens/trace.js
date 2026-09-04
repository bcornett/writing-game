/**
 * Trace: Dot draws the letter first, then the child follows the road with a
 * finger. Three rounds by default, and the road fades a little each round —
 * full road with arrows, then a dotted road, then just the start dots — so
 * by the third go she is writing it from memory with a safety net.
 */

import { GLYPH_BY_ID } from '../../core/glyphs.js';
import { createTrace, traceDown, traceMove, traceUp, tracePoint } from '../../core/tracer.js';
import { svgEl, strokePath, guideLines, strokeArrows, startDot, polylineLength, glyphStrokes } from '../../render/glyphSvg.js';
import { createMiniDot } from '../../render/dot.js';
import { createDemo } from '../demo.js';
import { attachPointer } from '../../input/pointer.js';
import { phraseIdFor } from '../../core/phrases.js';
import { el, button, wait, starRow } from '../dom.js';

export const glyphTitle = (g) => (g.kind === 'digit' ? `the ${g.label}` : g.kind === 'lower' ? `little ${g.label}` : `big ${g.label}`);

export function mountTrace(root, app, { glyph: id, rounds = 3, level = null, quest = null } = {}) {
  const g = GLYPH_BY_ID[id];
  const strokes = glyphStrokes(id);
  const name = phraseIdFor(g, 'name');
  let round = 0;
  let disposed = false;
  let tracing = false;
  let trace = null;
  let currentLevel = 1;
  let lastHint = 0;

  app.setTitle(`Trace ${glyphTitle(g)}`);

  const wrap = el('div', 'draw-wrap');
  const card = el('div', 'draw-card');
  const svg = svgEl('svg', { viewBox: '0 0 100 100', class: 'trace-svg' });
  svg.appendChild(guideLines());
  const roadG = svgEl('g', { class: 'road-layer' });
  const doneG = svgEl('g', { class: 'done-layer' });
  const guideG = svgEl('g', { class: 'guide-layer' });
  const fill = strokePath(strokes[0], { class: 'trace-fill' });
  const arrowsG = svgEl('g');
  const startG = svgEl('g');
  const mini = createMiniDot();
  mini.show(false);
  svg.append(roadG, doneG, guideG, fill, arrowsG, startG);
  const demo = createDemo(svg, id, { road: false, lines: false });
  svg.appendChild(mini.el);
  card.appendChild(svg);
  wrap.appendChild(card);

  const controls = el('div', 'screen-controls');
  const watchBtn = button('btn btn--sky', 'Watch again', async () => {
    app.sfx.play('tap');
    await runDemo();
    if (!disposed) tracing = true;
  }, { emoji: '👀' });
  controls.appendChild(watchBtn);
  if (!quest) {
    controls.appendChild(
      button('btn btn--ghost', 'Next', () => {
        app.sfx.play('tap');
        app.go('trace', { glyph: app.pick({ avoid: [id] }) });
      }, { emoji: '➜' }),
    );
  }
  wrap.appendChild(controls);
  root.appendChild(wrap);

  function renderRoad(lvl) {
    roadG.innerHTML = '';
    doneG.innerHTML = '';
    const cls = lvl === 1 ? 'road' : lvl === 2 ? 'road road--faint' : 'road road--hidden';
    for (const pts of strokes) roadG.appendChild(strokePath(pts, { class: cls }));
  }

  function setupStroke() {
    guideG.innerHTML = '';
    arrowsG.innerHTML = '';
    startG.innerHTML = '';
    const i = trace.index;
    const pts = strokes[i];
    if (currentLevel <= 2) guideG.appendChild(strokePath(pts, { class: `trace-guide${currentLevel === 2 ? ' trace-guide--faint' : ''}` }));
    const len = Math.max(0.01, polylineLength(pts));
    fill.setAttribute('d', strokePath(pts).getAttribute('d'));
    fill.setAttribute('stroke-dasharray', `${len} ${len}`);
    fill.setAttribute('stroke-dashoffset', len);
    fill.dataset.len = String(len);
    if (currentLevel === 1) arrowsG.appendChild(strokeArrows(pts));
    startG.appendChild(startDot(pts[0], i + 1));
    mini.moveTo(pts[0][0], pts[0][1]);
    mini.show(false);
  }

  function setFill(progress) {
    const len = Number(fill.dataset.len || 1);
    fill.setAttribute('stroke-dashoffset', (len * (1 - progress)).toFixed(3));
  }

  const hint = async (ids) => {
    const now = performance.now();
    if (now - lastHint < 2200) return;
    lastHint = now;
    startG.firstChild?.classList.add('start-dot--hint');
    setTimeout(() => startG.firstChild?.classList.remove('start-dot--hint'), 700);
    await app.say(...ids);
  };

  const detach = attachPointer(svg, {
    down([x, y]) {
      if (!tracing || !trace) return;
      const ev = traceDown(trace, x, y);
      if (ev.type === 'miss') {
        app.sfx.play('boop');
        app.dot.wobble();
        hint([ev.nearEnd ? 'other_end' : 'start_at_dot']);
        return;
      }
      app.sfx.play('tap');
      mini.show(true);
      const p = tracePoint(trace);
      mini.moveTo(p[0], p[1]);
    },
    move([x, y]) {
      if (!tracing || !trace) return;
      const ev = traceMove(trace, x, y);
      if (ev.type === 'progress') {
        setFill(ev.progress);
        const p = tracePoint(trace);
        mini.moveTo(p[0], p[1]);
        app.dot.lookAt((x - 50) / 50, (y - 50) / 50);
      } else if (ev.type === 'slip') {
        app.sfx.play('wobble');
        app.dot.wobble();
        hint(['stay_on_road']);
      }
    },
    up() {
      if (!tracing || !trace) return;
      const ev = traceUp(trace);
      if (ev.type === 'incomplete') {
        if (ev.progress > 0.15) hint(['keep_going']);
      } else if (ev.type === 'stroke-complete') {
        app.sfx.play('stroke');
        app.dot.nod();
        doneG.appendChild(strokePath(strokes[ev.next - 1], { class: 'trace-done' }));
        setupStroke();
      } else if (ev.type === 'glyph-complete') {
        completeRound(ev);
      }
    },
  });

  async function runDemo() {
    tracing = false;
    mini.show(false);
    app.dot.setMood('think');
    await Promise.all([app.say('lets_write', name, phraseIdFor(g, 'rhyme')), demo.play({ onStroke: () => app.sfx.play('whoosh') })]);
    demo.reset();
    app.dot.idle();
  }

  async function startRound() {
    currentLevel = level ?? Math.min(3, app.levelFor(id) + round);
    trace = createTrace(g, { strictness: app.progress.strictness });
    renderRoad(currentLevel);
    setupStroke();
    if (round === 0) {
      await runDemo();
      if (disposed) return;
      tracing = true;
      await app.say('your_turn');
    } else {
      tracing = true;
      await app.say(currentLevel === 3 ? 'just_dots' : currentLevel === 2 ? 'fading' : 'your_turn');
    }
  }

  async function completeRound(ev) {
    tracing = false;
    doneG.appendChild(strokePath(strokes[strokes.length - 1], { class: 'trace-done' }));
    startG.innerHTML = '';
    guideG.innerHTML = '';
    arrowsG.innerHTML = '';
    mini.show(false);
    app.sfx.play('sparkle');
    const r = card.getBoundingClientRect();
    app.confetti.burst({ x: r.left + r.width / 2, y: r.top + r.height / 2, count: 60 });
    app.dot.cheer();
    app.record(id, 'trace', ev.slips > 2 ? 'slips' : 'clean');
    await app.say(app.praise());
    if (disposed) return;
    await app.addStars(1);
    if (disposed) return;
    round++;
    await wait(300);
    if (disposed) return;
    if (round < rounds) startRound();
    else finish();
  }

  function finish() {
    if (quest) {
      quest.onDone({ type: 'trace', stars: rounds });
      return;
    }
    const cardEl = el('div', 'overlay__card');
    cardEl.appendChild(el('h2', 'overlay__title', 'You traced it!'));
    cardEl.appendChild(starRow(3));
    const actions = el('div', 'overlay__actions');
    actions.appendChild(
      button('btn btn--ghost', 'Again', () => {
        app.sfx.play('tap');
        app.closeOverlay();
        app.go('trace', { glyph: id });
      }, { emoji: '↺' }),
    );
    actions.appendChild(
      button('btn btn--sky', 'Write it', () => {
        app.sfx.play('tap');
        app.closeOverlay();
        app.go('write', { glyph: id });
      }, { emoji: '📝' }),
    );
    actions.appendChild(
      button('btn btn--coral', 'Next', () => {
        app.sfx.play('tap');
        app.closeOverlay();
        app.go('trace', { glyph: app.pick({ avoid: [id] }) });
      }, { emoji: '➜' }),
    );
    cardEl.appendChild(actions);
    app.overlay(cardEl);
    app.sfx.play('fanfare');
  }

  startRound();

  return () => {
    disposed = true;
    tracing = false;
    demo.stop();
    detach();
  };
}
