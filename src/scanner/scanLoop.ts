/**
 * rAF-throttled scan loop: grabs frames from a <video>, downsizes them to an
 * offscreen canvas and hands the ImageData to the decode worker at ~6–10 fps.
 * One frame is in flight at a time to avoid flooding the worker.
 */
import type { DecodeRequest, DecodeResponse } from "./decoder.worker.ts";

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
  const worker = new Worker(new URL("./decoder.worker.ts", import.meta.url), { type: "module" });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const interval = 1000 / (options.fps ?? 8);
  const maxEdge = options.maxEdge ?? 720;

  let running = true;
  let busy = false;
  let lastSent = 0;
  let rafId = 0;
  let reqId = 0;

  worker.addEventListener("message", (event: MessageEvent<DecodeResponse>) => {
    busy = false;
    const data = event.data;
    if (!data.ok) {
      options.onError?.(data.error);
      return;
    }
    const first = data.results[0];
    if (first) options.onHit({ text: first.text, format: first.format });
  });

  const tick = (now: number) => {
    if (!running) return;
    rafId = requestAnimationFrame(tick);
    if (busy || now - lastSent < interval) return;
    if (video.readyState < 2 || video.videoWidth === 0 || !ctx) return;

    lastSent = now;
    const scale = Math.min(1, maxEdge / Math.max(video.videoWidth, video.videoHeight));
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);
    const image = ctx.getImageData(0, 0, w, h);

    busy = true;
    const request: DecodeRequest = {
      id: ++reqId,
      image,
      options: { formats: [], tryHarder: false },
    };
    worker.postMessage(request, [image.data.buffer]);
  };

  rafId = requestAnimationFrame(tick);

  return {
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
      worker.terminate();
    },
  };
}
