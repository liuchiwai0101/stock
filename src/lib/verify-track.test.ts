import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompanyForecast } from "@/lib/types";
import {
  defaultChosenModels,
  evaluateVerifySnapshot,
  rollingConfidence,
  snapshotFromQuote,
  startVerifyTrack,
  stopVerifyTrack,
  upsertDailySnapshots,
} from "@/lib/verify-track";

function quote(partial: Partial<CompanyForecast> = {}): CompanyForecast {
  return {
    symbol: "0883.HK",
    name: "中国海洋石油",
    currency: "HKD",
    last: 20,
    changePct: 0.01,
    source: "yahoo",
    history: [],
    forecast: [],
    targetPrice: 22,
    expectedReturn: 0.1,
    annualizedReturn: 0.2,
    signal: "BUY",
    rawSignal: "BUY",
    confidence: 0.7,
    recommendedWeight: 0.05,
    liveReady: true,
    metrics: { rmse: 1, mape: 0.1, hitRate: 0.55, residualVol: 0.02 },
    weights: {
      holt: 0.2,
      ols: 0.05,
      ar1: 0.15,
      momentum: 0.1,
      garch: 0.1,
      kalman: 0.1,
      arima: 0.1,
      ou: 0.05,
      ewma: 0.1,
      regime: 0.05,
    },
    models: [
      {
        id: "holt",
        label: "Holt",
        category: "trend",
        description: "",
        purpose: "",
        formula: "",
        weight: 0.2,
        rmse: 1,
        mape: 0.1,
        hitRate: 0.5,
        targetPrice: 22,
        expectedReturn: 0.12,
      },
      {
        id: "ar1",
        label: "AR1",
        category: "return",
        description: "",
        purpose: "",
        formula: "",
        weight: 0.15,
        rmse: 1,
        mape: 0.1,
        hitRate: 0.5,
        targetPrice: 21,
        expectedReturn: -0.02,
      },
      {
        id: "momentum",
        label: "Mom",
        category: "trend",
        description: "",
        purpose: "",
        formula: "",
        weight: 0.1,
        rmse: 1,
        mape: 0.1,
        hitRate: 0.5,
        targetPrice: 21.5,
        expectedReturn: 0.08,
      },
    ],
    backtest: {
      periodDays: 252,
      horizon: 21,
      trades: 10,
      winRate: 0.5,
      hitRate: 0.55,
      totalReturn: 0.1,
      benchmarkReturn: 0.08,
      sharpe: 1.2,
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
        minSharpe: 0.5,
        maxDrawdown: 0.25,
        minTrades: 4,
        minDirectionAccuracy: 0.5,
      },
      tradeLog: [],
      summary: "ok",
    },
    rationale: "",
    ...partial,
  };
}

describe("verify-track", () => {
  beforeEach(() => {
    const mem = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
      removeItem: (k: string) => {
        mem.delete(k);
      },
    });
    vi.stubGlobal("window", { localStorage: globalThis.localStorage });
  });

  it("picks the heaviest models for Watch by default", () => {
    expect(defaultChosenModels(quote())).toEqual(["holt", "ar1", "momentum"]);
  });

  it("starts a track and stores today's ensemble snapshot", () => {
    const store = startVerifyTrack(quote());
    expect(store.tracks.map((t) => t.symbol)).toEqual(["0883.HK"]);
    expect(store.snapshots[0]?.signal).toBe("BUY");
    expect(store.snapshots[0]?.chosenModels).toEqual(["holt", "ar1", "momentum"]);
  });

  it("scores a prior snapshot hit/miss and rolls confidence", () => {
    const snap = snapshotFromQuote(quote(), { chosenModels: ["holt", "ar1"], horizon: 21 }, "2026-09-20");
    const scored = evaluateVerifySnapshot(snap, 22, "2026-09-21T00:00:00.000Z");
    expect(scored.evaluated?.ensembleHit).toBe(true);
    expect(scored.evaluated?.modelHits.holt).toBe(true);
    expect(scored.evaluated?.modelHits.ar1).toBe(false);
    expect(rollingConfidence([scored])).toEqual({ hits: 1, n: 1, rate: 1 });
  });

  it("upserts one snapshot per day and can stop watching", () => {
    startVerifyTrack(quote());
    const again = upsertDailySnapshots([quote({ last: 20.5, expectedReturn: 0.08 })]);
    expect(again?.snapshots.filter((s) => s.symbol === "0883.HK")).toHaveLength(1);
    expect(upsertDailySnapshots([quote({ last: 20.5, expectedReturn: 0.08 })])).toBeNull();
    const stopped = stopVerifyTrack("0883.HK");
    expect(stopped.tracks).toHaveLength(0);
  });
});
