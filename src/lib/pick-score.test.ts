import { describe, expect, it } from "vitest";
import { scorePick, selectTopPicks } from "./pick-score";
import type { CompanyForecast } from "./types";

function mockForecast(overrides: Partial<CompanyForecast> = {}): CompanyForecast {
  return {
    symbol: "AAPL",
    name: "Apple",
    currency: "USD",
    last: 200,
    changePct: 0.01,
    source: "yahoo",
    history: [],
    forecast: [],
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
    models: [
      {
        id: "holt",
        label: "Holt",
        category: "ts",
        description: "",
        purpose: "",
        formula: "",
        weight: 0.1,
        rmse: 0.1,
        mape: 0.05,
        hitRate: 0.55,
        targetPrice: 210,
        expectedReturn: 0.04,
      },
    ],
    backtest: {
      periodDays: 252,
      horizon: 21,
      trades: 4,
      winRate: 0.6,
      hitRate: 0.58,
      totalReturn: 0.12,
      benchmarkReturn: 0.08,
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
      summary: "passed",
    },
    rationale: "buy",
    ...overrides,
  };
}

describe("pick-score", () => {
  it("ranks live BUY forecasts and returns top 10", () => {
    const quotes = [
      mockForecast({ symbol: "LOW", metrics: { rmse: 0.1, mape: 0.05, hitRate: 0.5, residualVol: 0.2 } }),
      mockForecast({ symbol: "HIGH", metrics: { rmse: 0.1, mape: 0.05, hitRate: 0.8, residualVol: 0.2 } }),
      mockForecast({ symbol: "FAIL", liveReady: false, signal: "HOLD" }),
    ];
    const picks = selectTopPicks(quotes, 10);
    expect(picks).toHaveLength(2);
    expect(picks[0].symbol).toBe("HIGH");
    expect(picks[1].symbol).toBe("LOW");
    expect(scorePick(mockForecast({ liveReady: false }))).toBe(Number.NEGATIVE_INFINITY);
  });
});
