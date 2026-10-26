import { describe, it, expect } from "vitest";
import { parseLabelConfig, DEFAULT_LABEL_CONFIG, storageText } from "./labels";

describe("label config", () => {
  it("fills defaults and ignores junk", () => {
    expect(parseLabelConfig(null)).toEqual(DEFAULT_LABEL_CONFIG);
    expect(parseLabelConfig({ showLogo: true, storageLine: "freeze", compact: "yes", footer: 42 })).toMatchObject({ showLogo: true, storageLine: "freeze", compact: false, footer: "" });
    expect(parseLabelConfig({ storageLine: "banana" }).storageLine).toBe("");
  });
  it("maps storage presets to label text", () => {
    expect(storageText("refrigerate")).toContain("refrigerated");
    expect(storageText("")).toBe("");
  });
});
