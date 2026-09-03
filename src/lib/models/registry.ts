import { clamp, logPrices, logReturns, mean, softmaxInvError, stdev } from "@/lib/math/stats";

/** Log-price path forecast over `horizon` steps (one value per step). */
export type ModelPredict = (closes: number[], horizon: number) => number[];

export type ModelId =
  | "holt"
  | "ols"
  | "ar1"
  | "momentum"
  | "garch"
  | "kalman"
  | "arima"
  | "ou"
  | "ewma"
  | "regime";

export type ModelSpec = {
  id: ModelId;
  label: string;
  category: string;
  description: string;
  purpose: string;
  formula: string;
  predict: ModelPredict;
};

function holtForecast(y: number[], horizon: number): number[] {
  let bestPath = Array(horizon).fill(y[y.length - 1]);
  let bestSse = Number.POSITIVE_INFINITY;
  for (const alpha of [0.25, 0.4, 0.6]) {
    for (const beta of [0.05, 0.15, 0.3]) {
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
  return bestPath;
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

function ar1Path(closes: number[], horizon: number): number[] {
  const rets = logReturns(closes);
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
  const lookback = Math.min(63, n - 1);
  const recent = Math.log(closes[n - 1] / closes[n - 1 - lookback]) / lookback;
  const drift =
    sma20 >= sma50
      ? clamp(recent, -0.012, 0.015)
      : clamp(Math.log(sma50 / closes[n - 1]) / 50 + recent * 0.25, -0.01, 0.008);
  const path: number[] = [];
  let px = closes[n - 1];
  for (let h = 0; h < horizon; h++) {
    px *= Math.exp(drift);
    path.push(Math.log(px));
  }
  return path;
}

/** GARCH(1,1) variance forecast with drift from recent mean return. */
function garchPath(closes: number[], horizon: number): number[] {
  const rets = logReturns(closes);
  const mu = mean(rets);
  let varT = stdev(rets) ** 2 || 1e-6;
  const omega = 1e-6;
  const alpha = 0.08;
  const beta = 0.9;
  for (let t = 1; t < rets.length; t++) {
    const e = rets[t] - mu;
    varT = omega + alpha * e * e + beta * varT;
  }
  const path: number[] = [];
  let px = closes[closes.length - 1];
  let v = varT;
  for (let h = 0; h < horizon; h++) {
    const drift = mu - 0.5 * v;
    px *= Math.exp(drift);
    path.push(Math.log(px));
    v = omega + (alpha + beta) * v;
  }
  return path;
}

/** Kalman local linear trend on log prices. */
function kalmanPath(closes: number[], horizon: number): number[] {
  const y = logPrices(closes);
  let level = y[0];
  let trend = y[1] - y[0];
  const qLevel = 1e-4;
  const qTrend = 1e-5;
  let p00 = 1;
  let p01 = 0;
  let p11 = 1;
  const r = stdev(y) ** 2 * 0.01 + 1e-4;
  for (let t = 1; t < y.length; t++) {
    const lPred = level + trend;
    const tPred = trend;
    const p00p = p00 + 2 * p01 + p11 + qLevel;
    const p01p = p01 + p11;
    const p11p = p11 + qTrend;
    const innov = y[t] - lPred;
    const s = p00p + r;
    const k0 = p00p / s;
    const k1 = p01p / s;
    level = lPred + k0 * innov;
    trend = tPred + k1 * innov;
    p00 = (1 - k0) * p00p;
    p01 = (1 - k0) * p01p;
    p11 = p11p - k1 * p01p;
  }
  return Array.from({ length: horizon }, (_, h) => level + (h + 1) * trend);
}

/** ARIMA(1,1,0) on log prices (integrated AR). */
function arimaPath(closes: number[], horizon: number): number[] {
  const y = logPrices(closes);
  const dy: number[] = [];
  for (let i = 1; i < y.length; i++) dy.push(y[i] - y[i - 1]);
  const mu = mean(dy);
  let num = 0;
  let den = 0;
  for (let i = 1; i < dy.length; i++) {
    num += (dy[i - 1] - mu) * (dy[i] - mu);
    den += (dy[i - 1] - mu) ** 2;
  }
  const phi = clamp(den === 0 ? 0 : num / den, -0.95, 0.95);
  let lastDy = dy[dy.length - 1];
  let level = y[y.length - 1];
  const path: number[] = [];
  for (let h = 0; h < horizon; h++) {
    const nextDy = mu + phi * (lastDy - mu);
    level += nextDy;
    path.push(level);
    lastDy = nextDy;
  }
  return path;
}

/** Ornstein–Uhlenbeck mean reversion on log price vs long-run mean. */
function ouPath(closes: number[], horizon: number): number[] {
  const y = logPrices(closes);
  const theta = 0.05;
  const mu = mean(y.slice(-120));
  let x = y[y.length - 1];
  const path: number[] = [];
  for (let h = 0; h < horizon; h++) {
    x += theta * (mu - x);
    path.push(x);
  }
  return path;
}

/** RiskMetrics EWMA(λ=0.94) vol-scaled drift forecast. */
function ewmaPath(closes: number[], horizon: number): number[] {
  const rets = logReturns(closes);
  const lambda = 0.94;
  let varT = stdev(rets.slice(0, 30)) ** 2 || 1e-6;
  let ewmaMu = mean(rets.slice(0, 30));
  for (let t = 1; t < rets.length; t++) {
    ewmaMu = lambda * ewmaMu + (1 - lambda) * rets[t];
    varT = lambda * varT + (1 - lambda) * rets[t] ** 2;
  }
  const path: number[] = [];
  let px = closes[closes.length - 1];
  for (let h = 0; h < horizon; h++) {
    const vol = Math.sqrt(varT);
    const drift = ewmaMu - 0.5 * varT;
    px *= Math.exp(clamp(drift, -vol, vol));
    path.push(Math.log(px));
    varT = lambda * varT + (1 - lambda) * (drift * drift);
  }
  return path;
}

/** Volatility regime blend: low-vol momentum vs high-vol mean reversion. */
function regimePath(closes: number[], horizon: number): number[] {
  const rets = logReturns(closes);
  const shortVol = stdev(rets.slice(-20));
  const longVol = stdev(rets.slice(-120));
  const regime = shortVol / (longVol + 1e-8);
  const mom = momentumPath(closes, horizon);
  const ou = ouPath(closes, horizon);
  const wMom = clamp(1.2 - regime, 0.15, 0.85);
  return mom.map((m, i) => wMom * m + (1 - wMom) * ou[i]);
}

export const MODEL_REGISTRY: ModelSpec[] = [
  {
    id: "holt",
    label: "Holt linear trend",
    category: "Exponential smoothing",
    description: "Double exponential smoothing on log prices with level + trend; grid-searches α, β.",
    purpose:
      "Use when price has a smooth directional trend. Captures persistent drifts without overreacting to single-day noise.",
    formula: "L_t = α y_t + (1−α)(L_{t−1}+T_{t−1});  T_t = β(L_t−L_{t−1}) + (1−β)T_{t−1}",
    predict: (c, h) => holtForecast(logPrices(c), h),
  },
  {
    id: "ols",
    label: "OLS log-price regression",
    category: "Factor regression",
    description: "Ordinary least squares of log price on time; extrapolates the fitted line.",
    purpose:
      "Use as a baseline long-horizon drift estimate. Anchors the ensemble to the average historical growth rate.",
    formula: "log P_t = a + b·t + ε_t → ŷ_{t+h} = a + b·(t+h)",
    predict: (c, h) => olsForecast(logPrices(c), h),
  },
  {
    id: "ar1",
    label: "AR(1) return model",
    category: "Time series",
    description: "First-order autoregression on daily log returns with estimated mean and φ.",
    purpose:
      "Use when yesterday’s return partially predicts today’s. Models short-term continuation or mild mean reversion in returns.",
    formula: "r_t = μ + φ(r_{t−1}−μ) + ε_t;  P path via cumulative exp(r̂)",
    predict: ar1Path,
  },
  {
    id: "momentum",
    label: "Cross-sectional momentum",
    category: "Quant factor",
    description: "20/50 SMA trend filter plus 63-day average drift; clamped for stability.",
    purpose:
      "Use to follow medium-term trend following. Favors names still above their moving averages with positive multi-week drift.",
    formula: "drift = f(SMA20 ≷ SMA50, log(P_t/P_{t−63})/63)",
    predict: momentumPath,
  },
  {
    id: "garch",
    label: "GARCH(1,1) vol forecast",
    category: "Volatility modeling",
    description: "Conditional variance with mean drift; path uses μ − ½σ² adjustment.",
    purpose:
      "Use when volatility is changing. Adjusts expected path for risk (μ − ½σ²) so high-vol regimes don’t inflate naive returns.",
    formula: "σ²_t = ω + α ε²_{t−1} + β σ²_{t−1};  E[r] = μ − ½σ²",
    predict: garchPath,
  },
  {
    id: "kalman",
    label: "Kalman local trend",
    category: "State-space",
    description: "Local linear trend state-space filter; recursively updates level and slope.",
    purpose:
      "Use when the trend itself is evolving. Filters noisy prices into a live level/slope estimate that adapts as regimes shift.",
    formula: "x_t = [level, trend];  x_{t|t} = x_{t|t−1} + K·innovation",
    predict: kalmanPath,
  },
  {
    id: "arima",
    label: "ARIMA(1,1,0)",
    category: "Time series",
    description: "Integrated AR(1) on first differences of log prices (random-walk with drift + AR).",
    purpose:
      "Use for differenced series that are closer to stationary. Models incremental price changes with a classic desk ARIMA baseline.",
    formula: "Δy_t = μ + φ(Δy_{t−1}−μ) + ε_t;  ŷ_{t+h} = y_t + Σ Δŷ",
    predict: arimaPath,
  },
  {
    id: "ou",
    label: "Ornstein–Uhlenbeck MR",
    category: "Mean reversion",
    description: "Mean-reverting diffusion of log price toward a long-run mean (120-day).",
    purpose:
      "Use when price looks stretched vs its longer average. Pulls forecasts back toward fair value after large deviations.",
    formula: "dx = θ(μ − x) dt;  discrete: x ← x + θ(μ − x)",
    predict: ouPath,
  },
  {
    id: "ewma",
    label: "RiskMetrics EWMA",
    category: "Risk parity",
    description: "JPMorgan RiskMetrics-style exponentially weighted return & variance (λ=0.94).",
    purpose:
      "Use for risk-aware short-horizon forecasts. Emphasizes recent returns/vol the way RiskMetrics desks size risk.",
    formula: "σ²_t = λ σ²_{t−1} + (1−λ)r²_t;  drift = μ̂_EWMA − ½σ²",
    predict: ewmaPath,
  },
  {
    id: "regime",
    label: "Vol regime switch",
    category: "Regime detection",
    description: "Blends momentum (low vol) and OU mean reversion (high vol) by short/long vol ratio.",
    purpose:
      "Use to adapt strategy to market climate. Follows trend in calm markets and leans mean-reverting when vol spikes.",
    formula: "w = clamp(1.2 − σ_short/σ_long);  path = w·mom + (1−w)·OU",
    predict: regimePath,
  },
];

export type ModelWeights = Record<ModelId, number>;

export type ModelBreakdown = {
  id: ModelId;
  label: string;
  category: string;
  description: string;
  purpose: string;
  formula: string;
  weight: number;
  rmse: number;
  mape: number;
  hitRate: number;
  targetPrice: number;
  expectedReturn: number;
};

export function walkForwardRmse(
  closes: number[],
  horizon: number,
  predict: ModelPredict
): { rmse: number; mape: number; hitRate: number } {
  const origins: number[] = [];
  const start = Math.max(80, closes.length - 90);
  for (let t = start; t < closes.length - horizon; t += 4) origins.push(t);
  if (origins.length < 4) return { rmse: 1, mape: 1, hitRate: 0.5 };
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

export function fitEnsemble(closes: number[], horizon: number): {
  weights: ModelWeights;
  logPath: number[];
  metrics: { rmse: number; mape: number; hitRate: number };
  models: ModelBreakdown[];
} {
  const last = closes[closes.length - 1];
  const wfHorizon = Math.min(horizon, 10);
  const scores = MODEL_REGISTRY.map((m) => ({
    id: m.id,
    ...walkForwardRmse(closes, wfHorizon, m.predict),
  }));
  const weightArr = softmaxInvError(scores.map((s) => s.rmse));
  const weights = Object.fromEntries(
    MODEL_REGISTRY.map((m, i) => [m.id, weightArr[i]])
  ) as ModelWeights;

  const paths = MODEL_REGISTRY.map((m) => m.predict(closes, horizon));
  const logPath = paths[0].map((_, i) =>
    MODEL_REGISTRY.reduce((sum, m, j) => sum + weights[m.id] * paths[j][i], 0)
  );

  const models: ModelBreakdown[] = MODEL_REGISTRY.map((m, i) => {
    const targetPrice = Math.exp(paths[i][horizon - 1]);
    return {
      id: m.id,
      label: m.label,
      category: m.category,
      description: m.description,
      purpose: m.purpose,
      formula: m.formula,
      weight: weightArr[i],
      rmse: scores[i].rmse,
      mape: scores[i].mape,
      hitRate: scores[i].hitRate,
      targetPrice,
      expectedReturn: targetPrice / last - 1,
    };
  }).sort((a, b) => b.weight - a.weight);

  const metrics = {
    rmse: scores.reduce((s, x, i) => s + weightArr[i] * x.rmse, 0),
    mape: scores.reduce((s, x, i) => s + weightArr[i] * x.mape, 0),
    hitRate: scores.reduce((s, x, i) => s + weightArr[i] * x.hitRate, 0),
  };

  return { weights, logPath, metrics, models };
}

export const MODEL_LABELS: Record<ModelId, string> = Object.fromEntries(
  MODEL_REGISTRY.map((m) => [m.id, m.label])
) as Record<ModelId, string>;
