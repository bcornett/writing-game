/**
 * The letters and numbers, as pen strokes.
 *
 * Every glyph is drawn in a 100 × 100 box on kindergarten handwriting lines:
 * top line at y=12, dashed middle line at y=48, baseline at y=84, and room
 * for descenders down to y=98. Each stroke is one absolute SVG path in the
 * order and direction a kindergarten teacher would model it (ball-and-stick
 * manuscript: "big line down, then a bump"). Stroke order matters here — the
 * tracer makes the child follow it, and it is what fixes a reversal: a b
 * starts with the stick, a d starts with the c.
 *
 * `spoken` is what the voice says for the name. Letter names are spelled the
 * way they sound ("bee", "dee") because a lone "b" in text is a coin toss for
 * any text-to-speech engine, and "little a" would come out as "little uh".
 */

export const LINES = { top: 12, mid: 48, base: 84, desc: 98 };

/** The c that starts a, d, g and q, and is c itself. Drawn counter-clockwise from about 2 o'clock. */
const MAGIC_C = 'M66,56 C62,48 50,44 42,48 C32,54 30,74 40,82 C50,88 62,84 66,76';
/** The bowl of b and p: from the stick at the middle line, clockwise round the right, back to the stick. */
const RIGHT_BOWL = 'M34,52 C44,44 64,46 66,62 C68,78 54,86 42,84 C38,83 36,82 34,80';
/** A lowercase o / the round part of the digits, counter-clockwise from the top. */
const LOWER_O = 'M50,46 C36,46 32,56 32,66 C32,78 40,86 50,86 C60,86 68,78 68,66 C68,56 64,46 50,46';
const UPPER_C = 'M70,26 C62,12 40,10 32,26 C24,42 24,56 32,72 C40,88 62,86 70,72';
const UPPER_O = 'M50,12 C32,12 28,30 28,48 C28,66 32,84 50,84 C68,84 72,66 72,48 C72,30 68,12 50,12';
const U_CUP = 'M34,48 L34,72 C34,82 44,86 54,82 C62,78 66,72 66,66 L66,48';
const DESC_TAIL = 'M66,48 L66,86 C66,98 52,100 42,94';

const DIGIT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const LETTER_SOUNDS = {
  a: 'ay', b: 'bee', c: 'see', d: 'dee', e: 'ee', f: 'eff', g: 'gee', h: 'aitch', i: 'eye', j: 'jay',
  k: 'kay', l: 'ell', m: 'em', n: 'en', o: 'oh', p: 'pee', q: 'cue', r: 'are', s: 'ess', t: 'tee',
  u: 'you', v: 'vee', w: 'double-you', x: 'ex', y: 'why', z: 'zee',
};

const D = (id, strokes, rhyme, flip = null) => ({ id, kind: 'digit', strokes, rhyme, flip });
const L = (id, strokes, rhyme, flip = null) => ({ id, kind: 'lower', strokes, rhyme, flip });
const U = (id, strokes, rhyme, flip = null) => ({ id, kind: 'upper', strokes, rhyme, flip });

const RAW = [
  // ---- digits -------------------------------------------------------------
  D('0', ['M50,12 C33,12 30,32 30,48 C30,64 33,84 50,84 C67,84 70,64 70,48 C70,32 67,12 50,12'],
    'Start at the top and curve all the way around.'),
  D('1', ['M50,12 L50,84'], 'Start at the top and go straight down.'),
  D('2', ['M31,30 C31,14 42,12 50,12 C60,12 69,18 69,30 C69,42 58,52 31,84 L70,84'],
    'Curve around like a swan, slide down to the corner, then zip across.',
    'The two curls to the right at the top, and its flat foot points to the right.'),
  D('3', ['M32,22 C36,13 48,10 58,14 C70,19 70,36 58,44 L52,46 C70,48 74,66 64,77 C56,86 40,86 31,74'],
    'Curve around the top, then curve around the bottom.',
    'Both bumps of the three stick out to the right.'),
  D('4', ['M36,12 L36,56 L72,56', 'M60,12 L60,84'],
    'Little line down, little line across, then a big line down.',
    'The four has its little lines on the left, and the big line on the right.'),
  D('5', ['M36,12 L34,44 C40,40 50,38 58,40 C72,44 72,72 58,80 C50,86 38,84 31,74', 'M36,12 L70,12'],
    'Line down, big belly around, then a hat on top.',
    "The five's hat points to the right, and its belly is on the right too."),
  D('6', ['M64,16 C48,24 34,40 32,60 C31,74 40,84 51,84 C63,84 70,74 68,62 C66,50 56,44 44,48 C38,50 33,56 32,62'],
    'Curve down and around, then close the loop at the bottom.',
    "The six's loop is at the bottom."),
  D('7', ['M30,12 L70,12 L44,84'], 'Across the top, then slide down.',
    "The seven's top goes to the right, then it slides down to the left."),
  D('8', ['M64,24 C64,12 40,10 36,22 C32,34 50,42 50,48 C50,54 30,62 34,76 C38,88 62,88 66,76 C70,62 50,54 50,48 C50,42 68,36 64,24'],
    'Make an S, then climb back up to close it.'),
  D('9', ['M66,30 C66,16 58,12 50,12 C40,12 34,20 34,30 C34,42 42,48 50,48 C58,48 66,42 66,30 L66,84'],
    'Make a circle, then a line straight down.',
    "The nine's circle is at the top, and the line goes down."),

  // ---- lowercase ----------------------------------------------------------
  L('a', [MAGIC_C, 'M66,48 L66,84'], 'Make a c, then a line down on the right.',
    'The a has its line on the right side.'),
  L('b', ['M34,12 L34,84', RIGHT_BOWL], 'Big line down, bounce up, and make a belly on the right.',
    'The b has its belly on the right. Bat first, then ball.'),
  L('c', [MAGIC_C], 'Start near the top, curve around to the left, and stop.',
    'The c opens to the right, like a mouth taking a bite.'),
  L('d', [MAGIC_C, 'M66,12 L66,84'], 'Make a c, then a big line up and down.',
    'The d has its bump on the left. Make the c first, then the tall line.'),
  L('e', ['M34,66 L66,66 C66,52 58,46 50,46 C38,46 32,56 32,66 C32,78 40,86 52,84 C58,83 63,80 66,76'],
    'Little line across, then curve around to the left.',
    "The e's straight line goes to the right, then it curls around to the left."),
  L('f', ['M62,16 C52,10 40,14 40,26 L40,84', 'M30,48 L54,48'],
    'Curve at the top, big line down, then a little line across.',
    "The f's curve is at the top, and its little line crosses the middle."),
  L('g', [MAGIC_C, DESC_TAIL], 'Make a c, then a line down with a curly tail.',
    'The g makes a c first, and its tail curls to the left.'),
  L('h', ['M34,12 L34,84', 'M34,54 C38,46 52,44 60,50 C64,53 66,58 66,64 L66,84'],
    'Big line down, then bump over to the right.'),
  L('i', ['M50,48 L50,84', 'M50,30 L50,31'], 'Little line down, then a dot on top.'),
  L('j', ['M58,48 L58,86 C58,98 44,100 36,92', 'M58,30 L58,31'],
    'Line down with a hook to the left, then a dot on top.',
    'The j curls to the left at the bottom, like a hook.'),
  L('k', ['M34,12 L34,84', 'M64,48 L36,70', 'M44,64 L66,84'], 'Big line down, then kick in and kick out.',
    "The k's kicking legs point to the right."),
  L('l', ['M50,12 L50,84'], 'Big line down.'),
  L('m', ['M30,48 L30,84', 'M30,54 C34,46 48,46 50,56 L50,84', 'M50,54 C54,46 68,46 70,56 L70,84'],
    'Little line down, bump, bump.'),
  L('n', ['M34,48 L34,84', 'M34,56 C38,46 60,44 66,56 L66,84'], 'Little line down, then one bump.'),
  L('o', [LOWER_O], 'Start at the top and curve all the way around.'),
  L('p', ['M34,48 L34,98', RIGHT_BOWL], 'Line down, way down, then a bump on the right.',
    'The p has its bump on the right, and its tail goes down.'),
  L('q', [MAGIC_C, 'M66,48 L66,98'], 'Make a c, then a line down, way down.',
    'The q has its bump on the left, and its tail goes down.'),
  L('r', ['M36,48 L36,84', 'M36,60 C40,50 52,46 62,52'], 'Little line down, bounce up, and a little arm to the right.',
    "The r's little arm reaches out to the right."),
  L('s', ['M64,54 C58,46 40,44 36,54 C34,62 50,62 56,66 C66,70 64,84 50,86 C42,87 36,82 34,76'],
    'Curve to the left, slide across, then curve back.',
    'The s starts at the top right and curves to the left first.'),
  L('t', ['M48,18 L48,84', 'M34,48 L62,48'], 'Big line down, then a little line across.'),
  L('u', [U_CUP, 'M66,48 L66,84'], 'Down, curve up, then straight down.'),
  L('v', ['M32,48 L50,84 L68,48'], 'Slide down, then slide up.'),
  L('w', ['M28,48 L40,84 L50,58 L60,84 L72,48'], 'Down, up, down, up.'),
  L('x', ['M34,48 L66,84', 'M66,48 L34,84'], 'Slide down to the right, then slide down to the left.'),
  L('y', [U_CUP, DESC_TAIL], 'Down, curve up, then a long tail down.'),
  L('z', ['M34,48 L66,48 L34,84 L66,84'], 'Zip across, slide down, zip across.',
    'The z zips to the right, slides down to the left, then zips right again.'),

  // ---- uppercase ----------------------------------------------------------
  U('A', ['M50,12 L28,84', 'M50,12 L72,84', 'M36,60 L64,60'],
    'Slide down to the left, slide down to the right, then a line across.'),
  U('B', ['M32,12 L32,84', 'M32,12 C60,10 70,20 68,32 C66,44 50,48 32,48', 'M32,48 C60,48 72,54 70,68 C68,84 50,86 32,84'],
    'Big line down, then a bump and another bump.', "Big B's bumps are on the right."),
  U('C', [UPPER_C], 'Start near the top, curve around to the left, and stop.', 'Big C opens to the right.'),
  U('D', ['M32,12 L32,84', 'M32,12 C60,12 72,30 72,48 C72,66 60,84 32,84'],
    'Big line down, then a big curve around.', "Big D's big curve is on the right."),
  U('E', ['M32,12 L32,84', 'M32,12 L70,12', 'M32,48 L62,48', 'M32,84 L70,84'],
    'Big line down, then three little lines across.', "Big E's arms all point to the right."),
  U('F', ['M32,12 L32,84', 'M32,12 L70,12', 'M32,48 L62,48'],
    'Big line down, then two little lines across.', "Big F's arms point to the right."),
  U('G', ['M70,26 C62,12 40,10 32,26 C24,42 24,56 32,72 C40,88 66,86 70,66 L70,54 L52,54'],
    'Curve around like a C, then a little shelf inside.', 'Big G opens to the right, with a little shelf inside.'),
  U('H', ['M30,12 L30,84', 'M70,12 L70,84', 'M30,48 L70,48'], 'Big line down, big line down, little line across.'),
  U('I', ['M50,12 L50,84', 'M34,12 L66,12', 'M34,84 L66,84'], 'Big line down, then a little line on top and bottom.'),
  U('J', ['M60,12 L60,72 C60,86 40,86 34,72'], 'Big line down with a hook to the left.',
    'Big J curls to the left at the bottom.'),
  U('K', ['M32,12 L32,84', 'M68,12 L34,50', 'M42,42 L70,84'], 'Big line down, then kick in and kick out.',
    "Big K's kicking legs point to the right."),
  U('L', ['M32,12 L32,84 L72,84'], 'Big line down, then a little line across.', "Big L's foot points to the right."),
  U('M', ['M28,12 L28,84', 'M28,12 L50,62 L72,12', 'M72,12 L72,84'],
    'Big line down, slide down, slide up, big line down.'),
  U('N', ['M30,12 L30,84', 'M30,12 L70,84', 'M70,84 L70,12'],
    'Big line down, slide down to the corner, then straight up.',
    'Big N goes down, slides down to the right, then goes straight up.'),
  U('O', [UPPER_O], 'Start at the top and curve all the way around.'),
  U('P', ['M32,12 L32,84', 'M32,12 C62,10 72,22 70,36 C68,50 50,52 32,52'],
    'Big line down, then a bump at the top.', "Big P's bump is on the right, at the top."),
  U('Q', [UPPER_O, 'M56,68 L74,88'], 'Curve all the way around, then a little tail.'),
  U('R', ['M32,12 L32,84', 'M32,12 C62,10 72,22 70,36 C68,50 50,52 32,52', 'M46,52 L72,84'],
    'Big line down, a bump at the top, then a leg.', "Big R's bump and leg are on the right."),
  U('S', ['M68,24 C60,10 36,10 32,26 C28,42 50,44 58,50 C72,58 72,80 54,84 C42,88 32,80 30,70'],
    'Curve to the left, slide across, then curve back.', 'Big S starts at the top right and curves to the left first.'),
  U('T', ['M30,12 L70,12', 'M50,12 L50,84'], 'Line across the top, then a big line down.'),
  U('U', ['M30,12 L30,64 C30,84 70,84 70,64 L70,12'], 'Down, curve around, and up.'),
  U('V', ['M28,12 L50,84 L72,12'], 'Slide down, then slide up.'),
  U('W', ['M24,12 L36,84 L50,40 L64,84 L76,12'], 'Down, up, down, up.'),
  U('X', ['M30,12 L70,84', 'M70,12 L30,84'], 'Slide down to the right, then slide down to the left.'),
  U('Y', ['M28,12 L50,50', 'M72,12 L50,50', 'M50,50 L50,84'], 'Slide in, slide in, then a line down.'),
  U('Z', ['M30,12 L70,12 L30,84 L70,84'], 'Zip across, slide down, zip across.',
    'Big Z zips right, slides down to the left, then zips right again.'),
];

const article = (word) => (/^[aeiou]/.test(word) ? `an ${word}` : `a ${word}`);

/** Fully-described glyph records, keyed by id. */
export const GLYPHS = RAW.map((g) => {
  const lower = g.id.toLowerCase();
  const sound = LETTER_SOUNDS[lower];
  const spoken =
    g.kind === 'digit' ? DIGIT_WORDS[Number(g.id)] : g.kind === 'lower' ? `little ${sound}` : `big ${sound}`;
  const closing = g.kind === 'digit' ? article(spoken) : spoken;
  // Slugs are case-insensitive-safe: macOS would happily merge b.mp3 and B.mp3.
  const slug = g.kind === 'digit' ? `d${g.id}` : g.kind === 'lower' ? `l${lower}` : `u${lower}`;
  return {
    ...g,
    slug,
    spoken,
    /** Display label, e.g. "5", "b", "B". */
    label: g.id,
    rhyme: `${g.rhyme} That's ${closing}!`,
  };
});

export const GLYPH_BY_ID = Object.fromEntries(GLYPHS.map((g) => [g.id, g]));

export function glyph(id) {
  const g = GLYPH_BY_ID[id];
  if (!g) throw new Error(`unknown glyph "${id}"`);
  return g;
}

export const DIGITS = GLYPHS.filter((g) => g.kind === 'digit').map((g) => g.id);
export const LOWERCASE = GLYPHS.filter((g) => g.kind === 'lower').map((g) => g.id);
export const UPPERCASE = GLYPHS.filter((g) => g.kind === 'upper').map((g) => g.id);
