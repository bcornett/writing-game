#!/usr/bin/env node
/**
 * Zero-dependency static server for the game.
 *
 * ES modules can't be loaded over file://, and the iPad needs to reach the
 * game over wifi anyway, so this serves the project folder on 0.0.0.0 and
 * prints the LAN address to type into Safari.
 *
 *   npm start            # port 8080
 *   PORT=3000 npm start
 */

import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { createReadStream, promises as fs, readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname, resolve, sep } from 'node:path';
import { encodeQr, qrToAnsi, supportsTruecolor } from './qr.mjs';
import { buildServiceWorker } from './sw.mjs';
import { ensureCertificate, hasCertificates, opensslAvailable } from './cert.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const START_PORT = Number(process.env.PORT) || 8080;
const MAX_PORT_TRIES = 12;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
};

/**
 * Resolve a URL path to a file inside ROOT.
 *
 * Guarantees the result is `root` itself or somewhere beneath it, or null.
 * Traversal attempts (`/../../etc/passwd`, percent-encoded or not) resolve to
 * a harmless path inside root that simply won't exist, and 404.
 */
export function safeResolve(root, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  } catch {
    return null; // malformed percent-encoding
  }
  if (decoded.includes('\0')) return null;
  // Treat the request path as absolute before normalising, so leading `..`
  // segments collapse away instead of climbing out of root.
  const clean = normalize('/' + decoded).replace(/^[/\\]+/, '');
  const full = join(root, clean);
  if (full !== root && !full.startsWith(root + sep)) return null;
  return full;
}

async function statOrNull(path) {
  try {
    return await fs.stat(path);
  } catch {
    return null;
  }
}

/** Set once the TLS certificate is loaded, so /ca.crt and /trust can be served. */
let certificate = null;

/**
 * A page the iPad can open to install the certificate authority. Much kinder
 * than reading steps off a terminal on the other side of the room.
 */
function trustPage(origin) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Trust this Mac</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; padding:max(24px,env(safe-area-inset-top)) 22px 40px; background:#05061a; color:#eef3ff;
    font: 16px/1.5 -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }
  .wrap { max-width: 520px; margin: 0 auto; }
  h1 { font-size: 30px; line-height:1.1; margin:0 0 6px; }
  .sub { color:#9fb0d8; margin:0 0 26px; }
  a.btn { display:block; text-align:center; padding:18px; border-radius:20px; text-decoration:none;
    font-size:20px; font-weight:800; color:#21103a; margin-bottom:26px;
    background:linear-gradient(180deg,#9df1ff,#4dd8ff 45%,#6f8dff); }
  ol { padding-left: 22px; margin:0 0 26px; }
  li { margin-bottom: 14px; }
  code { background:rgba(255,255,255,.09); padding:2px 7px; border-radius:6px; font-size:.92em; }
  .done { display:block; text-align:center; padding:16px; border-radius:18px; text-decoration:none;
    font-weight:700; color:#cbe8ff; background:rgba(120,190,255,.14); border:1px solid rgba(120,190,255,.3); }
  .note { color:#9fb0d8; font-size:14px; margin-top:26px; }
</style></head><body><div class="wrap">
<h1>Trust this Mac</h1>
<p class="sub">One time only. This lets the game save itself so it plays without wifi.</p>
<a class="btn" href="/ca.crt">1. Download the certificate</a>
<ol>
  <li>Tap <b>Allow</b> when Safari asks.</li>
  <li>Open <b>Settings</b>. Near the top you'll see <b>Profile Downloaded</b> — tap it, then <b>Install</b> (top right). Enter your passcode and tap <b>Install</b> again.</li>
  <li>Still in Settings, go to <b>General &rsaquo; About &rsaquo; Certificate Trust Settings</b>.</li>
  <li>Turn <b>on</b> the switch next to <code>Dot's Writing Quest Local CA</code>, and confirm.</li>
</ol>
<a class="done" href="${origin}/">2. Now open the game &rsaquo;</a>
<p class="note">This certificate only works for this Mac on your home network. Nothing else on the internet trusts it, and you can remove it any time under Settings &rsaquo; General &rsaquo; VPN &amp; Device Management.</p>
</div></body></html>`;
}

const handler = async (req, res) => {
  const urlPath = (req.url ?? '/').split('?')[0];

  if (certificate && urlPath === '/ca.crt') {
    const body = readFileSync(certificate.caCertPath);
    res.writeHead(200, {
      // This content type is what makes iOS offer to install it as a profile.
      'content-type': 'application/x-x509-ca-cert',
      'content-length': body.length,
      'content-disposition': 'attachment; filename="writing-quest-ca.crt"',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
    return;
  }

  if (certificate && urlPath === '/trust') {
    const origin = `https://${req.headers.host ?? 'localhost'}`;
    const body = trustPage(origin);
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'content-length': Buffer.byteLength(body),
      'cache-control': 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
    return;
  }

  // Generate the service worker on every request rather than serving the
  // committed file. Its version is a hash of the game's contents, so editing
  // anything during development immediately invalidates the offline cache and
  // the next reload picks the change up.
  if (urlPath === '/sw.js') {
    const source = await buildServiceWorker(ROOT);
    res.writeHead(200, {
      'content-type': 'text/javascript; charset=utf-8',
      'content-length': Buffer.byteLength(source),
      'cache-control': 'no-cache, no-store, must-revalidate',
      'service-worker-allowed': '/',
    });
    res.end(req.method === 'HEAD' ? undefined : source);
    return;
  }

  const target = safeResolve(ROOT, req.url === '/' ? '/index.html' : req.url);
  if (!target) {
    res.writeHead(403, { 'content-type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  let stat = await statOrNull(target);
  let path = target;
  if (stat?.isDirectory()) {
    path = join(target, 'index.html');
    stat = await statOrNull(path);
  }

  if (!stat?.isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found: ' + req.url);
    return;
  }

  res.writeHead(200, {
    'content-type': MIME[extname(path).toLowerCase()] ?? 'application/octet-stream',
    'content-length': stat.size,
    // Always re-fetch: this is a dev server and edits should show up on the
    // iPad the moment you pull to refresh.
    'cache-control': 'no-cache, no-store, must-revalidate',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(path).pipe(res);
};

let server = createHttpServer(handler);

/**
 * Wifi addresses this machine can be reached on, best candidate first.
 * On a Mac the iPad is almost always on en0 (wifi), so prefer the low-numbered
 * `en` interfaces over VPN tunnels and virtual bridges.
 */
export function lanAddresses(interfaces = networkInterfaces()) {
  const out = [];
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const a of addrs ?? []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      // Skip link-local and the usual virtual-machine / container ranges.
      if (a.address.startsWith('169.254.')) continue;
      out.push({ name, address: a.address });
    }
  }
  const rank = (name) => {
    if (/^en\d/.test(name)) return 0;
    if (/^(wl|wlan)/.test(name)) return 0;
    if (/^(bridge|utun|tun|tap|vmnet|docker|ppp|awdl|llw)/.test(name)) return 2;
    return 1;
  };
  return out.sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
}

function listen(port, triesLeft) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && triesLeft > 0) {
      console.log(`port ${port} busy, trying ${port + 1}…`);
      listen(port + 1, triesLeft - 1);
      return;
    }
    console.error(err.message);
    process.exit(1);
  });

  server.listen(port, '0.0.0.0', () => {
    const addrs = lanAddresses();
    const scheme = certificate ? 'https' : 'http';
    const indent = (text, pad = '  ') =>
      text
        .split('\n')
        .map((l) => pad + l)
        .join('\n');

    console.log('');
    console.log("  ✏️  Dot's Writing Quest is running");
    console.log('');
    console.log(`  On this Mac:   ${scheme}://localhost:${port}`);

    if (!addrs.length) {
      console.log('');
      console.log('  No wifi address found — join a network to play on the iPad.');
    } else {
      const host = addrs[0].address;
      const gameUrl = `${scheme}://${host}:${port}`;
      // First run over https should go to the trust page, not the game.
      const url = certificate ? `${gameUrl}/trust` : gameUrl;

      console.log(`  On the iPad:   ${gameUrl}`);
      for (const a of addrs.slice(1)) {
        console.log(`      or         ${scheme}://${a.address}:${port}   (${a.name})`);
      }
      console.log('');
      console.log(
        certificate
          ? '  Point the iPad camera at this. It opens the one-time setup,'
          : '  Point the iPad camera at this, then tap the link:',
      );
      if (certificate) console.log('  then the game:');
      console.log('');
      console.log(
        indent(qrToAnsi(encodeQr(url, { ecc: 'M' }), { truecolor: supportsTruecolor() })),
      );
      console.log('');
      console.log('  In Safari: Share → Add to Home Screen for a full-screen icon.');
    }

    console.log('');
    if (certificate) {
      console.log('  🔒 Serving https, so the game can save itself for offline play.');
      if (certificate.reissued && !certificate.created) {
        console.log('     (Reissued for a new network address. No need to re-trust anything.)');
      }
    } else {
      console.log('  Offline play is OFF: browsers only allow it on https or localhost,');
      console.log('  so a plain http LAN address cannot save itself. To turn it on:');
      console.log('');
      console.log('      npm run cert   (once), then npm start');
      console.log('');
      console.log('  Everything else works fine over http.');
    }
    console.log('');
    console.log('  Ctrl-C to stop.');
    console.log('');
  });
}

/** Load TLS if a certificate has been set up, and swap in an https server. */
function configureTls() {
  const wantsHttp = process.argv.includes('--http') || process.env.HTTP === '1';
  if (wantsHttp || !hasCertificates(ROOT) || !opensslAvailable()) return;
  try {
    certificate = ensureCertificate(
      ROOT,
      lanAddresses().map((a) => a.address),
    );
    server = createHttpsServer({ key: certificate.key, cert: certificate.cert }, handler);
  } catch (error) {
    certificate = null;
    console.error(`  Could not load the certificate (${error.message}); falling back to http.`);
  }
}

// Only start listening when run directly, so tests can import the helpers.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  configureTls();
  listen(START_PORT, MAX_PORT_TRIES);
}

export { server, ROOT };
