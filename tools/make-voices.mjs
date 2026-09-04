#!/usr/bin/env node
/**
 * Turn every line in src/core/phrases.js into an MP3 with ElevenLabs.
 *
 *   npm run voices                 # generate whatever is missing or changed
 *   npm run voices -- --dry-run    # just count characters
 *   npm run voices -- --only hello,glyph.d5   # ids, or id prefixes
 *   npm run voices -- --force      # regenerate everything
 *
 * Reads ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID and ELEVENLABS_MODEL from
 * .env (gitignored). Writes audio/voice/<id>.mp3 and audio/voice/manifest.json,
 * which records the text and voice each clip was made from, so a changed line
 * or a changed voice regenerates exactly the clips that need it and nothing
 * else — every character sent costs money.
 *
 * Clips are generated in priority order (game-wide lines first, then the
 * default focus glyphs, then the rest), so a quota cut-off still leaves a
 * playable game. Anything missing falls back to the device voice at runtime.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PHRASES, totalCharacters } from '../src/core/phrases.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'audio', 'voice');
const MANIFEST = join(OUT_DIR, 'manifest.json');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};

/** The smallest possible .env reader: KEY=value lines, # comments, optional quotes. */
export function readEnv(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!m || line.trim().startsWith('#')) continue;
    out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

const env = { ...readEnv(join(ROOT, '.env')), ...process.env };
const VOICE_ID = env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';
const MODEL = env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
const OUTPUT_FORMAT = 'mp3_44100_64';
/** Warm, steady, a touch slower than adult conversation. */
const VOICE_SETTINGS = { stability: 0.5, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true, speed: 0.95 };
const CONCURRENCY = 3;

export const clipHash = (text, voiceId = VOICE_ID, model = MODEL) =>
  createHash('sha256').update(`${voiceId}|${model}|${OUTPUT_FORMAT}|${JSON.stringify(VOICE_SETTINGS)}|${text}`).digest('hex').slice(0, 16);

export function loadManifest() {
  try {
    return JSON.parse(readFileSync(MANIFEST, 'utf8'));
  } catch {
    return { voiceId: VOICE_ID, model: MODEL, clips: {} };
  }
}

/** Which clips need (re)generating, in priority order. */
export function plan(phrases, manifest, { only = null, force = false } = {}) {
  const ids = Object.keys(phrases)
    .filter((id) => !only || only.some((o) => id === o || id.startsWith(o)))
    .sort((a, b) => phrases[a].priority - phrases[b].priority || a.localeCompare(b));
  return ids.filter((id) => {
    if (force) return true;
    const entry = manifest.clips?.[id];
    return !entry || entry.hash !== clipHash(phrases[id].text) || !existsSync(join(OUT_DIR, entry.file));
  });
}

async function synthesize(text, apiKey) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=${OUTPUT_FORMAT}`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({ text, model_id: MODEL, voice_settings: VOICE_SETTINGS }),
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const body = await res.text().catch(() => '');
    if (res.status === 429 && attempt < 4) {
      await new Promise((r) => setTimeout(r, 1500 * attempt));
      continue;
    }
    throw new Error(`ElevenLabs ${res.status}: ${body.slice(0, 300)}`);
  }
  throw new Error('unreachable');
}

async function main() {
  const manifest = loadManifest();
  const only = option('only')?.split(',').map((s) => s.trim()).filter(Boolean) ?? null;
  const todo = plan(PHRASES, manifest, { only, force: flag('force') });
  const chars = totalCharacters(todo);
  console.log(`${Object.keys(PHRASES).length} phrases, ${totalCharacters().toLocaleString()} characters in total`);
  console.log(`${todo.length} to generate (${chars.toLocaleString()} characters) with voice ${VOICE_ID}, model ${MODEL}`);
  if (flag('dry-run') || !todo.length) return;

  const apiKey = env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error('ELEVENLABS_API_KEY is not set. Put it in .env (gitignored) and run again.');
    process.exit(1);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  manifest.voiceId = VOICE_ID;
  manifest.model = MODEL;
  manifest.clips ??= {};

  let done = 0;
  let failed = null;
  const queue = [...todo];
  const save = () => writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  const worker = async () => {
    while (queue.length && !failed) {
      const id = queue.shift();
      const text = PHRASES[id].text;
      try {
        const mp3 = await synthesize(text, apiKey);
        const file = `${id}.mp3`;
        writeFileSync(join(OUT_DIR, file), mp3);
        manifest.clips[id] = { file, text, hash: clipHash(text), bytes: mp3.length };
        done++;
        console.log(`  ${String(done).padStart(3)}/${todo.length}  ${id}  (${(mp3.length / 1024).toFixed(0)} KB)  "${text}"`);
        if (done % 5 === 0) save();
      } catch (error) {
        failed = { id, error };
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  manifest.generatedAt = new Date().toISOString();
  save();
  console.log(`wrote ${done} clips and ${MANIFEST}`);
  if (failed) {
    console.error(`stopped at ${failed.id}: ${failed.error.message}`);
    console.error('Run `npm run voices` again to resume; finished clips are kept.');
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
