#!/usr/bin/env node
/**
 * Write a scannable QR code PNG for the game's address.
 *
 *   npm run qr                       # auto-detects this Mac's wifi address
 *   npm run qr -- http://foo:8080    # or encode whatever you pass
 *
 * Useful for texting or AirDropping the link, or sticking it on the fridge.
 * `npm start` already prints one in the terminal — this is for when you want
 * a file.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { encodeQr, qrToRgba, qrToAnsi, supportsTruecolor } from './qr.mjs';
import { encodePng } from './png.mjs';
import { lanAddresses } from './serve.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT) || 8080;

const explicit = process.argv[2];
const addrs = lanAddresses();
if (!explicit && !addrs.length) {
  console.error('No wifi address found. Pass a URL: npm run qr -- http://host:port');
  process.exit(1);
}
const url = explicit ?? `http://${addrs[0].address}:${port}`;

const qr = encodeQr(url, { ecc: 'M' });
const { width, height, rgba } = qrToRgba(qr, { scale: 12, quiet: 4 });
const out = join(ROOT, 'qr.png');
writeFileSync(out, encodePng(width, height, rgba));

console.log('');
console.log(qrToAnsi(qr, { truecolor: supportsTruecolor() }));
console.log('');
console.log(`  ${url}`);
console.log(`  version ${qr.version}-${qr.ecc}, ${qr.size}x${qr.size} modules`);
console.log(`  wrote ${out} (${width}x${height})`);
console.log('');
