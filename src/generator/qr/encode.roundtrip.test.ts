import { describe, expect, it } from "vitest";
import { readBarcodes } from "zxing-wasm/full";
import type { EccLevel } from "./encode.ts";
import { qrMatrix, withQuietZone } from "./matrix.ts";

/**
 * Rasterize a boolean module grid to an RGBA buffer (dark = black, light =
 * white) at the given module size, shaped like an `ImageData` so zxing's
 * pixmap path can decode it.
 */
function rasterize(modules: boolean[][], scale = 4): ImageData {
  const size = modules.length;
  const px = size * scale;
  const data = new Uint8ClampedArray(px * px * 4);
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const dark = modules[Math.floor(y / scale)]?.[Math.floor(x / scale)] === true;
      const v = dark ? 0 : 255;
      const i = (y * px + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { data, width: px, height: px, colorSpace: "srgb" } as ImageData;
}

async function decode(text: string, ecc: EccLevel): Promise<string | undefined> {
  const matrix = qrMatrix(text, ecc);
  const image = rasterize(withQuietZone(matrix.modules, 4));
  const results = await readBarcodes(image, { formats: ["QRCode"], tryHarder: true });
  return results[0]?.text;
}

const ECC_LEVELS: EccLevel[] = ["L", "M", "Q", "H"];

describe("QR encoder ↔ zxing roundtrip", () => {
  const cases: { name: string; text: string }[] = [
    { name: "short numeric", text: "01234567" },
    { name: "numeric long", text: "1234567890".repeat(8) },
    { name: "alphanumeric", text: "HELLO WORLD 123 $%*+-./:" },
    { name: "url (byte)", text: "https://example.com/path?q=codes&v=1" },
    { name: "utf-8 umlauts", text: "Grüße aus München — ☕" },
    { name: "vCard-ish byte", text: "BEGIN:VCARD\nFN:Jane Doe\nTEL:+49123456789\nEND:VCARD" },
    { name: "medium byte", text: "The quick brown fox jumps over the lazy dog. ".repeat(4) },
  ];

  for (const ecc of ECC_LEVELS) {
    for (const { name, text } of cases) {
      it(`${name} @ ECC ${ecc}`, async () => {
        expect(await decode(text, ecc)).toBe(text);
      });
    }
  }

  it("selects higher versions for longer payloads", async () => {
    const long = "A".repeat(600);
    const matrix = qrMatrix(long, "L");
    expect(matrix.version).toBeGreaterThan(10);
    expect(await decode(long, "L")).toBe(long);
  });
});
