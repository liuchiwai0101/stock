import { updatePolicy, type AdaptivePolicy } from "@/lib/adaptive-policy";
import { evaluatePrediction, liveHitRate } from "@/lib/evaluate-predictions";
import { todayCaptureKey } from "@/lib/scan-history";
import {
  loadPredictionLog,
  markEvaluations,
  modelHitRates,
  pendingPredictionSymbols,
  type LoggedPrediction,
} from "@/lib/prediction-log";
import { computeBookPnL } from "@/lib/pnl";
import { loadPolicy, savePolicy } from "@/lib/policy-store";
import { loadPortfolio } from "@/lib/trading";
import type { Fill } from "@/lib/types";

export type LearnReport = {
  evaluated: number;
  pending: number;
  liveHitRate: number;
  tradingWinRate: number;
  policy: AdaptivePolicy;
};

function fillWinRate(fills: Fill[], marks: Record<string, number>): number {
  const scored = fills.filter((f) => (marks[f.symbol] ?? 0) > 0);
  if (scored.length === 0) return 0.5;
  let wins = 0;
  for (const f of scored) {
    const mark = marks[f.symbol];
    if (f.side === "BUY" && mark >= f.price) wins += 1;
    if (f.side === "SELL" && mark <= f.price) wins += 1;
  }
  return wins / scored.length;
}

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

export async function runLearnCycle(): Promise<LearnReport> {
  const today = todayCaptureKey();
  const pending = pendingPredictionSymbols(today);
  const portfolio = loadPortfolio();
  const held = portfolio.positions.map((p) => p.symbol);
  const recentFills = portfolio.fills.slice(0, 80).map((f) => f.symbol);
  const marks = await fetchMarks([...pending, ...held, ...recentFills]);

  const now = new Date().toISOString();
  const updates: LoggedPrediction[] = [];
  for (const row of loadPredictionLog()) {
    if (row.evaluated || row.date >= today) continue;
    const mark = marks[row.symbol];
    if (!(mark > 0)) continue;
    updates.push(evaluatePrediction(row, mark, now));
  }
  if (updates.length) markEvaluations(updates);

  const log = loadPredictionLog();
  const hit = liveHitRate(log);
  const book = computeBookPnL(portfolio, marks);
  const winRate = fillWinRate(portfolio.fills, marks);
  const next = updatePolicy(loadPolicy(), {
    samples: hit.n,
    liveHitRate: hit.rate,
    modelHitRates: modelHitRates(log),
    tradingWinRate: winRate,
    tradingPnL: book.totalPnL,
  });
  savePolicy(next);

  return {
    evaluated: updates.length,
    pending: pendingPredictionSymbols(today).length,
    liveHitRate: hit.rate,
    tradingWinRate: winRate,
    policy: next,
  };
}
