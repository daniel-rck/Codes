/**
 * Decode barcodes from an image file or blob (gallery / file upload). zxing's
 * wasm has its own image decoder, so the raw bytes go straight in — no canvas
 * round-trip needed.
 */
import { type ReaderOptions, readBarcodes } from "../shared/zxing.ts";

export type ImageHit = { text: string; format: string };

export async function decodeImageFile(file: Blob, options?: ReaderOptions): Promise<ImageHit[]> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const results = await readBarcodes(buffer, options);
  return results
    .filter((r) => r.isValid && r.text.length > 0)
    .map((r) => ({ text: r.text, format: r.format }));
}
