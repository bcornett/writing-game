/**
 * Pop!: bubbles drift up carrying letters and numbers, half of them
 * backwards. Pop only the backwards ones. Popping a right one is a soft
 * "oops", never a lost point; bubbles that float away are simply gone.
 */

import { popRound } from '../../core/curriculum.js';
import { glyphCard } from '../../render/glyphSvg.js';
import { el, button, wait, starRow } from '../dom.js';

export function mountPop(root, app, { total = 12, quest = null } = {}) {
  app.setTitle('Pop the backwards ones!');
  const wrap = el('div', 'pop');
  wrap.style.cssText = 'flex:1; align-self:stretch; width:100%; min-height:0;';
  const score = el('div', 'pop__score', '0');
  wrap.appendChild(score);
  root.appendChild(wrap);

  const bubbles = popRound(app.spotIds(), app.rng, { total });
  const backwardsTotal = bubbles.filter((b) => b.backwards).length;
  let spawned = 0;
  let alive = 0;
  let popped = 0;
  let wrong = 0;
  let finished = false;
  let disposed = false;
  let spawnTimer = 0;
  let lastNag = 0;

  const updateScore = () => {
    score.textContent = `${popped} / ${backwardsTotal} 🫧`;
  };
  updateScore();

  function spawn() {
    if (disposed || finished) return;
    if (spawned >= bubbles.length) return;
    if (alive >= 4) {
      spawnTimer = setTimeout(spawn, 600);
      return;
    }
    const b = bubbles[spawned++];
    alive++;
    const node = el('div', 'bubble-glyph');
    const width = wrap.clientWidth || 400;
    node.style.left = `${Math.round(10 + app.rng() * Math.max(10, width - 150))}px`;
    node.style.animationDuration = `${(7 + app.rng() * 2.5).toFixed(2)}s`;
    node.appendChild(glyphCard(b.glyph, { transform: b.transform, width: 10 }));
    let gone = false;
    const remove = () => {
      if (gone) return;
      gone = true;
      alive--;
      node.remove();
      maybeFinish();
    };
    node.addEventListener('animationend', (event) => {
      if (event.animationName === 'bubble-rise') remove();
      if (event.animationName === 'bubble-pop') remove();
    });
    node.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      if (gone || finished) return;
      if (b.backwards) {
        node.classList.add('is-popped');
        app.sfx.play('pop');
        popped++;
        updateScore();
        app.record(b.glyph, 'pop', 'right');
        const r = node.getBoundingClientRect();
        app.confetti.burst({ x: r.left + r.width / 2, y: r.top + r.height / 2, count: 18, spread: 5 });
        app.dot.cheer();
        // A popped bubble's end is its own animation; a stalled one still goes.
        setTimeout(remove, 450);
      } else {
        wrong++;
        app.record(b.glyph, 'pop', 'wrong');
        app.sfx.play('boop');
        app.dot.wobble();
        node.classList.add('is-nope');
        setTimeout(() => node.classList.remove('is-nope'), 500);
        const now = performance.now();
        if (now - lastNag > 3500) {
          lastNag = now;
          app.say('that_was_right');
        }
      }
    });
    wrap.appendChild(node);
    spawnTimer = setTimeout(spawn, 1500);
  }

  function maybeFinish() {
    if (finished || disposed) return;
    if (spawned >= bubbles.length && alive <= 0) finish();
  }

  async function finish() {
    finished = true;
    clearTimeout(spawnTimer);
    const stars = popped >= backwardsTotal * 0.8 && wrong <= 1 ? 3 : popped >= backwardsTotal * 0.5 ? 2 : 1;
    const banner = el('div', 'pop__banner', 'All done!');
    wrap.appendChild(banner);
    app.sfx.play('fanfare');
    app.confetti.rain({ count: 100 });
    app.dot.cheer();
    await app.addStars(stars);
    if (disposed) return;
    if (quest) {
      quest.onDone({ type: 'pop', stars });
      return;
    }
    const cardEl = el('div', 'overlay__card');
    cardEl.appendChild(el('h2', 'overlay__title', stars === 3 ? 'Bubble champion!' : 'Pop pop pop!'));
    cardEl.appendChild(starRow(stars));
    cardEl.appendChild(el('p', 'overlay__sub', `You popped ${popped} of ${backwardsTotal} backwards ones`));
    const actions = el('div', 'overlay__actions');
    actions.appendChild(
      button('btn btn--coral', 'Again', () => {
        app.sfx.play('tap');
        app.closeOverlay();
        app.go('pop');
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

  app.say('pop_backwards').then(() => {
    if (!disposed) spawn();
  });
  // Don't wait on the voice forever if it is off.
  spawnTimer = setTimeout(() => {
    if (!spawned && !disposed) spawn();
  }, 2500);

  return () => {
    disposed = true;
    clearTimeout(spawnTimer);
  };
}
