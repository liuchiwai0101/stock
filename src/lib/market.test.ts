import { describe, expect, it } from "vitest";
import { isLiveQuoteSeries, type QuoteSeries } from "./market";
import { canonicalizeTicker } from "./ticker";

describe("canonicalizeTicker", () => {
  it("pads HK and A-share numeric codes", () => {
    expect(canonicalizeTicker("100.HK")).toBe("0100.HK");
    expect(canonicalizeTicker("00100.hk")).toBe("0100.HK");
    expect(canonicalizeTicker("0100.HK")).toBe("0100.HK");
    expect(canonicalizeTicker("1810.HK")).toBe("1810.HK");
    expect(canonicalizeTicker("858.SZ")).toBe("000858.SZ");
    expect(canonicalizeTicker("SKHY")).toBe("SKHY");
    expect(canonicalizeTicker("BRK.B")).toBe("BRK.B");
  });
});

describe("isLiveQuoteSeries", () => {
  const bars = Array.from({ length: 60 }, (_, i) => ({
    date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
    close: 100 + i,
    open: 100,
    high: 101,
    low: 99,
    volume: 1,
  }));

  function series(over: Partial<QuoteSeries>): QuoteSeries {
    return {
      symbol: "SKHY",
      name: "SKHY",
      currency: "USD",
      source: "yahoo",
      bars,
      ...over,
    };
  }

  it("accepts Yahoo/Stooq history and rejects simulated Pages snapshots", () => {
    expect(isLiveQuoteSeries(series({ source: "yahoo" }))).toBe(true);
    expect(isLiveQuoteSeries(series({ source: "stooq" }))).toBe(true);
    expect(isLiveQuoteSeries(series({ source: "simulated" }))).toBe(false);
    expect(isLiveQuoteSeries(series({ bars: bars.slice(0, 10) }))).toBe(false);
    expect(isLiveQuoteSeries(series({ source: "yahoo", bars: bars.slice(0, 42) }))).toBe(true);
    expect(isLiveQuoteSeries(null)).toBe(false);
  });
});
