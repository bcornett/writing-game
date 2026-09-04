#!/usr/bin/env node
/**
 * Set up https so the game can save itself for offline play on the iPad.
 *
 *   npm run cert
 *
 * Creates a local certificate authority and a server certificate covering this
 * Mac's addresses. After this, `npm start` serves https automatically.
 *
 * You install the CA on the iPad once. Nothing else on the internet trusts it,
 * and the private key never leaves this folder (which is gitignored).
 */

import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { ensureCertificate, opensslAvailable, certPaths } from './cert.mjs';
import { lanAddresses } from './serve.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

if (!opensslAvailable()) {
  console.error('openssl not found. It ships with macOS; try `brew install openssl`.');
  process.exit(1);
}

const addresses = lanAddresses().map((a) => a.address);
const result = ensureCertificate(ROOT, addresses);
const p = certPaths(ROOT);

console.log('');
console.log(result.created ? '  Created a local certificate authority.' : '  Using the existing certificate authority.');
console.log(result.reissued ? '  Issued a server certificate.' : '  Server certificate already covers these addresses.');
console.log('');
console.log('  Covers: ' + result.hosts.join(', '));
console.log('  Files:  ' + relative(ROOT, p.dir) + '/  (gitignored — the key stays here)');
console.log('');
console.log('  Next: run `npm start`, then follow the on-screen steps to trust');
console.log('  the certificate on the iPad. You only do that once.');
console.log('');
