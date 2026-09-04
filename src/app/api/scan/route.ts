import { NextRequest, NextResponse } from "next/server";
import { runForecast } from "@/lib/forecast";
import { loadQuote } from "@/lib/market";
import { mapPool } from "@/lib/scan-pool";
import type { CompanyForecast, Horizon, RunResponse } from "@/lib/types";
import { usEquitySymbols } from "@/lib/us-universe";
import { getVerificationSummary } from "@/lib/verification-cache";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ALLOWED: Horizon[] = [5, 10, 21, 63];
const CONCURRENCY = 10;
const DEFAULT_BATCH = 120;
const MAX_BATCH = 200;

function slimQuote(q: CompanyForecast): CompanyForecast {
  return {
    ...q,
    history: q.history.slice(-120),
  };
}

export async function GET(req: NextRequest) {
  const horizonRaw = Number(req.nextUrl.searchParams.get("horizon") ?? 21);
  const horizon = (ALLOWED.includes(horizonRaw as Horizon) ? horizonRaw : 21) as Horizon;
  const countOnly = req.nextUrl.searchParams.get("countOnly") === "1";
  const symbols = await usEquitySymbols();

  if (countOnly) {
    return NextResponse.json({ total: symbols.length });
  }

  const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset") ?? 0));
  const limit = Math.min(
    MAX_BATCH,
    Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? DEFAULT_BATCH)),
  );
  const batch = symbols.slice(offset, offset + limit);
  const processed = offset + batch.length;
  const done = processed >= symbols.length;

  const errors: RunResponse["errors"] = [];
  const scanned = await mapPool(batch, CONCURRENCY, async (symbol) => {
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
    total: number;
    offset: number;
    limit: number;
    processed: number;
    done: boolean;
  } = {
    mode: "buy-scan",
    horizon,
    generatedAt: new Date().toISOString(),
    verification: getVerificationSummary(),
    quotes: buys,
    errors,
    scanned: batch.length,
    passed: scanned.filter((q) => q?.liveReady).length,
    buyCount: buys.length,
    total: symbols.length,
    offset,
    limit,
    processed,
    done,
  };

  return NextResponse.json(body);
}
