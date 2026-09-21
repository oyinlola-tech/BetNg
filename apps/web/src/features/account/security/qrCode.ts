/* A byte-mode QR encoder (ISO/IEC 18004), error correction level M, versions 1–15. Kept local so no secret ever leaves the page. */

const MAX_VERSION = 15;
const ECC_PER_BLOCK_M = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24];
const BLOCKS_M = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10];
const FORMAT_BITS_M = 0;

export interface QrMatrix {
  readonly size: number;
  readonly version: number;
  readonly mask: number;
  /** Row-major; true is a dark module. */
  readonly modules: readonly (readonly boolean[])[];
}

function bit(value: number, index: number): boolean {
  return ((value >>> index) & 1) !== 0;
}

function rawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;

  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;

    result -= (25 * align - 10) * align - 55;
    if (version >= 7) result -= 36;
  }

  return result;
}

function dataCodewords(version: number): number {
  return Math.floor(rawDataModules(version) / 8) - (ECC_PER_BLOCK_M[version] ?? 0) * (BLOCKS_M[version] ?? 0);
}

function gfMultiply(x: number, y: number): number {
  let z = 0;

  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }

  return z & 0xff;
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  let root = 1;

  result[degree - 1] = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(result[j] ?? 0, root);
      if (j + 1 < degree) result[j] = (result[j] ?? 0) ^ (result[j + 1] ?? 0);
    }
    root = gfMultiply(root, 0x02);
  }

  return result;
}

function rsRemainder(data: readonly number[], divisor: readonly number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0);

  for (const byte of data) {
    const factor = byte ^ (result.shift() ?? 0);

    result.push(0);
    divisor.forEach((coefficient, i) => {
      result[i] = (result[i] ?? 0) ^ gfMultiply(coefficient, factor);
    });
  }

  return result;
}

function alignmentPositions(version: number, size: number): number[] {
  if (version === 1) return [];

  const count = Math.floor(version / 7) + 2;
  const step = Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const result = [6];

  for (let pos = size - 7; result.length < count; pos -= step) result.splice(1, 0, pos);

  return result;
}

function encodeData(bytes: Uint8Array, version: number): number[] {
  const capacityBits = dataCodewords(version) * 8;
  const bits: number[] = [];
  const push = (value: number, length: number): void => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };

  push(0b0100, 4);
  push(bytes.length, version <= 9 ? 8 : 16);
  for (const byte of bytes) push(byte, 8);
  push(0, Math.min(4, capacityBits - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) push(pad, 8);

  const codewords: number[] = [];

  for (let i = 0; i < bits.length; i += 8) codewords.push(bits.slice(i, i + 8).reduce((acc, b) => (acc << 1) | b, 0));

  return codewords;
}

function withErrorCorrection(data: readonly number[], version: number): number[] {
  const blockCount = BLOCKS_M[version] ?? 1;
  const eccLength = ECC_PER_BLOCK_M[version] ?? 0;
  const rawCodewords = Math.floor(rawDataModules(version) / 8);
  const shortBlocks = blockCount - (rawCodewords % blockCount);
  const shortLength = Math.floor(rawCodewords / blockCount);
  const divisor = rsDivisor(eccLength);
  const blocks: number[][] = [];

  for (let i = 0, k = 0; i < blockCount; i++) {
    const length = shortLength - eccLength + (i < shortBlocks ? 0 : 1);
    const block = data.slice(k, k + length);

    k += length;

    const ecc = rsRemainder(block, divisor);

    if (i < shortBlocks) block.push(0);
    blocks.push([...block, ...ecc]);
  }

  const result: number[] = [];
  const width = blocks[0]?.length ?? 0;

  for (let i = 0; i < width; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortLength - eccLength || j >= shortBlocks) result.push(block[i] ?? 0);
    });
  }

  return result;
}

class Grid {
  readonly modules: boolean[][];
  readonly reserved: boolean[][];

  constructor(readonly size: number) {
    this.modules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
    this.reserved = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  }

  fixed(x: number, y: number, dark: boolean): void {
    const row = this.modules[y];
    const mark = this.reserved[y];

    if (row === undefined || mark === undefined) return;
    row[x] = dark;
    mark[x] = true;
  }

  isReserved(x: number, y: number): boolean {
    return this.reserved[y]?.[x] === true;
  }

  get(x: number, y: number): boolean {
    return this.modules[y]?.[x] === true;
  }

  set(x: number, y: number, dark: boolean): void {
    const row = this.modules[y];

    if (row !== undefined) row[x] = dark;
  }
}

function drawFormat(grid: Grid, mask: number): void {
  const data = (FORMAT_BITS_M << 3) | mask;
  let rem = data;

  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);

  const bits = ((data << 10) | rem) ^ 0x5412;
  const size = grid.size;

  for (let i = 0; i <= 5; i++) grid.fixed(8, i, bit(bits, i));
  grid.fixed(8, 7, bit(bits, 6));
  grid.fixed(8, 8, bit(bits, 7));
  grid.fixed(7, 8, bit(bits, 8));
  for (let i = 9; i < 15; i++) grid.fixed(14 - i, 8, bit(bits, i));
  for (let i = 0; i < 8; i++) grid.fixed(size - 1 - i, 8, bit(bits, i));
  for (let i = 8; i < 15; i++) grid.fixed(8, size - 15 + i, bit(bits, i));
  grid.fixed(8, size - 8, true);
}

function drawFunctionPatterns(grid: Grid, version: number): void {
  const size = grid.size;

  for (let i = 0; i < size; i++) {
    grid.fixed(6, i, i % 2 === 0);
    grid.fixed(i, 6, i % 2 === 0);
  }

  for (const [cx, cy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ] as const) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        const distance = Math.max(Math.abs(dx), Math.abs(dy));

        if (x >= 0 && x < size && y >= 0 && y < size) grid.fixed(x, y, distance !== 2 && distance !== 4);
      }
    }
  }

  const positions = alignmentPositions(version, size);
  const last = positions.length - 1;

  positions.forEach((px, i) => {
    positions.forEach((py, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) grid.fixed(px + dx, py + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    });
  });

  drawFormat(grid, 0);

  if (version >= 7) {
    let rem = version;

    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);

    const bits = (version << 12) | rem;

    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);

      grid.fixed(a, b, bit(bits, i));
      grid.fixed(b, a, bit(bits, i));
    }
  }
}

function drawCodewords(grid: Grid, codewords: readonly number[]): void {
  const size = grid.size;
  let i = 0;

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vertical : vertical;

        if (!grid.isReserved(x, y) && i < codewords.length * 8) {
          grid.set(x, y, bit(codewords[i >>> 3] ?? 0, 7 - (i & 7)));
          i++;
        }
      }
    }
  }
}

function masked(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

function applyMask(grid: Grid, mask: number): void {
  for (let y = 0; y < grid.size; y++) {
    for (let x = 0; x < grid.size; x++) {
      if (!grid.isReserved(x, y) && masked(mask, x, y)) grid.set(x, y, !grid.get(x, y));
    }
  }
}

function penalty(grid: Grid): number {
  const size = grid.size;
  let result = 0;

  const addHistory = (length: number, history: number[]): void => {
    history.pop();
    history.unshift(history[0] === 0 ? length + size : length);
  };
  const countPatterns = (h: readonly number[]): number => {
    const n = h[1] ?? 0;
    const core = n > 0 && h[2] === n && h[3] === n * 3 && h[4] === n && h[5] === n;

    return (core && (h[0] ?? 0) >= n * 4 && (h[6] ?? 0) >= n ? 1 : 0) + (core && (h[6] ?? 0) >= n * 4 && (h[0] ?? 0) >= n ? 1 : 0);
  };
  const scanLine = (read: (i: number) => boolean): void => {
    let color = false;
    let run = 0;
    const history = [0, 0, 0, 0, 0, 0, 0];

    for (let i = 0; i < size; i++) {
      if (read(i) === color) {
        run++;
        if (run === 5) result += 3;
        else if (run > 5) result++;
      } else {
        addHistory(run, history);
        if (!color) result += countPatterns(history) * 40;
        color = read(i);
        run = 1;
      }
    }

    if (color) {
      addHistory(run, history);
      run = 0;
    }
    addHistory(run + size, history);
    result += countPatterns(history) * 40;
  };

  for (let y = 0; y < size; y++) scanLine((x) => grid.get(x, y));
  for (let x = 0; x < size; x++) scanLine((y) => grid.get(x, y));

  let dark = 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const color = grid.get(x, y);

      if (color) dark++;
      if (x < size - 1 && y < size - 1 && color === grid.get(x + 1, y) && color === grid.get(x, y + 1) && color === grid.get(x + 1, y + 1)) result += 3;
    }
  }

  const total = size * size;

  return result + (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
}

/** Encodes text as a QR matrix; `forceMask` exists for tests. Throws when the text does not fit version 15. */
export function encodeQr(text: string, forceMask?: number): QrMatrix {
  const bytes = new TextEncoder().encode(text);
  let version = 1;

  while (version <= MAX_VERSION && 4 + (version <= 9 ? 8 : 16) + bytes.length * 8 > dataCodewords(version) * 8) version++;
  if (version > MAX_VERSION) throw new RangeError("The text is too long for this QR encoder.");

  const size = version * 4 + 17;
  const grid = new Grid(size);

  drawFunctionPatterns(grid, version);
  drawCodewords(grid, withErrorCorrection(encodeData(bytes, version), version));

  let mask = forceMask ?? 0;

  if (forceMask === undefined) {
    let best = Number.POSITIVE_INFINITY;

    for (let candidate = 0; candidate < 8; candidate++) {
      applyMask(grid, candidate);
      drawFormat(grid, candidate);

      const score = penalty(grid);

      if (score < best) {
        best = score;
        mask = candidate;
      }
      applyMask(grid, candidate);
    }
  }

  applyMask(grid, mask);
  drawFormat(grid, mask);

  return { size, version, mask, modules: grid.modules };
}
