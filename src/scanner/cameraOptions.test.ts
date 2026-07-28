import { describe, expect, it } from "vitest";
// Read/write come straight from zxing (as in `shared/zxing.test.ts`): the app
// wrapper points the loader at a Vite `?url` asset, which has no target under
// Node, where the test setup feeds the wasm bytes in directly instead.
import { readBarcodes, writeBarcode } from "zxing-wasm/full";
import { CAMERA_READER_OPTIONS, type ReaderOptions, readerOptionsFor } from "../shared/zxing.ts";

/**
 * Guards the reader options the live camera loop uses (`scanLoop.ts`). Without
 * `tryHarder` zxing only lays a few scanlines through the middle band of the
 * frame, so a handheld 1D barcode is missed unless it sits dead centre — the
 * camera path found QR codes but no EAN/Code128. These tests decode synthetic
 * camera frames to keep that from regressing.
 */

const VALUE = "4006381333931";

/**
 * The module pattern of a barcode, taken from the writer's utf8 rendering — its
 * first row is one character per module (`█` = dark). Cheaper and more precise
 * than rasterising the PNG, and it needs no image decoder.
 */
async function modulePattern(): Promise<number[]> {
  const written = await writeBarcode(VALUE, { format: "EAN-13", scale: 1 });
  expect(written.error).toBeFalsy();
  const row = String(written.utf8).split("\n")[0] ?? "";
  const modules = [...row].map((char) => (char === "█" ? 1 : 0));
  expect(modules.length).toBeGreaterThan(0);
  return modules;
}

type FramePlacement = {
  /** Pixels per barcode module. */
  moduleWidth: number;
  barHeight: number;
  centerX: number;
  centerY: number;
  /** Tilt in radians, as a handheld phone would produce. */
  angle: number;
};

/**
 * Paint the barcode into a white RGBA frame the way `scanLoop` hands camera
 * frames to the worker. Built as a plain object because jsdom provides no
 * `ImageData` constructor — zxing only reads `data`/`width`/`height`.
 */
function cameraFrame(
  modules: number[],
  width: number,
  height: number,
  placement: FramePlacement,
): ImageData {
  const { moduleWidth, barHeight, centerX, centerY, angle } = placement;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const barWidth = modules.length * moduleWidth;
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Frame pixel → barcode-local coordinates, rotated about the placement.
      const dx = x - centerX;
      const dy = y - centerY;
      const localX = dx * cos - dy * sin + barWidth / 2;
      const localY = dx * sin + dy * cos + barHeight / 2;
      if (localX < 0 || localY < 0 || localX >= barWidth || localY >= barHeight) continue;
      if (!modules[Math.floor(localX / moduleWidth)]) continue;
      const offset = (y * width + x) * 4;
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
    }
  }
  return { data, width, height, colorSpace: "srgb" };
}

async function decode(frame: ImageData, options: ReaderOptions): Promise<string | null> {
  const results = await readBarcodes(frame, options);
  return results.find((r) => r.isValid && r.text.length > 0)?.text ?? null;
}

// 720 is the longest edge `scanLoop` downsizes camera frames to.
const FRAME_WIDTH = 720;
const FRAME_HEIGHT = 405;

const PLACEMENTS: { name: string; placement: FramePlacement }[] = [
  {
    name: "centred",
    placement: { moduleWidth: 4, barHeight: 70, centerX: 360, centerY: 202, angle: 0 },
  },
  {
    name: "lower third",
    placement: { moduleWidth: 4, barHeight: 70, centerX: 360, centerY: 330, angle: 0 },
  },
  {
    name: "upper third, tilted",
    placement: { moduleWidth: 4, barHeight: 70, centerX: 360, centerY: 70, angle: 0.05 },
  },
];

describe("camera reader options", () => {
  it("keeps the thorough defaults and one symbol per frame", () => {
    expect(CAMERA_READER_OPTIONS.tryHarder).toBe(true);
    expect(CAMERA_READER_OPTIONS.maxNumberOfSymbols).toBe(1);
  });

  it("applies the camera profile to live frames, the defaults to file bytes", () => {
    expect(readerOptionsFor("image")).toBe(CAMERA_READER_OPTIONS);
    expect(readerOptionsFor("bytes").maxNumberOfSymbols).toBeUndefined();
  });

  it.each(PLACEMENTS)("reads an EAN-13 placed $name in the frame", async ({ placement }) => {
    const frame = cameraFrame(await modulePattern(), FRAME_WIDTH, FRAME_HEIGHT, placement);
    // Exactly what the worker uses for a `kind: "image"` request.
    await expect(decode(frame, readerOptionsFor("image"))).resolves.toBe(VALUE);
  });

  it("would miss an off-centre EAN-13 without tryHarder", async () => {
    // Regression anchor: this is what the loop used to send. If this ever starts
    // passing, zxing changed its scanline sampling and the note above is stale.
    const frame = cameraFrame(await modulePattern(), FRAME_WIDTH, FRAME_HEIGHT, {
      moduleWidth: 4,
      barHeight: 70,
      centerX: 360,
      centerY: 330,
      angle: 0,
    });
    await expect(decode(frame, { formats: [], tryHarder: false })).resolves.toBeNull();
  });
});
