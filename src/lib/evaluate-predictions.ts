import type { ModelId } from "@/lib/types";
import type { LoggedPrediction } from "@/lib/prediction-log";

export function evaluatePrediction(row: LoggedPrediction, mark: number, evaluatedAt: string): LoggedPrediction {
  if (!(mark > 0) || !(row.last > 0)) return row;
  const actualReturn = mark / row.last - 1;
  const predictedSign = Math.sign(row.expectedReturn);
  const actualSign = Math.sign(actualReturn);
  const directionHit = predictedSign === 0 ? actualSign === 0 : predictedSign === actualSign;
  const towardTarget =
    row.targetPrice >= row.last ? mark >= row.last : mark <= row.last;

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

export function liveHitRate(rows: LoggedPrediction[]): { hits: number; n: number; rate: number } {
  const scored = rows.filter((r) => r.evaluated);
  const n = scored.length;
  const hits = scored.filter((r) => r.evaluated?.directionHit).length;
  return { hits, n, rate: n === 0 ? 0.5 : hits / n };
}
