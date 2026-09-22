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

/**
 * Upper bound for a one-shot decode. Generous: a large photo on a slow device
 * can take a while, and the first request may queue behind the wasm cold start.
 */
const ONE_SHOT_TIMEOUT_MS = 20_000;

/**
 * One-shot request → response, matched by id (the worker is shared). Rejects
 * instead of hanging forever when the worker fails to load or never answers.
 */
export function decodeViaWorker(
  request: DecodeRequest,
  transfer: Transferable[] = [],
  timeoutMs = ONE_SHOT_TIMEOUT_MS,
): Promise<DecodeHit[]> {
  const target = getDecoderWorker();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      target.removeEventListener("message", onMessage);
      target.removeEventListener("error", onFailure);
      target.removeEventListener("messageerror", onFailure);
    };
    const onMessage = (event: MessageEvent<DecodeResponse>) => {
      if (event.data.id !== request.id) return;
      cleanup();
      if (event.data.ok) resolve(event.data.results);
      else reject(new Error(event.data.error));
    };
    const onFailure = () => {
      cleanup();
      reject(new Error("Decoder konnte nicht geladen werden."));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Decoder antwortet nicht."));
    }, timeoutMs);
    target.addEventListener("message", onMessage);
    target.addEventListener("error", onFailure);
    target.addEventListener("messageerror", onFailure);
    target.postMessage(request, transfer);
  });
}
