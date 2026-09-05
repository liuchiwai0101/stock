import { CAPTURE_TIMEZONE, dateKeyInTimeZone } from "@/lib/market-hours";

const STORAGE_KEY = "signal-desk-pnl-snapshots-v1";
const MAX_SNAPSHOTS = 365;

export type PnlSnapshot = {
  date: string;
  at: string;
  equity: number;
  cash: number;
  totalPnL: number;
  unrealizedPnL: number;
  realizedPnL: number;
  positionCount: number;
};

export function loadPnlSnapshots(): PnlSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PnlSnapshot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePnlSnapshots(snapshots: PnlSnapshot[]) {
  if (typeof window === "undefined") return;
  const trimmed = [...snapshots]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_SNAPSHOTS);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function appendPnlSnapshot(snapshot: PnlSnapshot): PnlSnapshot[] {
  const history = loadPnlSnapshots().filter((s) => s.date !== snapshot.date);
  history.unshift(snapshot);
  savePnlSnapshots(history);
  return history;
}

export function snapshotDateKey(date = new Date(), timeZone = CAPTURE_TIMEZONE): string {
  return dateKeyInTimeZone(date, timeZone);
}

export function filterSnapshotsByPeriod(
  snapshots: PnlSnapshot[],
  days: number | null,
): PnlSnapshot[] {
  if (days == null) return [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffKey = snapshotDateKey(cutoff);
  return snapshots
    .filter((s) => s.date >= cutoffKey)
    .sort((a, b) => a.date.localeCompare(b.date));
}
