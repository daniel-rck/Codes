import { describe, expect, it } from "vitest";
import { gfMul, rsGenerator, rsRemainder } from "./reedSolomon.ts";

describe("GF(256) arithmetic", () => {
  it("multiplies by identity and zero", () => {
    expect(gfMul(0, 5)).toBe(0);
    expect(gfMul(7, 0)).toBe(0);
    expect(gfMul(1, 42)).toBe(42);
  });

  it("matches a known product (α² · α³ = α⁵ = 32)", () => {
    // α=2, so 4 · 8 in GF(256) = 2^5 = 32.
    expect(gfMul(4, 8)).toBe(32);
  });
});

describe("Reed–Solomon generator polynomial", () => {
  it("degree 1 → (x + 1) = [1, 1]", () => {
    expect(Array.from(rsGenerator(1))).toEqual([1, 1]);
  });

  it("degree 2 → (x + 1)(x + α) = [1, 3, 2]", () => {
    expect(Array.from(rsGenerator(2))).toEqual([1, 3, 2]);
  });

  it("produces a leading coefficient of 1 and the right length", () => {
    const g = rsGenerator(10);
    expect(g.length).toBe(11);
    expect(g[0]).toBe(1);
  });
});

describe("Reed–Solomon remainder", () => {
  it("returns exactly ecLen codewords", () => {
    const data = Uint8Array.from([32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236]);
    const ec = rsRemainder(data, 13);
    expect(ec.length).toBe(13);
  });

  it("matches the ISO/IEC 18004 version-1-M reference vector", () => {
    // Data codewords for "01234567" (numeric, V1-M) from the standard's Annex.
    const data = Uint8Array.from([
      16, 32, 12, 86, 97, 128, 236, 17, 236, 17, 236, 17, 236, 17, 236, 17,
    ]);
    const ec = rsRemainder(data, 10);
    expect(Array.from(ec)).toEqual([165, 36, 212, 193, 237, 54, 199, 135, 44, 85]);
  });
});
