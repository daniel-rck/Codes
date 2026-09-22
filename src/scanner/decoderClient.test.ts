import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { DecodeRequest } from "./decoder.worker.ts";

/** Minimal stand-in for the decode worker; tests drive its responses. */
class FakeWorker extends EventTarget {
  static instance: FakeWorker | null = null;
  posted: DecodeRequest[] = [];
  constructor() {
    super();
    FakeWorker.instance = this;
  }
  postMessage(request: DecodeRequest) {
    this.posted.push(request);
  }
  respond(data: unknown) {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
}

let client: typeof import("./decoderClient.ts");

beforeAll(async () => {
  vi.stubGlobal("Worker", FakeWorker);
  client = await import("./decoderClient.ts");
});

afterEach(() => {
  vi.useRealTimers();
});

function worker(): FakeWorker {
  client.getDecoderWorker();
  if (!FakeWorker.instance) throw new Error("worker not created");
  return FakeWorker.instance;
}

function bytesRequest(): DecodeRequest {
  return { id: client.nextRequestId(), kind: "bytes", bytes: new Uint8Array() };
}

describe("decodeViaWorker", () => {
  it("resolves with the response matching its request id", async () => {
    const request = bytesRequest();
    const pending = client.decodeViaWorker(request);
    worker().respond({ id: request.id + 1000, ok: true, results: [] });
    worker().respond({ id: request.id, ok: true, results: [{ text: "hi", format: "QRCode" }] });
    await expect(pending).resolves.toEqual([{ text: "hi", format: "QRCode" }]);
  });

  it("rejects with the worker's error message", async () => {
    const request = bytesRequest();
    const pending = client.decodeViaWorker(request);
    worker().respond({ id: request.id, ok: false, error: "kaputt" });
    await expect(pending).rejects.toThrow("kaputt");
  });

  it("rejects instead of hanging when the worker fails", async () => {
    const pending = client.decodeViaWorker(bytesRequest());
    worker().dispatchEvent(new Event("error"));
    await expect(pending).rejects.toThrow("Decoder konnte nicht geladen werden.");
  });

  it("rejects after the timeout when no response arrives", async () => {
    vi.useFakeTimers();
    const pending = client.decodeViaWorker(bytesRequest(), [], 1000);
    const assertion = expect(pending).rejects.toThrow("Decoder antwortet nicht.");
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });
});
