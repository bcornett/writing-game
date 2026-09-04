/**
 * Everything Dot can say, in one table.
 *
 * `tools/make-voices.mjs` turns this into MP3s with ElevenLabs, and the game
 * plays those. If a clip is missing the game speaks the same text with the
 * device's own voice, so the table is the source of truth for both.
 *
 * Short lines on purpose: the listener is five, and each character costs
 * money. Letter names are spelled as sounds (see glyphs.js).
 */

import { GLYPHS } from './glyphs.js';
import { TWIN_PAIRS } from './curriculum.js';
import { DEFAULT_FOCUS } from './progress.js';

export const GENERIC = {
  hello: "Hi! I'm Dot. Let's write together!",
  welcome: 'Welcome back! Ready to play?',
  lets_go: "Let's go!",
  lets_write: "Let's write",
  watch_me: 'Watch me first.',
  your_turn: 'Your turn! Start at the green dot.',
  start_at_dot: 'Start at the green dot!',
  other_end: "Oops, that's the wrong end. Start at the green dot!",
  keep_going: 'Keep going!',
  stay_on_road: 'Whoops! Stay on the road.',
  nice: 'Nice!',
  great: 'Great job!',
  wow: 'Wow! Perfect!',
  you_did_it: 'You did it!',
  amazing: 'Amazing!',
  super: 'Super!',
  so_close: "So close! Let's try again.",
  try_again: "Let's try that again.",
  watch_dot: 'Watch Dot show you the way.',
  flipped: 'Oops! That one is facing the wrong way.',
  upside: 'Oops! That one is upside down.',
  backward: 'Good shape! Next time, start at the top.',
  looks_like: 'Hmm, that looks like',
  write_it: 'Now write it all by yourself!',
  tap_check: "Tap the green check when you're done.",
  find_real: 'Find the real',
  tap_real: 'Tap the real one!',
  that_backwards: "That one's backwards. Try again!",
  that_upside: "That one's upside down. Try again!",
  pop_backwards: 'Pop the backwards ones!',
  that_was_right: 'Oops, that one was right! Pop the backwards ones.',
  one_star: 'One star!',
  two_stars: 'Two stars!',
  three_stars: 'Three stars!',
  sticker: 'You earned a new sticker!',
  quest_done: "Quest complete! You're a writing superstar!",
  bed_trick:
    'Make two fists with your thumbs up. Your left hand makes little bee, and your right hand makes little dee. Together they spell, bed!',
  which_one: 'Which one is it?',
  yes_thats: "Yes! That's",
  look_again: 'Not quite. Look again!',
  next_one: 'Next one!',
  all_done: 'All done! Great work today.',
  fading: 'Now the road is fading. Follow it from memory!',
  just_dots: 'This time, just the dots. You know the way!',
  pick_game: 'Pick a game!',
};

/** Spoken question for each twin pair, keyed by the two ids joined. */
export const PAIR_PROMPTS = {
  bd: 'Is this little bee, or little dee?',
  pq: 'Is this little pee, or little cue?',
  bp: 'Is this little bee, or little pee?',
  dq: 'Is this little dee, or little cue?',
  69: 'Is this a six, or a nine?',
  nu: 'Is this little en, or little you?',
  mw: 'Is this little em, or little double-you?',
  25: 'Is this a two, or a five?',
};

export const pairKey = (pair) => pair.join('');
export const phraseIdFor = (g, kind) => `glyph.${g.slug}.${kind}`;

/** id → { text, priority } for every clip. Priority 0 first: generic lines, then the default focus glyphs. */
export function buildPhrases() {
  const out = {};
  const add = (id, text, priority) => {
    if (out[id]) throw new Error(`duplicate phrase id ${id}`);
    out[id] = { text, priority };
  };
  for (const [id, text] of Object.entries(GENERIC)) add(id, text, 0);
  for (const p of TWIN_PAIRS) {
    const key = pairKey(p.pair);
    if (!PAIR_PROMPTS[key]) throw new Error(`no prompt for pair ${key}`);
    add(`pair.${key}`, PAIR_PROMPTS[key], 1);
  }
  for (const g of GLYPHS) {
    const pri = DEFAULT_FOCUS.includes(g.id) ? 1 : 2;
    add(phraseIdFor(g, 'name'), g.spoken, pri);
    add(phraseIdFor(g, 'rhyme'), g.rhyme, pri);
    if (g.flip) add(phraseIdFor(g, 'flip'), g.flip, pri);
  }
  return out;
}

export const PHRASES = buildPhrases();

export const phraseText = (id) => PHRASES[id]?.text ?? null;

export const totalCharacters = (ids = Object.keys(PHRASES)) =>
  ids.reduce((n, id) => n + (PHRASES[id]?.text.length ?? 0), 0);
