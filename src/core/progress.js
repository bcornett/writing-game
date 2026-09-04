/**
 * What she has done and how it is going — the save file, and the mastery
 * model that decides what to practise next.
 *
 * Every activity reports an outcome per glyph. Mastery is a recency-weighted
 * average of those, so a run of good fives lifts the five quickly and a
 * reversal drops it. The picker leans toward low-mastery glyphs without ever
 * ignoring the rest, and stars accumulate into stickers (never down: this
 * game has no way to lose anything).
 */

export const SAVE_VERSION = 1;
export const STARS_PER_STICKER = 10;
export const RECENT_LIMIT = 12;

/** Sticker reward order. Deliberately not random: the first ones are the best ones. */
export const STICKERS = [
  '🦄', '🌈', '🐱', '🐶', '🦋', '🐢', '🐸', '🦊', '🐼', '🐨',
  '🦁', '🐯', '🐵', '🐧', '🦉', '🐝', '🐞', '🌻', '🌸', '🍓',
  '🍉', '🍦', '🧁', '🍩', '🎈', '🎀', '⭐', '🌙', '☀️', '🚀',
  '🚗', '🚲', '⛵', '🏰', '🎠', '🎡', '🎨', '🎸', '🥁', '⚽',
  '🏀', '🎯', '🧩', '🧸', '👑', '💎', '🔮', '🪁', '🐙', '🦕',
];

export const DEFAULT_FOCUS = ['5', '2', 'b', 'd', '3', '7', '9', '6', 's', 'z', 'p', 'q', 'j'];

/** How much evidence of mastery each outcome is, 0..1. */
export const OUTCOME_SCORE = {
  write: {
    great: 1,
    good: 0.85,
    backward: 0.7,
    okay: 0.5,
    'try-again': 0.25,
    'looks-like': 0.15,
    upside: 0.05,
    flipped: 0,
  },
  trace: { clean: 0.6, slips: 0.45 },
  spot: { first: 0.85, later: 0.35 },
  twins: { right: 0.8, wrong: 0.2 },
  pop: { right: 0.7, wrong: 0.3 },
};

export function createProgress(now = Date.now()) {
  return {
    version: SAVE_VERSION,
    name: '',
    /** The grown-up has been through the first-run screen. */
    setup: false,
    focus: [...DEFAULT_FOCUS],
    voice: true,
    strictness: 'normal',
    stars: 0,
    stickers: 0,
    quests: 0,
    glyphs: {},
    createdAt: now,
    updatedAt: now,
  };
}

function record(progress, id) {
  if (!progress.glyphs[id]) {
    progress.glyphs[id] = { trace: 0, write: 0, writeOk: 0, flips: 0, spot: 0, spotOk: 0, recent: [] };
  }
  return progress.glyphs[id];
}

/** Log one outcome for one glyph. Returns the glyph's record. */
export function recordOutcome(progress, id, kind, outcome, now = Date.now()) {
  const table = OUTCOME_SCORE[kind];
  if (!table || !(outcome in table)) throw new Error(`unknown outcome ${kind}/${outcome}`);
  const r = record(progress, id);
  if (kind === 'trace') r.trace++;
  if (kind === 'write') {
    r.write++;
    if (['great', 'good', 'backward'].includes(outcome)) r.writeOk++;
    if (outcome === 'flipped' || outcome === 'upside') r.flips++;
  }
  if (kind === 'spot' || kind === 'twins' || kind === 'pop') {
    r.spot++;
    if (outcome === 'first' || outcome === 'right') r.spotOk++;
  }
  r.recent.push({ k: kind, o: outcome, t: now });
  if (r.recent.length > RECENT_LIMIT) r.recent.splice(0, r.recent.length - RECENT_LIMIT);
  progress.updatedAt = now;
  return r;
}

/** 0..1, or the neutral prior 0.3 for a glyph she has not tried yet. */
export function mastery(progress, id) {
  const r = progress.glyphs[id];
  if (!r || !r.recent.length) return 0.3;
  let sum = 0;
  let weight = 0;
  const n = r.recent.length;
  r.recent.forEach((e, i) => {
    const w = Math.pow(0.8, n - 1 - i);
    sum += OUTCOME_SCORE[e.k][e.o] * w;
    weight += w;
  });
  return sum / weight;
}

/** How often, over her recent writes of this glyph, a reversal came out. */
export function reversalRate(progress, id) {
  const r = progress.glyphs[id];
  if (!r) return 0;
  const writes = r.recent.filter((e) => e.k === 'write');
  if (!writes.length) return 0;
  return writes.filter((e) => e.o === 'flipped' || e.o === 'upside').length / writes.length;
}

/**
 * Pick the next glyph to practise: weighted toward what she finds hard,
 * never repeating what she just did if there is any alternative.
 */
export function pickGlyph(progress, focus, rng, { avoid = [] } = {}) {
  const all = focus.length ? focus : DEFAULT_FOCUS;
  const rest = all.filter((id) => !avoid.includes(id));
  const pool = rest.length ? rest : all;
  const weights = pool.map((id) => 0.15 + Math.pow(1 - mastery(progress, id), 2) * 3);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/** Add stars; returns any stickers that just got unlocked. */
export function addStars(progress, n) {
  progress.stars += Math.max(0, Math.floor(n));
  const earned = Math.min(STICKERS.length, Math.floor(progress.stars / STARS_PER_STICKER));
  const unlocked = [];
  while (progress.stickers < earned) {
    unlocked.push(STICKERS[progress.stickers]);
    progress.stickers++;
  }
  return { stars: progress.stars, unlocked };
}

export const starsToNextSticker = (progress) =>
  progress.stickers >= STICKERS.length ? 0 : STARS_PER_STICKER - (progress.stars % STARS_PER_STICKER);

export const unlockedStickers = (progress) => STICKERS.slice(0, progress.stickers);

/** Validate whatever came out of storage; anything odd falls back to defaults. */
export function normalizeProgress(raw, now = Date.now()) {
  const p = createProgress(now);
  if (!raw || typeof raw !== 'object') return p;
  if (typeof raw.name === 'string') p.name = raw.name.slice(0, 24);
  if (typeof raw.setup === 'boolean') p.setup = raw.setup;
  if (Array.isArray(raw.focus) && raw.focus.every((v) => typeof v === 'string')) p.focus = [...new Set(raw.focus)];
  if (typeof raw.voice === 'boolean') p.voice = raw.voice;
  if (['easy', 'normal', 'tricky'].includes(raw.strictness)) p.strictness = raw.strictness;
  if (Number.isFinite(raw.stars) && raw.stars >= 0) p.stars = Math.floor(raw.stars);
  if (Number.isFinite(raw.stickers) && raw.stickers >= 0) p.stickers = Math.min(STICKERS.length, Math.floor(raw.stickers));
  if (Number.isFinite(raw.quests) && raw.quests >= 0) p.quests = Math.floor(raw.quests);
  if (Number.isFinite(raw.createdAt)) p.createdAt = raw.createdAt;
  if (Number.isFinite(raw.updatedAt)) p.updatedAt = raw.updatedAt;
  if (raw.glyphs && typeof raw.glyphs === 'object') {
    for (const [id, r] of Object.entries(raw.glyphs)) {
      if (!r || typeof r !== 'object') continue;
      const rec = record(p, id);
      for (const k of ['trace', 'write', 'writeOk', 'flips', 'spot', 'spotOk']) {
        if (Number.isFinite(r[k]) && r[k] >= 0) rec[k] = Math.floor(r[k]);
      }
      if (Array.isArray(r.recent)) {
        rec.recent = r.recent
          .filter((e) => e && OUTCOME_SCORE[e.k] && e.o in OUTCOME_SCORE[e.k])
          .slice(-RECENT_LIMIT)
          .map((e) => ({ k: e.k, o: e.o, t: Number.isFinite(e.t) ? e.t : now }));
      }
    }
  }
  return p;
}
