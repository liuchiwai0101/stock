import type { DailyPick } from "@/lib/pick-score";
import type { Horizon, ModelId, TradeSignal } from "@/lib/types";
import { MODEL_IDS } from "@/lib/adaptive-policy";
import type { VolRegime } from "@/lib/vol-regime";
import { businessDaysBetween } from "@/lib/market-hours";

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
  volRegime: VolRegime;
  modelLeans: Partial<Record<ModelId, number>>;
  evaluated?: LoggedEvaluation;
  horizonEvaluated?: HorizonEvaluation;
};

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

function normalizeRow(row: LoggedPrediction): LoggedPrediction {
  return {
    ...row,
    horizon: (row.horizon ?? 21) as Horizon,
    volRegime: row.volRegime === "high" ? "high" : "calm",
    modelLeans: row.modelLeans ?? {},
  };
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

export function mergePredictionLogs(local: LoggedPrediction[], remote: LoggedPrediction[]): LoggedPrediction[] {
  const byId = new Map<string, LoggedPrediction>();
  for (const row of [...remote, ...local].map(normalizeRow)) {
    const existing = byId.get(row.id);
    if (!existing) {
      byId.set(row.id, row);
      continue;
    }
    byId.set(row.id, {
      ...existing,
      ...row,
      evaluated: row.evaluated ?? existing.evaluated,
      horizonEvaluated: row.horizonEvaluated ?? existing.horizonEvaluated,
      modelLeans: { ...existing.modelLeans, ...row.modelLeans },
    });
  }
  return [...byId.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX_ROWS);
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
    volRegime: p.volRegime ?? "calm",
    modelLeans: p.modelLeans ?? {},
  }));
  const next = [...added, ...keep];
  savePredictionLog(next);
  return next;
}

export function pendingDirectionSymbols(today: string): string[] {
  return [
    ...new Set(
      loadRaw()
        .filter((row) => !row.evaluated && row.date < today)
        .map((row) => row.symbol),
    ),
  ];
}

export function pendingHorizonSymbols(today: string): string[] {
  return [
    ...new Set(
      loadRaw()
        .filter((row) => !row.horizonEvaluated && businessDaysBetween(row.date, today) >= row.horizon)
        .map((row) => row.symbol),
    ),
  ];
}

export function pendingPredictionSymbols(today: string): string[] {
  return [...new Set([...pendingDirectionSymbols(today), ...pendingHorizonSymbols(today)])];
}

export function markEvaluations(updates: LoggedPrediction[]): LoggedPrediction[] {
  const byId = new Map(updates.map((u) => [u.id, u]));
  const next = loadRaw().map((row) => byId.get(row.id) ?? row);
  savePredictionLog(next);
  return next;
}

export function replacePredictionLog(rows: LoggedPrediction[]) {
  savePredictionLog(rows.map(normalizeRow));
}

export function modelHitRates(
  rows: LoggedPrediction[],
  regime?: VolRegime,
): Partial<Record<ModelId, { hits: number; n: number }>> {
  const out: Partial<Record<ModelId, { hits: number; n: number }>> = {};
  for (const id of MODEL_IDS) out[id] = { hits: 0, n: 0 };
  for (const row of rows) {
    if (!row.evaluated) continue;
    if (regime && row.volRegime !== regime) continue;
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
