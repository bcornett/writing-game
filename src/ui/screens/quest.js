/**
 * The quest: six short steps planned around whatever she finds hardest,
 * a different game each step, a sticker at the end. A reversal in the
 * "write" step slips a quick trace of that letter in before she writes it
 * again — practice exactly where it is needed, right when it is needed.
 */

import { buildQuest } from '../../core/curriculum.js';
import { starsToNextSticker } from '../../core/progress.js';
import { el, button, starRow } from '../dom.js';
import { mountTrace } from './trace.js';
import { mountWrite } from './write.js';
import { mountSpot } from './spot.js';
import { mountTwins } from './twins.js';
import { mountPop } from './pop.js';

export function mountQuest(root, app) {
  const steps = buildQuest(app.progress, app.focusIds(), app.rng);
  const inserted = new Set();
  let index = 0;
  let starsEarned = 0;
  let cleanupStep = null;
  let disposed = false;

  function runStep() {
    if (disposed) return;
    cleanupStep?.();
    cleanupStep = null;
    root.innerHTML = '';
    app.closeOverlay();
    const step = steps[index];
    app.questDots(index, steps.length);
    const quest = {
      onDone(result) {
        if (disposed) return;
        starsEarned += result?.stars ?? 0;
        if (step.type === 'write' && result?.stars === 0 && !inserted.has(step.glyph)) {
          inserted.add(step.glyph);
          steps.splice(index + 1, 0, { type: 'trace', glyph: step.glyph, rounds: 1, level: 1 }, { type: 'write', glyph: step.glyph });
        }
        index++;
        if (index < steps.length) runStep();
        else finish();
      },
    };
    switch (step.type) {
      case 'trace':
        cleanupStep = mountTrace(root, app, { glyph: step.glyph, rounds: step.rounds ?? 1, level: step.level ?? null, quest });
        break;
      case 'write':
        cleanupStep = mountWrite(root, app, { glyph: step.glyph, quest });
        break;
      case 'spot':
        cleanupStep = mountSpot(root, app, { glyph: step.glyph, rounds: 3, quest });
        break;
      case 'twins':
        cleanupStep = mountTwins(root, app, { pairs: step.pairs, rounds: 4, quest });
        break;
      case 'pop':
        cleanupStep = mountPop(root, app, { total: 8, quest });
        break;
      default:
        quest.onDone({ stars: 0 });
    }
  }

  function finish() {
    cleanupStep?.();
    cleanupStep = null;
    root.innerHTML = '';
    app.progress.quests++;
    app.save();
    app.questDots(steps.length, steps.length);
    app.setTitle('Quest complete!');
    app.sfx.play('fanfare');
    app.confetti.rain({ count: 160 });
    app.dot.cheer();
    app.say('quest_done');
    const cardEl = el('div', 'overlay__card');
    cardEl.appendChild(el('div', 'overlay__big', '🏆'));
    cardEl.appendChild(el('h2', 'overlay__title', 'Quest complete!'));
    cardEl.appendChild(starRow(3));
    cardEl.appendChild(el('p', 'overlay__sub', `${starsEarned} star${starsEarned === 1 ? '' : 's'} this quest · ${app.progress.stars} in all`));
    const next = starsToNextSticker(app.progress);
    cardEl.appendChild(el('p', 'overlay__sub', next ? `${next} more star${next === 1 ? '' : 's'} until your next sticker!` : 'You have every sticker!'));
    const actions = el('div', 'overlay__actions');
    actions.appendChild(
      button('btn btn--coral btn--big', 'Play again', () => {
        app.sfx.play('tap');
        app.closeOverlay();
        app.go('quest');
      }, { emoji: '🚀' }),
    );
    actions.appendChild(
      button('btn btn--sunny', 'Stickers', () => {
        app.sfx.play('tap');
        app.closeOverlay();
        app.go('stickers');
      }, { emoji: '📒' }),
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

  runStep();

  return () => {
    disposed = true;
    cleanupStep?.();
    app.clearQuestDots();
  };
}
