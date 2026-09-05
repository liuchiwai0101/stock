import type { ModelId } from "@/lib/types";
import type { LoggedPrediction } from "@/lib/prediction-log";

export function evaluatePrediction(row: LoggedPrediction, mark: number, evaluatedAt: string): LoggedPrediction {
  if (!(mark > 0) || !(row.last > 0)) return row;
  const actualReturn = mark / row.last - 1;
  const predictedSign = Math.sign(row.expectedReturn);
  const actualSign = Math.sign(actualReturn);
  const directionHit = predictedSign === 0 ? actualSign === 0 : predictedSign === actualSign;
  const towardTarget = row.targetPrice >= row.last ? mark >= row.last : mark <= row.last;

  const modelHits: Partial<Record<ModelId, boolean>> = {};
  for (const [id, lean] of Object.entries(row.modelLeans)) {
    if (lean == null || lean === 0) continue;
    modelHits[id as ModelId] = Math.sign(lean) === actualSign || (actualSign === 0 && lean === 0);
  }

  return {
    ...row,
    evaluated: {
      at: evaluatedAt,
      mark,
      actualReturn,
      directionHit,
      towardTarget,
      modelHits,
    },
  };
}

export function evaluateHorizon(
  row: LoggedPrediction,
  mark: number,
  evaluatedAt: string,
): LoggedPrediction {
  if (!(mark > 0) || !(row.last > 0) || !(row.targetPrice > 0)) return row;
  const actualReturn = mark / row.last - 1;
  const predictedSign = Math.sign(row.expectedReturn);
  const actualSign = Math.sign(actualReturn);
  const directionHit = predictedSign === 0 ? actualSign === 0 : predictedSign === actualSign;
  const targetError = Math.abs(mark - row.targetPrice) / row.last;
  const towardTarget = Math.abs(mark - row.targetPrice) < Math.abs(row.last - row.targetPrice);

  return {
    ...row,
    horizonEvaluated: {
      at: evaluatedAt,
      mark,
      actualReturn,
      directionHit,
      towardTarget,
      targetError,
    },
  };
}

export function liveHitRate(rows: LoggedPrediction[]): { hits: number; n: number; rate: number } {
  const scored = rows.filter((r) => r.evaluated);
  const n = scored.length;
  const hits = scored.filter((r) => r.evaluated?.directionHit).length;
  return { hits, n, rate: n === 0 ? 0.5 : hits / n };
}

export function horizonHitRate(rows: LoggedPrediction[]): { hits: number; n: number; rate: number; avgTargetError: number } {
  const scored = rows.filter((r) => r.horizonEvaluated);
  const n = scored.length;
  const hits = scored.filter((r) => r.horizonEvaluated?.directionHit).length;
  const avgTargetError =
    n === 0 ? 0 : scored.reduce((s, r) => s + (r.horizonEvaluated?.targetError ?? 0), 0) / n;
  return { hits, n, rate: n === 0 ? 0.5 : hits / n, avgTargetError };
}
