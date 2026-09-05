import { updatePolicy, type AdaptivePolicy } from "@/lib/adaptive-policy";
import { costAwareFillWinRate, costAwarePnL } from "@/lib/cost-aware";
import { evaluateHorizon, evaluatePrediction, horizonHitRate, liveHitRate } from "@/lib/evaluate-predictions";
import { businessDaysBetween } from "@/lib/market-hours";
import { todayCaptureKey } from "@/lib/scan-history";
import {
  loadPredictionLog,
  markEvaluations,
  mergePredictionLogs,
  modelHitRates,
  pendingPredictionSymbols,
  replacePredictionLog,
  type LoggedPrediction,
} from "@/lib/prediction-log";
import { computeBookPnL } from "@/lib/pnl";
import { loadPolicy, savePolicy } from "@/lib/policy-store";
import { loadPortfolio } from "@/lib/trading";

export type LearnReport = {
  evaluated: number;
  horizonEvaluated: number;
  pending: number;
  liveHitRate: number;
  horizonHitRate: number;
  tradingWinRate: number;
  policy: AdaptivePolicy;
};

async function fetchMarks(symbols: string[]): Promise<Record<string, number>> {
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  const marks: Record<string, number> = {};
  for (let i = 0; i < unique.length; i += 30) {
    const chunk = unique.slice(i, i + 30);
    const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(chunk.join(","))}`, {
      cache: "no-store",
    });
    const json = (await res.json()) as { quotes?: { symbol: string; last: number }[] };
    for (const q of json.quotes ?? []) {
      if (q.last > 0) marks[q.symbol] = q.last;
    }
  }
  return marks;
}

async function pullRemoteLog(): Promise<LoggedPrediction[] | null> {
  try {
    const res = await fetch("/api/learn-log", { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { predictions?: LoggedPrediction[] };
    return Array.isArray(json.predictions) ? json.predictions : [];
  } catch {
    return null;
  }
}

async function pushRemoteLog(predictions: LoggedPrediction[], policy: AdaptivePolicy) {
  try {
    await fetch("/api/learn-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ predictions, policy }),
    });
  } catch {
    // Local log remains the source if the server is unavailable.
  }
}

export async function runLearnCycle(): Promise<LearnReport> {
  const remote = await pullRemoteLog();
  if (remote?.length) {
    replacePredictionLog(mergePredictionLogs(loadPredictionLog(), remote));
  }

  const today = todayCaptureKey();
  const pending = pendingPredictionSymbols(today);
  const portfolio = loadPortfolio();
  const held = portfolio.positions.map((p) => p.symbol);
  const recentFills = portfolio.fills.slice(0, 80).map((f) => f.symbol);
  const marks = await fetchMarks([...pending, ...held, ...recentFills]);

  const now = new Date().toISOString();
  const updates: LoggedPrediction[] = [];
  let directionCount = 0;
  let horizonCount = 0;

  for (const row of loadPredictionLog()) {
    const mark = marks[row.symbol];
    if (!(mark > 0)) continue;
    let next = row;
    if (!row.evaluated && row.date < today) {
      next = evaluatePrediction(next, mark, now);
      directionCount += 1;
    }
    if (!next.horizonEvaluated && businessDaysBetween(row.date, today) >= row.horizon) {
      next = evaluateHorizon(next, mark, now);
      horizonCount += 1;
    }
    if (next !== row) updates.push(next);
  }
  if (updates.length) markEvaluations(updates);

  const log = loadPredictionLog();
  const hit = liveHitRate(log);
  const horizon = horizonHitRate(log);
  const book = computeBookPnL(portfolio, marks);
  const winRate = costAwareFillWinRate(portfolio.fills, marks);
  const pnl = costAwarePnL(book.totalPnL, portfolio.fills);
  const next = updatePolicy(loadPolicy(), {
    samples: hit.n,
    liveHitRate: hit.rate,
    horizonSamples: horizon.n,
    horizonHitRate: horizon.rate,
    modelHitRates: modelHitRates(log),
    modelHitRatesCalm: modelHitRates(log, "calm"),
    modelHitRatesHigh: modelHitRates(log, "high"),
    tradingWinRate: winRate,
    tradingPnL: pnl,
  });
  savePolicy(next);
  await pushRemoteLog(log, next);

  return {
    evaluated: directionCount,
    horizonEvaluated: horizonCount,
    pending: pendingPredictionSymbols(today).length,
    liveHitRate: hit.rate,
    horizonHitRate: horizon.rate,
    tradingWinRate: winRate,
    policy: next,
  };
}
