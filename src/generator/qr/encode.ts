/**
 * Dependency-free QR Code data encoding (ISO/IEC 18004).
 *
 * Produces the final, interleaved codeword stream for a given text + error
 * correction level, picking the smallest version that fits. Matrix layout,
 * masking and module placement live in `matrix.ts`.
 */
import { rsRemainder } from "./reedSolomon.ts";

export type EccLevel = "L" | "M" | "Q" | "H";

const ECC_ORDER: EccLevel[] = ["L", "M", "Q", "H"];

/** Number of error-correction codewords per block, indexed [eccIndex][version]. */
// biome-ignore format: keep the spec table compact and column-aligned
const ECC_CODEWORDS_PER_BLOCK: number[][] = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];

/** Number of error-correction blocks, indexed [eccIndex][version]. */
// biome-ignore format: keep the spec table compact and column-aligned
const NUM_ERROR_CORRECTION_BLOCKS: number[][] = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

const MIN_VERSION = 1;
const MAX_VERSION = 40;

export type Mode = "numeric" | "alphanumeric" | "byte";

const ALPHANUMERIC = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

export type EncodeResult = {
  version: number;
  ecc: EccLevel;
  /** Final interleaved data + EC codewords, ready for module placement. */
  codewords: Uint8Array;
  mode: Mode;
};

function eccIndex(ecc: EccLevel): number {
  return ECC_ORDER.indexOf(ecc);
}

/** Total number of data + EC bits available in the symbol (before /8). */
function numRawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

/** Number of usable data codewords (raw codewords minus EC codewords). */
export function numDataCodewords(version: number, ecc: EccLevel): number {
  const e = eccIndex(ecc);
  const rawCodewords = Math.floor(numRawDataModules(version) / 8);
  return (
    rawCodewords -
    (ECC_CODEWORDS_PER_BLOCK[e]?.[version] as number) *
      (NUM_ERROR_CORRECTION_BLOCKS[e]?.[version] as number)
  );
}

function selectMode(text: string): Mode {
  if (/^[0-9]*$/.test(text)) return "numeric";
  for (const ch of text) {
    if (!ALPHANUMERIC.includes(ch)) return "byte";
  }
  return "alphanumeric";
}

function charCountBits(mode: Mode, version: number): number {
  const group = version <= 9 ? 0 : version <= 26 ? 1 : 2;
  const table: Record<Mode, [number, number, number]> = {
    numeric: [10, 12, 14],
    alphanumeric: [9, 11, 13],
    byte: [8, 16, 16],
  };
  return table[mode][group];
}

const MODE_INDICATOR: Record<Mode, number> = {
  numeric: 0x1,
  alphanumeric: 0x2,
  byte: 0x4,
};

class BitBuffer {
  private bits: number[] = [];

  append(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i--) {
      this.bits.push((value >>> i) & 1);
    }
  }

  get length(): number {
    return this.bits.length;
  }

  toBytes(): Uint8Array {
    const bytes = new Uint8Array(Math.ceil(this.bits.length / 8));
    for (let i = 0; i < this.bits.length; i++) {
      if (this.bits[i]) bytes[i >>> 3] = (bytes[i >>> 3] as number) | (0x80 >>> (i & 7));
    }
    return bytes;
  }
}

function utf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** Number of data bits the segment payload occupies (excluding header). */
function dataBitLength(mode: Mode, text: string): number {
  switch (mode) {
    case "numeric": {
      const n = text.length;
      return 10 * Math.floor(n / 3) + (n % 3 === 1 ? 4 : n % 3 === 2 ? 7 : 0);
    }
    case "alphanumeric": {
      const n = text.length;
      return 11 * Math.floor(n / 2) + (n % 2 === 1 ? 6 : 0);
    }
    case "byte":
      return utf8Bytes(text).length * 8;
  }
}

function charCountValue(mode: Mode, text: string): number {
  return mode === "byte" ? utf8Bytes(text).length : text.length;
}

function appendSegment(buf: BitBuffer, mode: Mode, text: string): void {
  switch (mode) {
    case "numeric": {
      for (let i = 0; i < text.length; i += 3) {
        const chunk = text.slice(i, i + 3);
        buf.append(Number.parseInt(chunk, 10), chunk.length * 3 + 1);
      }
      break;
    }
    case "alphanumeric": {
      for (let i = 0; i < text.length; i += 2) {
        if (i + 1 < text.length) {
          const v =
            ALPHANUMERIC.indexOf(text[i] as string) * 45 +
            ALPHANUMERIC.indexOf(text[i + 1] as string);
          buf.append(v, 11);
        } else {
          buf.append(ALPHANUMERIC.indexOf(text[i] as string), 6);
        }
      }
      break;
    }
    case "byte": {
      for (const byte of utf8Bytes(text)) buf.append(byte, 8);
      break;
    }
  }
}

function selectVersion(mode: Mode, text: string, ecc: EccLevel): number {
  const payloadBits = dataBitLength(mode, text);
  for (let version = MIN_VERSION; version <= MAX_VERSION; version++) {
    const headerBits = 4 + charCountBits(mode, version);
    const capacityBits = numDataCodewords(version, ecc) * 8;
    if (headerBits + payloadBits <= capacityBits) return version;
  }
  throw new Error("Inhalt zu lang für QR-Code (max. Version 40 überschritten).");
}

/** Pad the bit buffer to a full codeword stream of `numDataCodewords` bytes. */
function buildDataCodewords(buf: BitBuffer, capacityCodewords: number): Uint8Array {
  const capacityBits = capacityCodewords * 8;
  // Terminator: up to four zero bits.
  const terminator = Math.min(4, capacityBits - buf.length);
  buf.append(0, terminator);
  // Pad to a byte boundary.
  if (buf.length % 8 !== 0) buf.append(0, 8 - (buf.length % 8));

  const bytes = buf.toBytes();
  const result = new Uint8Array(capacityCodewords);
  result.set(bytes.subarray(0, capacityCodewords));
  // Pad bytes alternate between 0xEC and 0x11.
  for (let i = bytes.length; i < capacityCodewords; i++) {
    result[i] = (i - bytes.length) % 2 === 0 ? 0xec : 0x11;
  }
  return result;
}

/** Split data codewords into blocks, append EC, then interleave per the spec. */
function addEccAndInterleave(data: Uint8Array, version: number, ecc: EccLevel): Uint8Array {
  const e = eccIndex(ecc);
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[e]?.[version] as number;
  const ecLen = ECC_CODEWORDS_PER_BLOCK[e]?.[version] as number;
  const rawCodewords = Math.floor(numRawDataModules(version) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);

  const blocks: { data: Uint8Array; ec: Uint8Array }[] = [];
  let offset = 0;
  for (let i = 0; i < numBlocks; i++) {
    const dataLen = shortBlockLen - ecLen + (i < numShortBlocks ? 0 : 1);
    const blockData = data.subarray(offset, offset + dataLen);
    offset += dataLen;
    blocks.push({ data: blockData, ec: rsRemainder(blockData, ecLen) });
  }

  const result = new Uint8Array(rawCodewords);
  let pos = 0;
  // Interleave data codewords column-by-column.
  const maxDataLen = shortBlockLen - ecLen + 1;
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of blocks) {
      if (i < block.data.length) result[pos++] = block.data[i] as number;
    }
  }
  // Interleave EC codewords column-by-column.
  for (let i = 0; i < ecLen; i++) {
    for (const block of blocks) {
      result[pos++] = block.ec[i] as number;
    }
  }
  return result;
}

/** Encode `text` into a QR codeword stream at the given EC level. */
export function encodeQr(text: string, ecc: EccLevel = "M"): EncodeResult {
  if (text.length === 0) throw new Error("Leerer Inhalt kann nicht kodiert werden.");
  const mode = selectMode(text);
  const version = selectVersion(mode, text, ecc);

  const buf = new BitBuffer();
  buf.append(MODE_INDICATOR[mode], 4);
  buf.append(charCountValue(mode, text), charCountBits(mode, version));
  appendSegment(buf, mode, text);

  const dataCodewords = buildDataCodewords(buf, numDataCodewords(version, ecc));
  const codewords = addEccAndInterleave(dataCodewords, version, ecc);
  return { version, ecc, codewords, mode };
}
