import { NextRequest, NextResponse } from "next/server";
import { runForecast } from "@/lib/forecast";
import { loadQuote } from "@/lib/market";
import type { CompanyForecast, Horizon, RunResponse } from "@/lib/types";
import { universeSymbols } from "@/lib/universe";
import { getVerificationSummary } from "@/lib/verification-cache";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ALLOWED: Horizon[] = [5, 10, 21, 63];
const CONCURRENCY = 6;

async function mapPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

function slimQuote(q: CompanyForecast): CompanyForecast {
  return {
    ...q,
    history: q.history.slice(-120),
  };
}

export async function GET(req: NextRequest) {
  const horizonRaw = Number(req.nextUrl.searchParams.get("horizon") ?? 21);
  const horizon = (ALLOWED.includes(horizonRaw as Horizon) ? horizonRaw : 21) as Horizon;
  const symbols = universeSymbols();

  const errors: RunResponse["errors"] = [];
  const scanned = await mapPool(symbols, CONCURRENCY, async (symbol) => {
    try {
      const series = await loadQuote(symbol);
      return slimQuote(runForecast(series, horizon));
    } catch (err) {
      errors.push({
        symbol,
        message: err instanceof Error ? err.message : "Forecast failed",
      });
      return null;
    }
  });

  const buys = scanned
    .filter((q): q is CompanyForecast => q !== null)
    .filter((q) => q.liveReady && q.signal === "BUY")
    .sort((a, b) => {
      const hit = b.metrics.hitRate - a.metrics.hitRate;
      if (Math.abs(hit) > 1e-9) return hit;
      return b.confidence - a.confidence;
    });

  const body: RunResponse & {
    mode: "buy-scan";
    scanned: number;
    passed: number;
    buyCount: number;
  } = {
    mode: "buy-scan",
    horizon,
    generatedAt: new Date().toISOString(),
    verification: getVerificationSummary(),
    quotes: buys,
    errors,
    scanned: symbols.length,
    passed: scanned.filter((q) => q?.liveReady).length,
    buyCount: buys.length,
  };

  return NextResponse.json(body);
}
