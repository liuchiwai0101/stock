/**
 * Default watchlist for account Vin — US-listed names from the Futu 持倉 screenshot.
 * HK/A-share tickers are omitted — desk forecasts U.S. symbols.
 */
export const VIN_WATCHLIST_SYMBOLS = [
  "TSLA",
  "SQQQ",
  "SPCX",
  "SKHY",
  "LMND",
  "CRCL",
  "CBRS",
] as const;

export const MAX_WATCHLIST_SYMBOLS = 12;

export function vinDefaultSelection(): {
  symbols: string[];
  active: string;
  horizon: 21;
} {
  const symbols = [...VIN_WATCHLIST_SYMBOLS];
  return { symbols, active: symbols[0]!, horizon: 21 };
}
