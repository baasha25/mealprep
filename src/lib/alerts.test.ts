import { describe, it, expect } from "vitest";
import { sortAlerts, alertSummary, urgentCount } from "./alerts";

describe("alert hierarchy", () => {
  const list = [
    { key: "reviews", level: "info" as const },
    { key: "thin", level: "watch" as const },
    { key: "losing", level: "urgent" as const },
    { key: "rises", level: "watch" as const },
  ];
  it("sorts urgent → watch → info, stable within a level", () => {
    expect(sortAlerts(list).map((a) => a.key)).toEqual(["losing", "thin", "rises", "reviews"]);
  });
  it("summarises counts by level and says All clear when empty", () => {
    expect(alertSummary(list)).toBe("1 urgent · 2 to watch · 1 to review");
    expect(alertSummary([])).toBe("All clear");
    expect(urgentCount(list)).toBe(1);
  });
});
