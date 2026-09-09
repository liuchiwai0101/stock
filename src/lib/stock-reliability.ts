import type { LoggedPrediction } from "@/lib/prediction-log";

export const RELIABILITY_LOOKBACK = 5;
export const RELIABILITY_MIN_HITS = 1;

/** Tickers whose last N scored calls were almost all misses. */
export function unreliableSymbols(
  rows: LoggedPrediction[],
  lookback = RELIABILITY_LOOKBACK,
  minHits = RELIABILITY_MIN_HITS,
): Set<string> {
  const bySymbol = new Map<string, LoggedPrediction[]>();
  for (const row of rows) {
    if (!row.evaluated) continue;
    const list = bySymbol.get(row.symbol) ?? [];
    list.push(row);
    bySymbol.set(row.symbol, list);
  }

  const out = new Set<string>();
  for (const [symbol, list] of bySymbol) {
    const recent = [...list].sort((a, b) => b.date.localeCompare(a.date)).slice(0, lookback);
    if (recent.length < lookback) continue;
    const hits = recent.filter((r) => r.evaluated?.directionHit).length;
    if (hits < minHits) out.add(symbol);
  }
  return out;
}
