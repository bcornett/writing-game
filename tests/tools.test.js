/**
 * Tests for the two build-time tools: the PNG encoder and the dev server's
 * path resolution. Both are small, both would be very annoying to get wrong.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { encodePng, crc32 } from '../tools/png.mjs';
import { safeResolve, lanAddresses } from '../tools/serve.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readChunks(png) {
  const chunks = [];
  let offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    const crc = png.readUInt32BE(offset + 8 + length);
    chunks.push({ type, data, crc });
    offset += 12 + length;
  }
  return chunks;
}

test('crc32 matches the known value from the PNG spec test vector', () => {
  // CRC-32 of "IEND" with no data, as it appears in every PNG ever written.
  assert.equal(crc32(Buffer.from('IEND', 'ascii')), 0xae426082);
});

test('encodePng produces a structurally valid PNG', () => {
  const w = 4;
  const h = 3;
  const rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = i * 10;
    rgba[i * 4 + 1] = 255 - i * 10;
    rgba[i * 4 + 2] = 128;
    rgba[i * 4 + 3] = 255;
  }

  const png = encodePng(w, h, rgba);
  assert.ok(png.subarray(0, 8).equals(PNG_SIGNATURE), 'signature');

  const chunks = readChunks(png);
  assert.deepEqual(
    chunks.map((c) => c.type),
    ['IHDR', 'IDAT', 'IEND'],
  );

  const ihdr = chunks[0].data;
  assert.equal(ihdr.readUInt32BE(0), w);
  assert.equal(ihdr.readUInt32BE(4), h);
  assert.equal(ihdr[8], 8, 'bit depth');
  assert.equal(ihdr[9], 6, 'RGBA colour type');

  for (const c of chunks) {
    assert.equal(
      crc32(Buffer.concat([Buffer.from(c.type, 'ascii'), c.data])),
      c.crc,
      `${c.type} checksum`,
    );
  }
});

test('the encoded pixels survive a round trip', () => {
  const w = 5;
  const h = 4;
  const rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < rgba.length; i++) rgba[i] = (i * 37) % 256;

  const chunks = readChunks(encodePng(w, h, rgba));
  const raw = inflateSync(chunks.find((c) => c.type === 'IDAT').data);

  assert.equal(raw.length, h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    const rowStart = y * (w * 4 + 1);
    assert.equal(raw[rowStart], 0, 'filter byte should be None');
    for (let x = 0; x < w * 4; x++) {
      assert.equal(raw[rowStart + 1 + x], rgba[y * w * 4 + x], `pixel byte ${y},${x}`);
    }
  }
});

test('encodePng rejects a buffer of the wrong size', () => {
  assert.throws(() => encodePng(2, 2, new Uint8Array(3)), /expected 16 bytes/);
});

test('the dev server never resolves a path outside the project', () => {
  const attacks = [
    '/../../etc/passwd',
    '/%2e%2e/%2e%2e/etc/passwd',
    '/..%2f..%2fetc/passwd',
    '/./../../../../../../etc/passwd',
    '/src/../../etc/passwd',
    '//etc/passwd',
    '/....//....//etc/passwd',
  ];
  for (const attack of attacks) {
    const resolved = safeResolve(ROOT, attack);
    if (resolved === null) continue;
    // Containment is the whole security property: anything under ROOT that
    // doesn't exist simply 404s.
    assert.ok(
      resolved === ROOT || resolved.startsWith(ROOT + '/'),
      `${attack} escaped to ${resolved}`,
    );
    assert.notEqual(resolved, '/etc/passwd');
    assert.equal(existsSync(resolved) && !resolved.startsWith(ROOT), false);
  }
});

test('the dev server rejects malformed and null-byte paths', () => {
  assert.equal(safeResolve(ROOT, '/%E0%A4%A'), null, 'bad percent-encoding');
  assert.equal(safeResolve(ROOT, '/index.html%00.png'), null, 'null byte');
});

test('the dev server resolves real project files and ignores the query string', () => {
  assert.equal(safeResolve(ROOT, '/index.html'), join(ROOT, 'index.html'));
  assert.equal(safeResolve(ROOT, '/src/main.js?v=2'), join(ROOT, 'src', 'main.js'));
  assert.equal(safeResolve(ROOT, '/style.css#top'), join(ROOT, 'style.css'));
});

test('lanAddresses puts the wifi interface first and drops the noise', () => {
  const fake = {
    utun3: [{ family: 'IPv4', internal: false, address: '10.8.0.2' }],
    lo0: [{ family: 'IPv4', internal: true, address: '127.0.0.1' }],
    en0: [
      { family: 'IPv6', internal: false, address: 'fe80::1' },
      { family: 'IPv4', internal: false, address: '192.168.1.42' },
    ],
    awdl0: [{ family: 'IPv4', internal: false, address: '169.254.9.9' }],
    bridge100: [{ family: 'IPv4', internal: false, address: '192.168.64.1' }],
  };
  const result = lanAddresses(fake);
  assert.equal(result[0].address, '192.168.1.42', 'en0 should win');
  const addresses = result.map((r) => r.address);
  assert.ok(!addresses.includes('127.0.0.1'), 'loopback');
  assert.ok(!addresses.includes('169.254.9.9'), 'link-local');
  assert.ok(!addresses.includes('fe80::1'), 'IPv6');
  // Tunnels and virtual bridges are both deprioritised; their order relative
  // to each other doesn't matter, only that real wifi beats both.
  assert.ok(addresses.indexOf('10.8.0.2') > 0, 'utun should rank below en0');
  assert.ok(addresses.indexOf('192.168.64.1') > 0, 'bridge should rank below en0');
});

test('lanAddresses copes with a machine that has no network', () => {
  assert.deepEqual(lanAddresses({}), []);
  assert.deepEqual(lanAddresses({ lo0: [{ family: 'IPv4', internal: true, address: '127.0.0.1' }] }), []);
});

test('the files index.html asks for actually exist', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((r) => !r.startsWith('http') && !r.startsWith('data:'));

  assert.ok(refs.length > 0, 'expected some local references');
  for (const ref of refs) {
    assert.ok(existsSync(join(ROOT, ref)), `index.html references missing file: ${ref}`);
  }
});

test('every module import resolves to a real file', () => {
  const files = [
    'src/main.js',
    'src/core/path.js',
    'src/core/geometry.js',
    'src/core/glyphs.js',
    'src/core/tracer.js',
    'src/core/grader.js',
    'src/core/progress.js',
    'src/core/curriculum.js',
    'src/core/phrases.js',
    'src/core/rng.js',
    'src/core/qr.js',
    'src/render/glyphSvg.js',
    'src/render/dot.js',
    'src/audio/voice.js',
    'src/audio/sfx.js',
    'src/input/pointer.js',
    'src/ui/save.js',
    'src/ui/updates.js',
    'src/ui/confetti.js',
    'src/ui/dom.js',
    'src/ui/demo.js',
    'src/ui/screens/home.js',
    'src/ui/screens/trace.js',
    'src/ui/screens/write.js',
    'src/ui/screens/spot.js',
    'src/ui/screens/twins.js',
    'src/ui/screens/pop.js',
    'src/ui/screens/quest.js',
    'src/ui/screens/stickers.js',
    'src/ui/screens/parent.js',
  ];

  assert.ok(
    !readFileSync(join(ROOT, 'src/main.js'), 'utf8').includes('window.__'),
    'main.js still has a debug hook on window',
  );

  for (const file of files) {
    const full = join(ROOT, file);
    assert.ok(existsSync(full), `missing module: ${file}`);
    const source = readFileSync(full, 'utf8');
    for (const m of source.matchAll(/from\s+'([^']+)'/g)) {
      const spec = m[1];
      if (!spec.startsWith('.')) continue;
      const target = join(dirname(full), spec);
      assert.ok(existsSync(target), `${file} imports missing file: ${spec}`);
    }
  }
});

test('no shipped module leaves a stub behind', () => {
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
  for (const file of walk(join(ROOT, 'src'))) {
    const source = readFileSync(file, 'utf8');
    assert.ok(!/\b(TODO|FIXME|XXX)\b/.test(source), `${file} has a stub marker`);
  }
});
