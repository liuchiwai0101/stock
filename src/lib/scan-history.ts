import { CAPTURE_TIMEZONE, dateKeyInTimeZone } from "@/lib/market-hours";
import type { DailyPick } from "@/lib/pick-score";
import type { Horizon } from "@/lib/types";

const STORAGE_KEY = "signal-desk-daily-scans-v1";
const MAX_DAYS = 120;

export type DailyScanRecord = {
  date: string;
  horizon: Horizon;
  capturedAt: string;
  timezone: string;
  scanMeta: {
    scanned: number;
    total: number;
    passed: number;
    buyCount: number;
  };
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
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_DAYS);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function todayCaptureKey(date = new Date(), timeZone = CAPTURE_TIMEZONE): string {
  return dateKeyInTimeZone(date, timeZone);
}

export function hasCaptureForDate(dateKey: string): boolean {
  return loadScanHistory().some((r) => r.date === dateKey);
}

export function getLatestDailyScan(): DailyScanRecord | null {
  const history = loadScanHistory();
  return history[0] ?? null;
}

export function getDailyScan(dateKey: string): DailyScanRecord | null {
  return loadScanHistory().find((r) => r.date === dateKey) ?? null;
}

export function appendDailyScan(record: DailyScanRecord): DailyScanRecord[] {
  const history = loadScanHistory().filter((r) => r.date !== record.date);
  history.unshift(record);
  saveScanHistory(history);
  return history;
}
