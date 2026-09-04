#!/usr/bin/env node
/**
 * Write sw.js from whatever is currently on disk.
 *
 *   npm run sw
 *
 * `npm start` serves a freshly generated one anyway, so this is for keeping
 * the committed file correct — which is what a static deploy actually ships.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildServiceWorker, collectAssets, assetsVersion } from './sw.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const out = join(ROOT, 'sw.js');
writeFileSync(out, await buildServiceWorker(ROOT));

const assets = await collectAssets(ROOT);
const version = await assetsVersion(ROOT, assets);

console.log(`wrote ${out}`);
console.log(`  version ${version}`);
console.log(`  ${assets.length} files precached`);
