/**
 * Tests for the offline cache generator.
 *
 * The one that matters most is the drift check: the committed sw.js has to
 * match what's on disk, because that file is what a static deploy ships. The
 * dev server regenerates it per request, so a stale committed copy would only
 * ever bite in production.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { buildServiceWorker, collectAssets, assetsVersion } from '../tools/sw.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('the committed sw.js matches the current file tree', async () => {
  const expected = await buildServiceWorker(ROOT);
  const actual = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  assert.equal(
    actual,
    expected,
    'sw.js is out of date — run `npm run sw` and commit the result',
  );
});

test('the precache list covers everything the game needs to boot', async () => {
  const assets = await collectAssets(ROOT);

  for (const required of [
    'index.html',
    'style.css',
    'manifest.webmanifest',
    'src/main.js',
    'src/core/glyphs.js',
    'src/core/grader.js',
    'src/core/tracer.js',
    'src/ui/updates.js',
    'src/ui/screens/trace.js',
    'src/ui/screens/write.js',
    'audio/voice/manifest.json',
    'audio/voice/hello.mp3',
    'audio/voice/glyph.d5.rhyme.mp3',
    'icons/icon-180.png',
  ]) {
    assert.ok(assets.includes(required), `precache is missing ${required}`);
  }

  assert.equal(assets[0], 'index.html', 'the page should be fetched first');
  assert.equal(new Set(assets).size, assets.length, 'no duplicates');
});

test('every precached file actually exists and no junk is included', async () => {
  const assets = await collectAssets(ROOT);
  for (const asset of assets) {
    assert.ok(existsSync(join(ROOT, asset)), `precache lists a missing file: ${asset}`);
    assert.ok(!asset.startsWith('tests/'), `tests should not ship: ${asset}`);
    assert.ok(!asset.startsWith('tools/'), `tools should not ship: ${asset}`);
    assert.ok(!asset.startsWith('dev/'), `dev pages should not ship: ${asset}`);
    assert.ok(!asset.startsWith('node_modules/'), `node_modules should not ship: ${asset}`);
    assert.ok(!asset.endsWith('.map'), `source maps should not ship: ${asset}`);
  }
});

test('every module the page imports is precached', async () => {
  const assets = new Set(await collectAssets(ROOT));
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const ref = m[1];
    if (ref.startsWith('http') || ref.startsWith('data:')) continue;
    assert.ok(assets.has(ref), `index.html needs ${ref} but it is not precached`);
  }
});

test('the version changes when a file changes and is stable when nothing does', async () => {
  const assets = await collectAssets(ROOT);
  const a = await assetsVersion(ROOT, assets);
  const b = await assetsVersion(ROOT, assets);
  assert.equal(a, b, 'the version must be deterministic');
  assert.match(a, /^[0-9a-f]{12}$/);

  // Dropping a file from the list must produce a different hash — that is what
  // guarantees an edit invalidates the cache.
  const fewer = await assetsVersion(ROOT, assets.slice(0, -1));
  assert.notEqual(a, fewer);
});

test('the generated worker has the lifecycle the update button depends on', async () => {
  const source = await buildServiceWorker(ROOT);

  assert.match(source, /addEventListener\('install'/, 'install handler');
  assert.match(source, /addEventListener\('activate'/, 'activate handler');
  assert.match(source, /addEventListener\('fetch'/, 'fetch handler');
  assert.match(source, /addEventListener\('message'/, 'message handler');

  // The menu's "Update now" works by posting this message; without the guard
  // the button would silently do nothing.
  assert.match(source, /'skip-waiting'/, 'skip-waiting message');
  assert.match(source, /self\.skipWaiting\(\)/, 'skipWaiting call');
  assert.match(source, /self\.clients\.claim\(\)/, 'clients.claim call');

  // Installing must NOT auto-activate, or an update would swap files under a
  // running game instead of waiting to be asked.
  const installBlock = source
    .slice(
      source.indexOf("addEventListener('install'"),
      source.indexOf("addEventListener('activate'"),
    )
    // Strip comments, or the note explaining *why* there is no skipWaiting
    // here would trip the check below.
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(
    !installBlock.includes('skipWaiting()'),
    'install must not call skipWaiting; the player asks for the update',
  );

  // Old caches get cleaned up so the iPad does not fill with dead versions.
  assert.match(source, /caches\.delete/, 'stale cache cleanup');
  assert.match(source, /request\.mode === 'navigate'/, 'navigation fallback');
});

test('the worker is valid JavaScript', async () => {
  const source = await buildServiceWorker(ROOT);
  // Service-worker globals do not exist in Node, so parse without running.
  assert.doesNotThrow(() => new Function(source), 'generated sw.js should parse');
});
