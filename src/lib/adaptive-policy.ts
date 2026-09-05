import type { ModelId, ModelWeights } from "@/lib/types";
import type { VolRegime } from "@/lib/vol-regime";

export const MODEL_IDS: ModelId[] = [
  "holt",
  "ols",
  "ar1",
  "momentum",
  "garch",
  "kalman",
  "arima",
  "ou",
  "ewma",
  "regime",
];

export const POLICY_COOKIE = "sd-policy";
export const AUTO_TRADE_MIN_SAMPLES = 25;

export type AdaptivePolicy = {
  version: 1;
  updatedAt: string;
  samples: number;
  liveHitRate: number;
  horizonSamples: number;
  horizonHitRate: number;
  tradingWinRate: number;
  tradingPnL: number;
  modelBoosts: Record<ModelId, number>;
  modelBoostsCalm: Record<ModelId, number>;
  modelBoostsHighVol: Record<ModelId, number>;
  buyHurdleScale: number;
  confidenceScale: number;
  sizeScale: number;
};

export type CompactPolicy = {
  b: Partial<Record<ModelId, number>>;
  bc?: Partial<Record<ModelId, number>>;
  bh?: Partial<Record<ModelId, number>>;
  h: number;
  c: number;
  s: number;
  n?: number;
};

function unitBoosts(): Record<ModelId, number> {
  return Object.fromEntries(MODEL_IDS.map((id) => [id, 1])) as Record<ModelId, number>;
}

export function defaultPolicy(): AdaptivePolicy {
  const ones = unitBoosts();
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    samples: 0,
    liveHitRate: 0.5,
    horizonSamples: 0,
    horizonHitRate: 0.5,
    tradingWinRate: 0.5,
    tradingPnL: 0,
    modelBoosts: { ...ones },
    modelBoostsCalm: { ...ones },
    modelBoostsHighVol: { ...ones },
    buyHurdleScale: 1,
    confidenceScale: 1,
    sizeScale: 1,
  };
}

export function compactPolicy(policy: AdaptivePolicy): CompactPolicy {
  return {
    b: policy.modelBoosts,
    bc: policy.modelBoostsCalm,
    bh: policy.modelBoostsHighVol,
    h: policy.buyHurdleScale,
    c: policy.confidenceScale,
    s: policy.sizeScale,
    n: policy.samples,
  };
}

function mergeBoosts(source?: Partial<Record<ModelId, number>>): Record<ModelId, number> {
  const boosts = unitBoosts();
  if (!source) return boosts;
  for (const id of MODEL_IDS) {
    const v = source[id];
    if (typeof v === "number" && Number.isFinite(v)) boosts[id] = clamp(v, 0.45, 1.8);
  }
  return boosts;
}

export function expandPolicy(compact: CompactPolicy | null | undefined): AdaptivePolicy {
  const base = defaultPolicy();
  if (!compact) return base;
  const modelBoosts = mergeBoosts(compact.b);
  return {
    ...base,
    modelBoosts,
    modelBoostsCalm: mergeBoosts(compact.bc ?? compact.b),
    modelBoostsHighVol: mergeBoosts(compact.bh ?? compact.b),
    buyHurdleScale: clamp(compact.h ?? 1, 0.7, 1.5),
    confidenceScale: clamp(compact.c ?? 1, 0.7, 1.35),
    sizeScale: clamp(compact.s ?? 1, 0.5, 1.4),
    samples: compact.n ?? 0,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function boostsForRegime(policy: AdaptivePolicy, regime: VolRegime): Record<ModelId, number> {
  return regime === "high" ? policy.modelBoostsHighVol : policy.modelBoostsCalm;
}

export function applyBoostsToWeights(weights: ModelWeights, boosts: Record<ModelId, number>): ModelWeights {
  const scaled = MODEL_IDS.map((id) => Math.max(1e-6, (weights[id] ?? 0) * (boosts[id] ?? 1)));
  const sum = scaled.reduce((a, b) => a + b, 0);
  return Object.fromEntries(MODEL_IDS.map((id, i) => [id, scaled[i] / sum])) as ModelWeights;
}

export function canAutoTrade(policy: AdaptivePolicy): boolean {
  return policy.samples >= AUTO_TRADE_MIN_SAMPLES && policy.liveHitRate >= 0.48;
}

export type PolicyUpdateInput = {
  samples: number;
  liveHitRate: number;
  horizonSamples: number;
  horizonHitRate: number;
  modelHitRates: Partial<Record<ModelId, { hits: number; n: number }>>;
  modelHitRatesCalm: Partial<Record<ModelId, { hits: number; n: number }>>;
  modelHitRatesHigh: Partial<Record<ModelId, { hits: number; n: number }>>;
  tradingWinRate: number;
  tradingPnL: number;
};

function blendBoosts(
  prev: Record<ModelId, number>,
  rates: Partial<Record<ModelId, { hits: number; n: number }>>,
): Record<ModelId, number> {
  const next = { ...prev };
  for (const id of MODEL_IDS) {
    const row = rates[id];
    const observed = row && row.n >= 4 ? row.hits / row.n : 0.5;
    const target = clamp(0.55 + observed, 0.45, 1.8);
    next[id] = clamp(0.62 * (prev[id] ?? 1) + 0.38 * target, 0.45, 1.8);
  }
  return next;
}

export function updatePolicy(prev: AdaptivePolicy, input: PolicyUpdateInput): AdaptivePolicy {
  const samples = input.samples;
  const dailyHit = samples >= 3 ? input.liveHitRate : prev.liveHitRate;
  const horizonHit = input.horizonSamples >= 5 ? input.horizonHitRate : dailyHit;
  const hit = input.horizonSamples >= 5 ? 0.5 * dailyHit + 0.5 * horizonHit : dailyHit;
  const win = input.tradingWinRate;
  const pnlScore = Math.tanh(input.tradingPnL / 5000);

  const modelBoosts = blendBoosts(prev.modelBoosts ?? unitBoosts(), input.modelHitRates);
  const modelBoostsCalm = blendBoosts(prev.modelBoostsCalm ?? prev.modelBoosts, input.modelHitRatesCalm);
  const modelBoostsHighVol = blendBoosts(prev.modelBoostsHighVol ?? prev.modelBoosts, input.modelHitRatesHigh);

  const buyHurdleScale = clamp(1 - 0.35 * (hit - 0.5) - 0.08 * pnlScore, 0.7, 1.5);
  const confidenceScale = clamp(0.78 + 0.44 * hit, 0.7, 1.35);
  const sizeScale =
    samples >= AUTO_TRADE_MIN_SAMPLES
      ? clamp(1 + 0.22 * pnlScore + 0.15 * (win - 0.5), 0.5, 1.4)
      : 1;

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    samples,
    liveHitRate: dailyHit,
    horizonSamples: input.horizonSamples,
    horizonHitRate: horizonHit,
    tradingWinRate: win,
    tradingPnL: input.tradingPnL,
    modelBoosts,
    modelBoostsCalm,
    modelBoostsHighVol,
    buyHurdleScale,
    confidenceScale,
    sizeScale,
  };
}

export function hydratePolicy(parsed: AdaptivePolicy): AdaptivePolicy {
  const base = defaultPolicy();
  return {
    ...base,
    ...parsed,
    modelBoosts: mergeBoosts(parsed.modelBoosts),
    modelBoostsCalm: mergeBoosts(parsed.modelBoostsCalm ?? parsed.modelBoosts),
    modelBoostsHighVol: mergeBoosts(parsed.modelBoostsHighVol ?? parsed.modelBoosts),
  };
}
