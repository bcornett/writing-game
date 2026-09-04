/**
 * Tests for the QR encoder in tools/qr.mjs.
 *
 * The golden hashes below were produced by this encoder and then verified by
 * actually decoding the rendered images with Chromium's BarcodeDetector — all
 * eight cases round-tripped to the exact input string. They cover versions
 * 1-11, all four ECC levels, multi-byte UTF-8, and the version-information
 * blocks that only appear at version 7 and above.
 *
 * To re-verify by decoding rather than by hash: `npm start`, then in a browser
 * console on the served page, import /tools/qr.mjs, render with qrToRgba onto a
 * canvas, and run `new BarcodeDetector({formats:['qr_code']}).detect(bitmap)`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { encodeQr, qrToAnsi, qrToRgba, supportsTruecolor } from '../tools/qr.mjs';

const serialize = (qr) => qr.modules.map((row) => row.map((m) => (m ? '1' : '0')).join('')).join('\n');
const digest = (qr) => createHash('sha256').update(serialize(qr)).digest('hex').slice(0, 16);

const LONG_X = 'https://example.com/' + 'x'.repeat(120);
const LONG_Y = 'https://example.com/' + 'y'.repeat(300);
const UNICODE = "Caleb's Space Flyer — fly, hyperdrive, find all 10 planets! 🚀🪐";

/** Every one of these was confirmed to decode back to `text` by BarcodeDetector. */
const GOLDEN = [
  { text: 'http://192.168.1.100:8080', ecc: 'M', version: 2, mask: 3, sha: '63688bd8348b27f6' },
  { text: 'http://10.0.0.7:3000', ecc: 'L', version: 2, mask: 6, sha: 'e338b907884ef2f4' },
  { text: 'http://192.168.68.112:8080', ecc: 'Q', version: 3, mask: 0, sha: '1884c41a72537de6' },
  { text: 'http://192.168.1.100:8080', ecc: 'H', version: 4, mask: 2, sha: 'c76a99cd2612275d' },
  { text: 'A', ecc: 'H', version: 1, mask: 7, sha: '18002cc19680816f' },
  { text: LONG_X, ecc: 'M', version: 8, mask: 2, sha: '93faab4b12b256d2' },
  { text: LONG_Y, ecc: 'L', version: 11, mask: 1, sha: 'c46f9175b5e8e2f2' },
  { text: UNICODE, ecc: 'M', version: 5, mask: 7, sha: '4f447c100d725064' },
];

for (const g of GOLDEN) {
  const label = `${g.text.slice(0, 28)}${g.text.length > 28 ? '…' : ''} (${g.ecc})`;
  test(`encodes exactly as verified: ${label}`, () => {
    const qr = encodeQr(g.text, { ecc: g.ecc });
    assert.equal(qr.version, g.version, 'version');
    assert.equal(qr.mask, g.mask, 'mask');
    assert.equal(qr.size, g.version * 4 + 17, 'size');
    assert.equal(digest(qr), g.sha, 'module pattern changed');
  });
}

test('the matrix has the three finder patterns with separators', () => {
  const qr = encodeQr('http://192.168.1.100:8080');
  const m = qr.modules;
  const corners = [
    [0, 0],
    [0, qr.size - 7],
    [qr.size - 7, 0],
  ];
  for (const [row, col] of corners) {
    for (let dy = 0; dy < 7; dy++) {
      for (let dx = 0; dx < 7; dx++) {
        const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
        assert.equal(
          m[row + dy][col + dx],
          ring !== 2,
          `finder at ${row},${col} wrong at ${dy},${dx}`,
        );
      }
    }
  }
});

test('timing patterns alternate along row and column 6', () => {
  const qr = encodeQr('timing check please');
  for (let i = 8; i < qr.size - 8; i++) {
    assert.equal(qr.modules[6][i], i % 2 === 0, `row 6 at ${i}`);
    assert.equal(qr.modules[i][6], i % 2 === 0, `col 6 at ${i}`);
  }
});

test('the always-dark module is dark', () => {
  for (const ecc of ['L', 'M', 'Q', 'H']) {
    const qr = encodeQr('dark module', { ecc });
    assert.equal(qr.modules[qr.size - 8][8], true, `ecc ${ecc}`);
  }
});

test('version grows with data length and shrinks with weaker ECC', () => {
  const short = encodeQr('hi', { ecc: 'M' });
  const long = encodeQr('z'.repeat(200), { ecc: 'M' });
  assert.ok(long.version > short.version);

  const payload = 'w'.repeat(100);
  assert.ok(
    encodeQr(payload, { ecc: 'L' }).version <= encodeQr(payload, { ecc: 'H' }).version,
    'H should need at least as much room as L',
  );
});

test('minVersion and an explicit mask are honoured', () => {
  const qr = encodeQr('hi', { ecc: 'M', minVersion: 5, mask: 4 });
  assert.equal(qr.version, 5);
  assert.equal(qr.mask, 4);
  assert.equal(qr.size, 37);
});

test('every mask produces a well-formed matrix', () => {
  for (let mask = 0; mask < 8; mask++) {
    const qr = encodeQr('http://192.168.1.100:8080', { ecc: 'M', mask });
    assert.equal(qr.mask, mask);
    assert.equal(qr.modules[qr.size - 8][8], true, `mask ${mask} lost the dark module`);
    assert.equal(qr.modules[6][8], true, `mask ${mask} broke the timing row`);
  }
});

test('bad input is rejected clearly', () => {
  assert.throws(() => encodeQr('hi', { ecc: 'X' }), /unknown ECC level/);
  assert.throws(() => encodeQr('z'.repeat(5000), { ecc: 'H' }), /too long/);
});

test('the largest supported payload still encodes', () => {
  // Version 40-L holds 2,953 bytes; anything past that must throw.
  const qr = encodeQr('a'.repeat(2953), { ecc: 'L' });
  assert.equal(qr.version, 40);
  assert.equal(qr.size, 177);
  assert.throws(() => encodeQr('a'.repeat(2954), { ecc: 'L' }), /too long/);
});

test('ANSI output has a quiet zone and one line per two module rows', () => {
  const qr = encodeQr('http://192.168.1.100:8080');
  const lines = qrToAnsi(qr, { quiet: 4 }).split('\n');
  const n = qr.size + 8;
  assert.equal(lines.length, Math.ceil(n / 2));
  // The first row is entirely quiet zone, so it must contain no dark cells.
  assert.ok(!lines[0].includes('0;0;0'), 'quiet zone should be all light');
});

test('the ANSI half-blocks reproduce the module grid exactly', () => {
  // '▀' paints the top half in the foreground colour and the bottom half in
  // the background colour, so parsing the escape codes back out should give
  // the same matrix the PNG path renders.
  const qr = encodeQr('http://192.168.1.100:8080');
  const quiet = 4;
  const n = qr.size + quiet * 2;
  const lines = qrToAnsi(qr, { quiet }).split('\n');

  const grid = Array.from({ length: n }, () => new Array(n).fill(null));
  lines.forEach((line, row) => {
    const cells = [...line.matchAll(/\x1b\[38;2;(\d+);\d+;\d+m\x1b\[48;2;(\d+);\d+;\d+m▀/g)];
    assert.equal(cells.length, n, `row ${row} width`);
    cells.forEach((cell, col) => {
      grid[row * 2][col] = cell[1] === '0';
      if (row * 2 + 1 < n) grid[row * 2 + 1][col] = cell[2] === '0';
    });
  });

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const inside = x >= quiet && y >= quiet && x < quiet + qr.size && y < quiet + qr.size;
      const expected = inside ? qr.modules[y - quiet][x - quiet] : false;
      assert.equal(grid[y][x], expected, `module ${x},${y}`);
    }
  }
});

test('the low-colour ANSI fallback renders two cells per module', () => {
  const qr = encodeQr('A', { ecc: 'H' });
  const lines = qrToAnsi(qr, { quiet: 2, truecolor: false }).split('\n');
  assert.equal(lines.length, qr.size + 4);
  assert.ok(lines[0].includes('\x1b[47m'), 'expected white background cells');
});

test('supportsTruecolor reads COLORTERM', () => {
  assert.equal(supportsTruecolor({ COLORTERM: 'truecolor' }), true);
  assert.equal(supportsTruecolor({ COLORTERM: '24bit' }), true);
  assert.equal(supportsTruecolor({}), false);
  assert.equal(supportsTruecolor({ COLORTERM: 'ansi256' }), false);
});

test('qrToRgba produces an opaque square with a light border', () => {
  const qr = encodeQr('http://192.168.1.100:8080');
  const scale = 5;
  const quiet = 4;
  const { width, height, rgba } = qrToRgba(qr, { scale, quiet });

  assert.equal(width, (qr.size + quiet * 2) * scale);
  assert.equal(height, width);
  assert.equal(rgba.length, width * height * 4);

  // Top-left is quiet zone: white and opaque.
  assert.deepEqual([...rgba.slice(0, 4)], [255, 255, 255, 255]);

  // The centre of the top-left finder must be dark.
  const px = (quiet + 3) * scale + 2;
  const i = (px * width + px) * 4;
  assert.deepEqual([...rgba.slice(i, i + 4)], [0, 0, 0, 255]);

  for (let p = 3; p < rgba.length; p += 4) assert.equal(rgba[p], 255, 'alpha');
});
