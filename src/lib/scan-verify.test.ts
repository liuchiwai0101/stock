import { describe, expect, it } from "vitest";
import { calendarDaysBetween, evaluateHorizon, evaluatePrediction } from "@/lib/evaluate-predictions";
import type { LoggedPrediction } from "@/lib/prediction-log";
import { scorePick, selectTopPicks } from "@/lib/pick-score";
import { comparePickLists } from "@/lib/suggestion-compare";
import type { DailyPick } from "@/lib/pick-score";
import type { ScanMeta } from "@/lib/scan-history";
import { universeSymbols } from "@/lib/universe";
import type { CompanyForecast } from "@/lib/types";

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
  horizon: 5,
  modelLeans: { holt: 0.08, ou: -0.02 },
};

function pick(partial: Partial<DailyPick> & Pick<DailyPick, "symbol" | "rank">): DailyPick {
  return {
    name: partial.symbol,
    last: 100,
    targetPrice: 110,
    expectedReturn: 0.1,
    confidence: 0.6,
    hitRate: 0.55,
    sharpe: 0.4,
    pickScore: 0.5,
    modelBuyVotes: 6,
    modelCount: 10,
    recommendedWeight: 0.1,
    signal: "BUY",
    liveReady: true,
    horizon: 21,
    modelLeans: {},
    ...partial,
  };
}

const meta = (buyCount: number): ScanMeta => ({
  scanned: 100,
  total: 100,
  passed: 20,
  buyCount,
});

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

describe("evaluateHorizon", () => {
  it("records target error after the forecast horizon", () => {
    const row = evaluateHorizon(base, 108, "2026-09-09T00:00:00.000Z");
    expect(row.horizonEvaluated?.directionHit).toBe(true);
    expect(row.horizonEvaluated?.targetError).toBeCloseTo(0.02, 6);
    expect(row.horizonEvaluated?.towardTarget).toBe(true);
  });

  it("marks a horizon miss when price moved the other way", () => {
    const row = evaluateHorizon(base, 90, "2026-09-09T00:00:00.000Z");
    expect(row.horizonEvaluated?.directionHit).toBe(false);
    expect(row.horizonEvaluated?.targetError).toBeCloseTo(0.2, 6);
  });
});

describe("calendarDaysBetween", () => {
  it("counts whole days between as-of dates", () => {
    expect(calendarDaysBetween("2026-09-01", "2026-09-06")).toBe(5);
  });
});

describe("suggestion compare", () => {
  it("labels new, kept, and dropped names between scans", () => {
    const previous = [pick({ symbol: "AAPL", rank: 1 }), pick({ symbol: "MSFT", rank: 2, expectedReturn: 0.04 })];
    const current = [pick({ symbol: "NVDA", rank: 1 }), pick({ symbol: "AAPL", rank: 2, expectedReturn: 0.12 })];
    const cmp = comparePickLists(previous, current, "2026-09-01", "2026-09-08", meta(2), meta(2));
    expect(cmp.newCount).toBe(1);
    expect(cmp.keptCount).toBe(1);
    expect(cmp.droppedCount).toBe(1);
    expect(cmp.rows.find((r) => r.symbol === "NVDA")?.status).toBe("new");
    expect(cmp.rows.find((r) => r.symbol === "AAPL")?.status).toBe("kept");
    expect(cmp.rows.find((r) => r.symbol === "MSFT")?.status).toBe("dropped");
  });
});

describe("US scan universe", () => {
  it("tracks a confirmed liquid U.S. list for buy scans", () => {
    expect(universeSymbols()).toHaveLength(100);
    expect(universeSymbols()[0]).toBe("AAPL");
  });
});

describe("pick score", () => {
  it("ranks live BUY names and ignores fails", () => {
    const buy = {
      symbol: "AAPL",
      name: "Apple",
      liveReady: true,
      signal: "BUY",
      last: 100,
      targetPrice: 110,
      expectedReturn: 0.08,
      confidence: 0.7,
      recommendedWeight: 0.1,
      metrics: { hitRate: 0.6, rmse: 1, mape: 1, residualVol: 0.1 },
      backtest: { sharpe: 1.2, horizon: 21 },
      models: [
        { id: "holt", expectedReturn: 0.04, hitRate: 0.55 },
        { id: "ou", expectedReturn: -0.01, hitRate: 0.5 },
      ],
      history: [],
    } as unknown as CompanyForecast;
    const fail = { ...buy, symbol: "MSFT", liveReady: false, signal: "HOLD" } as CompanyForecast;
    expect(scorePick(buy)).toBeGreaterThan(scorePick(fail));
    expect(selectTopPicks([fail, buy], 10)).toHaveLength(1);
    expect(selectTopPicks([fail, buy], 10)[0].symbol).toBe("AAPL");
  });
});
