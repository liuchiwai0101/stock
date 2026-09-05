import { describe, expect, it } from "vitest";
import { evaluatePrediction } from "./evaluate-predictions";
import type { LoggedPrediction } from "./prediction-log";

const base: LoggedPrediction = {
  id: "2026-09-01:AAPL",
  date: "2026-09-01",
  symbol: "AAPL",
  name: "Apple",
  last: 100,
  targetPrice: 110,
  expectedReturn: 0.1,
  signal: "BUY",
  confidence: 0.7,
  modelLeans: { holt: 0.08, ou: -0.02 },
};

describe("evaluatePrediction", () => {
  it("marks a direction hit when price moves with the forecast", () => {
    const row = evaluatePrediction(base, 105, "2026-09-02T00:00:00.000Z");
    expect(row.evaluated?.directionHit).toBe(true);
    expect(row.evaluated?.modelHits.holt).toBe(true);
    expect(row.evaluated?.modelHits.ou).toBe(false);
  });

  it("marks a miss when price moves against the forecast", () => {
    const row = evaluatePrediction(base, 94, "2026-09-02T00:00:00.000Z");
    expect(row.evaluated?.directionHit).toBe(false);
  });
});
