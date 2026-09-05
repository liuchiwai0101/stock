import type { DailyPick } from "@/lib/pick-score";
import type { ModelId, TradeSignal } from "@/lib/types";
import { MODEL_IDS } from "@/lib/adaptive-policy";

const STORAGE_KEY = "signal-desk-prediction-log-v1";
const MAX_ROWS = 400;

export type LoggedEvaluation = {
  at: string;
  mark: number;
  actualReturn: number;
  directionHit: boolean;
  towardTarget: boolean;
  modelHits: Partial<Record<ModelId, boolean>>;
};

export type LoggedPrediction = {
  id: string;
  date: string;
  symbol: string;
  name: string;
  last: number;
  targetPrice: number;
  expectedReturn: number;
  signal: TradeSignal;
  confidence: number;
  modelLeans: Partial<Record<ModelId, number>>;
  evaluated?: LoggedEvaluation;
};

function loadRaw(): LoggedPrediction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LoggedPrediction[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadPredictionLog(): LoggedPrediction[] {
  return loadRaw().sort((a, b) => b.date.localeCompare(a.date));
}

export function savePredictionLog(rows: LoggedPrediction[]) {
  if (typeof window === "undefined") return;
  const trimmed = [...rows]
    .sort((a, b) => b.date.localeCompare(a.date) || a.symbol.localeCompare(b.symbol))
    .slice(0, MAX_ROWS);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function appendPredictionsFromPicks(date: string, picks: DailyPick[]): LoggedPrediction[] {
  const existing = loadRaw();
  const keep = existing.filter((row) => !(row.date === date && picks.some((p) => p.symbol === row.symbol)));
  const added: LoggedPrediction[] = picks.map((p) => ({
    id: `${date}:${p.symbol}`,
    date,
    symbol: p.symbol,
    name: p.name,
    last: p.last,
    targetPrice: p.targetPrice,
    expectedReturn: p.expectedReturn,
    signal: p.signal,
    confidence: p.confidence,
    modelLeans: p.modelLeans ?? {},
  }));
  const next = [...added, ...keep];
  savePredictionLog(next);
  return next;
}

export function pendingPredictionSymbols(today: string): string[] {
  return [
    ...new Set(
      loadRaw()
        .filter((row) => !row.evaluated && row.date < today)
        .map((row) => row.symbol),
    ),
  ];
}

export function markEvaluations(updates: LoggedPrediction[]): LoggedPrediction[] {
  const byId = new Map(updates.map((u) => [u.id, u]));
  const next = loadRaw().map((row) => byId.get(row.id) ?? row);
  savePredictionLog(next);
  return next;
}

export function modelHitRates(rows: LoggedPrediction[]): Partial<Record<ModelId, { hits: number; n: number }>> {
  const out: Partial<Record<ModelId, { hits: number; n: number }>> = {};
  for (const id of MODEL_IDS) out[id] = { hits: 0, n: 0 };
  for (const row of rows) {
    if (!row.evaluated) continue;
    for (const id of MODEL_IDS) {
      const lean = row.modelLeans[id];
      if (lean == null || lean === 0) continue;
      const bucket = out[id]!;
      bucket.n += 1;
      if (row.evaluated.modelHits[id]) bucket.hits += 1;
    }
  }
  return out;
}
