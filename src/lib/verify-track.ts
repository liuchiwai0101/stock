import { scopedStorageKey } from "@/lib/account";
import { todayCaptureKey } from "@/lib/scan-history";
import type { CompanyForecast, Horizon, ModelId, TradeSignal } from "@/lib/types";

const STORAGE_BASE = "signal-desk-verify-track-v1";
const MAX_SNAPSHOTS = 500;
const MAX_TRACKS = 24;

export type VerifyTrack = {
  symbol: string;
  name: string;
  startedAt: string;
  chosenModels: ModelId[];
  horizon: Horizon;
};

export type VerifySnapshotEval = {
  at: string;
  mark: number;
  actualReturn: number;
  ensembleHit: boolean;
  modelHits: Partial<Record<ModelId, boolean>>;
};

export type VerifySnapshot = {
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
  chosenModels: ModelId[];
  evaluated?: VerifySnapshotEval;
};

export type VerifyStore = {
  tracks: VerifyTrack[];
  snapshots: VerifySnapshot[];
};

export type RollingConfidence = {
  hits: number;
  n: number;
  rate: number;
};

function storageKey() {
  return typeof window === "undefined" ? STORAGE_BASE : scopedStorageKey(STORAGE_BASE);
}

function emptyStore(): VerifyStore {
  return { tracks: [], snapshots: [] };
}

function normalizeStore(raw: VerifyStore | null | undefined): VerifyStore {
  if (!raw || typeof raw !== "object") return emptyStore();
  return {
    tracks: Array.isArray(raw.tracks) ? raw.tracks.map(normalizeTrack).filter(Boolean) as VerifyTrack[] : [],
    snapshots: Array.isArray(raw.snapshots)
      ? raw.snapshots.map(normalizeSnapshot).filter(Boolean) as VerifySnapshot[]
      : [],
  };
}

function normalizeTrack(row: VerifyTrack): VerifyTrack | null {
  if (!row?.symbol) return null;
  return {
    symbol: String(row.symbol).toUpperCase(),
    name: row.name || row.symbol,
    startedAt: row.startedAt || new Date().toISOString(),
    chosenModels: Array.isArray(row.chosenModels) ? row.chosenModels : [],
    horizon: ([5, 10, 21, 63].includes(row.horizon) ? row.horizon : 21) as Horizon,
  };
}

function normalizeSnapshot(row: VerifySnapshot): VerifySnapshot | null {
  if (!row?.id || !row.symbol || !row.date) return null;
  return {
    ...row,
    symbol: String(row.symbol).toUpperCase(),
    modelLeans: row.modelLeans ?? {},
    chosenModels: Array.isArray(row.chosenModels) ? row.chosenModels : [],
    horizon: ([5, 10, 21, 63].includes(row.horizon) ? row.horizon : 21) as Horizon,
  };
}

export function loadVerifyStore(): VerifyStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw =
      window.localStorage.getItem(storageKey()) ?? window.localStorage.getItem(STORAGE_BASE);
    if (!raw) return emptyStore();
    return normalizeStore(JSON.parse(raw) as VerifyStore);
  } catch {
    return emptyStore();
  }
}

export function saveVerifyStore(store: VerifyStore) {
  if (typeof window === "undefined") return;
  const next: VerifyStore = {
    tracks: store.tracks.slice(0, MAX_TRACKS),
    snapshots: [...store.snapshots]
      .sort((a, b) => b.date.localeCompare(a.date) || a.symbol.localeCompare(b.symbol))
      .slice(0, MAX_SNAPSHOTS),
  };
  window.localStorage.setItem(storageKey(), JSON.stringify(next));
}

export function isVerifyTracked(symbol: string, store = loadVerifyStore()): boolean {
  const key = symbol.toUpperCase();
  return store.tracks.some((t) => t.symbol === key);
}

export function getVerifyTrack(symbol: string, store = loadVerifyStore()): VerifyTrack | null {
  const key = symbol.toUpperCase();
  return store.tracks.find((t) => t.symbol === key) ?? null;
}

/** Prefer the heaviest models so Watch starts with a focused shortlist. */
export function defaultChosenModels(quote: CompanyForecast, limit = 3): ModelId[] {
  return [...(quote.models ?? [])]
    .sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id))
    .filter((m) => m.weight > 0)
    .slice(0, limit)
    .map((m) => m.id);
}

export function modelLeansFromQuote(quote: CompanyForecast): Partial<Record<ModelId, number>> {
  const leans: Partial<Record<ModelId, number>> = {};
  for (const model of quote.models ?? []) {
    leans[model.id] = model.expectedReturn;
  }
  return leans;
}

export function snapshotFromQuote(
  quote: CompanyForecast,
  track: Pick<VerifyTrack, "chosenModels" | "horizon">,
  date = todayCaptureKey(),
): VerifySnapshot {
  return {
    id: `${date}:${quote.symbol.toUpperCase()}`,
    date,
    symbol: quote.symbol.toUpperCase(),
    name: quote.name,
    last: quote.last,
    targetPrice: quote.targetPrice,
    expectedReturn: quote.expectedReturn,
    signal: quote.signal,
    confidence: quote.confidence,
    horizon: track.horizon,
    modelLeans: modelLeansFromQuote(quote),
    chosenModels: [...track.chosenModels],
  };
}

export function startVerifyTrack(
  quote: CompanyForecast,
  opts?: { chosenModels?: ModelId[]; horizon?: Horizon },
): VerifyStore {
  const store = loadVerifyStore();
  const symbol = quote.symbol.toUpperCase();
  const chosenModels = opts?.chosenModels ?? defaultChosenModels(quote);
  const horizon = opts?.horizon ?? (([5, 10, 21, 63].includes(quote.backtest.horizon)
    ? quote.backtest.horizon
    : 21) as Horizon);
  const track: VerifyTrack = {
    symbol,
    name: quote.name,
    startedAt: new Date().toISOString(),
    chosenModels,
    horizon,
  };
  const tracks = [track, ...store.tracks.filter((t) => t.symbol !== symbol)].slice(0, MAX_TRACKS);
  const snap = snapshotFromQuote(quote, track);
  const snapshots = [snap, ...store.snapshots.filter((s) => s.id !== snap.id)];
  const next = { tracks, snapshots };
  saveVerifyStore(next);
  return next;
}

export function stopVerifyTrack(symbol: string): VerifyStore {
  const key = symbol.toUpperCase();
  const store = loadVerifyStore();
  const next = {
    tracks: store.tracks.filter((t) => t.symbol !== key),
    snapshots: store.snapshots,
  };
  saveVerifyStore(next);
  return next;
}

export function setChosenModels(symbol: string, chosenModels: ModelId[]): VerifyStore {
  const key = symbol.toUpperCase();
  const store = loadVerifyStore();
  const next = {
    ...store,
    tracks: store.tracks.map((t) => (t.symbol === key ? { ...t, chosenModels: [...chosenModels] } : t)),
  };
  saveVerifyStore(next);
  return next;
}

export function upsertDailySnapshots(
  quotes: CompanyForecast[],
  date = todayCaptureKey(),
): VerifyStore | null {
  const store = loadVerifyStore();
  if (store.tracks.length === 0) return null;
  const bySymbol = new Map(quotes.map((q) => [q.symbol.toUpperCase(), q]));
  let snapshots = [...store.snapshots];
  let changed = false;
  for (const track of store.tracks) {
    const quote = bySymbol.get(track.symbol);
    if (!quote || !(quote.last > 0)) continue;
    const snap = snapshotFromQuote(quote, track, date);
    const existing = snapshots.find((s) => s.id === snap.id);
    if (existing) {
      if (existing.evaluated) continue;
      // Refresh today's pending call when Analyze updates prices/signals.
      if (
        existing.last === snap.last &&
        existing.expectedReturn === snap.expectedReturn &&
        existing.signal === snap.signal &&
        existing.confidence === snap.confidence
      ) {
        continue;
      }
    }
    snapshots = [snap, ...snapshots.filter((s) => s.id !== snap.id)];
    changed = true;
  }
  if (!changed) return null;
  const next = { tracks: store.tracks, snapshots };
  saveVerifyStore(next);
  return next;
}

export function evaluateVerifySnapshot(
  row: VerifySnapshot,
  mark: number,
  evaluatedAt: string,
): VerifySnapshot {
  if (!(mark > 0) || !(row.last > 0)) return row;
  const actualReturn = mark / row.last - 1;
  const predictedSign = Math.sign(row.expectedReturn);
  const actualSign = Math.sign(actualReturn);
  const ensembleHit = predictedSign === 0 ? actualSign === 0 : predictedSign === actualSign;
  const modelHits: Partial<Record<ModelId, boolean>> = {};
  for (const id of row.chosenModels) {
    const lean = row.modelLeans[id];
    if (lean == null || lean === 0) continue;
    modelHits[id] = Math.sign(lean) === actualSign || (actualSign === 0 && lean === 0);
  }
  return {
    ...row,
    evaluated: {
      at: evaluatedAt,
      mark,
      actualReturn,
      ensembleHit,
      modelHits,
    },
  };
}

export function evaluatePendingSnapshots(
  marks: Record<string, number>,
  today = todayCaptureKey(),
): VerifyStore | null {
  const store = loadVerifyStore();
  const now = new Date().toISOString();
  let changed = false;
  const snapshots = store.snapshots.map((row) => {
    if (row.evaluated || row.date >= today) return row;
    const mark = marks[row.symbol];
    if (!(mark > 0)) return row;
    changed = true;
    return evaluateVerifySnapshot(row, mark, now);
  });
  if (!changed) return null;
  const next = { tracks: store.tracks, snapshots };
  saveVerifyStore(next);
  return next;
}

export function snapshotsForSymbol(symbol: string, store = loadVerifyStore()): VerifySnapshot[] {
  const key = symbol.toUpperCase();
  return store.snapshots
    .filter((s) => s.symbol === key)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function rollingConfidence(rows: VerifySnapshot[]): RollingConfidence {
  const scored = rows.filter((r) => r.evaluated);
  const n = scored.length;
  const hits = scored.filter((r) => r.evaluated?.ensembleHit).length;
  return { hits, n, rate: n === 0 ? 0 : hits / n };
}

export function modelRollingConfidence(rows: VerifySnapshot[], modelId: ModelId): RollingConfidence {
  let hits = 0;
  let n = 0;
  for (const row of rows) {
    if (!row.evaluated) continue;
    const lean = row.modelLeans[modelId];
    if (lean == null || lean === 0) continue;
    if (!(modelId in (row.evaluated.modelHits ?? {})) && !row.chosenModels.includes(modelId)) continue;
    const hit = row.evaluated.modelHits[modelId];
    if (hit == null) continue;
    n += 1;
    if (hit) hits += 1;
  }
  return { hits, n, rate: n === 0 ? 0 : hits / n };
}

export function pendingVerifySymbols(today = todayCaptureKey(), store = loadVerifyStore()): string[] {
  return [
    ...new Set(
      store.snapshots
        .filter((row) => !row.evaluated && row.date < today)
        .map((row) => row.symbol),
    ),
  ];
}
