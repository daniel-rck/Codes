import { describe, expect, it } from "vitest";
import { readBarcodes, writeBarcode } from "zxing-wasm/full";

/**
 * Phase 1 smoke test: the zxing read/write layer is wired up correctly. Encode
 * a value via `writeBarcode`, then decode the rendered raster back through
 * `readBarcodes` (the wasm has its own image decoder, so this runs in Node).
 */
describe("zxing read/write layer", () => {
  it("round-trips a Code128 barcode through write → read", async () => {
    const value = "CODES-128-SMOKE";
    const written = await writeBarcode(value, { format: "Code128", scale: 4 });
    expect(written.error).toBeFalsy();
    expect(written.image).toBeInstanceOf(Blob);

    const buf = await (written.image as Blob).arrayBuffer();
    const results = await readBarcodes(new Uint8Array(buf), { formats: ["Code128"] });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.text).toBe(value);
    expect(results[0]?.format).toBe("Code128");
  });

  it("round-trips a QR code via the zxing writer (encoder baseline)", async () => {
    const value = "https://example.com/zxing";
    const written = await writeBarcode(value, { format: "QRCode", scale: 6 });
    expect(written.error).toBeFalsy();

    const buf = await (written.image as Blob).arrayBuffer();
    const results = await readBarcodes(new Uint8Array(buf), { formats: ["QRCode"] });
    expect(results[0]?.text).toBe(value);
  });
});
