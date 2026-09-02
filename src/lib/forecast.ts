import type {
  CompanyForecast,
  ForecastPoint,
  Horizon,
  ModelMetrics,
  ModelWeights,
  TradeSignal,
} from "@/lib/types";
import type { QuoteSeries } from "@/lib/market";

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

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

function logPrices(closes: number[]): number[] {
  return closes.map((c) => Math.log(c));
}

function holtForecast(y: number[], horizon: number): { path: number[]; sse: number } {
  let bestPath = Array(horizon).fill(y[y.length - 1]);
  let bestSse = Number.POSITIVE_INFINITY;
  const alphas = [0.25, 0.4, 0.6];
  const betas = [0.05, 0.15, 0.3];
  for (const alpha of alphas) {
    for (const beta of betas) {
      let level = y[0];
      let trend = y[1] - y[0];
      let sse = 0;
      for (let t = 1; t < y.length; t++) {
        const pred = level + trend;
        sse += (y[t] - pred) ** 2;
        const nextLevel = alpha * y[t] + (1 - alpha) * (level + trend);
        trend = beta * (nextLevel - level) + (1 - beta) * trend;
        level = nextLevel;
      }
      if (sse < bestSse) {
        bestSse = sse;
        bestPath = Array.from({ length: horizon }, (_, h) => level + (h + 1) * trend);
      }
    }
  }
  return { path: bestPath, sse: bestSse };
}

function olsForecast(y: number[], horizon: number): number[] {
  const n = y.length;
  let sumT = 0;
  let sumY = 0;
  let sumTY = 0;
  let sumT2 = 0;
  for (let t = 0; t < n; t++) {
    sumT += t;
    sumY += y[t];
    sumTY += t * y[t];
    sumT2 += t * t;
  }
  const denom = n * sumT2 - sumT * sumT;
  const b = denom === 0 ? 0 : (n * sumTY - sumT * sumY) / denom;
  const a = (sumY - b * sumT) / n;
  return Array.from({ length: horizon }, (_, h) => a + b * (n + h));
}

function ar1ReturnPath(closes: number[], horizon: number): number[] {
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    rets.push(Math.log(closes[i] / closes[i - 1]));
  }
  const mu = mean(rets);
  let num = 0;
  let den = 0;
  for (let i = 1; i < rets.length; i++) {
    const x = rets[i - 1] - mu;
    num += x * (rets[i] - mu);
    den += x * x;
  }
  const phi = clamp(den === 0 ? 0 : num / den, -0.9, 0.9);
  const path: number[] = [];
  let last = closes[closes.length - 1];
  let lastDev = rets[rets.length - 1] - mu;
  for (let h = 0; h < horizon; h++) {
    const expected = mu + phi * lastDev;
    last *= Math.exp(expected);
    path.push(Math.log(last));
    lastDev = expected;
  }
  return path;
}

function momentumPath(closes: number[], horizon: number): number[] {
  const n = closes.length;
  const sma20 = mean(closes.slice(-20));
  const sma50 = mean(closes.slice(-Math.min(50, n)));
  const lookback = Math.min(20, n - 1);
  const recent = Math.log(closes[n - 1] / closes[n - 1 - lookback]) / lookback;
  const drift =
    sma20 >= sma50
      ? clamp(recent, -0.01, 0.012)
      : clamp(Math.log(sma50 / closes[n - 1]) / 40 + recent * 0.3, -0.008, 0.006);
  const path: number[] = [];
  let px = closes[n - 1];
  for (let h = 0; h < horizon; h++) {
    px *= Math.exp(drift);
    path.push(Math.log(px));
  }
  return path;
}

function walkForwardHit(
  closes: number[],
  horizon: number,
  predict: (train: number[], h: number) => number[]
): { rmse: number; mape: number; hitRate: number } {
  const origins: number[] = [];
  const start = Math.max(80, closes.length - 90);
  const step = 4;
  for (let t = start; t < closes.length - horizon; t += step) origins.push(t);
  if (origins.length < 4) {
    return { rmse: 0, mape: 0, hitRate: 0.5 };
  }
  let sq = 0;
  let ape = 0;
  let hits = 0;
  for (const t of origins) {
    const train = closes.slice(0, t);
    const predLogs = predict(train, horizon);
    const pred = Math.exp(predLogs[horizon - 1]);
    const actual = closes[t + horizon - 1];
    const last = closes[t - 1];
    sq += (pred - actual) ** 2;
    ape += Math.abs(pred - actual) / actual;
    if ((pred - last) * (actual - last) > 0) hits++;
  }
  const k = origins.length;
  return { rmse: Math.sqrt(sq / k), mape: ape / k, hitRate: hits / k };
}

function softmaxInvError(errors: number[]): number[] {
  const inv = errors.map((e) => 1 / (e + 1e-6));
  const s = inv.reduce((a, b) => a + b, 0);
  return inv.map((x) => x / s);
}

function signalFromForecast(
  expectedReturn: number,
  residualVol: number,
  horizon: number
): { signal: TradeSignal; confidence: number; recommendedWeight: number } {
  const pathVol = residualVol * Math.sqrt(horizon);
  const tstat = pathVol === 0 ? 0 : expectedReturn / pathVol;
  const hurdle = Math.max(0.01, 0.28 * pathVol);
  let signal: TradeSignal = "HOLD";
  if (expectedReturn > hurdle) signal = "BUY";
  else if (expectedReturn < -hurdle) signal = "SELL";
  const confidence = clamp(Math.abs(tstat) / 1.6, 0.12, 0.92);
  const raw = pathVol === 0 ? 0 : expectedReturn / (pathVol * pathVol) * 0.18;
  const recommendedWeight =
    signal === "HOLD" ? 0 : clamp(Math.abs(raw), 0.04, 0.28) * (signal === "SELL" ? -1 : 1);
  return { signal, confidence, recommendedWeight };
}

function rationale(
  signal: TradeSignal,
  weights: ModelWeights,
  expectedReturn: number,
  hitRate: number
): string {
  const dominant = (Object.entries(weights) as [keyof ModelWeights, number][]).sort(
    (a, b) => b[1] - a[1]
  )[0][0];
  const labels: Record<keyof ModelWeights, string> = {
    holt: "Holt trend smoothing",
    ols: "log-price regression",
    ar1: "return mean-reversion (AR1)",
    momentum: "moving-average momentum",
  };
  const dir = expectedReturn >= 0 ? "higher" : "lower";
  const action =
    signal === "BUY"
      ? "The ensemble leans long."
      : signal === "SELL"
        ? "The ensemble leans short / reduce."
        : "The path is too close to noise for a new trade.";
  return `${action} Lead contributor is ${labels[dominant]}. Walk-forward direction accuracy is ${(hitRate * 100).toFixed(0)}%, with a ${dir} expected close over the horizon.`;
}

export function runForecast(series: QuoteSeries, horizon: Horizon): CompanyForecast {
  const bars = series.bars.slice(-400);
  const closes = bars.map((b) => b.close);
  if (closes.length < 80) {
    throw new Error(`Not enough history for ${series.symbol}`);
  }
  const y = logPrices(closes);
  const holt = holtForecast(y, horizon).path;
  const ols = olsForecast(y, horizon);
  const ar1 = ar1ReturnPath(closes, horizon);
  const mom = momentumPath(closes, horizon);

  const holtWf = walkForwardHit(closes, Math.min(horizon, 10) as Horizon, (train, h) =>
    holtForecast(logPrices(train), h).path
  );
  const olsWf = walkForwardHit(closes, Math.min(horizon, 10) as Horizon, (train, h) =>
    olsForecast(logPrices(train), h)
  );
  const ar1Wf = walkForwardHit(closes, Math.min(horizon, 10) as Horizon, (train, h) =>
    ar1ReturnPath(train, h)
  );
  const momWf = walkForwardHit(closes, Math.min(horizon, 10) as Horizon, (train, h) =>
    momentumPath(train, h)
  );

  const weightArr = softmaxInvError([holtWf.rmse, olsWf.rmse, ar1Wf.rmse, momWf.rmse]);
  const weights: ModelWeights = {
    holt: weightArr[0],
    ols: weightArr[1],
    ar1: weightArr[2],
    momentum: weightArr[3],
  };

  const logPath = holt.map((_, i) => {
    return (
      weights.holt * holt[i] +
      weights.ols * ols[i] +
      weights.ar1 * ar1[i] +
      weights.momentum * mom[i]
    );
  });

  const last = closes[closes.length - 1];
  const lastDate = bars[bars.length - 1].date;
  const prev = closes[closes.length - 2] ?? last;
  const changePct = last / prev - 1;

  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) rets.push(Math.log(closes[i] / closes[i - 1]));
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
  const { signal, confidence, recommendedWeight } = signalFromForecast(
    expectedReturn,
    residualVol,
    horizon
  );

  const ensembleRmse = holtWf.rmse * weights.holt + olsWf.rmse * weights.ols + ar1Wf.rmse * weights.ar1 + momWf.rmse * weights.momentum;
  const ensembleMape = holtWf.mape * weights.holt + olsWf.mape * weights.ols + ar1Wf.mape * weights.ar1 + momWf.mape * weights.momentum;
  const ensembleHit = holtWf.hitRate * weights.holt + olsWf.hitRate * weights.ols + ar1Wf.hitRate * weights.ar1 + momWf.hitRate * weights.momentum;

  const metrics: ModelMetrics = {
    rmse: ensembleRmse,
    mape: ensembleMape,
    hitRate: ensembleHit,
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
    confidence,
    recommendedWeight,
    metrics,
    weights,
    rationale: rationale(signal, weights, expectedReturn, metrics.hitRate),
  };
}
