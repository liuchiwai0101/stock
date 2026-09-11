/** Normalize listed tickers so Yahoo/Pages lookups hit the real series. */
export function canonicalizeTicker(symbol: string): string {
  const t = symbol.trim().toUpperCase();
  const hk = t.match(/^(\d{1,5})\.HK$/);
  if (hk) {
    const digits = hk[1].replace(/^0+/, "") || "0";
    return `${digits.padStart(4, "0")}.HK`;
  }
  const cn = t.match(/^(\d{1,6})\.(SS|SZ)$/);
  if (cn) {
    const digits = cn[1].replace(/^0+/, "") || "0";
    return `${digits.padStart(6, "0")}.${cn[2]}`;
  }
  return t;
}

export type TickerSearchHit = { symbol: string; name: string; type: string };

/** Always keep the typed ticker first so Add works even when Yahoo search is blocked. */
export function mergeTickerSearchHits(
  query: string,
  remote: TickerSearchHit[],
  nameFor = (symbol: string) => symbol,
): TickerSearchHit[] {
  const typed = canonicalizeTicker(query);
  if (!typed) return remote.slice(0, 8);
  const typedHit: TickerSearchHit = { symbol: typed, name: nameFor(typed), type: "EQUITY" };
  const rest = remote.filter((h) => h.symbol.toUpperCase() !== typed);
  return [typedHit, ...rest].slice(0, 8);
}
