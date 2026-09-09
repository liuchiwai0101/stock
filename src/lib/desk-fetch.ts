import { runDesk, scanCount, searchDesk, loadMarks } from "@/lib/desk";
import { STATIC_DESK } from "@/lib/static-mode";
import { fetchPublishedUsScan } from "@/lib/scan-cache";
import type { Horizon, RunResponse } from "@/lib/types";
import type { SearchHit } from "@/lib/market";
import type { ScanBatchResponse, QuoteMark } from "@/lib/desk";

function publishedToBatch(published: NonNullable<Awaited<ReturnType<typeof fetchPublishedUsScan>>>, offset: number, limit: number): ScanBatchResponse {
  const total = Math.max(published.scanMeta.total, published.scanMeta.scanned, 0);
  if (offset > 0) {
    return {
      mode: "buy-scan",
      horizon: published.horizon,
      generatedAt: published.generatedAt,
      verification: null,
      quotes: [],
      errors: [],
      scanned: 0,
      passed: 0,
      buyCount: published.quotes.length,
      total,
      offset,
      limit,
      processed: total,
      done: true,
    };
  }
  return {
    mode: "buy-scan",
    horizon: published.horizon,
    generatedAt: published.generatedAt,
    verification: null,
    quotes: published.quotes,
    errors: [],
    scanned: published.scanMeta.scanned || total,
    passed: published.scanMeta.passed,
    buyCount: published.quotes.length,
    total,
    offset: 0,
    limit: total || limit,
    processed: published.scanMeta.scanned || total,
    done: true,
  };
}

export async function fetchRun(symbols: string[], horizon: Horizon): Promise<RunResponse> {
  if (STATIC_DESK) return runDesk(symbols, horizon);
  const res = await fetch(
    `/api/run?symbols=${encodeURIComponent(symbols.join(","))}&horizon=${horizon}`,
    { cache: "no-store" },
  );
  const body = (await res.json()) as RunResponse & { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Forecast failed");
  return body;
}

export async function fetchScanCount(refresh = false): Promise<number> {
  if (STATIC_DESK) {
    const published = await fetchPublishedUsScan({ cacheBust: refresh });
    if (published?.scanMeta.total) return published.scanMeta.total;
    return scanCount();
  }
  const res = await fetch("/api/scan?countOnly=1", { cache: "no-store" });
  const json = (await res.json()) as { total?: number };
  return json.total ?? 0;
}

export async function fetchScanBatch(
  horizon: Horizon,
  offset: number,
  limit: number,
  refresh = false,
): Promise<ScanBatchResponse> {
  if (STATIC_DESK) {
    const published = await fetchPublishedUsScan({ cacheBust: refresh });
    if (published) return publishedToBatch(published, offset, limit);
    throw new Error(
      "Published U.S. scan is missing. GitHub Pages cannot live-scan every listed name in the browser.",
    );
  }
  const res = await fetch(`/api/scan?horizon=${horizon}&offset=${offset}&limit=${limit}`, {
    cache: "no-store",
  });
  const json = (await res.json()) as ScanBatchResponse & { error?: string };
  if (!res.ok) throw new Error(json.error ?? "US buy scan failed");
  return json;
}

export async function fetchSearch(query: string): Promise<SearchHit[]> {
  if (STATIC_DESK) return searchDesk(query);
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  const json = (await res.json()) as { results: SearchHit[] };
  return json.results ?? [];
}

export async function fetchMarks(symbols: string[]): Promise<{
  quotes: QuoteMark[];
  errors: { symbol: string; message: string }[];
}> {
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  const quotes: QuoteMark[] = [];
  const errors: { symbol: string; message: string }[] = [];
  for (let i = 0; i < unique.length; i += 80) {
    const chunk = unique.slice(i, i + 80);
    if (STATIC_DESK) {
      const part = await loadMarks(chunk);
      quotes.push(...part.quotes);
      errors.push(...part.errors);
      continue;
    }
    const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(chunk.join(","))}`, {
      cache: "no-store",
    });
    const json = (await res.json()) as {
      quotes?: QuoteMark[];
      error?: string;
      errors?: { symbol: string; message: string }[];
    };
    if (!res.ok) throw new Error(json.error ?? "Price refresh failed");
    quotes.push(...(json.quotes ?? []));
    errors.push(...(json.errors ?? []));
  }
  return { quotes, errors };
}
