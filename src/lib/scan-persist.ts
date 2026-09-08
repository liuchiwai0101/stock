import { quotesAsOfDate, selectTopPicks } from "@/lib/pick-score";
import { appendPredictionsFromPicks } from "@/lib/prediction-log";
import { clearPartialScan, savePartialScan, saveSavedScan } from "@/lib/scan-cache";
import { appendDailyScan, type DailyScanRecord, type ScanMeta } from "@/lib/scan-history";
import type { CompanyForecast, Horizon } from "@/lib/types";

export function persistCompletedScan(
  horizon: Horizon,
  generatedAt: string,
  scanMeta: ScanMeta,
  quotes: CompanyForecast[],
): DailyScanRecord {
  const date = quotesAsOfDate(quotes) || generatedAt.slice(0, 10);
  const topPicks = selectTopPicks(quotes, 10);
  const record: DailyScanRecord = {
    date,
    horizon,
    capturedAt: generatedAt,
    scanMeta,
    topPicks,
  };
  appendDailyScan(record);
  appendPredictionsFromPicks(date, topPicks, horizon);
  saveSavedScan({ horizon, generatedAt, scanMeta, quotes });
  clearPartialScan();
  return record;
}

export function persistPartialScan(
  horizon: Horizon,
  generatedAt: string,
  scanMeta: ScanMeta,
  quotes: CompanyForecast[],
) {
  savePartialScan({ horizon, generatedAt, scanMeta, quotes });
}
