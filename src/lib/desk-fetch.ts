import { runDesk, scanBuyBatch, scanCount, searchDesk, loadMarks } from "@/lib/desk";
import { STATIC_DESK } from "@/lib/static-mode";
import type { Horizon, RunResponse } from "@/lib/types";
import type { SearchHit } from "@/lib/market";
import type { ScanBatchResponse, QuoteMark } from "@/lib/desk";

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

export async function fetchScanCount(): Promise<number> {
  if (STATIC_DESK) return scanCount();
  const res = await fetch("/api/scan?countOnly=1", { cache: "no-store" });
  const json = (await res.json()) as { total?: number };
  return json.total ?? 0;
}

export async function fetchScanBatch(
  horizon: Horizon,
  offset: number,
  limit: number,
): Promise<ScanBatchResponse> {
  if (STATIC_DESK) return scanBuyBatch(horizon, offset, limit);
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
  if (STATIC_DESK) return loadMarks(symbols);
  const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbols.join(","))}`, {
    cache: "no-store",
  });
  const json = (await res.json()) as {
    quotes?: QuoteMark[];
    error?: string;
    errors?: { symbol: string; message: string }[];
  };
  if (!res.ok) throw new Error(json.error ?? "Price refresh failed");
  return { quotes: json.quotes ?? [], errors: json.errors ?? [] };
}
