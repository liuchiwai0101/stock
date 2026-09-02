import type { Bar, DataSource } from "@/lib/types";
import { companyName } from "@/lib/universe";

export type QuoteSeries = {
  symbol: string;
  name: string;
  currency: string;
  source: DataSource;
  bars: Bar[];
};

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "application/json,text/csv,*/*",
};

function isoFromUnix(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

function cleanBars(bars: Bar[]): Bar[] {
  const out: Bar[] = [];
  for (const bar of bars) {
    if (!Number.isFinite(bar.close) || bar.close <= 0) continue;
    const close = bar.close;
    out.push({
      date: bar.date,
      close,
      open: Number.isFinite(bar.open) && bar.open > 0 ? bar.open : close,
      high: Number.isFinite(bar.high) && bar.high > 0 ? bar.high : close,
      low: Number.isFinite(bar.low) && bar.low > 0 ? bar.low : close,
      volume: Number.isFinite(bar.volume) ? bar.volume : 0,
    });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

async function fetchYahoo(symbol: string, range: string): Promise<QuoteSeries> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}&includePrePost=false&events=div%7Csplit`;
  const res = await fetch(url, { headers: FETCH_HEADERS, cache: "no-store" });
  if (!res.ok) throw new Error(`Yahoo ${res.status}`);
  const json = (await res.json()) as {
    chart?: {
      result?: {
        meta?: { symbol?: string; shortName?: string; longName?: string; currency?: string };
        timestamp?: number[];
        indicators?: { quote?: { close?: (number | null)[]; open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; volume?: (number | null)[] }[] };
      }[];
      error?: { description?: string } | null;
    };
  };
  const result = json.chart?.result?.[0];
  if (!result?.timestamp?.length) {
    throw new Error(json.chart?.error?.description ?? "Yahoo returned no series");
  }
  const quote = result.indicators?.quote?.[0];
  const bars: Bar[] = result.timestamp.map((ts, i) => ({
    date: isoFromUnix(ts),
    close: Number(quote?.close?.[i]),
    open: Number(quote?.open?.[i]),
    high: Number(quote?.high?.[i]),
    low: Number(quote?.low?.[i]),
    volume: Number(quote?.volume?.[i]),
  }));
  const cleaned = cleanBars(bars);
  if (cleaned.length < 60) throw new Error("Not enough Yahoo history");
  return {
    symbol: (result.meta?.symbol ?? symbol).toUpperCase(),
    name: result.meta?.shortName ?? result.meta?.longName ?? companyName(symbol),
    currency: result.meta?.currency ?? "USD",
    source: "yahoo",
    bars: cleaned,
  };
}

async function fetchStooq(symbol: string): Promise<QuoteSeries> {
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol.toLowerCase())}.us&i=d`;
  const res = await fetch(url, { headers: FETCH_HEADERS, cache: "no-store" });
  if (!res.ok) throw new Error(`Stooq ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split("\n");
  if (lines.length < 62 || !lines[0].toLowerCase().includes("date")) {
    throw new Error("Stooq returned no series");
  }
  const bars: Bar[] = [];
  for (const line of lines.slice(1)) {
    const [date, open, high, low, close, volume] = line.split(",");
    if (!date || !close) continue;
    bars.push({
      date,
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: Number(volume),
    });
  }
  const cleaned = cleanBars(bars).slice(-400);
  if (cleaned.length < 60) throw new Error("Not enough Stooq history");
  return {
    symbol: symbol.toUpperCase(),
    name: companyName(symbol),
    currency: "USD",
    source: "stooq",
    bars: cleaned,
  };
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number): number {
  const u = Math.max(1e-12, rand());
  const v = Math.max(1e-12, rand());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const SYNTH_PROFILES: Record<string, { start: number; mu: number; sigma: number }> = {
  AAPL: { start: 228, mu: 0.00045, sigma: 0.016 },
  MSFT: { start: 428, mu: 0.0004, sigma: 0.014 },
  NVDA: { start: 178, mu: 0.0007, sigma: 0.028 },
  GOOGL: { start: 165, mu: 0.00038, sigma: 0.017 },
  AMZN: { start: 186, mu: 0.00042, sigma: 0.018 },
  META: { start: 512, mu: 0.0005, sigma: 0.022 },
  TSLA: { start: 248, mu: 0.0002, sigma: 0.038 },
  AMD: { start: 142, mu: 0.00035, sigma: 0.03 },
  NFLX: { start: 690, mu: 0.0004, sigma: 0.024 },
  JPM: { start: 248, mu: 0.00032, sigma: 0.015 },
};

function addBusinessDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  let added = 0;
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

function simulateSeries(symbol: string): QuoteSeries {
  const profile = SYNTH_PROFILES[symbol.toUpperCase()] ?? {
    start: 80 + (hashString(symbol) % 240),
    mu: 0.00025,
    sigma: 0.02,
  };
  const rand = mulberry32(hashString(`${symbol}:v3`));
  const bars: Bar[] = [];
  let price = profile.start;
  let date = "2024-09-03";
  for (let i = 0; i < 320; i++) {
    const shock = gaussian(rand);
    const drift = profile.mu + (i > 250 ? profile.mu * 0.4 : 0);
    price = Math.max(2, price * Math.exp(drift + profile.sigma * shock));
    const open = price / Math.exp(profile.sigma * 0.3 * gaussian(rand));
    const high = Math.max(open, price) * (1 + Math.abs(profile.sigma * 0.4 * gaussian(rand)));
    const low = Math.min(open, price) * (1 - Math.abs(profile.sigma * 0.4 * gaussian(rand)));
    bars.push({
      date,
      open,
      high,
      low,
      close: price,
      volume: Math.round(8_000_000 + rand() * 40_000_000),
    });
    date = addBusinessDays(date, 1);
  }
  return {
    symbol: symbol.toUpperCase(),
    name: companyName(symbol),
    currency: "USD",
    source: "simulated",
    bars,
  };
}

export async function loadQuote(symbol: string, range = "2y"): Promise<QuoteSeries> {
  const ticker = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9.^]{1,10}$/.test(ticker)) {
    throw new Error("Invalid ticker");
  }
  try {
    return await fetchYahoo(ticker, range);
  } catch {
    try {
      return await fetchStooq(ticker);
    } catch {
      return simulateSeries(ticker);
    }
  }
}

export type SearchHit = { symbol: string; name: string; type: string };

export async function searchTickers(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 1) return [];
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0`;
    const res = await fetch(url, { headers: FETCH_HEADERS, cache: "no-store" });
    if (!res.ok) throw new Error("search failed");
    const json = (await res.json()) as {
      quotes?: { symbol?: string; shortname?: string; longname?: string; quoteType?: string }[];
    };
    return (json.quotes ?? [])
      .filter((row) => row.symbol && (row.quoteType === "EQUITY" || row.quoteType === "ETF"))
      .map((row) => ({
        symbol: row.symbol!.toUpperCase(),
        name: row.shortname ?? row.longname ?? row.symbol!,
        type: row.quoteType ?? "EQUITY",
      }))
      .slice(0, 8);
  } catch {
    const { UNIVERSE } = await import("@/lib/universe");
    const needle = q.toLowerCase();
    return UNIVERSE.filter(
      (c) => c.symbol.toLowerCase().includes(needle) || c.name.toLowerCase().includes(needle)
    ).map((c) => ({ symbol: c.symbol, name: c.name, type: "EQUITY" }));
  }
}
