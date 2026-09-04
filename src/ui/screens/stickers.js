/**
 * The sticker book: one sticker for every ten stars, in order, forever.
 */

import { STICKERS, starsToNextSticker } from '../../core/progress.js';
import { el } from '../dom.js';

export function mountStickers(root, app, { fresh = false } = {}) {
  app.setTitle('Sticker book');
  const wrap = el('div', 'stickers');
  const next = starsToNextSticker(app.progress);
  wrap.appendChild(
    el(
      'div',
      'stickers__next',
      app.progress.stickers === 0
        ? `Earn ${next} stars to get your first sticker!`
        : next
          ? `${next} more star${next === 1 ? '' : 's'} until your next sticker!`
          : 'You collected every sticker! Wow!',
    ),
  );
  const grid = el('div', 'stickers__grid');
  STICKERS.forEach((emoji, i) => {
    const unlocked = i < app.progress.stickers;
    const s = el('div', unlocked ? 'sticker' : 'sticker sticker--locked', unlocked ? emoji : '?');
    if (unlocked && fresh && i === app.progress.stickers - 1) s.classList.add('sticker--new');
    if (unlocked) {
      s.addEventListener('click', () => {
        app.sfx.play('pop');
        s.classList.remove('sticker--new');
        void s.offsetWidth;
        s.classList.add('sticker--new');
      });
    }
    grid.appendChild(s);
  });
  wrap.appendChild(grid);
  root.appendChild(wrap);
  app.bubble(app.progress.stickers ? 'Look at all your stickers!' : 'Play games to earn stars and stickers!');
  app.dot.setMood('excited');
  return () => {};
}
