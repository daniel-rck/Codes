/**
 * Reed–Solomon error correction over GF(256) for QR codes.
 *
 * The field uses the QR-standard primitive polynomial x⁸ + x⁴ + x³ + x² + 1
 * (0x11D) with generator element α = 2. Addition is XOR; multiplication is done
 * via precomputed exp/log tables.
 */

const PRIMITIVE = 0x11d;

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function initTables() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= PRIMITIVE;
  }
  // Duplicate so exponent sums up to 508 need no modulo.
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255] as number;
})();

/** Multiply two field elements. */
export function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[(GF_LOG[a] as number) + (GF_LOG[b] as number)] as number;
}

/**
 * Build the generator polynomial of the given degree, returned as coefficients
 * from the highest-order term down. The leading coefficient is always 1, so the
 * result has `degree + 1` entries.
 */
export function rsGenerator(degree: number): Uint8Array {
  let poly = Uint8Array.of(1);
  for (let i = 0; i < degree; i++) {
    const root = GF_EXP[i] as number;
    const next = new Uint8Array(poly.length + 1);
    for (let j = 0; j < poly.length; j++) {
      next[j] = (next[j] as number) ^ (poly[j] as number);
      next[j + 1] = (next[j + 1] as number) ^ gfMul(poly[j] as number, root);
    }
    poly = next;
  }
  return poly;
}

/**
 * Compute the `ecLen` Reed–Solomon error-correction codewords for `data`.
 * Returns exactly `ecLen` bytes (the polynomial division remainder).
 */
export function rsRemainder(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = rsGenerator(ecLen);
  const res = new Uint8Array(ecLen);
  for (const byte of data) {
    const factor = byte ^ (res[0] as number);
    res.copyWithin(0, 1);
    res[ecLen - 1] = 0;
    for (let j = 0; j < ecLen; j++) {
      // gen[0] is the leading 1 and is skipped (already shifted out).
      res[j] = (res[j] as number) ^ gfMul(gen[j + 1] as number, factor);
    }
  }
  return res;
}
