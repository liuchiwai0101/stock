import type { ListedCompany } from "@/lib/universe";

const NASDAQ_URL = "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt";
const OTHER_URL = "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "text/plain,*/*",
};

let cachedSymbols: ListedCompany[] | null = null;
let cachedAt = 0;

function isCommonEquity(symbol: string, name: string, etf: string, testIssue: string): boolean {
  if (!symbol || etf === "Y" || testIssue === "Y") return false;
  if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol)) return false;
  const label = name.toLowerCase();
  if (
    /warrant| units| unit$| rights| right$| preferred| depositary shares| notes due| notes\b| debenture| fund,| trust preferred/.test(
      label,
    )
  ) {
    return false;
  }
  return true;
}

function parseNasdaqListed(text: string): ListedCompany[] {
  const lines = text.trim().split("\n");
  const out: ListedCompany[] = [];
  for (const line of lines.slice(1, -1)) {
    const [symbol, name, , testIssue, , , etf] = line.split("|");
    if (!isCommonEquity(symbol, name ?? "", etf ?? "", testIssue ?? "")) continue;
    out.push({ symbol, name: name ?? symbol, sector: "US" });
  }
  return out;
}

function parseOtherListed(text: string): ListedCompany[] {
  const lines = text.trim().split("\n");
  const out: ListedCompany[] = [];
  for (const line of lines.slice(1, -1)) {
    const [symbol, name, , , etf, , testIssue] = line.split("|");
    if (!isCommonEquity(symbol, name ?? "", etf ?? "", testIssue ?? "")) continue;
    out.push({ symbol, name: name ?? symbol, sector: "US" });
  }
  return out;
}

export async function loadUsEquityUniverse(force = false): Promise<ListedCompany[]> {
  const fresh = cachedSymbols && Date.now() - cachedAt < CACHE_TTL_MS;
  if (!force && fresh) return cachedSymbols!;

  const [nasdaqRes, otherRes] = await Promise.all([
    fetch(NASDAQ_URL, { headers: FETCH_HEADERS, cache: "no-store" }),
    fetch(OTHER_URL, { headers: FETCH_HEADERS, cache: "no-store" }),
  ]);
  if (!nasdaqRes.ok || !otherRes.ok) {
    throw new Error("Could not download the U.S. symbol directory");
  }

  const [nasdaqText, otherText] = await Promise.all([nasdaqRes.text(), otherRes.text()]);
  const merged = new Map<string, ListedCompany>();
  for (const company of [...parseNasdaqListed(nasdaqText), ...parseOtherListed(otherText)]) {
    merged.set(company.symbol, company);
  }

  cachedSymbols = [...merged.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
  cachedAt = Date.now();
  return cachedSymbols;
}

export async function usEquitySymbols(): Promise<string[]> {
  const universe = await loadUsEquityUniverse();
  return universe.map((c) => c.symbol);
}
