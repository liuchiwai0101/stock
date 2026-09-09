import { describe, expect, it } from "vitest";
import { pickToForecast, slimForecastForCache } from "./scan-cache";
import type { CompanyForecast } from "./types";

const base: CompanyForecast = {
  symbol: "AAPL",
  name: "Apple",
  currency: "USD",
  last: 200,
  changePct: 0.01,
  source: "yahoo",
  history: [{ date: "2026-01-01", open: 1, high: 1, low: 1, close: 1, volume: 1 }],
  forecast: [{ date: "2026-01-02", mean: 1, lo: 1, hi: 1 }],
  targetPrice: 210,
  expectedReturn: 0.05,
  annualizedReturn: 0.2,
  signal: "BUY",
  rawSignal: "BUY",
  confidence: 0.7,
  recommendedWeight: 0.08,
  liveReady: true,
  metrics: { rmse: 0.1, mape: 0.05, hitRate: 0.6, residualVol: 0.2 },
  weights: {} as CompanyForecast["weights"],
  models: [],
  backtest: {
    periodDays: 252,
    horizon: 21,
    trades: 1,
    winRate: 1,
    hitRate: 0.6,
    totalReturn: 0.1,
    benchmarkReturn: 0.05,
    sharpe: 0.5,
    maxDrawdown: 0.1,
    passed: true,
    checks: {
      hitRate: true,
      sharpe: true,
      drawdown: true,
      trades: true,
      direction: true,
    },
    gates: {
      minHitRate: 0.48,
      minSharpe: 0.1,
      maxDrawdown: 0.35,
      minTrades: 2,
      minDirectionAccuracy: 0.48,
    },
    tradeLog: [],
    summary: "ok",
  },
  rationale: "buy",
};

describe("scan-cache", () => {
  it("slims heavy forecast fields for storage", () => {
    const slim = slimForecastForCache(base);
    expect(slim.history).toHaveLength(0);
    expect(slim.forecast).toHaveLength(0);
    expect(slim.symbol).toBe("AAPL");
  });

  it("builds a forecast row from a daily pick", () => {
    const row = pickToForecast(
      {
        rank: 1,
        symbol: "NVDA",
        name: "NVIDIA",
        last: 180,
        targetPrice: 200,
        expectedReturn: 0.08,
        confidence: 0.75,
        hitRate: 0.62,
        sharpe: 0.4,
        pickScore: 0.7,
        modelBuyVotes: 8,
        modelCount: 10,
        recommendedWeight: 0.07,
        signal: "BUY",
        liveReady: true,
      },
      21,
    );
    expect(row.symbol).toBe("NVDA");
    expect(row.signal).toBe("BUY");
  });
});
