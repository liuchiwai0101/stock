import { describe, expect, it } from "vitest";
import type { LoggedPrediction } from "./prediction-log";
import { unreliableSymbols } from "./stock-reliability";

function row(symbol: string, date: string, hit: boolean): LoggedPrediction {
  return {
    id: `${date}:${symbol}`,
    date,
    symbol,
    name: symbol,
    last: 100,
    targetPrice: 110,
    expectedReturn: 0.1,
    signal: "BUY",
    confidence: 0.6,
    horizon: 5,
    volRegime: "calm",
    modelLeans: {},
    evaluated: {
      at: `${date}T00:00:00.000Z`,
      mark: hit ? 105 : 95,
      actualReturn: hit ? 0.05 : -0.05,
      directionHit: hit,
      towardTarget: hit,
      modelHits: {},
    },
  };
}

describe("unreliableSymbols", () => {
  it("drops a ticker whose last 5 scored calls were all misses", () => {
    const rows = [
      row("BAD", "2026-09-01", false),
      row("BAD", "2026-09-02", false),
      row("BAD", "2026-09-03", false),
      row("BAD", "2026-09-04", false),
      row("BAD", "2026-09-05", false),
      row("OK", "2026-09-01", false),
      row("OK", "2026-09-02", false),
      row("OK", "2026-09-03", false),
      row("OK", "2026-09-04", false),
      row("OK", "2026-09-05", true),
    ];
    const blocked = unreliableSymbols(rows);
    expect(blocked.has("BAD")).toBe(true);
    expect(blocked.has("OK")).toBe(false);
  });

  it("waits until five scored calls before blocking", () => {
    const rows = [
      row("NEW", "2026-09-01", false),
      row("NEW", "2026-09-02", false),
      row("NEW", "2026-09-03", false),
      row("NEW", "2026-09-04", false),
    ];
    expect(unreliableSymbols(rows).has("NEW")).toBe(false);
  });
});
