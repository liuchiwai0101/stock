import { runForecast } from "@/lib/forecast";
import { loadQuote, searchTickers, type SearchHit } from "@/lib/market";
import { loadPolicy } from "@/lib/policy-store";
import { mapPool } from "@/lib/scan-pool";
import { defaultPolicy } from "@/lib/adaptive-policy";
import type { CompanyForecast, DataSource, Horizon, RunResponse } from "@/lib/types";
import { UNIVERSE } from "@/lib/universe";
import { usEquitySymbols } from "@/lib/us-universe";
import { getVerificationSummary } from "@/lib/verification-cache";

export const ALLOWED_HORIZONS: Horizon[] = [5, 10, 21, 63];

export type ScanBatchResponse = RunResponse & {
  mode: "buy-scan";
  scanned: number;
  passed: number;
  buyCount: number;
  total: number;
  offset: number;
  limit: number;
  processed: number;
  done: boolean;
};

export type QuoteMark = {
  symbol: string;
  name: string;
  last: number;
  changePct: number;
  at: string;
  source: DataSource;
};

export function parseHorizon(raw: number): Horizon {
  return ALLOWED_HORIZONS.includes(raw as Horizon) ? (raw as Horizon) : 21;
}

export function parseSymbols(symbolsParam: string, limit = 6): string[] {
  return [...new Set(symbolsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(
    0,
    limit,
  );
}

function slimQuote(q: CompanyForecast): CompanyForecast {
  return {
    ...q,
    history: q.history.slice(-120),
  };
}

function policy() {
  return typeof window === "undefined" ? defaultPolicy() : loadPolicy();
}

export async function runDesk(symbols: string[], horizon: Horizon): Promise<RunResponse> {
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(0, 12);
  if (unique.length === 0) {
    return {
      horizon,
      generatedAt: new Date().toISOString(),
      verification: getVerificationSummary(),
      quotes: [],
      errors: [{ symbol: "", message: "Pick at least one ticker." }],
    };
  }

  const errors: RunResponse["errors"] = [];
  const quotes = await Promise.all(
    unique.map(async (symbol) => {
      try {
        const series = await loadQuote(symbol);
        return runForecast(series, horizon, policy());
      } catch (err) {
        errors.push({
          symbol,
          message: err instanceof Error ? err.message : "Forecast failed",
        });
        return null;
      }
    }),
  );

  return {
    horizon,
    generatedAt: new Date().toISOString(),
    verification: getVerificationSummary(),
    quotes: quotes.filter((q): q is CompanyForecast => q !== null),
    errors,
  };
}

export async function scanCount(): Promise<number> {
  const symbols = await usEquitySymbols();
  return symbols.length;
}

export async function scanBuyBatch(
  horizon: Horizon,
  offset = 0,
  limit = 120,
): Promise<ScanBatchResponse> {
  const symbols = await usEquitySymbols();
  const batch = symbols.slice(offset, offset + limit);
  const processed = offset + batch.length;
  const errors: RunResponse["errors"] = [];
  const concurrency = typeof window === "undefined" ? 10 : 4;
  const scanned = await mapPool(batch, concurrency, async (symbol) => {
    try {
      const series = await loadQuote(symbol);
      return slimQuote(runForecast(series, horizon, policy()));
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

  return {
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
    done: processed >= symbols.length,
  };
}

export async function searchDesk(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) {
    return UNIVERSE.slice(0, 8).map((c) => ({ symbol: c.symbol, name: c.name, type: "EQUITY" }));
  }
  return searchTickers(q);
}

export async function loadMarks(symbols: string[]): Promise<{ quotes: QuoteMark[]; errors: { symbol: string; message: string }[] }> {
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(0, 30);
  const errors: { symbol: string; message: string }[] = [];
  const quotes = await mapPool(unique, 6, async (symbol) => {
    try {
      const series = await loadQuote(symbol, "5d");
      const bars = series.bars;
      const lastBar = bars[bars.length - 1];
      const prevBar = bars[bars.length - 2];
      const last = lastBar?.close ?? 0;
      const prev = prevBar?.close ?? last;
      return {
        symbol: series.symbol,
        name: series.name,
        last,
        changePct: prev > 0 ? last / prev - 1 : 0,
        at: lastBar?.date ?? new Date().toISOString().slice(0, 10),
        source: series.source,
      };
    } catch (err) {
      errors.push({
        symbol,
        message: err instanceof Error ? err.message : "Quote failed",
      });
      return null;
    }
  });
  return { quotes: quotes.filter((q): q is QuoteMark => q !== null), errors };
}
