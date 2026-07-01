/**
 * Vitest setup. In the browser the wasm is fetched from our own origin via a
 * Vite `?url` asset; under Node there is no fetch target, so we hand the
 * Emscripten loader the wasm bytes directly from `node_modules`.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { prepareZXingModule } from "zxing-wasm/full";

const require = createRequire(import.meta.url);
const wasmBinary = readFileSync(require.resolve("zxing-wasm/full/zxing_full.wasm"));

prepareZXingModule({
  overrides: { wasmBinary: wasmBinary.buffer as ArrayBuffer },
  fireImmediately: false,
});
