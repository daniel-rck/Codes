/**
 * Central zxing-wasm setup. The single domain dependency of this app — it both
 * reads (`readBarcodes`) and writes (`writeBarcode`) every supported format.
 *
 * The `.wasm` binary is bundled as a local Vite asset and served from our own
 * origin (no CDN fetch) so the service worker can precache it for offline use.
 */
import {
  type CreatableBarcodeFormat,
  formatToLabel,
  prepareZXingModule,
  type ReaderOptions,
  type ReadResult,
  type WriteResult,
  type WriterOptions,
  readBarcodes as zxingReadBarcodes,
  writeBarcode as zxingWriteBarcode,
} from "zxing-wasm/full";
// Local copy of the wasm binary, emitted into our own bundle by Vite.
import wasmUrl from "zxing-wasm/full/zxing_full.wasm?url";

export type { CreatableBarcodeFormat, ReaderOptions, ReadResult, WriteResult, WriterOptions };
export { formatToLabel };

let prepared = false;

// Stable object identity: prepareZXingModule shallow-compares overrides to
// decide whether the cached module promise can be reused.
const OVERRIDES = {
  locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? wasmUrl : prefix + path),
};

/**
 * Point the Emscripten loader at our locally-hosted `.wasm` instead of the
 * default jsDelivr CDN. Idempotent; safe to call before every read/write.
 */
export function ensureZXingModule(): void {
  if (prepared) return;
  prepared = true;
  prepareZXingModule({ overrides: OVERRIDES, fireImmediately: false });
}

/**
 * Eagerly fetch + compile the wasm so the first real read/write doesn't pay
 * the cold start. Each realm (main thread, worker) has its own instance and
 * must warm itself.
 */
export async function warmZXingModule(): Promise<void> {
  prepared = true;
  await prepareZXingModule({ overrides: OVERRIDES, fireImmediately: true });
}

/** Sensible defaults for decoding: be thorough, search every format. */
export const DEFAULT_READER_OPTIONS: ReaderOptions = {
  formats: [],
  tryHarder: true,
  tryRotate: true,
  tryInvert: true,
  tryDownscale: true,
};

/**
 * Live camera frames. Same thoroughness as the defaults — `tryHarder` is what
 * makes zxing lay scanlines across the whole frame instead of a few rows in the
 * middle band, without which 1D codes (EAN, Code128, …) are only found when
 * they happen to sit dead centre. The scan loop consumes a single result, so
 * cap the symbol search to offset part of the extra work.
 */
export const CAMERA_READER_OPTIONS: ReaderOptions = {
  ...DEFAULT_READER_OPTIONS,
  maxNumberOfSymbols: 1,
};

/**
 * Reader options per decode request: live camera frames get the camera profile,
 * file/gallery bytes the general defaults. Lives here rather than at the call
 * site so the scan loop stays free of the zxing glue — it runs on the main
 * thread, where the reader is deliberately never loaded.
 */
export function readerOptionsFor(kind: "image" | "bytes"): ReaderOptions {
  return kind === "image" ? CAMERA_READER_OPTIONS : DEFAULT_READER_OPTIONS;
}

export async function readBarcodes(
  input: ImageData | Blob | ArrayBuffer | Uint8Array,
  options: ReaderOptions = DEFAULT_READER_OPTIONS,
): Promise<ReadResult[]> {
  ensureZXingModule();
  return zxingReadBarcodes(input, options);
}

export async function writeBarcode(text: string, options: WriterOptions): Promise<WriteResult> {
  ensureZXingModule();
  return zxingWriteBarcode(text, options);
}
