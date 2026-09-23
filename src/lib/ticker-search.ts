import { CHINESE_NAMES } from "@/lib/chinese-names";
import { canonicalizeTicker } from "@/lib/ticker";
import type { TickerSearchHit } from "@/lib/ticker";
import { UNIVERSE } from "@/lib/universe";

export type MarketId = "US" | "HK" | "CN";

export type ListedSymbol = {
  symbol: string;
  name: string;
  market: MarketId;
  aliases: string[];
};

const MARKET_ORDER: MarketId[] = ["HK", "CN", "US"];

export function marketOfSymbol(symbol: string): MarketId {
  const t = canonicalizeTicker(symbol);
  if (t.endsWith(".HK")) return "HK";
  if (t.endsWith(".SS") || t.endsWith(".SZ") || t.endsWith(".BJ")) return "CN";
  return "US";
}

export function marketLabel(market: MarketId): string {
  if (market === "HK") return "港股";
  if (market === "CN") return "A股";
  return "美股";
}

/** True when the field is a ticker, not a Chinese company name. */
export function isLikelyTicker(raw: string): boolean {
  const t = canonicalizeTicker(raw.replace(/\s+/g, ""));
  return /^[A-Z0-9][A-Z0-9.^/-]{0,14}(\.(HK|SS|SZ|BJ))?$/.test(t);
}

function compact(value: string): string {
  return value.replace(/(\p{Script=Han})\s+(?=\p{Script=Han})/gu, "$1").trim();
}

function fold(value: string): string {
  return compact(value).toLowerCase();
}

export function searchListedMarkets(query: string, rows: ListedSymbol[], limit = 12): TickerSearchHit[] {
  const q = fold(query);
  if (!q) return [];
  const ranked: { row: ListedSymbol; score: number }[] = [];
  for (const row of rows) {
    const symbol = fold(row.symbol);
    const names = [row.name, ...row.aliases].map(fold).filter(Boolean);
    let score = 0;
    if (symbol === q || names.some((name) => name === q)) score = 100;
    else if (symbol.startsWith(q)) score = 80;
    else if (names.some((name) => name.startsWith(q))) score = 70;
    else if (symbol.includes(q) || names.some((name) => name.includes(q))) score = 40;
    if (score > 0) ranked.push({ row, score });
  }

  const byMarket = new Map<MarketId, { row: ListedSymbol; score: number }[]>();
  for (const hit of ranked) {
    const list = byMarket.get(hit.row.market) ?? [];
    list.push(hit);
    byMarket.set(hit.row.market, list);
  }
  for (const list of byMarket.values()) {
    list.sort((a, b) => b.score - a.score || a.row.name.length - b.row.name.length || a.row.symbol.localeCompare(b.row.symbol));
  }

  const picked: ListedSymbol[] = [];
  const seen = new Set<string>();
  const cursors = Object.fromEntries(MARKET_ORDER.map((m) => [m, 0])) as Record<MarketId, number>;
  while (picked.length < limit) {
    let added = false;
    for (const market of MARKET_ORDER) {
      const list = byMarket.get(market) ?? [];
      while (cursors[market] < list.length && seen.has(list[cursors[market]].row.symbol)) cursors[market] += 1;
      const next = list[cursors[market]];
      if (!next) continue;
      cursors[market] += 1;
      seen.add(next.row.symbol);
      picked.push(next.row);
      added = true;
      if (picked.length >= limit) break;
    }
    if (!added) break;
  }

  return picked.map((row) => ({
    symbol: row.symbol,
    name: compact(row.aliases[0] || row.name),
    type: row.market,
  }));
}

type SymbolFile = { symbols?: Array<string | { symbol?: string; name?: string; market?: string }> };

function rowsFromFile(json: SymbolFile, fallbackMarket: MarketId): ListedSymbol[] {
  const out: ListedSymbol[] = [];
  for (const row of json.symbols ?? []) {
    if (typeof row === "string") {
      const symbol = canonicalizeTicker(row);
      if (!symbol) continue;
      out.push({ symbol, name: symbol, market: marketOfSymbol(symbol) === "US" ? fallbackMarket : marketOfSymbol(symbol), aliases: [] });
      continue;
    }
    if (!row?.symbol) continue;
    const symbol = canonicalizeTicker(row.symbol);
    const market = row.market === "HK" || row.market === "CN" || row.market === "US" ? row.market : marketOfSymbol(symbol);
    out.push({ symbol, name: compact(row.name?.trim() || symbol), market, aliases: [] });
  }
  return out;
}

let directoryPromise: Promise<ListedSymbol[]> | null = null;

async function readSymbolFile(file: string): Promise<SymbolFile> {
  if (typeof window === "undefined") {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    return JSON.parse(await readFile(join(process.cwd(), "data", file), "utf8")) as SymbolFile;
  }
  const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");
  const res = await fetch(`${base}/data/${file}`, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Missing ${file}`);
  return (await res.json()) as SymbolFile;
}

export function loadTickerDirectory(): Promise<ListedSymbol[]> {
  if (!directoryPromise) {
    directoryPromise = (async () => {
      const [asia, us] = await Promise.all([
        readSymbolFile("asia-symbols.json").catch(() => ({ symbols: [] })),
        readSymbolFile("us-symbols.json").catch(() => ({ symbols: [] })),
      ]);
      const merged = new Map<string, ListedSymbol>();
      for (const row of [...rowsFromFile(asia, "CN"), ...rowsFromFile(us, "US")]) {
        merged.set(row.symbol, row);
      }
      for (const company of UNIVERSE) {
        const symbol = canonicalizeTicker(company.symbol);
        const existing = merged.get(symbol);
        if (existing) {
          if (!existing.aliases.includes(company.name)) existing.aliases.push(company.name);
        } else {
          merged.set(symbol, { symbol, name: company.name, market: "US", aliases: [] });
        }
      }
      for (const [symbol, name] of Object.entries(CHINESE_NAMES)) {
        const key = canonicalizeTicker(symbol);
        const existing = merged.get(key);
        if (existing) {
          if (!existing.aliases.includes(name)) existing.aliases.unshift(name);
        } else {
          merged.set(key, { symbol: key, name, market: marketOfSymbol(key), aliases: [] });
        }
      }
      return [...merged.values()];
    })();
  }
  return directoryPromise;
}

export async function searchTradableMarkets(query: string): Promise<TickerSearchHit[]> {
  const rows = await loadTickerDirectory();
  return searchListedMarkets(query, rows);
}

export function resolveListedSymbol(
  raw: string,
  rows: ListedSymbol[],
): { symbol: string; name: string } | null {
  const typed = canonicalizeTicker(raw.replace(/\s+/g, ""));
  if (isLikelyTicker(typed)) {
    const row = rows.find((item) => item.symbol === typed);
    return { symbol: typed, name: compact(row?.aliases[0] || row?.name || typed) };
  }
  const hits = searchListedMarkets(raw, rows, 8);
  const q = fold(raw);
  const exact = hits.filter((hit) => fold(hit.name) === q);
  const pick = exact[0] ?? (hits.length === 1 ? hits[0] : null);
  if (!pick) return null;
  return { symbol: pick.symbol, name: pick.name };
}

export async function resolveTradableSymbol(raw: string): Promise<{ symbol: string; name: string } | null> {
  const rows = await loadTickerDirectory();
  return resolveListedSymbol(raw, rows);
}

export async function resolveWatchlistSymbols(symbols: string[]): Promise<string[]> {
  const rows = await loadTickerDirectory();
  const out: string[] = [];
  const names: Record<string, string> = {};
  for (const symbol of symbols) {
    const resolved = resolveListedSymbol(symbol, rows);
    const next = resolved?.symbol ?? (isLikelyTicker(symbol) ? canonicalizeTicker(symbol) : "");
    if (!next || out.includes(next)) continue;
    out.push(next);
    if (resolved?.name && resolved.name !== next) names[next] = resolved.name;
  }
  if (Object.keys(names).length > 0 && typeof window !== "undefined") {
    const { mergeChineseNames } = await import("@/lib/chinese-names-store");
    mergeChineseNames(names);
  }
  return out.length > 0 ? out : symbols;
}
