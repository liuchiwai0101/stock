import { describe, expect, it } from "vitest";
import { runBacktest, DEFAULT_GATES } from "@/lib/backtest";
import { fitEnsemble, MODEL_REGISTRY } from "@/lib/models/registry";
import { runForecast } from "@/lib/forecast";
import { runVerificationSuite } from "@/lib/verification";
import { mean, softmaxInvError, stdev } from "@/lib/math/stats";

function syntheticCloses(days = 400): { closes: number[]; dates: string[] } {
  const closes: number[] = [];
  const dates: string[] = [];
  let px = 100;
  let date = "2024-01-02";
  for (let i = 0; i < days; i++) {
    px *= 1 + 0.0004 + 0.015 * Math.sin(i / 17) + 0.008 * (Math.random() - 0.5);
    closes.push(px);
    dates.push(date);
    const d = new Date(`${date}T00:00:00Z`);
    do {
      d.setUTCDate(d.getUTCDate() + 1);
    } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
    date = d.toISOString().slice(0, 10);
  }
  return { closes, dates };
}

describe("math stats", () => {
  it("computes mean and stdev", () => {
    expect(mean([1, 2, 3])).toBe(2);
    expect(stdev([1, 2, 3])).toBeCloseTo(1, 5);
  });

  it("softmax weights sum to 1", () => {
    const w = softmaxInvError([1, 2, 3, 4]);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
  });
});

describe("institutional models", () => {
  const { closes } = syntheticCloses();

  it("registers 10 models", () => {
    expect(MODEL_REGISTRY.length).toBe(10);
  });

  for (const model of MODEL_REGISTRY) {
    it(`${model.id} returns finite ${model.label}`, () => {
      const path = model.predict(closes, 21);
      expect(path).toHaveLength(21);
      expect(path.every((v) => Number.isFinite(v))).toBe(true);
    });
  }

  it("ensemble produces weighted path and per-model breakdown", () => {
    const { weights, logPath, models } = fitEnsemble(closes, 21);
    expect(Object.values(weights).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
    expect(logPath).toHaveLength(21);
    expect(models).toHaveLength(10);
    expect(models[0].weight).toBeGreaterThanOrEqual(models[9].weight);
    expect(models.every((m) => m.description.length > 10 && m.purpose.length > 10 && m.formula.length > 5)).toBe(true);
  });
});

describe("1-year backtest", () => {
  it("runs walk-forward simulation", () => {
    const { closes, dates } = syntheticCloses(450);
    const bt = runBacktest(closes, dates, 21);
    expect(bt.periodDays).toBe(252);
    expect(Number.isFinite(bt.sharpe)).toBe(true);
    expect(bt.checks).toBeDefined();
    expect(DEFAULT_GATES.minTrades).toBeGreaterThan(0);
  });
});

describe("forecast pipeline", () => {
  it("runs end-to-end on synthetic series", () => {
    const { closes, dates } = syntheticCloses(450);
    const series = {
      symbol: "TEST",
      name: "Test Co",
      currency: "USD",
      source: "simulated" as const,
      bars: closes.map((close, i) => ({
        date: dates[i],
        close,
        open: close,
        high: close,
        low: close,
        volume: 1e6,
      })),
    };
    const f = runForecast(series, 21);
    expect(f.forecast).toHaveLength(21);
    expect(f.weights.garch).toBeGreaterThanOrEqual(0);
    expect(f.models).toHaveLength(10);
    expect(f.models[0].targetPrice).toBeGreaterThan(0);
    expect(f.backtest.periodDays).toBe(252);
    if (!f.liveReady) expect(f.signal).toBe("HOLD");
  });
});

describe("self verification suite", () => {
  it("passes all internal checks", () => {
    const result = runVerificationSuite();
    for (const c of result.cases) {
      if (!c.passed) {
        console.error("FAILED:", c.name, c.detail);
      }
    }
    expect(result.passed).toBe(true);
    expect(result.modelCount).toBe(10);
  });
});
