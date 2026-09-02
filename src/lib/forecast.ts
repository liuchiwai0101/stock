import { kellyWeight, runBacktest } from "@/lib/backtest";
import { clamp, logReturns, stdev } from "@/lib/math/stats";
import { fitEnsemble, MODEL_LABELS, MODEL_REGISTRY, type ModelId } from "@/lib/models/registry";
import type {
  CompanyForecast,
  ForecastPoint,
  Horizon,
  ModelMetrics,
  TradeSignal,
} from "@/lib/types";
import type { QuoteSeries } from "@/lib/market";

export function addBusinessDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  let added = 0;
  const step = days >= 0 ? 1 : -1;
  const target = Math.abs(days);
  while (added < target) {
    d.setUTCDate(d.getUTCDate() + step);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

function signalFromForecast(
  expectedReturn: number,
  residualVol: number,
  horizon: number
): { signal: TradeSignal; confidence: number; recommendedWeight: number } {
  const pathVol = residualVol * Math.sqrt(horizon);
  const tstat = pathVol === 0 ? 0 : expectedReturn / pathVol;
  const hurdle = Math.max(0.008, 0.28 * pathVol);
  let signal: TradeSignal = "HOLD";
  if (expectedReturn > hurdle) signal = "BUY";
  else if (expectedReturn < -hurdle) signal = "SELL";
  const confidence = clamp(Math.abs(tstat) / 1.6, 0.12, 0.92);
  const kelly = kellyWeight(expectedReturn, residualVol, horizon);
  const recommendedWeight =
    signal === "HOLD" ? 0 : clamp(Math.abs(kelly), 0.04, 0.25) * (signal === "SELL" ? -1 : 1);
  return { signal, confidence, recommendedWeight };
}

function rationale(
  signal: TradeSignal,
  liveReady: boolean,
  weights: Record<ModelId, number>,
  expectedReturn: number,
  backtestSummary: string
): string {
  const dominant = (Object.entries(weights) as [ModelId, number][]).sort((a, b) => b[1] - a[1])[0][0];
  const dir = expectedReturn >= 0 ? "higher" : "lower";
  const action =
    signal === "BUY"
      ? "Ensemble leans long."
      : signal === "SELL"
        ? "Ensemble leans to reduce / exit."
        : liveReady
          ? "Forecast edge is below the trade hurdle."
          : "Signal blocked — 1-year backtest did not pass verification gates.";
  return `${action} Lead model: ${MODEL_LABELS[dominant]}. Expected ${dir} close. ${backtestSummary}`;
}

export function runForecast(series: QuoteSeries, horizon: Horizon): CompanyForecast {
  const bars = series.bars.slice(-500);
  const closes = bars.map((b) => b.close);
  const dates = bars.map((b) => b.date);
  if (closes.length < 120) {
    throw new Error(`Not enough history for ${series.symbol} (need 120+ days)`);
  }

  const { weights, logPath, metrics: wfMetrics } = fitEnsemble(closes, horizon);
  const backtest = runBacktest(closes, dates, horizon);

  const last = closes[closes.length - 1];
  const lastDate = bars[bars.length - 1].date;
  const prev = closes[closes.length - 2] ?? last;
  const changePct = last / prev - 1;
  const rets = logReturns(closes);
  const residualVol = stdev(rets);

  const points: ForecastPoint[] = logPath.map((lp, i) => {
    const h = i + 1;
    const sigma = residualVol * Math.sqrt(h) * 1.28;
    const meanPx = Math.exp(lp + 0.5 * residualVol * residualVol);
    return {
      date: addBusinessDays(lastDate, h),
      mean: meanPx,
      lo: Math.exp(lp - sigma),
      hi: Math.exp(lp + sigma),
    };
  });

  const targetPrice = points[points.length - 1].mean;
  const expectedReturn = targetPrice / last - 1;
  const { signal: rawSignal, confidence, recommendedWeight } = signalFromForecast(
    expectedReturn,
    residualVol,
    horizon
  );

  const liveReady = backtest.passed;
  const signal: TradeSignal = liveReady ? rawSignal : "HOLD";

  const metrics: ModelMetrics = {
    rmse: wfMetrics.rmse,
    mape: wfMetrics.mape,
    hitRate: wfMetrics.hitRate,
    residualVol,
  };

  return {
    symbol: series.symbol,
    name: series.name,
    currency: series.currency,
    last,
    changePct,
    source: series.source,
    history: bars.slice(-180),
    forecast: points,
    targetPrice,
    expectedReturn,
    annualizedReturn: (1 + expectedReturn) ** (252 / horizon) - 1,
    signal,
    rawSignal,
    confidence,
    recommendedWeight: liveReady ? recommendedWeight : 0,
    liveReady,
    metrics,
    weights,
    backtest,
    rationale: rationale(signal, liveReady, weights, expectedReturn, backtest.summary),
  };
}

export { MODEL_REGISTRY, MODEL_LABELS };
