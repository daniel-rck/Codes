/**
 * Render a QR module matrix to a styled SVG string and to a raw RGBA raster.
 *
 * The SVG path is the rich, user-facing output: solid colours or gradients,
 * per-module shapes, distinct finder ("eye") styling, a centred logo with a
 * quiet cut-out, and an optional CTA frame. The raster path is a DOM-free
 * rasteriser used for PNG export and for decodability tests.
 */
import type { QrMatrix } from "./matrix.ts";

export type ModuleShape = "square" | "dots" | "rounded";
export type EyeShape = "square" | "rounded" | "circle";

export type QrGradient = {
  type: "linear" | "radial";
  from: string;
  to: string;
  /** Rotation in degrees for linear gradients. */
  rotation?: number;
};

export type QrLogo = {
  /** Image source — a data: URI keeps the SVG self-contained. */
  href: string;
  /** Logo edge length as a fraction of the QR width (0–1). */
  sizeRatio?: number;
  /** Padding around the logo, in modules. */
  padding?: number;
  /** Background behind the logo (the cut-out fill). */
  background?: string;
};

export type QrFrame = {
  text: string;
  background?: string;
  textColor?: string;
};

export type QrRenderStyle = {
  /** Quiet zone in modules (spec minimum is 4). */
  margin?: number;
  /** Foreground module colour (ignored when a gradient is set). */
  fg?: string;
  /** Background colour, or "transparent". */
  bg?: string;
  moduleShape?: ModuleShape;
  eyeShape?: EyeShape;
  /** Distinct colour for the three finder patterns (defaults to `fg`). */
  eyeColor?: string;
  gradient?: QrGradient;
  logo?: QrLogo;
  frame?: QrFrame;
};

const DEFAULTS = {
  margin: 4,
  fg: "#0a0a0a",
  bg: "#ffffff",
  moduleShape: "square" as ModuleShape,
  eyeShape: "square" as EyeShape,
};

const FINDER_SIZE = 7;

/** True when (x, y) lies inside one of the three 7×7 finder patterns. */
function isEyeModule(x: number, y: number, size: number): boolean {
  const inTopLeft = x < FINDER_SIZE && y < FINDER_SIZE;
  const inTopRight = x >= size - FINDER_SIZE && y < FINDER_SIZE;
  const inBottomLeft = x < FINDER_SIZE && y >= size - FINDER_SIZE;
  return inTopLeft || inTopRight || inBottomLeft;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function moduleSvg(x: number, y: number, shape: ModuleShape, fill: string): string {
  switch (shape) {
    case "dots":
      return `<circle cx="${x + 0.5}" cy="${y + 0.5}" r="0.45" fill="${fill}"/>`;
    case "rounded":
      return `<rect x="${x + 0.05}" y="${y + 0.05}" width="0.9" height="0.9" rx="0.35" fill="${fill}"/>`;
    default:
      return `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${fill}"/>`;
  }
}

/** Render one finder pattern (outer 7×7 frame + inner 3×3) at module (ox, oy). */
function eyeSvg(ox: number, oy: number, shape: EyeShape, fill: string): string {
  if (shape === "circle") {
    return [
      `<circle cx="${ox + 3.5}" cy="${oy + 3.5}" r="3.5" fill="${fill}"/>`,
      `<circle cx="${ox + 3.5}" cy="${oy + 3.5}" r="2.5" fill="#ffffff"/>`,
      `<circle cx="${ox + 3.5}" cy="${oy + 3.5}" r="1.5" fill="${fill}"/>`,
    ].join("");
  }
  const rx = shape === "rounded" ? 1.75 : 0;
  const rxInner = shape === "rounded" ? 0.75 : 0;
  return [
    `<rect x="${ox}" y="${oy}" width="7" height="7" rx="${rx}" fill="${fill}"/>`,
    `<rect x="${ox + 1}" y="${oy + 1}" width="5" height="5" rx="${rxInner}" fill="#ffffff"/>`,
    `<rect x="${ox + 2}" y="${oy + 2}" width="3" height="3" rx="${rxInner / 2}" fill="${fill}"/>`,
  ].join("");
}

function gradientDef(gradient: QrGradient): { def: string; ref: string } {
  const id = "qrgrad";
  const from = escapeXml(gradient.from);
  const to = escapeXml(gradient.to);
  if (gradient.type === "radial") {
    return {
      ref: `url(#${id})`,
      def: `<radialGradient id="${id}"><stop offset="0%" stop-color="${from}"/><stop offset="100%" stop-color="${to}"/></radialGradient>`,
    };
  }
  const angle = gradient.rotation ?? 0;
  const rad = (angle * Math.PI) / 180;
  const x2 = (50 + 50 * Math.cos(rad)).toFixed(2);
  const y2 = (50 + 50 * Math.sin(rad)).toFixed(2);
  const x1 = (50 - 50 * Math.cos(rad)).toFixed(2);
  const y1 = (50 - 50 * Math.sin(rad)).toFixed(2);
  return {
    ref: `url(#${id})`,
    def: `<linearGradient id="${id}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%"><stop offset="0%" stop-color="${from}"/><stop offset="100%" stop-color="${to}"/></linearGradient>`,
  };
}

/** Centre cut-out square for a logo, in module coordinates (lo..hi). */
function logoBox(size: number, logo: QrLogo): { lo: number; hi: number } {
  const ratio = Math.min(0.3, Math.max(0.05, logo.sizeRatio ?? 0.2));
  const boxSize = size * ratio + (logo.padding ?? 1) * 2;
  const lo = (size - boxSize) / 2;
  return { lo, hi: lo + boxSize };
}

/** Build a styled SVG string for the given matrix. */
export function renderQrSvg(matrix: QrMatrix, style: QrRenderStyle = {}): string {
  const margin = style.margin ?? DEFAULTS.margin;
  // The SVG is injected via innerHTML downstream — escape every interpolated
  // style string exactly once here, at read time.
  const fg = escapeXml(style.fg ?? DEFAULTS.fg);
  const bg = escapeXml(style.bg ?? DEFAULTS.bg);
  const moduleShape = style.moduleShape ?? DEFAULTS.moduleShape;
  const eyeShape = style.eyeShape ?? DEFAULTS.eyeShape;
  const size = matrix.size;
  const dim = size + margin * 2;

  const grad = style.gradient ? gradientDef(style.gradient) : null;
  const moduleFill = grad ? grad.ref : fg;
  const eyeFill = style.eyeColor ? escapeXml(style.eyeColor) : grad ? grad.ref : fg;

  const parts: string[] = [];
  const defs: string[] = [];
  if (grad) defs.push(grad.def);

  // Background.
  if (bg !== "transparent") {
    parts.push(`<rect width="${dim}" height="${dim}" fill="${bg}"/>`);
  }

  // Translate into the quiet-zone-padded coordinate space.
  parts.push(`<g transform="translate(${margin} ${margin})">`);

  // Data + timing/alignment modules (eyes drawn separately for clean styling).
  // Modules under the logo cut-out are skipped so the area stays quiet even
  // with a transparent logo background (parity with the rasteriser).
  const cut = style.logo ? logoBox(size, style.logo) : null;
  const cells: string[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!(matrix.modules[y] as boolean[])[x]) continue;
      if (isEyeModule(x, y, size)) continue;
      if (cut && x + 0.5 > cut.lo && x + 0.5 < cut.hi && y + 0.5 > cut.lo && y + 0.5 < cut.hi) {
        continue;
      }
      cells.push(moduleSvg(x, y, moduleShape, moduleFill));
    }
  }
  parts.push(cells.join(""));

  // Finder patterns.
  parts.push(eyeSvg(0, 0, eyeShape, eyeFill));
  parts.push(eyeSvg(size - FINDER_SIZE, 0, eyeShape, eyeFill));
  parts.push(eyeSvg(0, size - FINDER_SIZE, eyeShape, eyeFill));

  // Centred logo with a quiet cut-out.
  if (style.logo && cut) {
    const ratio = Math.min(0.3, Math.max(0.05, style.logo.sizeRatio ?? 0.2));
    const logoSize = size * ratio;
    const boxSize = cut.hi - cut.lo;
    const logoPos = (size - logoSize) / 2;
    const logoBg = escapeXml(style.logo.background ?? "#ffffff");
    parts.push(
      `<rect x="${cut.lo}" y="${cut.lo}" width="${boxSize}" height="${boxSize}" rx="${boxSize * 0.15}" fill="${logoBg}"/>`,
    );
    parts.push(
      `<image x="${logoPos}" y="${logoPos}" width="${logoSize}" height="${logoSize}" href="${escapeXml(style.logo.href)}" preserveAspectRatio="xMidYMid meet"/>`,
    );
  }

  parts.push("</g>");

  const body = `${defs.length ? `<defs>${defs.join("")}</defs>` : ""}${parts.join("")}`;

  // Optional CTA frame: enlarge the canvas and add a bottom label bar.
  if (style.frame) {
    const frameBg = style.frame.background ? escapeXml(style.frame.background) : fg;
    const frameText = style.frame.textColor ? escapeXml(style.frame.textColor) : "#ffffff";
    const border = dim * 0.06;
    const barHeight = dim * 0.16;
    const outerW = dim + border * 2;
    const outerH = dim + border * 2 + barHeight;
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${outerW} ${outerH}" shape-rendering="crispEdges">`,
      `<rect width="${outerW}" height="${outerH}" rx="${border}" fill="${frameBg}"/>`,
      `<rect x="${border}" y="${border}" width="${dim}" height="${dim}" fill="${bg === "transparent" ? "#ffffff" : bg}"/>`,
      `<g transform="translate(${border} ${border})">${body}</g>`,
      `<text x="${outerW / 2}" y="${dim + border + barHeight * 0.62}" fill="${frameText}" font-family="sans-serif" font-size="${barHeight * 0.5}" font-weight="700" text-anchor="middle">${escapeXml(style.frame.text)}</text>`,
      `</svg>`,
    ].join("");
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges">${body}</svg>`;
}

export type RasterImage = { data: Uint8ClampedArray; width: number; height: number };

function hexToRgb(color: string): [number, number, number] {
  const c = color.replace("#", "");
  const full =
    c.length === 3
      ? c
          .split("")
          .map((d) => d + d)
          .join("")
      : c;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/**
 * DOM-free rasteriser honouring colours, module shape and an optional logo
 * cut-out. Gradients are flattened to the `from` colour. Used by the
 * decodability tests (PNG export goes through the SVG → canvas path in
 * `shared/export.ts`).
 */
export function rasterizeQr(matrix: QrMatrix, style: QrRenderStyle = {}, scale = 8): RasterImage {
  const margin = style.margin ?? DEFAULTS.margin;
  const moduleShape = style.moduleShape ?? DEFAULTS.moduleShape;
  const size = matrix.size;
  const dim = size + margin * 2;
  const px = dim * scale;
  const [fr, fg2, fb] = hexToRgb(style.gradient?.from ?? style.fg ?? DEFAULTS.fg);
  const bgTransparent = style.bg === "transparent";
  const [br, bg2, bb] = hexToRgb(bgTransparent ? "#ffffff" : (style.bg ?? DEFAULTS.bg));
  const data = new Uint8ClampedArray(px * px * 4);

  // Fill background.
  for (let i = 0; i < px * px; i++) {
    data[i * 4] = br;
    data[i * 4 + 1] = bg2;
    data[i * 4 + 2] = bb;
    data[i * 4 + 3] = 255;
  }

  const logoBox = (() => {
    if (!style.logo) return null;
    const ratio = Math.min(0.3, Math.max(0.05, style.logo.sizeRatio ?? 0.2));
    const logoSize = size * ratio;
    const pad = style.logo.padding ?? 1;
    const boxSize = logoSize + pad * 2;
    const boxPos = (size - boxSize) / 2 + margin;
    return { lo: boxPos, hi: boxPos + boxSize };
  })();

  const plot = (cx: number, cy: number, dark: boolean) => {
    const [r, g, b] = dark ? [fr, fg2, fb] : [br, bg2, bb];
    const i = (cy * px + cx) * 4;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!(matrix.modules[y] as boolean[])[x]) continue;
      const gx = x + margin;
      const gy = y + margin;
      // Skip modules under the logo cut-out.
      if (
        logoBox &&
        gx + 0.5 > logoBox.lo &&
        gx + 0.5 < logoBox.hi &&
        gy + 0.5 > logoBox.lo &&
        gy + 0.5 < logoBox.hi
      ) {
        continue;
      }
      const isEye = isEyeModule(x, y, size);
      const shape = isEye ? "square" : moduleShape;
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          let dark = true;
          if (shape !== "square") {
            const fx = (sx + 0.5) / scale - 0.5;
            const fy = (sy + 0.5) / scale - 0.5;
            dark = fx * fx + fy * fy <= 0.25; // inscribed circle for dots/rounded
          }
          if (dark) plot(gx * scale + sx, gy * scale + sy, true);
        }
      }
    }
  }

  return { data, width: px, height: px };
}
