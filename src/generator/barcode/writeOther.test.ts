import { describe, expect, it } from "vitest";
import { cleanWriterError } from "./writeOther.ts";

describe("cleanWriterError", () => {
  it("strips zint error codes and return values", () => {
    expect(cleanWriterError("Error 123: Input too long (retval: 5)")).toBe("Input too long");
  });
  it("translates check-digit errors", () => {
    expect(cleanWriterError("Error 275: Invalid check digit '2', expecting '1' (retval: 7)")).toBe(
      "Ungültige Prüfziffer „2“ — erwartet wird „1“.",
    );
  });
});
