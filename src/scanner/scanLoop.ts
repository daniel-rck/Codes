/**
 * rAF-throttled scan loop: grabs frames from a <video>, downsizes them to an
 * offscreen canvas and hands the ImageData to the shared decode worker at
 * ~6–10 fps. One frame is in flight at a time; responses are matched by
 * request id because the worker is shared with other consumers.
 *
 * Because only one frame may be in flight, a lost response would stall the loop
 * for good — the preview keeps running while nothing is ever decoded again. A
 * watchdog frees the slot and reports the stall instead of failing silently.
 */
import type { DecodeRequest, DecodeResponse } from "./decoder.worker.ts";
import { getDecoderWorker, nextRequestId } from "./decoderClient.ts";

/**
 * How long to wait for a frame's decode result before freeing the slot. Well
 * above a normal decode (single-digit to low tens of ms) because the very first
 * frame can queue behind the wasm cold start.
 */
const FRAME_TIMEOUT_MS = 6000;

/** Consecutive timeouts before the user is told the decoder is unresponsive. */
const TIMEOUTS_BEFORE_ERROR = 2;

export type ScanHit = { text: string; format: string };

export type ScanLoopOptions = {
  /** Target decode rate. Defaults to 8 fps. */
  fps?: number;
  /** Longest edge of the downscaled frame sent to the worker. */
  maxEdge?: number;
  onHit: (hit: ScanHit) => void;
  onError?: (message: string) => void;
};

export type ScanLoop = { stop: () => void };

export function startScanLoop(video: HTMLVideoElement, options: ScanLoopOptions): ScanLoop {
  const worker = getDecoderWorker();
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const interval = 1000 / (options.fps ?? 8);
  const maxEdge = options.maxEdge ?? 720;

  let running = true;
  let busy = false;
  let lastSent = 0;
  let rafId = 0;
  let inFlightId = -1;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let timeouts = 0;

  const clearWatchdog = () => {
    if (watchdog !== undefined) clearTimeout(watchdog);
    watchdog = undefined;
  };

  const onMessage = (event: MessageEvent<DecodeResponse>) => {
    // The worker is shared — only consume responses to our own frames.
    if (event.data.id !== inFlightId) return;
    clearWatchdog();
    timeouts = 0;
    busy = false;
    if (!running) return;
    const data = event.data;
    if (!data.ok) {
      options.onError?.(data.error);
      return;
    }
    const first = data.results[0];
    if (first) options.onHit({ text: first.text, format: first.format });
  };

  // A worker that fails to load or receives an unclonable message never answers
  // — surface it instead of leaving the preview running on a dead decoder.
  const onWorkerFailure = () => {
    clearWatchdog();
    busy = false;
    if (running) options.onError?.("Decoder konnte nicht geladen werden.");
  };

  worker.addEventListener("message", onMessage);
  worker.addEventListener("error", onWorkerFailure);
  worker.addEventListener("messageerror", onWorkerFailure);

  const tick = (now: number) => {
    if (!running) return;
    rafId = requestAnimationFrame(tick);
    if (busy || now - lastSent < interval) return;
    if (video.readyState < 2 || video.videoWidth === 0 || !ctx) return;

    lastSent = now;
    const scale = Math.min(1, maxEdge / Math.max(video.videoWidth, video.videoHeight));
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    // Reassigning canvas dimensions clears + reallocates the buffer — only do
    // it when the source resolution actually changed.
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);
    const image = ctx.getImageData(0, 0, w, h);

    busy = true;
    inFlightId = nextRequestId();
    // No `options`: the worker applies the camera profile for `image` requests
    // (`readerOptionsFor` in shared/zxing.ts), keeping the zxing glue out of the
    // main-thread bundle.
    const request: DecodeRequest = { id: inFlightId, kind: "image", image };
    clearWatchdog();
    watchdog = setTimeout(() => {
      watchdog = undefined;
      // Free the slot so the loop keeps decoding; only complain once a second
      // frame in a row went unanswered, so a slow cold start stays quiet.
      busy = false;
      timeouts += 1;
      if (running && timeouts >= TIMEOUTS_BEFORE_ERROR) {
        options.onError?.("Decoder antwortet nicht.");
      }
    }, FRAME_TIMEOUT_MS);
    worker.postMessage(request, [image.data.buffer]);
  };

  rafId = requestAnimationFrame(tick);

  return {
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
      clearWatchdog();
      // Keep the worker alive — it is shared and holds the compiled wasm.
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onWorkerFailure);
      worker.removeEventListener("messageerror", onWorkerFailure);
    },
  };
}
