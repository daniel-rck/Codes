/**
 * Non-QR barcode generation via zxing `writeBarcode` (zint backend). QR codes
 * are produced by our own encoder/renderer (see `src/generator/qr/`); every
 * other format — EAN, Code128, PDF417, DataMatrix, Aztec, … — goes through here.
 */
import {
  type CreatableBarcodeFormat,
  formatToLabel,
  type WriterOptions,
  writeBarcode,
} from "../../shared/zxing.ts";

export type { CreatableBarcodeFormat };

export function formatLabel(format: CreatableBarcodeFormat): string {
  return formatToLabel(format) ?? format;
}

export type WriteOtherResult = {
  svg: string;
  image: Blob | null;
};

export type WriteOtherOptions = Omit<WriterOptions, "format">;

/**
 * Encode `content` as the given non-QR format. Returns both an SVG string
 * (crisp, scalable) and a raster Blob for download/preview.
 */
export async function writeOther(
  format: CreatableBarcodeFormat,
  content: string,
  options: WriteOtherOptions = {},
): Promise<WriteOtherResult> {
  const result = await writeBarcode(content, { format, ...options });
  if (result.error) throw new Error(result.error);
  return { svg: result.svg, image: result.image };
}
