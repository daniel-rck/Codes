/**
 * Decode barcodes from an image file or blob (gallery / file upload). The raw
 * bytes go to the shared decode worker — zxing's wasm has its own image
 * decoder, and routing through the worker keeps the reader off the main
 * thread entirely.
 */
import type { ReaderOptions } from "../shared/zxing.ts";
import { decodeViaWorker, nextRequestId } from "./decoderClient.ts";

export type ImageHit = { text: string; format: string };

export async function decodeImageFile(file: Blob, options?: ReaderOptions): Promise<ImageHit[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const hits = await decodeViaWorker({ id: nextRequestId(), kind: "bytes", bytes, options }, [
    bytes.buffer,
  ]);
  return hits.map((h) => ({ text: h.text, format: h.format }));
}
