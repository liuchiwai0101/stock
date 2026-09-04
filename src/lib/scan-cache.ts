import type { CompanyForecast, Horizon } from "@/lib/types";

const STORAGE_KEY = "signal-desk-us-scan-v1";

export type SavedScan = {
  horizon: Horizon;
  generatedAt: string;
  scanMeta: {
    scanned: number;
    total: number;
    passed: number;
    buyCount: number;
  };
  quotes: CompanyForecast[];
};

export function loadSavedScan(): SavedScan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedScan>;
    if (!parsed.quotes || !Array.isArray(parsed.quotes) || !parsed.scanMeta) return null;
    return {
      horizon: (parsed.horizon ?? 21) as Horizon,
      generatedAt: parsed.generatedAt ?? new Date().toISOString(),
      scanMeta: {
        scanned: Number(parsed.scanMeta.scanned) || 0,
        total: Number(parsed.scanMeta.total) || 0,
        passed: Number(parsed.scanMeta.passed) || 0,
        buyCount: Number(parsed.scanMeta.buyCount) || parsed.quotes.length,
      },
      quotes: parsed.quotes,
    };
  } catch {
    return null;
  }
}

export function saveSavedScan(scan: SavedScan) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scan));
}

export function clearSavedScan() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
