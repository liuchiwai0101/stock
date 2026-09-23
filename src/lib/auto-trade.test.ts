import { describe, expect, it } from "vitest";
import { planAutoTrades } from "./auto-trade";
import { DEFAULT_AUTO_TRADE_SETTINGS } from "./auto-trade-settings";
import { isScanFreshToday, scanFreshnessLabel } from "./scan-freshness";
import type { CompanyForecast, Portfolio } from "./types";

function quote(partial: Partial<CompanyForecast> & { symbol: string }): CompanyForecast {
  return {
    symbol: partial.symbol,
    name: partial.name ?? partial.symbol,
    currency: "USD",
    last: partial.last ?? 100,
    changePct: 0,
    source: "yahoo",
    history: [],
    forecast: [],
    targetPrice: partial.targetPrice ?? 110,
    expectedReturn: partial.expectedReturn ?? 0.05,
    annualizedReturn: 0.2,
    signal: partial.signal ?? "BUY",
    rawSignal: partial.rawSignal ?? "BUY",
    confidence: 0.6,
    recommendedWeight: partial.recommendedWeight ?? 0.1,
    liveReady: partial.liveReady ?? true,
    metrics: {
      hitRate: partial.metrics?.hitRate ?? 0.55,
      mape: partial.metrics?.mape ?? 0,
      rmse: partial.metrics?.rmse ?? 0,
      residualVol: partial.metrics?.residualVol ?? 0.1,
    },
    weights: {} as CompanyForecast["weights"],
    models: [],
    backtest: {
      periodDays: 252,
      horizon: 21,
      trades: 1,
      winRate: 0.55,
      hitRate: 0.55,
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
        minTrades: 1,
        minDirectionAccuracy: 0.5,
      },
      tradeLog: [],
      summary: "ok",
    },
    rationale: "",
  };
}

const emptyBook: Portfolio = { cash: 100_000, positions: [], fills: [] };

describe("scan freshness", () => {
  it("treats today's capture as fresh", () => {
    const now = new Date("2026-09-23T04:00:00+08:00");
    expect(isScanFreshToday("2026-09-23T02:00:00.000Z", now)).toBe(true);
    expect(scanFreshnessLabel("2026-09-23T02:00:00.000Z", now)).toBe("fresh");
  });

  it("rejects yesterday's scan", () => {
    const now = new Date("2026-09-23T04:00:00+08:00");
    expect(isScanFreshToday("2026-09-22T10:00:00.000Z", now)).toBe(false);
    expect(scanFreshnessLabel(null, now)).toBe("missing");
  });
});

describe("planAutoTrades", () => {
  it("refuses stale scans", () => {
    const plan = planAutoTrades({
      quotes: [quote({ symbol: "AAPL" })],
      scanGeneratedAt: "2026-09-22T10:00:00.000Z",
      portfolio: emptyBook,
      settings: { ...DEFAULT_AUTO_TRADE_SETTINGS, enabled: true },
      now: new Date("2026-09-23T04:00:00+08:00"),
    });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toBe("scan_stale");
  });

  it("plans buys from a fresh scan", () => {
    const plan = planAutoTrades({
      quotes: [
        quote({
          symbol: "AAPL",
          expectedReturn: 0.08,
          metrics: { hitRate: 0.6, mape: 0, rmse: 0, residualVol: 0.1 },
        }),
      ],
      scanGeneratedAt: "2026-09-23T02:00:00.000Z",
      portfolio: emptyBook,
      settings: { ...DEFAULT_AUTO_TRADE_SETTINGS, enabled: true },
      now: new Date("2026-09-23T04:00:00+08:00"),
    });
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.buys.length).toBe(1);
      expect(plan.buys[0]?.symbol).toBe("AAPL");
    }
  });

  it("plans sells on SELL signal", () => {
    const book: Portfolio = {
      cash: 50_000,
      positions: [{ symbol: "TSLA", name: "Tesla", shares: 10, avgPrice: 200, openedAt: "2026-09-01T00:00:00.000Z" }],
      fills: [],
    };
    const plan = planAutoTrades({
      quotes: [quote({ symbol: "TSLA", signal: "SELL", rawSignal: "SELL", last: 250 })],
      scanGeneratedAt: "2026-09-23T02:00:00.000Z",
      portfolio: book,
      settings: { ...DEFAULT_AUTO_TRADE_SETTINGS, enabled: true, sellOnSellSignal: true },
      now: new Date("2026-09-23T04:00:00+08:00"),
    });
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.sells[0]?.symbol).toBe("TSLA");
      expect(plan.sells[0]?.shares).toBe(10);
    }
  });
});
