import { describe, expect, it } from "vitest";
import { toHref } from "./links.ts";

describe("toHref", () => {
  it("passes through openable schemes", () => {
    expect(toHref("https://example.com")).toBe("https://example.com");
    expect(toHref("MAILTO:a@b.de")).toBe("MAILTO:a@b.de");
    expect(toHref("tel:+491234")).toBe("tel:+491234");
  });
  it("makes bare www hosts absolute", () => {
    expect(toHref("www.example.com")).toBe("https://www.example.com");
  });
  it("ignores plain text and unsafe schemes", () => {
    expect(toHref("hello world")).toBeNull();
    expect(toHref("javascript:alert(1)")).toBeNull();
    expect(toHref("WIFI:S:net;;")).toBeNull();
  });
});
