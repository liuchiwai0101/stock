import { runForecast } from "@/lib/forecast";
import { loadQuote, searchTickers, type SearchHit } from "@/lib/market";
import { mapPool } from "@/lib/pool";
import type { CompanyForecast, Horizon, RunResponse } from "@/lib/types";
import { UNIVERSE, universeSymbols } from "@/lib/universe";
import { getVerificationSummary } from "@/lib/verification-cache";

export const ALLOWED_HORIZONS: Horizon[] = [5, 10, 21, 63];
const SCAN_CONCURRENCY = 6;

export type BuyScanResponse = RunResponse & {
  mode: "buy-scan";
  scanned: number;
  passed: number;
  buyCount: number;
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

export async function runDesk(symbols: string[], horizon: Horizon): Promise<RunResponse> {
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(0, 6);
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
        return runForecast(series, horizon);
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

export async function scanBuyList(horizon: Horizon): Promise<BuyScanResponse> {
  const symbols = universeSymbols();
  const errors: RunResponse["errors"] = [];
  const scanned = await mapPool(symbols, SCAN_CONCURRENCY, async (symbol) => {
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

  return {
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
}

export async function searchDesk(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) {
    return UNIVERSE.slice(0, 8).map((c) => ({ symbol: c.symbol, name: c.name, type: "EQUITY" }));
  }
  return searchTickers(q);
}
