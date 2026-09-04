/**
 * Tests for the local certificate authority.
 *
 * These matter because the failure mode is silent and remote: a certificate
 * that looks fine on the Mac but that iOS quietly refuses to trust, leaving
 * offline play mysteriously broken on the iPad. Apple's rules for a trusted
 * server certificate are specific, so they're asserted here rather than
 * rediscovered on the couch.
 *
 * Skipped automatically if openssl isn't installed.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  sanLine,
  certificateHosts,
  ensureCertificate,
  hasCertificates,
  opensslAvailable,
  certPaths,
} from '../tools/cert.mjs';

const available = opensslAvailable();
const options = available ? {} : { skip: 'openssl not installed' };

let workspace;
test.before(() => {
  if (available) workspace = mkdtempSync(join(tmpdir(), 'space-flyer-cert-test-'));
});
test.after(() => {
  if (workspace) rmSync(workspace, { recursive: true, force: true });
});

const dump = (certPath) =>
  execFileSync('openssl', ['x509', '-in', certPath, '-noout', '-text'], {
    encoding: 'utf8',
  });

test('sanLine tells IP addresses and hostnames apart', () => {
  assert.equal(
    sanLine(['localhost', '127.0.0.1', '192.168.1.42']),
    'subjectAltName=DNS:localhost,IP:127.0.0.1,IP:192.168.1.42',
  );
  assert.equal(sanLine(['a', 'a', 'b']), 'subjectAltName=DNS:a,DNS:b', 'deduplicated');
});

test('certificateHosts returns nothing for a file that is not there', () => {
  assert.deepEqual(certificateHosts('/no/such/certificate.crt'), []);
});

test('ensureCertificate creates a CA and a server certificate', options, () => {
  const result = ensureCertificate(workspace, ['192.168.1.42']);
  const p = certPaths(workspace);

  assert.ok(result.created, 'should have created the CA');
  assert.ok(result.reissued, 'should have issued a server certificate');
  for (const file of [p.caKey, p.caCert, p.key, p.cert]) {
    assert.ok(existsSync(file), `missing ${file}`);
  }
  assert.ok(hasCertificates(workspace));
  assert.ok(result.key.length > 0 && result.cert.length > 0);
});

test('the server certificate is signed by our CA', options, () => {
  const p = certPaths(workspace);
  const output = execFileSync(
    'openssl',
    ['verify', '-CAfile', p.caCert, p.cert],
    { encoding: 'utf8' },
  );
  assert.match(output, /OK/);
});

test('the certificate meets what iOS requires of a trusted server cert', options, () => {
  const p = certPaths(workspace);
  const text = dump(p.cert);

  // Hosts must come from subjectAltName; iOS ignores the common name entirely.
  assert.match(text, /X509v3 Subject Alternative Name/);
  const hosts = certificateHosts(p.cert);
  assert.ok(hosts.includes('localhost'), 'localhost');
  assert.ok(hosts.includes('127.0.0.1'), 'loopback');
  assert.ok(hosts.includes('192.168.1.42'), 'the LAN address');

  // Server authentication must be spelled out.
  assert.match(text, /X509v3 Extended Key Usage:\s*\n\s*TLS Web Server Authentication/);

  // SHA-256 or better, and a key iOS still accepts.
  assert.match(text, /Signature Algorithm: sha256WithRSAEncryption/);
  assert.match(text, /Public-Key: \((\d+) bit\)/);
  const bits = Number(text.match(/Public-Key: \((\d+) bit\)/)[1]);
  assert.ok(bits >= 2048, `key is only ${bits} bits`);

  // Apple rejects server certificates valid for more than 825 days.
  const notBefore = new Date(text.match(/Not Before: (.+)/)[1]);
  const notAfter = new Date(text.match(/Not After : (.+)/)[1]);
  const days = (notAfter - notBefore) / 86400000;
  assert.ok(days <= 825, `valid for ${Math.round(days)} days, limit is 825`);
  assert.ok(days > 90, 'but long enough to not be a chore');

  assert.ok(notAfter > new Date(), 'certificate should not already be expired');
});

test('the CA is a real CA and the leaf is not', options, () => {
  const p = certPaths(workspace);
  assert.match(dump(p.caCert), /CA:TRUE/);
  assert.match(dump(p.cert), /CA:FALSE/);
  assert.match(dump(p.caCert), /Certificate Sign/);
});

test('the private key never has a passphrase, or the server could not start', options, () => {
  const key = readFileSync(certPaths(workspace).key, 'utf8');
  assert.ok(key.includes('PRIVATE KEY'), 'looks like a key');
  assert.ok(!key.includes('ENCRYPTED'), 'must not be passphrase-protected');
});

test('running it again changes nothing', options, () => {
  const p = certPaths(workspace);
  const before = readFileSync(p.cert);
  const result = ensureCertificate(workspace, ['192.168.1.42']);
  assert.equal(result.created, false, 'CA should be reused');
  assert.equal(result.reissued, false, 'certificate already covers this host');
  assert.deepEqual(readFileSync(p.cert), before, 'certificate should be untouched');
});

test('a new network address reissues the leaf but keeps the CA', options, () => {
  const p = certPaths(workspace);
  const caBefore = readFileSync(p.caCert);
  const certBefore = readFileSync(p.cert);

  const result = ensureCertificate(workspace, ['192.168.1.42', '10.0.0.5']);

  assert.equal(result.created, false, 'the CA must survive — the iPad trusts it');
  assert.ok(result.reissued, 'the leaf should be reissued for the new address');
  assert.deepEqual(readFileSync(p.caCert), caBefore, 'CA file changed');
  assert.notDeepEqual(readFileSync(p.cert), certBefore, 'leaf should have changed');

  const hosts = certificateHosts(p.cert);
  assert.ok(hosts.includes('10.0.0.5'), 'new address');
  assert.ok(hosts.includes('192.168.1.42'), 'old address kept');
  assert.ok(hosts.includes('localhost'), 'localhost kept');
});

test('hasCertificates is false for a directory with nothing in it', () => {
  const empty = mkdtempSync(join(tmpdir(), 'space-flyer-empty-'));
  try {
    assert.equal(hasCertificates(empty), false);
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});
