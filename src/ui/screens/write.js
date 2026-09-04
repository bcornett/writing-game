/**
 * Write: a blank card and a finger. The grader says what she drew — a
 * great 5, a 5 facing the wrong way, a d instead of a b — and Dot responds
 * to exactly that, with a side-by-side that flips her drawing over so she
 * can see the difference for herself.
 */

import { GLYPH_BY_ID, GLYPHS } from '../../core/glyphs.js';
import { gradeDrawing } from '../../core/grader.js';
import { svgEl, strokePath, guideLines, startDot, glyphStrokes, glyphCard } from '../../render/glyphSvg.js';
import { createDemo } from '../demo.js';
import { attachPointer } from '../../input/pointer.js';
import { phraseIdFor, phraseText } from '../../core/phrases.js';
import { el, button, starRow, pickOne } from '../dom.js';
import { glyphTitle } from './trace.js';

const TITLES = {
  great: 'Wow, perfect!',
  good: 'Nice one!',
  backward: 'Good shape!',
  okay: 'Getting there!',
  flipped: "Oops, it's backwards!",
  upside: "Oops, it's upside down!",
  'looks-like': 'Hmm…',
  'try-again': "Let's try again!",
};

export function mountWrite(root, app, { glyph: id, quest = null } = {}) {
  const g = GLYPH_BY_ID[id];
  const name = phraseIdFor(g, 'name');
  const level = app.levelFor(id);
  const others = GLYPHS.filter((o) => o.kind === g.kind || (g.kind !== 'digit' && o.kind !== 'digit'));
  let strokes = [];
  let current = null;
  let currentPath = null;
  let disposed = false;
  let demo = null;

  app.setTitle(`Write ${glyphTitle(g)}`);

  const wrap = el('div', 'draw-wrap');
  const card = el('div', 'draw-card');
  const svg = svgEl('svg', { viewBox: '0 0 100 100', class: 'write-svg' });
  svg.appendChild(guideLines());
  const sun = svgEl('text', { x: 6, y: 9.5, class: 'sun' });
  sun.textContent = '☀️';
  svg.appendChild(sun);
  if (level === 1) {
    const ghost = svgEl('g', { class: 'ghost' });
    for (const pts of glyphStrokes(id)) ghost.appendChild(strokePath(pts, { class: 'road' }));
    svg.appendChild(ghost);
  }
  if (level <= 2) svg.appendChild(startDot(glyphStrokes(id)[0][0], 1));
  const inkG = svgEl('g');
  svg.appendChild(inkG);
  card.appendChild(svg);
  wrap.appendChild(card);

  const controls = el('div', 'screen-controls');
  const clearBtn = button('btn btn--ghost', 'Clear', () => {
    app.sfx.play('tap');
    clear();
  }, { emoji: '↺' });
  const watchBtn = button('btn btn--sky', 'Watch', () => {
    app.sfx.play('tap');
    showDemo();
  }, { emoji: '👀' });
  const doneBtn = button('btn btn--big', 'Done', () => submit(), { emoji: '✓' });
  controls.append(clearBtn, watchBtn, doneBtn);
  wrap.appendChild(controls);
  root.appendChild(wrap);

  const detach = attachPointer(svg, {
    down([x, y]) {
      current = [[x, y]];
      currentPath = strokePath(current, { class: 'ink' });
      inkG.appendChild(currentPath);
    },
    move([x, y]) {
      if (!current) return;
      const last = current[current.length - 1];
      if (Math.hypot(x - last[0], y - last[1]) < 0.6) return;
      current.push([x, y]);
      currentPath.setAttribute('d', strokePath(current).getAttribute('d'));
    },
    up() {
      if (!current) return;
      strokes.push(current);
      current = null;
      currentPath = null;
    },
  });

  function clear() {
    strokes = [];
    current = null;
    inkG.innerHTML = '';
  }

  async function showDemo() {
    const cardEl = el('div', 'overlay__card');
    cardEl.appendChild(el('h2', 'overlay__title', `${g.label}`));
    const box = el('div', 'overlay__demo');
    const dsvg = svgEl('svg', { viewBox: '0 0 100 100' });
    box.appendChild(dsvg);
    cardEl.appendChild(box);
    cardEl.appendChild(
      button('btn btn--coral', 'Got it!', () => {
        app.sfx.play('tap');
        demo?.stop();
        app.closeOverlay();
      }, { emoji: '👍' }),
    );
    app.overlay(cardEl);
    demo = createDemo(dsvg, id);
    app.dot.setMood('think');
    await Promise.all([app.say(phraseIdFor(g, 'rhyme')), demo.play({ onStroke: () => app.sfx.play('whoosh') })]);
    app.dot.idle();
  }

  async function submit() {
    if (current) return;
    if (!strokes.length) {
      app.sfx.play('boop');
      card.classList.add('is-shaking');
      setTimeout(() => card.classList.remove('is-shaking'), 500);
      app.say('write_it');
      return;
    }
    app.sfx.play('tap');
    doneBtn.disabled = true;
    const result = gradeDrawing(strokes, g, { others });
    app.record(id, 'write', result.outcome);
    await showResult(result);
  }

  async function showResult(result) {
    const o = result.outcome;
    const flipHint = g.flip ? phraseIdFor(g, 'flip') : 'watch_dot';
    const r = card.getBoundingClientRect();
    let lines = [];
    if (o === 'great') {
      app.sfx.play('fanfare');
      app.confetti.burst({ x: r.left + r.width / 2, y: r.top + r.height / 2, count: 110 });
      app.dot.cheer();
      lines = [pickOne(app.rng, ['wow', 'amazing', 'you_did_it'])];
    } else if (o === 'good') {
      app.sfx.play('ding');
      app.confetti.burst({ x: r.left + r.width / 2, y: r.top + r.height / 2, count: 50 });
      app.dot.cheer();
      lines = ['great'];
    } else if (o === 'backward') {
      app.sfx.play('ding');
      app.dot.nod();
      lines = ['backward'];
    } else if (o === 'okay') {
      app.sfx.play('ding');
      app.dot.setMood('happy');
      lines = ['nice', 'try_again'];
    } else if (o === 'flipped') {
      app.sfx.play('boop');
      app.dot.wobble();
      lines = ['flipped', flipHint];
    } else if (o === 'upside') {
      app.sfx.play('boop');
      app.dot.wobble();
      lines = ['upside', flipHint];
    } else if (o === 'looks-like') {
      app.sfx.play('boop');
      app.dot.setMood('think');
      lines = ['looks_like', phraseIdFor(GLYPH_BY_ID[result.lookalike], 'name'), 'watch_dot'];
    } else {
      app.sfx.play('boop');
      app.dot.setMood('think');
      lines = ['so_close'];
    }
    const saying = app.say(...lines);
    // Stars first: a new sticker takes over the overlay, and the result card
    // should be what she is left looking at.
    if (result.stars > 0) await app.addStars(result.stars);
    if (disposed) return;

    const cardEl = el('div', 'overlay__card');
    cardEl.appendChild(el('h2', 'overlay__title', TITLES[o] ?? 'Hmm…'));
    if (result.stars > 0) cardEl.appendChild(starRow(result.stars));
    else {
      const sub = el('p', 'overlay__sub');
      sub.textContent =
        o === 'looks-like'
          ? `That looks like ${GLYPH_BY_ID[result.lookalike].label}, not ${g.label}.`
          : o === 'flipped' || o === 'upside'
            ? g.flip ?? phraseText('watch_dot')
            : phraseText('so_close');
      cardEl.appendChild(sub);
    }

    // Side by side: hers, then the real thing. A reversal flips hers over.
    const compare = el('div', 'result__compare');
    const mine = el('div', 'result__pane result__pane--mine');
    const mineSvg = svgEl('svg', { viewBox: '0 0 100 100', class: 'glyph-svg' });
    mineSvg.appendChild(guideLines());
    for (const s of strokes) mineSvg.appendChild(strokePath(s, { class: 'ink' }));
    mine.appendChild(mineSvg);
    mine.appendChild(el('div', 'result__pane-label', 'Yours'));
    const real = el('div', 'result__pane');
    real.appendChild(glyphCard(id, { lines: true }));
    real.appendChild(el('div', 'result__pane-label', `${g.label}`));
    compare.append(mine, el('div', 'result__arrow', '→'), real);
    cardEl.appendChild(compare);
    if (o === 'flipped') mine.classList.add('is-flipping');
    if (o === 'upside') mine.classList.add('is-flipping-v');

    const actions = el('div', 'overlay__actions');
    if (quest) {
      actions.appendChild(
        button('btn btn--coral', 'Next', () => {
          app.sfx.play('tap');
          app.closeOverlay();
          quest.onDone({ type: 'write', stars: result.stars, outcome: o });
        }, { emoji: '➜' }),
      );
    } else {
      actions.appendChild(
        button('btn btn--ghost', 'Try again', () => {
          app.sfx.play('tap');
          app.closeOverlay();
          app.go('write', { glyph: id });
        }, { emoji: '↺' }),
      );
      if (result.stars < 3) {
        actions.appendChild(
          button('btn btn--sky', 'Trace it with Dot', () => {
            app.sfx.play('tap');
            app.closeOverlay();
            app.go('trace', { glyph: id, rounds: 1, level: 1 });
          }, { emoji: '✏️' }),
        );
      }
      actions.appendChild(
        button('btn btn--coral', 'Next', () => {
          app.sfx.play('tap');
          app.closeOverlay();
          app.go('write', { glyph: app.pick({ avoid: [id] }) });
        }, { emoji: '➜' }),
      );
    }
    cardEl.appendChild(actions);
    app.overlay(cardEl);
    await saying;
  }

  app.say('lets_write', name, 'write_it');

  return () => {
    disposed = true;
    demo?.stop();
    detach();
  };
}
