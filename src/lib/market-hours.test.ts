import { describe, expect, it } from "vitest";
import { addCalendarDays, businessDaysBetween } from "./market-hours";

describe("businessDaysBetween", () => {
  it("counts weekdays after the start date through the end date", () => {
    expect(businessDaysBetween("2026-09-01", "2026-09-01")).toBe(0);
    expect(businessDaysBetween("2026-09-01", "2026-09-02")).toBe(1);
    expect(businessDaysBetween("2026-09-04", "2026-09-07")).toBe(1);
    expect(businessDaysBetween("2026-09-01", "2026-09-08")).toBe(5);
  });

  it("aligns a 5-day horizon with the next week of sessions", () => {
    const start = "2026-09-01";
    expect(businessDaysBetween(start, addCalendarDays(start, 7))).toBe(5);
  });
});
