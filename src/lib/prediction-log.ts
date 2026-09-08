import type { DailyPick } from "@/lib/pick-score";
import type { Horizon, ModelId, TradeSignal } from "@/lib/types";

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

export type HorizonEvaluation = {
  at: string;
  mark: number;
  actualReturn: number;
  directionHit: boolean;
  towardTarget: boolean;
  targetError: number;
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
  horizon: Horizon;
  modelLeans: Partial<Record<ModelId, number>>;
  evaluated?: LoggedEvaluation;
  horizonEvaluated?: HorizonEvaluation;
};

function normalizeRow(row: LoggedPrediction): LoggedPrediction {
  return {
    ...row,
    horizon: (row.horizon ?? 21) as Horizon,
    modelLeans: row.modelLeans ?? {},
  };
}

function loadRaw(): LoggedPrediction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LoggedPrediction[];
    return Array.isArray(parsed) ? parsed.map(normalizeRow) : [];
  } catch {
    return [];
  }
}

export function loadPredictionLog(): LoggedPrediction[] {
  return loadRaw().sort((a, b) => b.date.localeCompare(a.date) || a.symbol.localeCompare(b.symbol));
}

export function savePredictionLog(rows: LoggedPrediction[]) {
  if (typeof window === "undefined") return;
  const trimmed = [...rows]
    .sort((a, b) => b.date.localeCompare(a.date) || a.symbol.localeCompare(b.symbol))
    .slice(0, MAX_ROWS);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function appendPredictionsFromPicks(
  date: string,
  picks: DailyPick[],
  horizon: Horizon = 21,
): LoggedPrediction[] {
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
    horizon: p.horizon ?? horizon,
    modelLeans: p.modelLeans ?? {},
  }));
  const next = [...added, ...keep];
  savePredictionLog(next);
  return next;
}

export function markEvaluations(updates: LoggedPrediction[]): LoggedPrediction[] {
  const byId = new Map(updates.map((u) => [u.id, u]));
  const next = loadRaw().map((row) => byId.get(row.id) ?? row);
  savePredictionLog(next);
  return next;
}

export function modelHitRates(rows: LoggedPrediction[]): Partial<Record<ModelId, { hits: number; n: number }>> {
  const out: Partial<Record<ModelId, { hits: number; n: number }>> = {};
  for (const row of rows) {
    if (!row.evaluated) continue;
    for (const [id, lean] of Object.entries(row.modelLeans)) {
      if (lean == null || lean === 0) continue;
      const key = id as ModelId;
      const bucket = out[key] ?? { hits: 0, n: 0 };
      bucket.n += 1;
      if (row.evaluated.modelHits[key]) bucket.hits += 1;
      out[key] = bucket;
    }
  }
  return out;
}
