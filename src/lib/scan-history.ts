import { CAPTURE_TIMEZONE, dateKeyInTimeZone } from "@/lib/market-hours";
import type { DailyPick } from "@/lib/pick-score";
import type { Horizon } from "@/lib/types";
import { scopedStorageKey } from "@/lib/account";

const STORAGE_BASE = "signal-desk-daily-scans-v1";
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

function storageKey() {
  return typeof window === "undefined" ? STORAGE_BASE : scopedStorageKey(STORAGE_BASE);
}

export function loadScanHistory(): DailyScanRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw =
      window.localStorage.getItem(storageKey()) ?? window.localStorage.getItem(STORAGE_BASE);
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
  window.localStorage.setItem(storageKey(), JSON.stringify(trimmed));
}

export function replaceScanHistory(records: DailyScanRecord[]) {
  saveScanHistory(records);
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
