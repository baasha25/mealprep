import { describe, it, expect } from "vitest";
import {
  sourceFromReferrer,
  deriveAttribution,
  parseAttributionCookie,
  sourceLabel,
} from "./attribution";

describe("sourceFromReferrer", () => {
  it("maps known hosts", () => {
    expect(sourceFromReferrer("https://www.google.com/")).toBe("google");
    expect(sourceFromReferrer("https://l.instagram.com/")).toBe("instagram");
    expect(sourceFromReferrer("https://t.co/abc")).toBe("twitter");
    expect(sourceFromReferrer("https://www.producthunt.com/posts/x")).toBe("producthunt");
  });
  it("falls back to the bare host", () => {
    expect(sourceFromReferrer("https://news.ycombinator.com/item")).toBe("news.ycombinator.com");
    expect(sourceFromReferrer("https://www.somekitchenblog.com/")).toBe("somekitchenblog.com");
  });
  it("empty / invalid → direct", () => {
    expect(sourceFromReferrer("")).toBe("direct");
    expect(sourceFromReferrer("not a url")).toBe("direct");
  });
});

describe("deriveAttribution", () => {
  it("prefers UTM params over the referrer", () => {
    const a = deriveAttribution(
      new URLSearchParams("utm_source=newsletter&utm_medium=email&utm_campaign=launch"),
      "https://www.google.com/",
    );
    expect(a).toEqual({ source: "newsletter", medium: "email", campaign: "launch", referrer: "https://www.google.com/" });
  });
  it("derives source + medium from the referrer when no UTM", () => {
    const a = deriveAttribution(new URLSearchParams(""), "https://www.instagram.com/");
    expect(a.source).toBe("instagram");
    expect(a.medium).toBe("social");
  });
  it("organic medium for search engines", () => {
    expect(deriveAttribution(new URLSearchParams(""), "https://www.google.com/").medium).toBe("organic");
  });
  it("no referrer, no UTM → direct/direct", () => {
    const a = deriveAttribution(new URLSearchParams(""), "");
    expect(a).toEqual({ source: "direct", medium: "direct", campaign: "", referrer: "" });
  });
});

describe("parseAttributionCookie", () => {
  it("round-trips a JSON cookie value", () => {
    const v = encodeURIComponent(JSON.stringify({ source: "instagram", medium: "social", campaign: "reel1", referrer: "https://ig" }));
    expect(parseAttributionCookie(v)).toEqual({ source: "instagram", medium: "social", campaign: "reel1", referrer: "https://ig" });
  });
  it("null / garbage → null", () => {
    expect(parseAttributionCookie(null)).toBeNull();
    expect(parseAttributionCookie("{not json")).toBeNull();
  });
});

describe("sourceLabel", () => {
  it("title-cases with a Direct fallback", () => {
    expect(sourceLabel("instagram")).toBe("Instagram");
    expect(sourceLabel(null)).toBe("Direct");
    expect(sourceLabel("")).toBe("Direct");
  });
});
