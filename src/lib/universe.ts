export type ListedCompany = {
  symbol: string;
  name: string;
  sector: string;
};

export const UNIVERSE: ListedCompany[] = [
  { symbol: "AAPL", name: "Apple", sector: "Tech" },
  { symbol: "MSFT", name: "Microsoft", sector: "Tech" },
  { symbol: "NVDA", name: "NVIDIA", sector: "Semiconductors" },
  { symbol: "GOOGL", name: "Alphabet", sector: "Tech" },
  { symbol: "AMZN", name: "Amazon", sector: "Consumer" },
  { symbol: "META", name: "Meta", sector: "Tech" },
  { symbol: "TSLA", name: "Tesla", sector: "Auto" },
  { symbol: "AVGO", name: "Broadcom", sector: "Semiconductors" },
  { symbol: "JPM", name: "JPMorgan", sector: "Finance" },
  { symbol: "V", name: "Visa", sector: "Finance" },
  { symbol: "UNH", name: "UnitedHealth", sector: "Health" },
  { symbol: "XOM", name: "Exxon Mobil", sector: "Energy" },
  { symbol: "JNJ", name: "Johnson & Johnson", sector: "Health" },
  { symbol: "WMT", name: "Walmart", sector: "Retail" },
  { symbol: "PG", name: "Procter & Gamble", sector: "Staples" },
  { symbol: "MA", name: "Mastercard", sector: "Finance" },
  { symbol: "LLY", name: "Eli Lilly", sector: "Health" },
  { symbol: "COST", name: "Costco", sector: "Retail" },
  { symbol: "NFLX", name: "Netflix", sector: "Media" },
  { symbol: "AMD", name: "AMD", sector: "Semiconductors" },
];

export const DEFAULT_SYMBOLS = ["AAPL", "NVDA", "MSFT"];

export function companyName(symbol: string): string {
  return UNIVERSE.find((c) => c.symbol === symbol.toUpperCase())?.name ?? symbol.toUpperCase();
}
