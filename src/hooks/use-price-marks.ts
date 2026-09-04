"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type LiveQuote = {
  symbol: string;
  name: string;
  last: number;
  changePct: number;
  at: string;
};

const POLL_MS = 60_000;

export function usePriceMarks(symbols: string[], enabled = true) {
  const key = useMemo(() => [...new Set(symbols)].sort().join(","), [symbols]);
  const [quotes, setQuotes] = useState<LiveQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const list = key.split(",").filter(Boolean);
    if (list.length === 0) {
      setQuotes([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(list.join(","))}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as {
        quotes?: LiveQuote[];
        error?: string;
        errors?: { symbol: string; message: string }[];
      };
      if (!res.ok) throw new Error(json.error ?? "Price refresh failed");
      setQuotes(json.quotes ?? []);
      setUpdatedAt(new Date().toISOString());
      if (json.errors?.length) {
        setError(json.errors.map((e) => `${e.symbol}: ${e.message}`).join(" · "));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Price refresh failed");
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    if (!enabled || !key) return;
    queueMicrotask(() => void refresh());
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [enabled, key, refresh]);

  const marks = useMemo(() => {
    const m: Record<string, number> = {};
    for (const q of quotes) m[q.symbol] = q.last;
    return m;
  }, [quotes]);

  const quoteMap = useMemo(() => {
    const m = new Map<string, LiveQuote>();
    for (const q of quotes) m.set(q.symbol, q);
    return m;
  }, [quotes]);

  return { quotes, marks, quoteMap, loading, error, updatedAt, refresh };
}
