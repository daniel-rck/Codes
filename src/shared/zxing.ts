/**
 * Central zxing-wasm setup. The single domain dependency of this app — it both
 * reads (`readBarcodes`) and writes (`writeBarcode`) every supported format.
 *
 * The `.wasm` binary is bundled as a local Vite asset and served from our own
 * origin (no CDN fetch) so the service worker can precache it for offline use.
 */
import {
  CREATABLE_BARCODE_FORMATS,
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
export { CREATABLE_BARCODE_FORMATS, formatToLabel };

let prepared = false;

/**
 * Point the Emscripten loader at our locally-hosted `.wasm` instead of the
 * default jsDelivr CDN. Idempotent; safe to call before every read/write.
 */
export function ensureZXingModule(): void {
  if (prepared) return;
  prepared = true;
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) =>
        path.endsWith(".wasm") ? wasmUrl : prefix + path,
    },
    fireImmediately: false,
  });
}

/** Sensible defaults for decoding: be thorough, search every format. */
export const DEFAULT_READER_OPTIONS: ReaderOptions = {
  formats: [],
  tryHarder: true,
  tryRotate: true,
  tryInvert: true,
  tryDownscale: true,
};

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
