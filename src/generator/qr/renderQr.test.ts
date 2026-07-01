import { describe, expect, it } from "vitest";
import { readBarcodes } from "zxing-wasm/full";
import { qrMatrix } from "./matrix.ts";
import { type QrRenderStyle, rasterizeQr, renderQrSvg } from "./renderQr.ts";

async function decodeStyled(text: string, style: QrRenderStyle): Promise<string | undefined> {
  const matrix = qrMatrix(text, style.logo ? "H" : "M");
  const { data, width, height } = rasterizeQr(matrix, style, 10);
  const results = await readBarcodes({ data, width, height, colorSpace: "srgb" } as ImageData, {
    formats: ["QRCode"],
    tryHarder: true,
  });
  return results[0]?.text;
}

describe("styled QR rendering stays readable", () => {
  const text = "https://example.com/styled";

  it("plain square modules", async () => {
    expect(await decodeStyled(text, { moduleShape: "square" })).toBe(text);
  });

  it("dot modules", async () => {
    expect(await decodeStyled(text, { moduleShape: "dots" })).toBe(text);
  });

  it("rounded modules", async () => {
    expect(await decodeStyled(text, { moduleShape: "rounded" })).toBe(text);
  });

  it("custom foreground/background colours", async () => {
    expect(await decodeStyled(text, { fg: "#003344", bg: "#eefbff" })).toBe(text);
  });

  it("logo cut-out at ECC H", async () => {
    const style: QrRenderStyle = {
      moduleShape: "rounded",
      logo: { href: "data:image/png;base64,AAAA", sizeRatio: 0.18, padding: 1 },
    };
    expect(await decodeStyled(text, style)).toBe(text);
  });
});

describe("renderQrSvg output", () => {
  const matrix = qrMatrix("SVG-TEST", "M");

  it("produces a valid svg root with a viewBox", () => {
    const svg = renderQrSvg(matrix);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("viewBox=");
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
  });

  it("emits a gradient definition when requested", () => {
    const svg = renderQrSvg(matrix, {
      gradient: { type: "linear", from: "#0ff", to: "#06f", rotation: 45 },
    });
    expect(svg).toContain("<linearGradient");
    expect(svg).toContain("url(#qrgrad)");
  });

  it("wraps a CTA frame with the given text", () => {
    const svg = renderQrSvg(matrix, { frame: { text: "Scan me" } });
    expect(svg).toContain("Scan me");
    expect(svg).toContain("<text");
  });

  it("escapes XML-significant characters in frame text", () => {
    const svg = renderQrSvg(matrix, { frame: { text: "A & B <C>" } });
    expect(svg).toContain("A &amp; B &lt;C&gt;");
  });

  it("escapes hostile colour values instead of injecting markup", () => {
    const svg = renderQrSvg(matrix, {
      fg: `"><script>alert(1)</script>`,
      bg: `red" onload="x`,
      gradient: { type: "linear", from: `"><img src=x>`, to: "#000" },
      frame: { text: "ok", background: `"><foreignObject>` },
    });
    expect(svg).not.toContain("<script");
    expect(svg).not.toContain("<img");
    expect(svg).not.toContain("<foreignObject");
    expect(svg).not.toContain(`onload="x"`);
  });

  it("leaves no modules under the logo cut-out in the SVG", () => {
    const withLogo = renderQrSvg(matrix, {
      logo: { href: "data:image/png;base64,AAAA", sizeRatio: 0.2 },
    });
    const without = renderQrSvg(matrix, {});
    const countRects = (s: string) => (s.match(/<rect /g) ?? []).length;
    // Logo adds one rect (the cut-out) but removes several module rects.
    expect(countRects(withLogo)).toBeLessThan(countRects(without) + 1);
  });
});
