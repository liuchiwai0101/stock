import type { DailyPick } from "@/lib/pick-score";
import type { Horizon } from "@/lib/types";

const STORAGE_KEY = "signal-desk-daily-scans-v1";
const MAX_DAYS = 120;

export type ScanMeta = {
  scanned: number;
  total: number;
  passed: number;
  buyCount: number;
};

export type DailyScanRecord = {
  date: string;
  horizon: Horizon;
  capturedAt: string;
  scanMeta: ScanMeta;
  topPicks: DailyPick[];
};

export function loadScanHistory(): DailyScanRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DailyScanRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveScanHistory(records: DailyScanRecord[]) {
  if (typeof window === "undefined") return;
  const trimmed = [...records]
    .sort((a, b) => b.date.localeCompare(a.date) || b.capturedAt.localeCompare(a.capturedAt))
    .slice(0, MAX_DAYS);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function getLatestDailyScan(): DailyScanRecord | null {
  return loadScanHistory()[0] ?? null;
}

export function getPreviousDailyScan(): DailyScanRecord | null {
  return loadScanHistory()[1] ?? null;
}

export function appendDailyScan(record: DailyScanRecord): DailyScanRecord[] {
  const history = [record, ...loadScanHistory().filter((r) => r.capturedAt !== record.capturedAt)];
  saveScanHistory(history);
  return history;
}
