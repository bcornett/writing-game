/**
 * A QR Code encoder, in plain JavaScript with no dependencies.
 *
 * `npm start` prints one of these in the terminal so the iPad's camera can
 * open the game without anyone typing an IP address. The project has no build
 * step and no node_modules on purpose, so the encoder lives here.
 *
 * Byte mode only (a URL is bytes), all 40 versions, all four ECC levels.
 * Structure follows ISO/IEC 18004; the layout and table-derivation approach
 * matches Nayuki's reference implementation, which is the clearest public
 * description of the placement rules.
 */

// --- Galois field GF(256), primitive polynomial 0x11D ------------------------

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}

const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** Generator polynomial for `degree` error-correction codewords. */
function rsGenerator(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], 1);
      next[j + 1] ^= gfMul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

/** Reed-Solomon remainder for one block. */
function rsRemainder(data, degree) {
  const gen = rsGenerator(degree);
  const buf = new Uint8Array(data.length + degree);
  buf.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = buf[i];
    if (coef === 0) continue;
    for (let j = 0; j < gen.length; j++) buf[i + j] ^= gfMul(gen[j], coef);
  }
  return buf.slice(data.length);
}

// --- Version / ECC tables ----------------------------------------------------

// Index by version 1..40; index 0 is a placeholder.
const ECC_CODEWORDS_PER_BLOCK = {
  L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
};

const NUM_ECC_BLOCKS = {
  L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};

const ECC_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

/** Total data+ECC modules available for codewords at a given version. */
function rawDataModules(version) {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

function dataCodewords(version, ecc) {
  return (
    Math.floor(rawDataModules(version) / 8) -
    ECC_CODEWORDS_PER_BLOCK[ecc][version] * NUM_ECC_BLOCKS[ecc][version]
  );
}

/** Byte mode uses an 8-bit character count below version 10, 16 bits above. */
const charCountBits = (version) => (version <= 9 ? 8 : 16);

// --- Bit assembly ------------------------------------------------------------

function buildCodewords(bytes, version, ecc) {
  const bits = [];
  const push = (value, length) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };

  push(0b0100, 4); // byte mode
  push(bytes.length, charCountBits(version));
  for (const b of bytes) push(b, 8);

  const capacity = dataCodewords(version, ecc) * 8;
  if (bits.length > capacity) throw new Error('data does not fit the chosen version');

  push(0, Math.min(4, capacity - bits.length)); // terminator
  while (bits.length % 8 !== 0) bits.push(0);

  const out = new Uint8Array(capacity / 8);
  for (let i = 0; i < bits.length; i++) out[i >>> 3] |= bits[i] << (7 - (i & 7));
  // Alternating pad bytes fill whatever is left.
  for (let i = bits.length / 8, pad = 0xec; i < out.length; i++, pad ^= 0xec ^ 0x11) {
    out[i] = pad;
  }
  return out;
}

/** Split into blocks, append ECC, and interleave as the spec requires. */
function interleave(data, version, ecc) {
  const numBlocks = NUM_ECC_BLOCKS[ecc][version];
  const eccLen = ECC_CODEWORDS_PER_BLOCK[ecc][version];
  const rawCodewords = Math.floor(rawDataModules(version) / 8);
  const numShort = numBlocks - (rawCodewords % numBlocks);
  const shortDataLen = Math.floor(rawCodewords / numBlocks) - eccLen;

  const blocks = [];
  for (let i = 0, offset = 0; i < numBlocks; i++) {
    const len = shortDataLen + (i < numShort ? 0 : 1);
    const chunk = data.slice(offset, offset + len);
    offset += len;
    blocks.push({ data: chunk, ecc: rsRemainder(chunk, eccLen) });
  }

  const result = new Uint8Array(rawCodewords);
  let k = 0;
  for (let i = 0; i < shortDataLen + 1; i++) {
    for (let b = 0; b < numBlocks; b++) {
      // The short blocks have no final data codeword to contribute.
      if (i < blocks[b].data.length) result[k++] = blocks[b].data[i];
    }
  }
  for (let i = 0; i < eccLen; i++) {
    for (let b = 0; b < numBlocks; b++) result[k++] = blocks[b].ecc[i];
  }
  return result;
}

// --- Matrix ------------------------------------------------------------------

function alignmentPositions(version) {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const step =
    version === 32 ? 26 : Math.ceil((version * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const size = version * 4 + 17;
  const result = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function buildMatrix(codewords, version, ecc, forcedMask) {
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const isFunction = Array.from({ length: size }, () => new Array(size).fill(false));

  const setFn = (x, y, dark) => {
    modules[y][x] = dark;
    isFunction[y][x] = true;
  };

  // Timing patterns.
  for (let i = 0; i < size; i++) {
    setFn(6, i, i % 2 === 0);
    setFn(i, 6, i % 2 === 0);
  }

  // Finder patterns, including their separators.
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || x >= size || y < 0 || y >= size) continue;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        setFn(x, y, dist !== 2 && dist !== 4);
      }
    }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);

  // Alignment patterns, skipping the three that would sit on a finder.
  const align = alignmentPositions(version);
  for (let i = 0; i < align.length; i++) {
    for (let j = 0; j < align.length; j++) {
      const corner =
        (i === 0 && j === 0) ||
        (i === 0 && j === align.length - 1) ||
        (i === align.length - 1 && j === 0);
      if (corner) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          setFn(align[i] + dx, align[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }

  // Version information (version 7 and up).
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) !== 0;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFn(a, b, dark);
      setFn(b, a, dark);
    }
  }

  // Reserve the format-information modules; the real bits go in below.
  const drawFormat = (mask) => {
    const data = (ECC_FORMAT_BITS[ecc] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const bit = (i) => ((bits >>> i) & 1) !== 0;

    for (let i = 0; i <= 5; i++) setFn(8, i, bit(i));
    setFn(8, 7, bit(6));
    setFn(8, 8, bit(7));
    setFn(7, 8, bit(8));
    for (let i = 9; i < 15; i++) setFn(14 - i, 8, bit(i));

    for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, bit(i));
    setFn(8, size - 8, true); // the always-dark module
  };
  drawFormat(0);

  // Codewords, zigzagging up and down pairs of columns from the right.
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // skip the vertical timing column
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (isFunction[y][x] || i >= codewords.length * 8) continue;
        modules[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
        i++;
      }
    }
  }

  const applyMask = (mask) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!isFunction[y][x] && MASKS[mask](x, y)) modules[y][x] = !modules[y][x];
      }
    }
  };

  let best = forcedMask ?? 0;
  if (forcedMask == null) {
    let bestPenalty = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      applyMask(mask);
      drawFormat(mask);
      const penalty = penaltyScore(modules, size);
      applyMask(mask); // undo (masking is its own inverse)
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        best = mask;
      }
    }
  }
  applyMask(best);
  drawFormat(best);

  return { modules, size, mask: best };
}

/** The four penalty rules from the spec, used to pick the least-ugly mask. */
function penaltyScore(modules, size) {
  let result = 0;

  const runScore = (run) => (run >= 5 ? 3 + (run - 5) : 0);

  for (let y = 0; y < size; y++) {
    let run = 0;
    let colour = false;
    for (let x = 0; x < size; x++) {
      if (modules[y][x] === colour) run++;
      else {
        result += runScore(run);
        colour = modules[y][x];
        run = 1;
      }
    }
    result += runScore(run);
  }
  for (let x = 0; x < size; x++) {
    let run = 0;
    let colour = false;
    for (let y = 0; y < size; y++) {
      if (modules[y][x] === colour) run++;
      else {
        result += runScore(run);
        colour = modules[y][x];
        run = 1;
      }
    }
    result += runScore(run);
  }

  // Rule 2: 2x2 blocks of one colour.
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = modules[y][x];
      if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) {
        result += 3;
      }
    }
  }

  // Rule 3: finder-like 1:1:3:1:1 patterns with four light modules beside them.
  const FINDER = [true, false, true, true, true, false, true];
  const matches = (get, start, n) => {
    for (let i = 0; i < 7; i++) if (get(start + i) !== FINDER[i]) return false;
    const before = () => {
      for (let i = 1; i <= 4; i++) {
        const p = start - i;
        if (p >= 0 && get(p)) return false;
      }
      return true;
    };
    const after = () => {
      for (let i = 0; i < 4; i++) {
        const p = start + 7 + i;
        if (p < n && get(p)) return false;
      }
      return true;
    };
    return before() || after();
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x + 7 <= size; x++) {
      if (matches((i) => modules[y][i], x, size)) result += 40;
    }
  }
  for (let x = 0; x < size; x++) {
    for (let y = 0; y + 7 <= size; y++) {
      if (matches((i) => modules[i][x], y, size)) result += 40;
    }
  }

  // Rule 4: overall balance of dark and light.
  let dark = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (modules[y][x]) dark++;
  const total = size * size;
  const k = Math.floor((Math.abs(dark * 20 - total * 10) * 10) / total);
  result += k * 10;

  return result;
}

// --- Public API --------------------------------------------------------------

/**
 * Encode text as a QR Code.
 *
 * @param {string} text
 * @param {{ecc?: 'L'|'M'|'Q'|'H', minVersion?: number, mask?: number}} [options]
 * @returns {{size: number, modules: boolean[][], version: number, ecc: string, mask: number}}
 */
export function encodeQr(text, options = {}) {
  const ecc = options.ecc ?? 'M';
  if (!ECC_CODEWORDS_PER_BLOCK[ecc]) throw new Error(`unknown ECC level: ${ecc}`);

  const bytes = new TextEncoder().encode(text);
  let version = -1;
  for (let v = options.minVersion ?? 1; v <= 40; v++) {
    const capacity = dataCodewords(v, ecc) * 8;
    if (4 + charCountBits(v) + bytes.length * 8 <= capacity) {
      version = v;
      break;
    }
  }
  if (version < 0) throw new Error('text is too long for a QR Code');

  const codewords = interleave(buildCodewords(bytes, version, ecc), version, ecc);
  const { modules, size, mask } = buildMatrix(codewords, version, ecc, options.mask);
  return { size, modules, version, ecc, mask };
}

/**
 * Render a QR Code as terminal text.
 *
 * Uses half-block characters so each module stays roughly square, with a
 * 4-module quiet zone. Truecolor when the terminal advertises it, otherwise
 * the basic black/white background codes.
 */
export function qrToAnsi(qr, { quiet = 4, truecolor = true } = {}) {
  const n = qr.size + quiet * 2;
  const at = (x, y) => {
    const mx = x - quiet;
    const my = y - quiet;
    if (mx < 0 || my < 0 || mx >= qr.size || my >= qr.size) return false;
    return qr.modules[my][mx];
  };

  const lines = [];
  if (truecolor) {
    const WHITE = '255;255;255';
    const BLACK = '0;0;0';
    for (let y = 0; y < n; y += 2) {
      let line = '';
      for (let x = 0; x < n; x++) {
        const top = at(x, y);
        const bottom = y + 1 < n ? at(x, y + 1) : false;
        // '▀' paints the upper half in the foreground colour.
        line += `\x1b[38;2;${top ? BLACK : WHITE}m\x1b[48;2;${bottom ? BLACK : WHITE}m▀`;
      }
      lines.push(line + '\x1b[0m');
    }
  } else {
    for (let y = 0; y < n; y++) {
      let line = '';
      for (let x = 0; x < n; x++) line += at(x, y) ? '\x1b[40m  ' : '\x1b[47m  ';
      lines.push(line + '\x1b[0m');
    }
  }
  return lines.join('\n');
}

/** True when the terminal claims 24-bit colour. */
export const supportsTruecolor = (env = process.env) =>
  env.COLORTERM === 'truecolor' || env.COLORTERM === '24bit';

/**
 * Render a QR Code as RGBA pixels, ready for tools/png.mjs.
 * @returns {{width: number, height: number, rgba: Uint8Array}}
 */
export function qrToRgba(qr, { scale = 8, quiet = 4 } = {}) {
  const n = qr.size + quiet * 2;
  const width = n * scale;
  const rgba = new Uint8Array(width * width * 4);
  for (let y = 0; y < width; y++) {
    for (let x = 0; x < width; x++) {
      const mx = Math.floor(x / scale) - quiet;
      const my = Math.floor(y / scale) - quiet;
      const dark =
        mx >= 0 && my >= 0 && mx < qr.size && my < qr.size && qr.modules[my][mx];
      const i = (y * width + x) * 4;
      const v = dark ? 0 : 255;
      rgba[i] = v;
      rgba[i + 1] = v;
      rgba[i + 2] = v;
      rgba[i + 3] = 255;
    }
  }
  return { width, height: width, rgba };
}
