/**
 * Dot's Writing Quest — boot, the shared app object, and the screen router.
 *
 * Every screen is a function `mount(root, app, params)` that returns a
 * cleanup function. `app` is the one object they all share: progress and
 * saving, the voice and sound effects, the mascot in the footer, stars and
 * stickers, and navigation. Nothing here knows how a letter is drawn — that
 * is all in src/core and src/render.
 */

import { loadProgress, saveProgress, clearProgress } from './ui/save.js';
import { createVoice } from './audio/voice.js';
import { createSfx } from './audio/sfx.js';
import { createConfetti } from './ui/confetti.js';
import { createDot } from './render/dot.js';
import { createUpdater, STATUS } from './ui/updates.js';
import { mastery, pickGlyph, addStars, DEFAULT_FOCUS, createProgress } from './core/progress.js';
import { recordOutcome } from './core/progress.js';
import { eligibleForSpot } from './core/curriculum.js';
import { phraseText } from './core/phrases.js';
import { el, button, pickOne } from './ui/dom.js';
import { mountHome } from './ui/screens/home.js';
import { mountTrace } from './ui/screens/trace.js';
import { mountWrite } from './ui/screens/write.js';
import { mountSpot } from './ui/screens/spot.js';
import { mountTwins } from './ui/screens/twins.js';
import { mountPop } from './ui/screens/pop.js';
import { mountQuest } from './ui/screens/quest.js';
import { mountStickers } from './ui/screens/stickers.js';
import { mountParent } from './ui/screens/parent.js';

const $ = (id) => document.getElementById(id);

const SCREENS = {
  home: mountHome,
  trace: mountTrace,
  write: mountWrite,
  spot: mountSpot,
  twins: mountTwins,
  pop: mountPop,
  quest: mountQuest,
  stickers: mountStickers,
  parent: mountParent,
};

const PRAISE = ['great', 'wow', 'you_did_it', 'amazing', 'super', 'nice'];

const screenRoot = $('screen');
const overlayRoot = $('overlay');
const bubbleText = $('bubble-text');
const bubbleEl = $('bubble');
const titleEl = $('topbar-title');
const backBtn = $('back-button');
const starsCount = $('stars-count');
const starsBadge = $('stars-badge');
const questDotsEl = $('quest-dots');

const sfx = createSfx();
const voice = createVoice({ sfx });
const confetti = createConfetti($('confetti'));
const dot = createDot({ size: 84 });
$('dot-home').appendChild(dot.el);

let progress = loadProgress();
let cleanup = null;
let currentScreen = null;
let overlayOpen = false;
const updaterListeners = new Set();

const app = {
  get progress() {
    return progress;
  },
  rng: Math.random,
  voice,
  sfx,
  confetti,
  dot,
  version: null,

  save() {
    saveProgress(progress);
  },

  resetProgress() {
    const keep = { name: progress.name, focus: progress.focus, voice: progress.voice, strictness: progress.strictness, setup: progress.setup };
    clearProgress();
    progress = Object.assign(createProgress(), keep);
    app.save();
    renderStars();
  },

  setTitle(text) {
    titleEl.textContent = text;
  },

  bubble(text) {
    bubbleText.textContent = text;
    bubbleEl.classList.remove('is-fresh');
    void bubbleEl.offsetWidth;
    bubbleEl.classList.add('is-fresh');
  },

  /** Dot says these lines (voice + bubble). Resolves when she is done or interrupted. */
  say(...ids) {
    const clean = ids.filter(Boolean);
    const text = clean.map((id) => phraseText(id) ?? '').filter(Boolean).join(' ');
    if (text) app.bubble(text);
    return voice.say(...clean);
  },

  praise: () => pickOne(Math.random, PRAISE),

  go(name, params = {}) {
    const mount = SCREENS[name];
    if (!mount) throw new Error(`no screen ${name}`);
    cleanup?.();
    cleanup = null;
    voice.stop();
    app.closeOverlay();
    app.clearQuestDots();
    screenRoot.innerHTML = '';
    screenRoot.scrollTop = 0;
    currentScreen = name;
    backBtn.classList.toggle('is-hidden', name === 'home');
    dot.idle();
    cleanup = mount(screenRoot, app, params) || null;
    if (name === 'home' && updater.status === STATUS.UPDATE_READY) updater.applyUpdate();
  },

  home() {
    app.go('home');
  },

  overlay(card) {
    overlayRoot.innerHTML = '';
    overlayRoot.appendChild(card);
    overlayRoot.classList.remove('is-hidden');
    overlayOpen = true;
  },

  closeOverlay() {
    overlayRoot.classList.add('is-hidden');
    overlayRoot.innerHTML = '';
    overlayOpen = false;
  },

  questDots(current, total) {
    questDotsEl.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const d = el('span', 'quest-dots__dot');
      if (i < current) d.classList.add('is-done');
      else if (i === current) d.classList.add('is-current');
      questDotsEl.appendChild(d);
    }
    questDotsEl.classList.remove('is-hidden');
  },

  clearQuestDots() {
    questDotsEl.classList.add('is-hidden');
    questDotsEl.innerHTML = '';
  },

  /** 1: full road and arrows · 2: dotted road · 3: just the start dot. */
  levelFor(id) {
    const m = mastery(progress, id);
    return m < 0.45 ? 1 : m < 0.75 ? 2 : 3;
  },

  focusIds() {
    return progress.focus.length ? progress.focus : DEFAULT_FOCUS;
  },

  /** Focus glyphs that can be shown backwards (a 0 can't). */
  spotIds() {
    const ids = app.focusIds().filter(eligibleForSpot);
    return ids.length ? ids : DEFAULT_FOCUS.filter(eligibleForSpot);
  },

  pick({ avoid = [], eligible = false } = {}) {
    return pickGlyph(progress, eligible ? app.spotIds() : app.focusIds(), Math.random, { avoid });
  },

  record(id, kind, outcome) {
    recordOutcome(progress, id, kind, outcome);
    app.save();
  },

  /** Add stars; if that earns a sticker, show it and wait for a tap. */
  async addStars(n) {
    const { unlocked } = addStars(progress, n);
    app.save();
    renderStars(true);
    sfx.play('star');
    for (const emoji of unlocked) {
      await new Promise((resolve) => {
        const card = el('div', 'overlay__card');
        card.appendChild(el('div', 'overlay__big', emoji));
        card.appendChild(el('h2', 'overlay__title', 'New sticker!'));
        card.appendChild(el('p', 'overlay__sub', `Sticker ${progress.stickers} of ${50}`));
        card.appendChild(
          button('btn btn--coral btn--big', 'Yay!', () => {
            sfx.play('pop');
            app.closeOverlay();
            resolve();
          }, { emoji: '🎉' }),
        );
        app.overlay(card);
        confetti.rain({ count: 120 });
        sfx.play('fanfare');
        dot.cheer();
        app.say('sticker');
      });
    }
  },

  onUpdaterChange(fn) {
    updaterListeners.add(fn);
    return () => updaterListeners.delete(fn);
  },
};

function renderStars(bump = false) {
  starsCount.textContent = String(progress.stars);
  if (bump) {
    starsBadge.classList.remove('is-bumping');
    void starsBadge.offsetWidth;
    starsBadge.classList.add('is-bumping');
  }
}

// --- Offline + updates -------------------------------------------------------

const updater = createUpdater({
  onChange(status) {
    for (const fn of updaterListeners) fn(status);
    // A new build found on the home screen applies itself; mid-game it waits.
    if (status === STATUS.UPDATE_READY && currentScreen === 'home' && !overlayOpen) updater.applyUpdate();
  },
});
app.updater = updater;

updater.register().then(async (registration) => {
  if (!registration) return;
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'version') app.version = event.data.version;
  });
  await navigator.serviceWorker.ready;
  navigator.serviceWorker.controller?.postMessage('version');
});

// --- Input hygiene -----------------------------------------------------------

// iOS needs a user gesture before any sound; the first tap anywhere is it.
const unlockAudio = () => {
  sfx.unlock();
  voice.unlock();
  document.removeEventListener('pointerdown', unlockAudio, true);
  document.removeEventListener('touchend', unlockAudio, true);
};
document.addEventListener('pointerdown', unlockAudio, true);
document.addEventListener('touchend', unlockAudio, true);

for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}
document.addEventListener('touchmove', (e) => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) voice.stop();
});
backBtn.addEventListener('click', () => {
  sfx.play('tap');
  app.home();
});

// --- Boot --------------------------------------------------------------------

voice.setEnabled(progress.voice);
renderStars();
voice.load().finally(() => app.go('home'));
