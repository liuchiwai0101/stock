import { selectTopPicks } from "@/lib/pick-score";
import {
  appendDailyScan,
  todayCaptureKey,
  type DailyScanRecord,
} from "@/lib/scan-history";
import { CAPTURE_TIMEZONE } from "@/lib/market-hours";
import { saveSavedScan } from "@/lib/scan-cache";
import type { CompanyForecast, Horizon, RunResponse } from "@/lib/types";

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
  const countRes = await fetch("/api/scan?countOnly=1", { cache: "no-store" });
  const countJson = (await countRes.json()) as { total?: number };
  const total = countJson.total ?? 0;

  const batchSize = 120;
  let offset = 0;
  let processed = 0;
  let passed = 0;
  const buyMap = new Map<string, CompanyForecast>();

  while (true) {
    if (isCancelled?.()) throw new Error("Scan cancelled");

    const res = await fetch(
      `/api/scan?horizon=${horizon}&offset=${offset}&limit=${batchSize}`,
      { cache: "no-store" },
    );
    const json = (await res.json()) as RunResponse & {
      error?: string;
      scanned?: number;
      passed?: number;
      processed?: number;
      done?: boolean;
      total?: number;
    };
    if (!res.ok) throw new Error(json.error ?? "US buy scan failed");

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
      saveSavedScan({
        horizon,
        generatedAt: json.generatedAt,
        scanMeta: record.scanMeta,
        quotes: buys,
      });

      return { scan: record, quotes: buys };
    }

    offset += batchSize;
  }
}
