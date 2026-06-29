/// <reference lib="webworker" />
/**
 * Decode worker. Runs zxing `readBarcodes` off the main thread so the camera
 * preview stays smooth. The scan loop posts `ImageData` frames; this worker
 * replies with decoded results (or an empty list when nothing was found).
 */
import { type ReaderOptions, type ReadResult, readBarcodes } from "../shared/zxing.ts";

export type DecodeRequest = {
  id: number;
  image: ImageData;
  options?: ReaderOptions;
};

export type DecodeHit = {
  text: string;
  format: string;
  bytes: Uint8Array;
};

export type DecodeResponse =
  | { id: number; ok: true; results: DecodeHit[] }
  | { id: number; ok: false; error: string };

function toHit(result: ReadResult): DecodeHit {
  return { text: result.text, format: result.format, bytes: result.bytes };
}

self.addEventListener("message", async (event: MessageEvent<DecodeRequest>) => {
  const { id, image, options } = event.data;
  try {
    const results = await readBarcodes(image, options);
    const hits = results.filter((r) => r.isValid && r.text.length > 0).map(toHit);
    const response: DecodeResponse = { id, ok: true, results: hits };
    (self as DedicatedWorkerGlobalScope).postMessage(response);
  } catch (err) {
    const response: DecodeResponse = {
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    (self as DedicatedWorkerGlobalScope).postMessage(response);
  }
});
