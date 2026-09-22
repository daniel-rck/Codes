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
  if (result.error) throw new Error(cleanWriterError(result.error));
  return { svg: result.svg, image: result.image };
}

/**
 * zint errors carry internal codes ("Error 275: … (retval: 7)") that mean
 * nothing to users — keep just the message.
 */
export function cleanWriterError(message: string): string {
  const cleaned = message
    .replace(/^Error \d+:\s*/, "")
    .replace(/\s*\(retval: -?\d+\)\s*$/, "")
    .trim();
  const checkDigit = /^Invalid check digit '(.+)', expecting '(.+)'$/.exec(cleaned);
  if (checkDigit) {
    return `Ungültige Prüfziffer „${checkDigit[1]}“ — erwartet wird „${checkDigit[2]}“.`;
  }
  return cleaned;
}

export type FormatInputHint = {
  hint: string;
  placeholder: string;
  numeric: boolean;
};

/** Input guidance per creatable format, shown under the content field. */
export const FORMAT_INPUT_HINTS: Partial<Record<CreatableBarcodeFormat, FormatInputHint>> = {
  Code128: { hint: "Beliebiger ASCII-Text.", placeholder: "ABC-12345", numeric: false },
  EAN13: {
    hint: "12 Ziffern (Prüfziffer wird berechnet) oder 13 Ziffern.",
    placeholder: "400638133393",
    numeric: true,
  },
  EAN8: {
    hint: "7 Ziffern (Prüfziffer wird berechnet) oder 8 Ziffern.",
    placeholder: "9638507",
    numeric: true,
  },
  UPCA: {
    hint: "11 Ziffern (Prüfziffer wird berechnet) oder 12 Ziffern.",
    placeholder: "03600029145",
    numeric: true,
  },
  Code39: {
    hint: "Buchstaben A–Z, Ziffern, Leerzeichen und - . $ / + %.",
    placeholder: "CODE-39",
    numeric: false,
  },
  ITF: { hint: "Nur Ziffern.", placeholder: "12345678", numeric: true },
  PDF417: { hint: "Beliebiger Text, auch lang.", placeholder: "Inhalt eingeben …", numeric: false },
  DataMatrix: { hint: "Beliebiger Text.", placeholder: "Inhalt eingeben …", numeric: false },
  Aztec: { hint: "Beliebiger Text.", placeholder: "Inhalt eingeben …", numeric: false },
};
