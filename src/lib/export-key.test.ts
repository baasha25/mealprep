import { describe, it, expect } from "vitest";
import { newExportKey, looksLikeExportKey, maskExportKey, importDataFormula } from "./export-key";

describe("export keys", () => {
  it("generates keys that validate, and rejects junk", () => {
    const k = newExportKey();
    expect(looksLikeExportKey(k)).toBe(true);
    expect(looksLikeExportKey("pfx_short")).toBe(false);
    expect(looksLikeExportKey("abc")).toBe(false);
    expect(looksLikeExportKey(null)).toBe(false);
  });
  it("masks and builds the Sheets formula", () => {
    expect(maskExportKey("pfx_abcdefghijklmnopqrstuvwxyz")).toBe("pfx_abc…xyz");
    expect(importDataFormula("https://x/y?key=k")).toBe('=IMPORTDATA("https://x/y?key=k")');
  });
});
