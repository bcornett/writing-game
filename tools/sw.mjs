/**
 * Generates the service worker that makes the game playable offline.
 *
 * The precache list has to match what's actually on disk, and a hand-written
 * list would drift the first time someone adds a module. So the list — and the
 * cache version, which is a hash of every file's contents — is generated:
 *
 *   npm run sw          writes sw.js
 *   npm start           serves a freshly generated sw.js on every request, so
 *                       editing the game during development always invalidates
 *                       the cache
 *   npm test            asserts the committed sw.js matches the file tree
 *
 * That last one is what keeps a static deploy honest.
 */

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** Everything the game needs to run with the network switched off. */
const INCLUDE_DIRS = ['src', 'icons', 'audio'];
const INCLUDE_FILES = ['index.html', 'style.css', 'manifest.webmanifest'];
const INCLUDE_EXTENSIONS = new Set([
  '.js',
  '.css',
  '.html',
  '.png',
  '.webmanifest',
  '.json',
  '.mp3',
]);

async function walk(dir, root, out) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, root, out);
      continue;
    }
    const ext = entry.name.slice(entry.name.lastIndexOf('.'));
    if (!INCLUDE_EXTENSIONS.has(ext)) continue;
    // LICENSE/VERSION notes in vendor/ don't need caching, and neither do maps.
    if (entry.name.endsWith('.map')) continue;
    out.push(relative(root, full).split(sep).join('/'));
  }
  return out;
}

/** Relative paths of every asset the service worker should precache. */
export async function collectAssets(root) {
  const found = [];
  for (const file of INCLUDE_FILES) {
    try {
      await fs.access(join(root, file));
      found.push(file);
    } catch {
      /* not built yet — `npm run icons` and `npm run voices` create these */
    }
  }
  for (const dir of INCLUDE_DIRS) await walk(join(root, dir), root, found);
  // index.html first so it is fetched before everything it references.
  return [...new Set(found)].sort((a, b) =>
    a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b),
  );
}

/** A version string that changes whenever any cached file changes. */
export async function assetsVersion(root, assets) {
  const hash = createHash('sha256');
  for (const asset of assets) {
    hash.update(asset);
    hash.update(await fs.readFile(join(root, asset)));
  }
  return hash.digest('hex').slice(0, 12);
}

/** The full source of sw.js for the project at `root`. */
export async function buildServiceWorker(root) {
  const assets = await collectAssets(root);
  const version = await assetsVersion(root, assets);
  const list = assets.map((a) => `  '${a}',`).join('\n');

  return `/**
 * Dot's Writing Quest — offline cache.
 *
 * GENERATED FILE. Do not edit by hand; run \`npm run sw\`.
 * Source: tools/sw.mjs
 *
 * Strategy is cache-first, which is what you want for a game with no server
 * state: once it is installed it never touches the network, so it works on a
 * plane. Updates are handled by version: any change to any file produces a new
 * VERSION, the browser installs the new worker alongside the old one, and the
 * game's menu offers an "Update" button that activates it.
 */

const VERSION = '${version}';
const CACHE = 'writing-quest-' + VERSION;

const ASSETS = [
${list}
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)),
  );
  // Deliberately no skipWaiting(): swapping files under a running game would
  // be rude. The page asks for the swap when the player taps Update.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('writing-quest-') && key !== CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
  if (event.data === 'version') {
    event.source?.postMessage({ type: 'version', version: VERSION });
  }
});

const indexUrl = new URL('index.html', self.registration.scope).href;

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // A navigation (opening the app, or the home-screen icon) always resolves to
  // the cached page when we have it, so a dead server never shows an error.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cached = await caches.match(indexUrl);
        if (cached) return cached;
        try {
          return await fetch(request);
        } catch {
          return new Response('Offline and nothing cached yet.', {
            status: 503,
            headers: { 'content-type': 'text/plain' },
          });
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        // Cache anything else same-origin we happen to need later.
        if (response.ok && response.type === 'basic') {
          const cache = await caches.open(CACHE);
          cache.put(request, response.clone());
        }
        return response;
      } catch {
        const fallback = await caches.match(request, { ignoreSearch: true });
        if (fallback) return fallback;
        // Offline and never cached. Answer with a plain 404 rather than
        // throwing: the voice player treats a missing clip as "use the
        // device voice", and a rejected fetch would just spam the console.
        return new Response('', { status: 404, statusText: 'Offline' });
      }
    })(),
  );
});
`;
}
