/// <reference lib="webworker" />
/**
 * Decode worker. Runs zxing `readBarcodes` off the main thread so the camera
 * preview stays smooth and the main thread never instantiates the reader.
 * Accepts camera frames (`ImageData`), encoded image bytes (file/gallery
 * uploads) and a warm-up request that pre-compiles the wasm module.
 */
import {
  type ReaderOptions,
  type ReadResult,
  readBarcodes,
  warmZXingModule,
} from "../shared/zxing.ts";

export type DecodeRequest =
  | { id: number; kind: "image"; image: ImageData; options?: ReaderOptions }
  | { id: number; kind: "bytes"; bytes: Uint8Array; options?: ReaderOptions }
  | { id: number; kind: "warmup" };

export type DecodeHit = {
  text: string;
  format: string;
};

export type DecodeResponse =
  | { id: number; ok: true; results: DecodeHit[] }
  | { id: number; ok: false; error: string };

function post(response: DecodeResponse): void {
  (self as DedicatedWorkerGlobalScope).postMessage(response);
}

function toHit(result: ReadResult): DecodeHit {
  return { text: result.text, format: result.format };
}

self.addEventListener("message", async (event: MessageEvent<DecodeRequest>) => {
  const request = event.data;
  try {
    if (request.kind === "warmup") {
      await warmZXingModule();
      post({ id: request.id, ok: true, results: [] });
      return;
    }
    const input = request.kind === "image" ? request.image : request.bytes;
    const results = await readBarcodes(input, request.options);
    const hits = results.filter((r) => r.isValid && r.text.length > 0).map(toHit);
    post({ id: request.id, ok: true, results: hits });
  } catch (err) {
    post({
      id: request.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});
