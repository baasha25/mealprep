import { describe, it, expect } from "vitest";
import { parseCsv, parseCsvRecords, splitList } from "./csv";

describe("parseCsv", () => {
  it("parses a simple grid", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with commas", () => {
    expect(parseCsv('name,note\n"Bowl, large","tasty"')).toEqual([
      ["name", "note"],
      ["Bowl, large", "tasty"],
    ]);
  });

  it("handles escaped quotes and newlines inside quotes", () => {
    const csv = 'a,b\n"line1\nline2","say ""hi"""';
    expect(parseCsv(csv)).toEqual([
      ["a", "b"],
      ["line1\nline2", 'say "hi"'],
    ]);
  });

  it("normalizes CRLF and drops empty lines", () => {
    expect(parseCsv("a,b\r\n1,2\r\n\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("parseCsvRecords", () => {
  it("keys rows by normalized header", () => {
    const recs = parseCsvRecords("Name, Price\nChicken Bowl, 12.50");
    expect(recs).toEqual([{ name: "Chicken Bowl", price: "12.50" }]);
  });

  it("returns [] when only a header is present", () => {
    expect(parseCsvRecords("name,price")).toEqual([]);
  });

  it("fills missing trailing columns with empty strings", () => {
    const recs = parseCsvRecords("name,price,diet\nSalad,9");
    expect(recs[0]).toEqual({ name: "Salad", price: "9", diet: "" });
  });
});

describe("splitList", () => {
  it("splits on ; , |, trims, lowercases", () => {
    expect(splitList("Fish; Dairy| nuts")).toEqual(["fish", "dairy", "nuts"]);
  });
  it("empty in, empty out", () => {
    expect(splitList("")).toEqual([]);
    expect(splitList(undefined)).toEqual([]);
  });
});
