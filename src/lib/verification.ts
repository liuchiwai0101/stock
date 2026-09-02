import { runBacktest, DEFAULT_GATES } from "@/lib/backtest";
import { fitEnsemble, MODEL_REGISTRY } from "@/lib/models/registry";
import { runForecast } from "@/lib/forecast";
import type { QuoteSeries } from "@/lib/market";
import type { Horizon, VerificationCase, VerificationSummary } from "@/lib/types";

function syntheticSeries(seed = 42, days = 400): QuoteSeries {
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const bars = [];
  let px = 100;
  let date = "2024-01-02";
  for (let i = 0; i < days; i++) {
    px *= Math.exp(0.0003 + 0.018 * (rand() - 0.5));
    bars.push({
      date,
      open: px,
      high: px * 1.01,
      low: px * 0.99,
      close: px,
      volume: 1_000_000,
    });
    const d = new Date(`${date}T00:00:00Z`);
    do {
      d.setUTCDate(d.getUTCDate() + 1);
    } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
    date = d.toISOString().slice(0, 10);
  }
  return { symbol: "TEST", name: "Synthetic", currency: "USD", source: "simulated", bars };
}

export function runVerificationSuite(): VerificationSummary {
  const cases: VerificationCase[] = [];
  const series = syntheticSeries();

  cases.push({
    name: "Model registry complete",
    passed: MODEL_REGISTRY.length === 10,
    detail: `${MODEL_REGISTRY.length} institutional models registered (target 10)`,
  });

  for (const model of MODEL_REGISTRY) {
    const path = model.predict(series.bars.map((b) => b.close), 21);
    const ok =
      path.length === 21 &&
      path.every((v) => Number.isFinite(v) && !Number.isNaN(v));
    cases.push({
      name: `Model ${model.id} produces finite path`,
      passed: ok,
      detail: ok ? `${model.label} OK` : `${model.label} returned invalid values`,
    });
  }

  const closes = series.bars.map((b) => b.close);
  const dates = series.bars.map((b) => b.date);
  const ensemble = fitEnsemble(closes, 21);
  cases.push({
    name: "Ensemble weights sum to 1",
    passed: Math.abs(Object.values(ensemble.weights).reduce((a, b) => a + b, 0) - 1) < 1e-6,
    detail: `Weight sum ${Object.values(ensemble.weights).reduce((a, b) => a + b, 0).toFixed(4)}`,
  });

  cases.push({
    name: "Ensemble path length",
    passed: ensemble.logPath.length === 21,
    detail: `Path length ${ensemble.logPath.length}`,
  });

  const bt = runBacktest(closes, dates, 21);
  cases.push({
    name: "1-year backtest executes",
    passed: Number.isFinite(bt.totalReturn) && Number.isFinite(bt.sharpe),
    detail: `${bt.trades} trades, return ${(bt.totalReturn * 100).toFixed(1)}%, Sharpe ${bt.sharpe.toFixed(2)}`,
  });

  cases.push({
    name: "Backtest gates defined",
    passed:
      DEFAULT_GATES.minHitRate > 0 &&
      DEFAULT_GATES.minSharpe >= 0 &&
      DEFAULT_GATES.maxDrawdown > 0,
    detail: `hit≥${DEFAULT_GATES.minHitRate}, sharpe≥${DEFAULT_GATES.minSharpe}, dd≤${DEFAULT_GATES.maxDrawdown}`,
  });

  let forecastOk = false;
  let forecastDetail = "not run";
  try {
    const forecast = runForecast(series, 21);
    forecastOk = forecast.forecast.length === 21 && forecast.weights.holt >= 0;
    forecastDetail = `${forecast.symbol} target ${forecast.targetPrice.toFixed(2)} raw ${forecast.rawSignal} live ${forecast.liveReady}`;
    cases.push({
      name: "Full forecast pipeline",
      passed: forecastOk,
      detail: forecastDetail,
    });
    cases.push({
      name: "Live-ready gate blocks unverified signals",
      passed: !forecast.liveReady ? forecast.signal === "HOLD" : forecast.signal === forecast.rawSignal || forecast.signal !== "HOLD",
      detail: forecast.liveReady
        ? "Backtest passed — tradable signal enabled"
        : `Backtest failed — signal forced HOLD (raw was ${forecast.rawSignal})`,
    });
  } catch (e) {
    cases.push({
      name: "Full forecast pipeline",
      passed: false,
      detail: e instanceof Error ? e.message : "forecast failed",
    });
    cases.push({
      name: "Live-ready gate blocks unverified signals",
      passed: false,
      detail: "Forecast pipeline failed",
    });
  }

  const passed = cases.every((c) => c.passed);

  return {
    passed,
    ranAt: new Date().toISOString(),
    cases,
    modelCount: MODEL_REGISTRY.length,
  };
}

export function verifyHorizon(h: number): h is Horizon {
  return h === 5 || h === 10 || h === 21 || h === 63;
}
