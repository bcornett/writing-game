/**
 * Home: one big PLAY button (the quest), a tile for each game, the sticker
 * book, and a press-and-hold gear for grown-ups.
 */

import { el, button } from '../dom.js';
import { createDot } from '../../render/dot.js';

const TILES = [
  { screen: 'trace', emoji: '✏️', label: 'Trace' },
  { screen: 'write', emoji: '📝', label: 'Write' },
  { screen: 'spot', emoji: '🔍', label: 'Spot it' },
  { screen: 'twins', emoji: '👯', label: 'Twins' },
  { screen: 'pop', emoji: '🫧', label: 'Pop!' },
  { screen: 'stickers', emoji: '📒', label: 'Stickers', className: 'tile--stickers' },
];

export function mountHome(root, app) {
  app.setTitle('');
  const home = el('div', 'home');

  const hero = el('div', 'home__hero');
  const heroDot = createDot({ size: 110 });
  heroDot.el.addEventListener('click', () => {
    app.sfx.play('tap');
    heroDot.cheer();
    app.say('hello');
  });
  hero.appendChild(heroDot.el);
  const title = el('h1', 'home__title', "Dot's Writing Quest");
  const sub = el('span', '', app.progress.name ? `Hi, ${app.progress.name}!` : 'Letters and numbers, the right way round');
  title.appendChild(sub);
  hero.appendChild(title);
  home.appendChild(hero);

  home.appendChild(
    button('btn btn--coral btn--big home__play', 'Play!', () => {
      app.sfx.play('tap');
      app.go('quest');
    }, { emoji: '🚀' }),
  );

  const tiles = el('div', 'tiles');
  for (const t of TILES) {
    const tile = button(`tile ${t.className ?? ''}`.trim(), t.label, () => {
      app.sfx.play('tap');
      if (t.screen === 'stickers') app.go('stickers');
      else if (t.screen === 'trace') app.go('trace', { glyph: app.pick() });
      else if (t.screen === 'write') app.go('write', { glyph: app.pick() });
      else if (t.screen === 'spot') app.go('spot');
      else if (t.screen === 'twins') app.go('twins');
      else if (t.screen === 'pop') app.go('pop');
    });
    const emoji = el('span', 'tile__emoji', t.emoji);
    emoji.setAttribute('aria-hidden', 'true');
    tile.prepend(emoji);
    tiles.appendChild(tile);
  }
  home.appendChild(tiles);
  root.appendChild(home);

  // Grown-ups: hold the gear for a moment and a half.
  const gear = el('button', 'gear');
  gear.type = 'button';
  gear.setAttribute('aria-label', 'Grown-ups: press and hold');
  gear.appendChild(el('span', '', '⚙️'));
  gear.appendChild(el('span', 'gear__ring'));
  gear.appendChild(el('span', 'gear__hint', 'Hold for grown-ups'));
  let holdTimer = 0;
  let hintTimer = 0;
  const cancelHold = () => {
    clearTimeout(holdTimer);
    holdTimer = 0;
    gear.classList.remove('is-holding');
  };
  gear.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    gear.classList.add('is-holding');
    holdTimer = setTimeout(() => {
      cancelHold();
      app.sfx.play('unlock');
      app.go('parent');
    }, 1400);
  });
  const release = () => {
    if (holdTimer) {
      gear.classList.add('is-hinting');
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => gear.classList.remove('is-hinting'), 1600);
    }
    cancelHold();
  };
  gear.addEventListener('pointerup', release);
  gear.addEventListener('pointercancel', release);
  gear.addEventListener('pointerleave', release);
  root.appendChild(gear);

  app.bubble(app.progress.name ? `Hi ${app.progress.name}! Tap Play!` : 'Tap Play to start a quest!');
  app.dot.idle();

  if (!app.progress.setup) showSetup(app);

  return () => {
    cancelHold();
    clearTimeout(hintTimer);
  };
}

/** First run: who is playing? A grown-up types the name once. */
function showSetup(app) {
  const card = el('div', 'overlay__card');
  card.appendChild(el('h2', 'overlay__title', "Hi! I'm Dot."));
  card.appendChild(el('p', 'overlay__sub', "Who's going to be writing with me?"));
  const input = el('input', 'text-input');
  input.type = 'text';
  input.placeholder = 'Her name (optional)';
  input.maxLength = 24;
  input.autocomplete = 'off';
  input.style.width = '100%';
  input.style.textAlign = 'center';
  card.appendChild(input);
  card.appendChild(
    el('p', 'overlay__sub', 'Grown-ups: hold the ⚙️ on the home screen to pick which letters and numbers to practise, and to see how it is going.'),
  );
  const go = button('btn btn--coral btn--big', "Let's play!", () => {
    app.progress.name = input.value.trim().slice(0, 24);
    app.progress.setup = true;
    app.save();
    app.closeOverlay();
    app.sfx.play('unlock');
    app.go('home');
    app.say('hello');
  }, { emoji: '🎉' });
  card.appendChild(go);
  app.overlay(card);
  setTimeout(() => input.focus({ preventScroll: true }), 300);
}
