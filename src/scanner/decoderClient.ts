/**
 * Shared decode-worker client. The worker (and its wasm instance) is created
 * once per session and reused across scan loops, rescans and image decodes —
 * terminating it would force a full wasm cold start on the next use.
 */
import type { DecodeHit, DecodeRequest, DecodeResponse } from "./decoder.worker.ts";

export type { DecodeHit, DecodeRequest, DecodeResponse };

let worker: Worker | null = null;
let seq = 0;

export function getDecoderWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./decoder.worker.ts", import.meta.url), { type: "module" });
  }
  return worker;
}

/** Monotonic request id, shared by all consumers of the worker. */
export function nextRequestId(): number {
  return ++seq;
}

/** Fire-and-forget: pre-compile the worker's wasm before the first decode. */
export function warmUpDecoder(): void {
  const request: DecodeRequest = { id: nextRequestId(), kind: "warmup" };
  getDecoderWorker().postMessage(request);
}

/** One-shot request → response, matched by id (the worker is shared). */
export function decodeViaWorker(
  request: DecodeRequest,
  transfer: Transferable[] = [],
): Promise<DecodeHit[]> {
  const target = getDecoderWorker();
  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent<DecodeResponse>) => {
      if (event.data.id !== request.id) return;
      target.removeEventListener("message", onMessage);
      if (event.data.ok) resolve(event.data.results);
      else reject(new Error(event.data.error));
    };
    target.addEventListener("message", onMessage);
    target.postMessage(request, transfer);
  });
}
