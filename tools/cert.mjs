/**
 * A local certificate authority, so the game can be served over https on the
 * home network.
 *
 * Browsers only enable service workers and the Cache API in a "secure
 * context": https, localhost, or file. A LAN address over plain http is not
 * one, however private the network is — there is no flag, header, or opt-in
 * that changes it. So offline play on the iPad means real https.
 *
 * Self-signed alone is not enough either: WebKit refuses to register a service
 * worker on an origin with a certificate error, even after you tap through the
 * warning. The certificate has to actually be trusted. Hence a small CA you
 * install once on the iPad, which then signs the server certificate.
 *
 * The CA is generated once and kept. Only the server certificate is reissued
 * when the Mac's LAN address changes, so the iPad never has to trust anything
 * a second time.
 *
 * Requires `openssl`, which ships with macOS.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export const CERT_DIR = 'certs';
const CA_KEY = 'ca.key';
const CA_CERT = 'ca.crt';
const SERVER_KEY = 'server.key';
const SERVER_CERT = 'server.crt';

/**
 * Apple requires server certificates issued after September 2020 to last 825
 * days or fewer, carry an ExtendedKeyUsage of serverAuth, and identify hosts
 * via subjectAltName rather than the common name. All three are honoured here.
 */
const SERVER_DAYS = 397;
const CA_DAYS = 3650;

const openssl = (args, options = {}) =>
  execFileSync('openssl', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options });

/** Is openssl usable on this machine? */
export function opensslAvailable() {
  try {
    openssl(['version']);
    return true;
  } catch {
    return false;
  }
}

const paths = (root) => ({
  dir: join(root, CERT_DIR),
  caKey: join(root, CERT_DIR, CA_KEY),
  caCert: join(root, CERT_DIR, CA_CERT),
  key: join(root, CERT_DIR, SERVER_KEY),
  cert: join(root, CERT_DIR, SERVER_CERT),
});

/** Build the subjectAltName line for a set of hostnames and IP addresses. */
export function sanLine(hosts) {
  const isIp = (h) => /^\d{1,3}(\.\d{1,3}){3}$/.test(h);
  const entries = [...new Set(hosts)].map((h) => (isIp(h) ? `IP:${h}` : `DNS:${h}`));
  return `subjectAltName=${entries.join(',')}`;
}

/** The hosts a certificate currently covers, parsed back out of the file. */
export function certificateHosts(certPath) {
  if (!existsSync(certPath)) return [];
  try {
    const text = openssl(['x509', '-noout', '-ext', 'subjectAltName', '-in', certPath]);
    return [...text.matchAll(/(?:DNS|IP Address):([^,\s]+)/g)].map((m) => m[1]);
  } catch {
    return [];
  }
}

function createCa(p) {
  openssl([
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-sha256',
    '-days',
    String(CA_DAYS),
    '-nodes',
    '-keyout',
    p.caKey,
    '-out',
    p.caCert,
    '-subj',
    "/CN=Dot's Writing Quest Local CA/O=Writing Quest",
    '-addext',
    'basicConstraints=critical,CA:TRUE,pathlen:0',
    '-addext',
    'keyUsage=critical,keyCertSign,cRLSign',
  ]);
}

function createServerCert(p, hosts) {
  const scratch = join(tmpdir(), `writing-quest-cert-${process.pid}`);
  mkdirSync(scratch, { recursive: true });
  const csr = join(scratch, 'server.csr');
  const ext = join(scratch, 'server.ext');

  writeFileSync(
    ext,
    [
      'basicConstraints=CA:FALSE',
      'keyUsage=critical,digitalSignature,keyEncipherment',
      'extendedKeyUsage=serverAuth',
      sanLine(hosts),
      '',
    ].join('\n'),
  );

  try {
    openssl([
      'req',
      '-newkey',
      'rsa:2048',
      '-sha256',
      '-nodes',
      '-keyout',
      p.key,
      '-out',
      csr,
      '-subj',
      "/CN=Dot's Writing Quest",
    ]);
    openssl([
      'x509',
      '-req',
      '-in',
      csr,
      '-CA',
      p.caCert,
      '-CAkey',
      p.caKey,
      '-CAcreateserial',
      '-out',
      p.cert,
      '-days',
      String(SERVER_DAYS),
      '-sha256',
      '-extfile',
      ext,
    ]);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/**
 * Make sure a certificate exists covering `hosts`, creating or reissuing as
 * needed. Reissuing keeps the existing CA, so the iPad's one-time trust holds
 * even when the Mac's DHCP address changes.
 *
 * @param {string} root project directory
 * @param {string[]} hosts hostnames and IPv4 addresses to cover
 * @returns {{key: Buffer, cert: Buffer, caCertPath: string,
 *            created: boolean, reissued: boolean, hosts: string[]}}
 */
export function ensureCertificate(root, hosts) {
  const p = paths(root);
  mkdirSync(p.dir, { recursive: true });

  const wanted = [...new Set(['localhost', '127.0.0.1', ...hosts])];

  let created = false;
  if (!existsSync(p.caKey) || !existsSync(p.caCert)) {
    createCa(p);
    created = true;
  }

  const covered = certificateHosts(p.cert);
  const missing = wanted.filter((h) => !covered.includes(h));
  const reissued = !existsSync(p.key) || !existsSync(p.cert) || missing.length > 0;
  if (reissued) createServerCert(p, wanted);

  return {
    key: readFileSync(p.key),
    cert: readFileSync(p.cert),
    caCertPath: p.caCert,
    created,
    reissued,
    hosts: wanted,
  };
}

/** True when a CA has already been generated for this project. */
export const hasCertificates = (root) => {
  const p = paths(root);
  return existsSync(p.caCert) && existsSync(p.key) && existsSync(p.cert);
};

export { paths as certPaths };
