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
