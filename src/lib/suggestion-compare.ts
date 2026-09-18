import type { DailyPick } from "@/lib/pick-score";
import type { DailyScanRecord, ScanMeta } from "@/lib/scan-history";

export type SuggestionChange = {
  symbol: string;
  name: string;
  status: "new" | "kept" | "dropped";
  previousRank?: number;
  currentRank?: number;
  previousExpected?: number;
  currentExpected?: number;
  previousHitRate?: number;
  currentHitRate?: number;
};

export type SuggestionCompare = {
  previousDate: string;
  currentDate: string;
  previousMeta: ScanMeta;
  currentMeta: ScanMeta;
  newCount: number;
  keptCount: number;
  droppedCount: number;
  rows: SuggestionChange[];
};

export function comparePickLists(
  previous: DailyPick[],
  current: DailyPick[],
  previousDate: string,
  currentDate: string,
  previousMeta: ScanMeta,
  currentMeta: ScanMeta,
): SuggestionCompare {
  const prevMap = new Map(previous.map((p) => [p.symbol, p]));
  const currMap = new Map(current.map((p) => [p.symbol, p]));
  const symbols = [...new Set([...prevMap.keys(), ...currMap.keys()])];

  const rows: SuggestionChange[] = symbols
    .map((symbol) => {
      const prev = prevMap.get(symbol);
      const curr = currMap.get(symbol);
      const status: SuggestionChange["status"] = !prev ? "new" : !curr ? "dropped" : "kept";
      return {
        symbol,
        name: curr?.name ?? prev?.name ?? symbol,
        status,
        previousRank: prev?.rank,
        currentRank: curr?.rank,
        previousExpected: prev?.expectedReturn,
        currentExpected: curr?.expectedReturn,
        previousHitRate: prev?.hitRate,
        currentHitRate: curr?.hitRate,
      };
    })
    .sort((a, b) => {
      const order = { new: 0, kept: 1, dropped: 2 };
      const byStatus = order[a.status] - order[b.status];
      if (byStatus !== 0) return byStatus;
      return (a.currentRank ?? a.previousRank ?? 99) - (b.currentRank ?? b.previousRank ?? 99);
    });

  return {
    previousDate,
    currentDate,
    previousMeta,
    currentMeta,
    newCount: rows.filter((r) => r.status === "new").length,
    keptCount: rows.filter((r) => r.status === "kept").length,
    droppedCount: rows.filter((r) => r.status === "dropped").length,
    rows,
  };
}

export function compareDailyScans(previous: DailyScanRecord, current: DailyScanRecord): SuggestionCompare {
  return comparePickLists(
    previous.topPicks,
    current.topPicks,
    previous.date,
    current.date,
    previous.scanMeta,
    current.scanMeta,
  );
}

export function compareLatestScans(history: DailyScanRecord[]): SuggestionCompare | null {
  const latest = history[0];
  const previous = history[1];
  if (!latest || !previous) return null;
  return compareDailyScans(previous, latest);
}
