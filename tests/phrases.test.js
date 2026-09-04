/**
 * The voice catalogue, and the drift check that keeps the generated clips
 * honest: every line the game can say must have a clip made from exactly
 * that text with the current voice, or `npm run voices` needs running.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PHRASES, GENERIC, PAIR_PROMPTS, phraseIdFor, phraseText, totalCharacters } from '../src/core/phrases.js';
import { GLYPHS } from '../src/core/glyphs.js';
import { TWIN_PAIRS, REVERSAL_PRONE } from '../src/core/curriculum.js';
import { clipHash, plan, loadManifest, readEnv } from '../tools/make-voices.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('every glyph has a name and a rhyme, and the reversal-prone ones a flip hint', () => {
  for (const g of GLYPHS) {
    assert.equal(phraseText(phraseIdFor(g, 'name')), g.spoken);
    assert.equal(phraseText(phraseIdFor(g, 'rhyme')), g.rhyme);
    if (REVERSAL_PRONE.includes(g.id)) assert.ok(phraseText(phraseIdFor(g, 'flip')), `${g.id} needs a flip hint`);
  }
  for (const p of TWIN_PAIRS) assert.ok(PAIR_PROMPTS[p.pair.join('')], `prompt for ${p.pair}`);
  for (const id of Object.keys(GENERIC)) assert.ok(PHRASES[id]);
});

test('ids are filesystem-safe and unique on a case-insensitive disk', () => {
  const ids = Object.keys(PHRASES);
  assert.equal(new Set(ids.map((id) => id.toLowerCase())).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z0-9_.]+$/, id);
});

test('the catalogue stays affordable', () => {
  assert.ok(totalCharacters() < 9000, `${totalCharacters()} characters`);
  for (const [id, { text }] of Object.entries(PHRASES)) {
    assert.ok(text.length > 0 && text.length <= 140, `${id} is ${text.length} characters`);
    assert.ok(!/\bTODO\b/i.test(text));
  }
});

test('the generated clips match the catalogue (run `npm run voices` if not)', () => {
  const manifest = loadManifest();
  const missing = plan(PHRASES, manifest);
  assert.deepEqual(missing, [], `clips missing or out of date: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''}`);
  for (const [id, entry] of Object.entries(manifest.clips)) {
    assert.ok(PHRASES[id], `manifest has a clip for an unknown phrase: ${id}`);
    assert.ok(existsSync(join(ROOT, 'audio', 'voice', entry.file)), `${entry.file} exists`);
    assert.equal(entry.hash, clipHash(entry.text));
  }
});

test('the .env reader copes with comments, quotes and blanks', () => {
  const path = join(ROOT, 'tests', 'fixtures', 'sample.env');
  const env = readEnv(path);
  assert.equal(env.ELEVENLABS_API_KEY, 'sk_test_123');
  assert.equal(env.ELEVENLABS_VOICE_ID, 'voice with spaces');
  assert.equal(env.COMMENTED, undefined);
  assert.deepEqual(readEnv(join(ROOT, 'tests', 'fixtures', 'does-not-exist.env')), {});
});

test('the manifest the game loads is valid JSON with the shape voice.js expects', () => {
  const raw = readFileSync(join(ROOT, 'audio', 'voice', 'manifest.json'), 'utf8');
  const m = JSON.parse(raw);
  assert.ok(m.voiceId && m.model && m.clips);
  for (const entry of Object.values(m.clips)) assert.match(entry.file, /^[a-z0-9_.]+\.mp3$/);
});
