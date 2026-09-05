import type { CompanyForecast, ModelId } from "@/lib/types";
import { loadPolicy } from "@/lib/policy-store";

export type DailyPick = {
  rank: number;
  symbol: string;
  name: string;
  last: number;
  targetPrice: number;
  expectedReturn: number;
  confidence: number;
  hitRate: number;
  sharpe: number;
  pickScore: number;
  modelBuyVotes: number;
  modelCount: number;
  recommendedWeight: number;
  signal: CompanyForecast["signal"];
  liveReady: boolean;
  modelLeans?: Partial<Record<ModelId, number>>;
};

/** Composite score from ensemble + all 10 model breakdowns, tilted by live policy. */
export function scorePick(q: CompanyForecast): number {
  if (!q.liveReady || q.signal !== "BUY") return Number.NEGATIVE_INFINITY;

  const models = q.models ?? [];
  const modelCount = Math.max(1, models.length);
  const modelBuyVotes = models.filter((m) => m.expectedReturn > 0).length / modelCount;
  const avgModelHit = models.reduce((sum, m) => sum + m.hitRate, 0) / modelCount;
  const sharpeNorm = Math.min(1, Math.max(0, q.backtest.sharpe / 2));
  const expNorm = Math.min(1, Math.max(0, q.expectedReturn * 12));
  const policy = typeof window === "undefined" ? null : loadPolicy();
  const liveTilt = policy && policy.samples >= 3 ? 0.85 + 0.3 * policy.liveHitRate : 1;

  const base =
    0.3 * q.metrics.hitRate +
    0.2 * q.confidence +
    0.15 * expNorm +
    0.15 * sharpeNorm +
    0.1 * modelBuyVotes +
    0.1 * avgModelHit;

  return base * liveTilt;
}

export function toDailyPick(q: CompanyForecast, rank: number, pickScore: number): DailyPick {
  const models = q.models ?? [];
  const modelBuyVotes = models.filter((m) => m.expectedReturn > 0).length;

  return {
    rank,
    symbol: q.symbol,
    name: q.name,
    last: q.last,
    targetPrice: q.targetPrice,
    expectedReturn: q.expectedReturn,
    confidence: q.confidence,
    hitRate: q.metrics.hitRate,
    sharpe: q.backtest.sharpe,
    pickScore,
    modelBuyVotes,
    modelCount: models.length,
    recommendedWeight: q.recommendedWeight,
    signal: q.signal,
    liveReady: q.liveReady,
    modelLeans: Object.fromEntries((q.models ?? []).map((m) => [m.id, m.expectedReturn])),
  };
}

export function selectTopPicks(quotes: CompanyForecast[], limit = 10): DailyPick[] {
  return quotes
    .map((q) => ({ q, pickScore: scorePick(q) }))
    .filter((row) => Number.isFinite(row.pickScore))
    .sort((a, b) => {
      const score = b.pickScore - a.pickScore;
      if (Math.abs(score) > 1e-9) return score;
      const hit = b.q.metrics.hitRate - a.q.metrics.hitRate;
      if (Math.abs(hit) > 1e-9) return hit;
      return b.q.confidence - a.q.confidence;
    })
    .slice(0, limit)
    .map((row, index) => toDailyPick(row.q, index + 1, row.pickScore));
}
