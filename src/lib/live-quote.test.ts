import { describe, expect, it } from "vitest";
import { applyLiveQuote } from "./live-quote";
import type { CompanyForecast } from "./types";

function stub(over: Partial<CompanyForecast> = {}): CompanyForecast {
  return {
    symbol: "SKHY",
    name: "SK Hynix",
    currency: "USD",
    last: 100,
    changePct: -0.01,
    source: "yahoo",
    history: [
      { date: "2026-09-08", close: 100, open: 100, high: 101, low: 99, volume: 1 },
    ],
    forecast: [],
    targetPrice: 110,
    expectedReturn: 0.1,
    annualizedReturn: 0.1,
    signal: "BUY",
    rawSignal: "BUY",
    confidence: 0.5,
    recommendedWeight: 0.1,
    liveReady: true,
    metrics: { rmse: 0, mape: 0, hitRate: 0.5, residualVol: 0.02 },
    weights: {
      holt: 0.1,
      ols: 0.1,
      ar1: 0.1,
      momentum: 0.1,
      garch: 0.1,
      kalman: 0.1,
      arima: 0.1,
      ou: 0.1,
      ewma: 0.1,
      regime: 0.1,
    },
    models: [],
    backtest: {
      periodDays: 252,
      horizon: 21,
      trades: 2,
      winRate: 0.5,
      hitRate: 0.5,
      totalReturn: 0,
      benchmarkReturn: 0,
      sharpe: 0.2,
      maxDrawdown: 0.1,
      passed: true,
      checks: { hitRate: true, sharpe: true, drawdown: true, trades: true, direction: true },
      gates: {
        minHitRate: 0.48,
        minSharpe: 0.1,
        maxDrawdown: 0.35,
        minTrades: 2,
        minDirectionAccuracy: 0.48,
      },
      tradeLog: [],
      summary: "Pass",
    },
    rationale: "",
    ...over,
  };
}

describe("applyLiveQuote", () => {
  it("replaces last price and expected return from a same-day mark", () => {
    const next = applyLiveQuote(stub(), {
      symbol: "SKHY",
      last: 115.95,
      changePct: -0.0465,
      at: "2026-09-08",
    });
    expect(next.last).toBe(115.95);
    expect(next.changePct).toBeCloseTo(-0.0465);
    expect(next.expectedReturn).toBeCloseTo(110 / 115.95 - 1);
    expect(next.history.at(-1)?.close).toBe(115.95);
  });
});
