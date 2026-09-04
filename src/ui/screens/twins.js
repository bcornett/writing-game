/**
 * Twins: "is this a b, or a d?" A big letter, two big answers. A wrong
 * b/d answer brings out the bed trick: two fists, thumbs up, b-e-d.
 */

import { GLYPH_BY_ID } from '../../core/glyphs.js';
import { twinsRound, twinPairsFor } from '../../core/curriculum.js';
import { glyphCard, svgEl } from '../../render/glyphSvg.js';
import { phraseIdFor, pairKey } from '../../core/phrases.js';
import { el, button, wait, starRow } from '../dom.js';

/** Two fists with thumbs up — the left makes a b, the right a d — over the word "bed". */
export function bedTrickSvg() {
  const svg = svgEl('svg', { viewBox: '0 0 150 80', 'aria-hidden': 'true' });
  const fist = (x, thumbLeft) => {
    const g = svgEl('g', { transform: `translate(${x},0)` });
    g.appendChild(svgEl('rect', { x: 10, y: 22, width: 34, height: 30, rx: 9, fill: '#f6c9a8', stroke: '#c98a5d', 'stroke-width': 2 }));
    for (let i = 0; i < 3; i++) {
      g.appendChild(svgEl('line', { x1: thumbLeft ? 20 + i * 9 : 16 + i * 9, y1: 30, x2: thumbLeft ? 20 + i * 9 : 16 + i * 9, y2: 46, stroke: '#c98a5d', 'stroke-width': 1.5, 'stroke-linecap': 'round' }));
    }
    g.appendChild(svgEl('rect', { x: thumbLeft ? 8 : 34, y: 4, width: 12, height: 26, rx: 6, fill: '#f6c9a8', stroke: '#c98a5d', 'stroke-width': 2 }));
    return g;
  };
  svg.appendChild(fist(0, true));
  svg.appendChild(fist(96, false));
  for (const [x, letter] of [[27, 'b'], [75, 'e'], [123, 'd']]) {
    const t = svgEl('text', { x, y: 74, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 900, fill: '#2d2a3e', 'font-family': 'inherit' });
    t.textContent = letter;
    svg.appendChild(t);
  }
  return svg;
}

export function mountTwins(root, app, { pairs = null, rounds = 6, quest = null } = {}) {
  const pool = pairs?.length ? pairs : twinPairsFor(app.focusIds());
  let round = 0;
  let results = [];
  let wrongThisRound = false;
  let locked = false;
  let disposed = false;
  let trickShown = false;

  const wrap = el('div', 'twins');
  const pips = el('div', 'round-pips');
  const shown = el('div', 'twins__shown');
  const choices = el('div', 'twins__choices');
  const trick = el('div', 'trick is-hidden');
  wrap.append(pips, shown, choices, trick);
  root.appendChild(wrap);

  if (!pool.length) {
    app.setTitle('Twins');
    app.bubble('Pick some twin letters in the grown-up settings first!');
    return () => {};
  }

  function renderPips() {
    pips.innerHTML = '';
    for (let i = 0; i < rounds; i++) {
      const p = el('span', 'round-pips__pip');
      if (results[i] === 'right') p.classList.add('is-first');
      else if (results[i] === 'late') p.classList.add('is-later');
      else if (i === round) p.classList.add('is-current');
      pips.appendChild(p);
    }
  }

  function startRound() {
    const r = twinsRound(pool, app.rng);
    wrongThisRound = false;
    locked = false;
    trick.classList.add('is-hidden');
    app.setTitle(`${r.pair[0]} or ${r.pair[1]}?`);
    renderPips();
    shown.innerHTML = '';
    shown.appendChild(glyphCard(r.shown, { lines: true }));
    choices.innerHTML = '';
    for (const c of r.choices) {
      const btn = el('button', 'twins__choice');
      btn.type = 'button';
      btn.appendChild(glyphCard(c));
      btn.appendChild(el('span', '', c));
      btn.addEventListener('click', () => tap(btn, c, r));
      choices.appendChild(btn);
    }
    app.dot.idle();
    app.say(`pair.${pairKey(r.pair)}`);
  }

  async function tap(btn, choice, r) {
    if (locked) return;
    if (choice === r.shown) {
      locked = true;
      btn.classList.add('is-right');
      app.sfx.play('ding');
      app.dot.cheer();
      const outcome = wrongThisRound ? 'late' : 'right';
      results.push(outcome);
      app.record(r.shown, 'twins', wrongThisRound ? 'wrong' : 'right');
      renderPips();
      await app.say('yes_thats', phraseIdFor(GLYPH_BY_ID[r.shown], 'name'));
      await wait(400);
      if (disposed) return;
      round++;
      if (round < rounds) startRound();
      else finish();
    } else {
      wrongThisRound = true;
      btn.classList.add('is-wrong');
      app.sfx.play('boop');
      app.dot.wobble();
      const isBd = r.pair.includes('b') && r.pair.includes('d');
      if (isBd && !trickShown) {
        trickShown = true;
        trick.innerHTML = '';
        trick.appendChild(bedTrickSvg());
        trick.appendChild(el('span', '', 'Thumbs up: b, e, d!'));
        trick.classList.remove('is-hidden');
        await app.say('bed_trick');
      } else {
        const g = GLYPH_BY_ID[r.shown];
        await app.say('look_again', g.flip ? phraseIdFor(g, 'flip') : null);
      }
    }
  }

  async function finish() {
    const rights = results.filter((x) => x === 'right').length;
    const stars = rights === rounds ? 3 : rights >= rounds * 0.6 ? 2 : 1;
    app.sfx.play('fanfare');
    app.confetti.rain({ count: 80 });
    await app.addStars(stars);
    if (disposed) return;
    if (quest) {
      quest.onDone({ type: 'twins', stars });
      return;
    }
    const cardEl = el('div', 'overlay__card');
    cardEl.appendChild(el('h2', 'overlay__title', stars === 3 ? 'Twin expert!' : 'Nice work!'));
    cardEl.appendChild(starRow(stars));
    cardEl.appendChild(el('p', 'overlay__sub', `${rights} of ${rounds} on the first try`));
    const actions = el('div', 'overlay__actions');
    actions.appendChild(
      button('btn btn--coral', 'Again', () => {
        app.sfx.play('tap');
        app.closeOverlay();
        app.go('twins');
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
