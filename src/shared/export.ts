/**
 * Export helpers: SVG string, PNG blob and a minimal single-image PDF. All
 * client-side. PNG/PDF rasterise an SVG via an offscreen canvas; the PDF is
 * hand-built (no dependency) embedding the raster with FlateDecode, which
 * `CompressionStream` produces natively.
 */

export type RasterOptions = {
  /** Output edge length in pixels (square). */
  size?: number;
  /** Background fill; "transparent" keeps PNG alpha (PDF flattens to white). */
  background?: string;
};

const DEFAULT_SIZE = 1024;

export function toSVGString(svg: string): string {
  return svg.trimStart().startsWith("<?xml")
    ? svg
    : `<?xml version="1.0" encoding="UTF-8"?>\n${svg}`;
}

function svgToImage(svg: string): Promise<HTMLImageElement> {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG konnte nicht gerendert werden."));
    };
    img.src = url;
  });
}

async function rasterToCanvas(svg: string, options: RasterOptions): Promise<HTMLCanvasElement> {
  const size = options.size ?? DEFAULT_SIZE;
  const img = await svgToImage(svg);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas-Kontext nicht verfügbar.");
  if (options.background && options.background !== "transparent") {
    ctx.fillStyle = options.background;
    ctx.fillRect(0, 0, size, size);
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, size, size);
  return canvas;
}

export async function toPNGBlob(svg: string, options: RasterOptions = {}): Promise<Blob> {
  const canvas = await rasterToCanvas(svg, options);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNG-Export fehlgeschlagen."));
    }, "image/png");
  });
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

/** Build a single-page PDF embedding the SVG rasterised to RGB. */
export async function toPDFBlob(svg: string, options: RasterOptions = {}): Promise<Blob> {
  const size = options.size ?? DEFAULT_SIZE;
  const canvas = await rasterToCanvas(svg, {
    ...options,
    background: options.background ?? "#ffffff",
  });
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas-Kontext nicht verfügbar.");
  const { data } = ctx.getImageData(0, 0, size, size);

  // Drop alpha → packed RGB samples, then zlib-compress for FlateDecode.
  const rgb = new Uint8Array(size * size * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    rgb[j] = data[i] as number;
    rgb[j + 1] = data[i + 1] as number;
    rgb[j + 2] = data[i + 2] as number;
  }
  const compressed = await deflate(rgb);

  // Page is 8.27in (A4 width-ish) square at 72pt/in; image fills it.
  const pagePt = 420;
  const enc = new TextEncoder();
  const objects: (string | Uint8Array)[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objects.push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pagePt} ${pagePt}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  );
  const imgHeader = enc.encode(
    `<< /Type /XObject /Subtype /Image /Width ${size} /Height ${size} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${compressed.length} >>\nstream\n`,
  );
  const imgStream = new Uint8Array(imgHeader.length + compressed.length + "\nendstream".length);
  imgStream.set(imgHeader, 0);
  imgStream.set(compressed, imgHeader.length);
  imgStream.set(enc.encode("\nendstream"), imgHeader.length + compressed.length);
  objects.push(imgStream);
  const content = `q ${pagePt} 0 0 ${pagePt} 0 0 cm /Im0 Do Q`;
  objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);

  // Serialise with a cross-reference table.
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = 0;
  const pushStr = (s: string) => {
    const b = enc.encode(s);
    chunks.push(b);
    pos += b.length;
  };
  const pushBytes = (b: Uint8Array) => {
    chunks.push(b);
    pos += b.length;
  };

  pushStr("%PDF-1.4\n");
  objects.forEach((obj, i) => {
    offsets[i] = pos;
    pushStr(`${i + 1} 0 obj\n`);
    if (typeof obj === "string") pushStr(obj);
    else pushBytes(obj);
    pushStr("\nendobj\n");
  });

  const xrefPos = pos;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += `${off.toString().padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  pushStr(xref);

  return new Blob(chunks as BlobPart[], { type: "application/pdf" });
}

/** Trigger a browser download for a blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Print guidance shown in the export UI. */
export const PRINT_HINTS = [
  "Mindestgröße: ca. 2 × 2 cm; je mehr Daten, desto größer drucken.",
  "Hoher Kontrast: dunkle Module auf hellem Grund, keine invertierten Farben.",
  "Ruhezone (Rand) nicht abschneiden — mindestens 4 Module ringsum.",
] as const;
