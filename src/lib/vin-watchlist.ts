/**
 * Default watchlist for account Vin — names from the Futu 持倉 screenshots.
 * Deploy nudge: rebuild Pages/Docker after PR #12 merge.
 * Numeric HK/A codes are stored as Yahoo-style tickers (e.g. 1810.HK, 000858.SZ).
 */
export const VIN_WATCHLIST_SYMBOLS = [
  // US / OTC-style from Futu
  "TSLA",
  "SQQQ",
  "SPCX",
  "SKHY",
  "LMND",
  "CRCL",
  "CBRS",
  // HK
  "1810.HK", // 小米集團-W 01810
  "0981.HK", // 中芯國際 00981
  "0939.HK", // 建設銀行 00939
  "7709.HK", // 南方東英 SK 海力士 07709
  "0100.HK", // MINIMAX-W 00100
  // A-shares
  "000858.SZ", // 五糧液
  "601611.SS", // 中國核建
] as const;

export const MAX_WATCHLIST_SYMBOLS = 20;

export function vinDefaultSelection(): {
  symbols: string[];
  active: string;
  horizon: 21;
} {
  const symbols = [...VIN_WATCHLIST_SYMBOLS];
  return { symbols, active: symbols[0]!, horizon: 21 };
}
