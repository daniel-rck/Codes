/**
 * QR Code module matrix: function patterns, data placement, data masking and
 * format/version information (ISO/IEC 18004). Consumes the codeword stream from
 * `encode.ts` and produces a boolean matrix (`true` = dark module).
 *
 * Internally the builder works on flat `Uint8Array` grids (row-major,
 * `y * size + x`) — mask evaluation makes ~16 full-grid passes per encode, and
 * flat typed arrays keep that cache-friendly. The public result stays
 * `boolean[][]`.
 */
import { type EccLevel, type EncodeResult, encodeQr } from "./encode.ts";

export type QrMatrix = {
  size: number;
  /** Row-major; `modules[y][x] === true` means a dark module. */
  modules: boolean[][];
  version: number;
  ecc: EccLevel;
  mask: number;
};

// Format-information ECC indicator bits (NB: differs from the table order).
const ECC_FORMAT_BITS: Record<EccLevel, number> = { L: 1, M: 0, Q: 3, H: 2 };

const PENALTY_N1 = 3;
const PENALTY_N2 = 3;
const PENALTY_N3 = 40;
const PENALTY_N4 = 10;

function getBit(value: number, index: number): boolean {
  return ((value >>> index) & 1) !== 0;
}

class MatrixBuilder {
  readonly size: number;
  /** Flat row-major grid; 1 = dark. */
  private readonly grid: Uint8Array;
  /** Flat row-major grid; 1 = function module (not maskable). */
  private readonly func: Uint8Array;

  constructor(
    private readonly version: number,
    private readonly ecc: EccLevel,
  ) {
    this.size = version * 4 + 17;
    this.grid = new Uint8Array(this.size * this.size);
    this.func = new Uint8Array(this.size * this.size);
  }

  private set(x: number, y: number, dark: boolean): void {
    const i = y * this.size + x;
    this.grid[i] = dark ? 1 : 0;
    this.func[i] = 1;
  }

  private alignmentPositions(): number[] {
    if (this.version === 1) return [];
    const numAlign = Math.floor(this.version / 7) + 2;
    const step =
      this.version === 32 ? 26 : Math.ceil((this.version * 4 + 4) / (numAlign * 2 - 2)) * 2;
    const result: number[] = [];
    for (let pos = this.size - 7; result.length < numAlign - 1; pos -= step) result.unshift(pos);
    result.unshift(6);
    return result;
  }

  private drawFinder(x: number, y: number): void {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size) {
          this.set(xx, yy, dist !== 2 && dist !== 4);
        }
      }
    }
  }

  private drawAlignment(x: number, y: number): void {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        this.set(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  drawFunctionPatterns(): void {
    // Timing patterns.
    for (let i = 0; i < this.size; i++) {
      this.set(6, i, i % 2 === 0);
      this.set(i, 6, i % 2 === 0);
    }
    // Finder patterns (+ implicit separators via distance 4).
    this.drawFinder(3, 3);
    this.drawFinder(this.size - 4, 3);
    this.drawFinder(3, this.size - 4);
    // Alignment patterns (skip the three that collide with finders).
    const positions = this.alignmentPositions();
    const last = positions.length - 1;
    for (let i = 0; i < positions.length; i++) {
      for (let j = 0; j < positions.length; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
        this.drawAlignment(positions[i] as number, positions[j] as number);
      }
    }
    // Reserve format (mask 0 placeholder, overwritten later) and version areas.
    this.drawFormatBits(0);
    this.drawVersion();
  }

  drawFormatBits(mask: number): void {
    const data = (ECC_FORMAT_BITS[this.ecc] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;

    for (let i = 0; i <= 5; i++) this.set(8, i, getBit(bits, i));
    this.set(8, 7, getBit(bits, 6));
    this.set(8, 8, getBit(bits, 7));
    this.set(7, 8, getBit(bits, 8));
    for (let i = 9; i < 15; i++) this.set(14 - i, 8, getBit(bits, i));

    for (let i = 0; i < 8; i++) this.set(this.size - 1 - i, 8, getBit(bits, i));
    for (let i = 8; i < 15; i++) this.set(8, this.size - 15 + i, getBit(bits, i));
    this.set(8, this.size - 8, true); // always-dark module
  }

  private drawVersion(): void {
    if (this.version < 7) return;
    let rem = this.version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (this.version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = getBit(bits, i);
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.set(a, b, bit);
      this.set(b, a, bit);
    }
  }

  drawCodewords(data: Uint8Array): void {
    let i = 0;
    const totalBits = data.length * 8;
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < this.size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? this.size - 1 - vert : vert;
          const idx = y * this.size + x;
          if (!this.func[idx] && i < totalBits) {
            this.grid[idx] = getBit(data[i >>> 3] as number, 7 - (i & 7)) ? 1 : 0;
            i++;
          }
        }
      }
    }
  }

  private maskInvert(mask: number, x: number, y: number): boolean {
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
      case 7:
        return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
      default:
        return false;
    }
  }

  applyMask(mask: number): void {
    for (let y = 0; y < this.size; y++) {
      const row = y * this.size;
      for (let x = 0; x < this.size; x++) {
        if (!this.func[row + x] && this.maskInvert(mask, x, y)) {
          this.grid[row + x] = this.grid[row + x] ? 0 : 1;
        }
      }
    }
  }

  private finderPenaltyCountPatterns(runHistory: number[]): number {
    const n = runHistory[1] as number;
    const core =
      n > 0 &&
      runHistory[2] === n &&
      runHistory[3] === n * 3 &&
      runHistory[4] === n &&
      runHistory[5] === n;
    return (
      (core && (runHistory[0] as number) >= n * 4 && (runHistory[6] as number) >= n ? 1 : 0) +
      (core && (runHistory[6] as number) >= n * 4 && (runHistory[0] as number) >= n ? 1 : 0)
    );
  }

  private finderPenaltyAddHistory(currentRunLength: number, runHistory: number[]): void {
    let run = currentRunLength;
    if (runHistory[0] === 0) run += this.size; // light border on the first run
    runHistory.pop();
    runHistory.unshift(run);
  }

  private finderPenaltyTerminate(
    currentRunColor: number,
    currentRunLength: number,
    runHistory: number[],
  ): number {
    let run = currentRunLength;
    if (currentRunColor) {
      this.finderPenaltyAddHistory(run, runHistory);
      run = 0;
    }
    run += this.size; // light border
    this.finderPenaltyAddHistory(run, runHistory);
    return this.finderPenaltyCountPatterns(runHistory);
  }

  getPenaltyScore(): number {
    let result = 0;
    const size = this.size;
    const grid = this.grid;

    // Rows.
    for (let y = 0; y < size; y++) {
      const row = y * size;
      let runColor = 0;
      let runX = 0;
      const runHistory = [0, 0, 0, 0, 0, 0, 0];
      for (let x = 0; x < size; x++) {
        if (grid[row + x] === runColor) {
          runX++;
          if (runX === 5) result += PENALTY_N1;
          else if (runX > 5) result++;
        } else {
          this.finderPenaltyAddHistory(runX, runHistory);
          if (!runColor) result += this.finderPenaltyCountPatterns(runHistory) * PENALTY_N3;
          runColor = grid[row + x] as number;
          runX = 1;
        }
      }
      result += this.finderPenaltyTerminate(runColor, runX, runHistory) * PENALTY_N3;
    }
    // Columns.
    for (let x = 0; x < size; x++) {
      let runColor = 0;
      let runY = 0;
      const runHistory = [0, 0, 0, 0, 0, 0, 0];
      for (let y = 0; y < size; y++) {
        if (grid[y * size + x] === runColor) {
          runY++;
          if (runY === 5) result += PENALTY_N1;
          else if (runY > 5) result++;
        } else {
          this.finderPenaltyAddHistory(runY, runHistory);
          if (!runColor) result += this.finderPenaltyCountPatterns(runHistory) * PENALTY_N3;
          runColor = grid[y * size + x] as number;
          runY = 1;
        }
      }
      result += this.finderPenaltyTerminate(runColor, runY, runHistory) * PENALTY_N3;
    }
    // 2x2 blocks of one color.
    for (let y = 0; y < size - 1; y++) {
      const row = y * size;
      for (let x = 0; x < size - 1; x++) {
        const c = grid[row + x];
        if (
          c === grid[row + x + 1] &&
          c === grid[row + size + x] &&
          c === grid[row + size + x + 1]
        ) {
          result += PENALTY_N2;
        }
      }
    }
    // Balance of dark vs light modules.
    let dark = 0;
    for (let i = 0; i < grid.length; i++) if (grid[i]) dark++;
    const total = size * size;
    const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    result += k * PENALTY_N4;
    return result;
  }

  /** Materialise the flat grid as the public boolean[][] shape. */
  toModules(): boolean[][] {
    const modules: boolean[][] = [];
    for (let y = 0; y < this.size; y++) {
      const row = new Array<boolean>(this.size);
      const base = y * this.size;
      for (let x = 0; x < this.size; x++) row[x] = this.grid[base + x] === 1;
      modules.push(row);
    }
    return modules;
  }
}

/** Build a QR matrix from a pre-computed codeword stream, choosing the best mask. */
export function buildMatrix(result: EncodeResult): QrMatrix {
  const builder = new MatrixBuilder(result.version, result.ecc);
  builder.drawFunctionPatterns();
  builder.drawCodewords(result.codewords);

  let bestMask = 0;
  let minPenalty = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 8; mask++) {
    builder.applyMask(mask);
    builder.drawFormatBits(mask);
    const penalty = builder.getPenaltyScore();
    if (penalty < minPenalty) {
      minPenalty = penalty;
      bestMask = mask;
    }
    builder.applyMask(mask); // undo (XOR is its own inverse)
  }
  builder.applyMask(bestMask);
  builder.drawFormatBits(bestMask);

  return {
    size: builder.size,
    modules: builder.toModules(),
    version: result.version,
    ecc: result.ecc,
    mask: bestMask,
  };
}

/** Convenience: encode text and build its matrix in one call. */
export function qrMatrix(text: string, ecc: EccLevel = "M"): QrMatrix {
  return buildMatrix(encodeQr(text, ecc));
}

/** Return a copy of the module grid padded with a light quiet zone. */
export function withQuietZone(modules: boolean[][], border = 4): boolean[][] {
  const size = modules.length;
  const padded = Array.from({ length: size + border * 2 }, () =>
    new Array<boolean>(size + border * 2).fill(false),
  );
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      (padded[y + border] as boolean[])[x + border] = (modules[y] as boolean[])[x] as boolean;
    }
  }
  return padded;
}
