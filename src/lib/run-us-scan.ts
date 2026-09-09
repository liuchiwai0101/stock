import { fetchScanBatch, fetchScanCount } from "@/lib/desk-fetch";
import { selectTopPicks } from "@/lib/pick-score";
import { appendPredictionsFromPicks } from "@/lib/prediction-log";
import {
  appendDailyScan,
  todayCaptureKey,
  type DailyScanRecord,
} from "@/lib/scan-history";
import { CAPTURE_TIMEZONE } from "@/lib/market-hours";
import { saveSavedScan } from "@/lib/scan-cache";
import type { CompanyForecast, Horizon } from "@/lib/types";

export type ScanProgress = {
  processed: number;
  total: number;
  passed: number;
  buyCount: number;
};

export async function runFullUsScan(
  horizon: Horizon,
  onProgress?: (progress: ScanProgress) => void,
  isCancelled?: () => boolean,
): Promise<{ scan: DailyScanRecord; quotes: CompanyForecast[] }> {
  const total = await fetchScanCount();

  const batchSize = 120;
  let offset = 0;
  let processed = 0;
  let passed = 0;
  const buyMap = new Map<string, CompanyForecast>();

  while (true) {
    if (isCancelled?.()) throw new Error("Scan cancelled");

    const json = await fetchScanBatch(horizon, offset, batchSize);

    processed = json.processed ?? processed + (json.scanned ?? 0);
    passed += json.passed ?? 0;

    for (const quote of json.quotes) {
      buyMap.set(quote.symbol, quote);
    }

    const buys = [...buyMap.values()].sort((a, b) => {
      const hit = b.metrics.hitRate - a.metrics.hitRate;
      if (Math.abs(hit) > 1e-9) return hit;
      return b.confidence - a.confidence;
    });

    onProgress?.({
      processed,
      total: json.total ?? total,
      passed,
      buyCount: buys.length,
    });

    if (json.done) {
      const dateKey = todayCaptureKey();
      const topPicks = selectTopPicks(buys, 10);
      const record: DailyScanRecord = {
        date: dateKey,
        horizon,
        capturedAt: json.generatedAt,
        timezone: CAPTURE_TIMEZONE,
        scanMeta: {
          scanned: processed,
          total: json.total ?? total,
          passed,
          buyCount: buys.length,
        },
        topPicks,
      };

      appendDailyScan(record);
      appendPredictionsFromPicks(dateKey, topPicks, horizon);
      saveSavedScan({
        horizon,
        generatedAt: json.generatedAt,
        scanMeta: record.scanMeta,
        quotes: buys,
      });
      try {
        const { getAccountSnapshot, pushGuestScan, pushUserData } = await import("@/lib/account-store");
        if (getAccountSnapshot()) void pushUserData();
        else void pushGuestScan(record);
      } catch {
        // Sync is optional.
      }

      return { scan: record, quotes: buys };
    }

    offset += batchSize;
  }
}
