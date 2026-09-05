import type { ModelId, ModelWeights } from "@/lib/types";

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

export type AdaptivePolicy = {
  version: 1;
  updatedAt: string;
  samples: number;
  liveHitRate: number;
  tradingWinRate: number;
  tradingPnL: number;
  modelBoosts: Record<ModelId, number>;
  /** Multiplier on BUY/SELL hurdle. >1 = pickier. */
  buyHurdleScale: number;
  /** Multiplier on displayed/used confidence. */
  confidenceScale: number;
  /** Multiplier on recommended position size. */
  sizeScale: number;
};

export type CompactPolicy = {
  b: Partial<Record<ModelId, number>>;
  h: number;
  c: number;
  s: number;
};

export function defaultPolicy(): AdaptivePolicy {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    samples: 0,
    liveHitRate: 0.5,
    tradingWinRate: 0.5,
    tradingPnL: 0,
    modelBoosts: Object.fromEntries(MODEL_IDS.map((id) => [id, 1])) as Record<ModelId, number>,
    buyHurdleScale: 1,
    confidenceScale: 1,
    sizeScale: 1,
  };
}

export function compactPolicy(policy: AdaptivePolicy): CompactPolicy {
  return {
    b: policy.modelBoosts,
    h: policy.buyHurdleScale,
    c: policy.confidenceScale,
    s: policy.sizeScale,
  };
}

export function expandPolicy(compact: CompactPolicy | null | undefined): AdaptivePolicy {
  const base = defaultPolicy();
  if (!compact) return base;
  const boosts = { ...base.modelBoosts };
  for (const id of MODEL_IDS) {
    const v = compact.b?.[id];
    if (typeof v === "number" && Number.isFinite(v)) {
      boosts[id] = clamp(v, 0.45, 1.8);
    }
  }
  return {
    ...base,
    modelBoosts: boosts,
    buyHurdleScale: clamp(compact.h ?? 1, 0.7, 1.5),
    confidenceScale: clamp(compact.c ?? 1, 0.7, 1.35),
    sizeScale: clamp(compact.s ?? 1, 0.5, 1.4),
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function applyBoostsToWeights(weights: ModelWeights, boosts: Record<ModelId, number>): ModelWeights {
  const scaled = MODEL_IDS.map((id) => Math.max(1e-6, (weights[id] ?? 0) * (boosts[id] ?? 1)));
  const sum = scaled.reduce((a, b) => a + b, 0);
  return Object.fromEntries(MODEL_IDS.map((id, i) => [id, scaled[i] / sum])) as ModelWeights;
}

export type PolicyUpdateInput = {
  samples: number;
  liveHitRate: number;
  modelHitRates: Partial<Record<ModelId, { hits: number; n: number }>>;
  tradingWinRate: number;
  tradingPnL: number;
};

export function updatePolicy(prev: AdaptivePolicy, input: PolicyUpdateInput): AdaptivePolicy {
  const samples = input.samples;
  const hit = samples >= 3 ? input.liveHitRate : prev.liveHitRate;
  const win = input.tradingWinRate;
  const pnlScore = Math.tanh(input.tradingPnL / 5000);

  const boosts = { ...prev.modelBoosts };
  for (const id of MODEL_IDS) {
    const row = input.modelHitRates[id];
    const observed = row && row.n >= 4 ? row.hits / row.n : 0.5;
    const target = clamp(0.55 + observed, 0.45, 1.8);
    const blended = 0.62 * (prev.modelBoosts[id] ?? 1) + 0.38 * target;
    boosts[id] = clamp(blended, 0.45, 1.8);
  }

  const buyHurdleScale = clamp(1 - 0.35 * (hit - 0.5) - 0.08 * pnlScore, 0.7, 1.5);
  const confidenceScale = clamp(0.78 + 0.44 * hit, 0.7, 1.35);
  const sizeScale = clamp(1 + 0.22 * pnlScore + 0.15 * (win - 0.5), 0.5, 1.4);

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    samples,
    liveHitRate: hit,
    tradingWinRate: win,
    tradingPnL: input.tradingPnL,
    modelBoosts: boosts,
    buyHurdleScale,
    confidenceScale,
    sizeScale,
  };
}
