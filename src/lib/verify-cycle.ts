import { evaluateHorizon, evaluatePrediction, calendarDaysBetween } from "@/lib/evaluate-predictions";
import { loadQuote } from "@/lib/market";
import { loadPredictionLog, markEvaluations, type LoggedPrediction } from "@/lib/prediction-log";

export type VerifyReport = {
  evaluated: number;
  horizonEvaluated: number;
  waitingForNewerQuotes: number;
  liveHitRate: number;
};

async function loadMarks(symbols: string[]): Promise<Map<string, { last: number; asOf: string }>> {
  const marks = new Map<string, { last: number; asOf: string }>();
  for (const symbol of [...new Set(symbols)]) {
    try {
      const series = await loadQuote(symbol);
      const bar = series.bars.at(-1);
      if (!bar || !(bar.close > 0)) continue;
      marks.set(symbol, { last: bar.close, asOf: bar.date });
    } catch {
      // Skip symbols without a quote snapshot.
    }
  }
  return marks;
}

export async function runVerifyCycle(rows = loadPredictionLog()): Promise<VerifyReport> {
  const pending = rows.filter((row) => !row.evaluated || !row.horizonEvaluated);
  const marks = await loadMarks(pending.map((row) => row.symbol));
  const evaluatedAt = new Date().toISOString();
  const updates: LoggedPrediction[] = [];
  let evaluated = 0;
  let horizonEvaluated = 0;
  let waitingForNewerQuotes = 0;

  for (const row of pending) {
    const mark = marks.get(row.symbol);
    if (!mark) continue;
    let next = row;

    if (!row.evaluated) {
      if (mark.asOf > row.date) {
        next = evaluatePrediction(next, mark.last, evaluatedAt);
        evaluated += 1;
      } else {
        waitingForNewerQuotes += 1;
      }
    }

    if (!next.horizonEvaluated && calendarDaysBetween(row.date, mark.asOf) >= row.horizon) {
      next = evaluateHorizon(next, mark.last, evaluatedAt);
      horizonEvaluated += 1;
    }

    if (next !== row) updates.push(next);
  }

  const scored = markEvaluations(updates);
  const hits = scored.filter((r) => r.evaluated?.directionHit).length;
  const n = scored.filter((r) => r.evaluated).length;

  return {
    evaluated,
    horizonEvaluated,
    waitingForNewerQuotes,
    liveHitRate: n === 0 ? 0.5 : hits / n,
  };
}
