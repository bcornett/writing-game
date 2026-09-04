/**
 * Spot it: one real letter among its backwards twins. Tap the real one.
 * Two cards to start, four once she is good at it.
 */

import { GLYPH_BY_ID } from '../../core/glyphs.js';
import { spotRound } from '../../core/curriculum.js';
import { mastery } from '../../core/progress.js';
import { glyphCard } from '../../render/glyphSvg.js';
import { phraseIdFor } from '../../core/phrases.js';
import { el, button, wait, starRow } from '../dom.js';
import { glyphTitle } from './trace.js';

export function mountSpot(root, app, { glyph: fixed = null, rounds = 5, quest = null } = {}) {
  let round = 0;
  let results = [];
  let wrongThisRound = false;
  let locked = false;
  let disposed = false;
  let last = null;

  const wrap = el('div', 'spot');
  const pips = el('div', 'round-pips');
  const grid = el('div', 'spot__cards');
  wrap.append(pips, grid);
  root.appendChild(wrap);

  function renderPips() {
    pips.innerHTML = '';
    for (let i = 0; i < rounds; i++) {
      const p = el('span', 'round-pips__pip');
      if (results[i] === 'first') p.classList.add('is-first');
      else if (results[i] === 'later') p.classList.add('is-later');
      else if (i === round) p.classList.add('is-current');
      pips.appendChild(p);
    }
  }

  function startRound() {
    const id = fixed ?? app.pick({ avoid: last ? [last] : [], eligible: true });
    last = id;
    const g = GLYPH_BY_ID[id];
    const m = mastery(app.progress, id);
    const count = m < 0.45 ? 2 : m < 0.75 ? 3 : 4;
    const r = spotRound(id, count, app.rng);
    wrongThisRound = false;
    locked = false;
    app.setTitle(`Find the real ${g.label}`);
    renderPips();
    grid.innerHTML = '';
    grid.className = `spot__cards spot__cards--${r.cards.length}`;
    for (const c of r.cards) {
      const btn = el('button', 'spot-card');
      btn.type = 'button';
      btn.appendChild(glyphCard(id, { transform: c.transform, lines: true }));
      btn.addEventListener('click', () => tap(btn, c, id));
      grid.appendChild(btn);
    }
    app.dot.idle();
    app.say('find_real', phraseIdFor(g, 'name'));
  }

  async function tap(btn, card, id) {
    if (locked) return;
    if (card.correct) {
      locked = true;
      btn.classList.add('is-right');
      for (const other of grid.children) if (other !== btn) other.classList.add('is-dim');
      app.sfx.play('ding');
      app.dot.cheer();
      const outcome = wrongThisRound ? 'later' : 'first';
      results.push(outcome);
      app.record(id, 'spot', outcome);
      const r = btn.getBoundingClientRect();
      app.confetti.burst({ x: r.left + r.width / 2, y: r.top + r.height / 2, count: 40 });
      renderPips();
      await app.say(app.praise());
      await wait(500);
      if (disposed) return;
      round++;
      if (round < rounds) startRound();
      else finish();
    } else {
      wrongThisRound = true;
      btn.classList.add('is-wrong');
      app.sfx.play('boop');
      app.dot.wobble();
      app.say(card.transform === 'mirror' ? 'that_backwards' : 'that_upside');
    }
  }

  async function finish() {
    const firsts = results.filter((r) => r === 'first').length;
    const stars = firsts === rounds ? 3 : firsts >= rounds * 0.6 ? 2 : 1;
    app.sfx.play('fanfare');
    app.confetti.rain({ count: 80 });
    await app.addStars(stars);
    if (disposed) return;
    if (quest) {
      quest.onDone({ type: 'spot', stars });
      return;
    }
    const cardEl = el('div', 'overlay__card');
    cardEl.appendChild(el('h2', 'overlay__title', stars === 3 ? 'Sharp eyes!' : 'Good looking!'));
    cardEl.appendChild(starRow(stars));
    cardEl.appendChild(el('p', 'overlay__sub', `${firsts} of ${rounds} on the first try`));
    const actions = el('div', 'overlay__actions');
    actions.appendChild(
      button('btn btn--coral', 'Again', () => {
        app.sfx.play('tap');
        app.closeOverlay();
        app.go('spot');
      }, { emoji: '↺' }),
    );
    actions.appendChild(
      button('btn btn--ghost', 'Home', () => {
        app.sfx.play('tap');
        app.closeOverlay();
        app.home();
      }, { emoji: '🏠' }),
    );
    cardEl.appendChild(actions);
    app.overlay(cardEl);
  }

  startRound();
  return () => {
    disposed = true;
  };
}

export { glyphTitle };
