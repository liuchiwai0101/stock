import { existsSync, readFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { loadQuote } from "../src/lib/market";
import { mapPool } from "../src/lib/scan-pool";
import { buySymbolsFromScan, type SavedScan } from "../src/lib/scan-cache";
import { VIN_WATCHLIST_SYMBOLS } from "../src/lib/vin-watchlist";
import { DEFAULT_SYMBOLS, universeSymbols } from "../src/lib/universe";
import type { QuoteSeries } from "../src/lib/market";

const SCAN_PATHS = ["public/data/us-scan.json", "data/us-scan.json", "docs/data/us-scan.json"];

function scanBuySymbols(): string[] {
  for (const path of SCAN_PATHS) {
    if (!existsSync(path)) continue;
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8")) as SavedScan;
      const symbols = buySymbolsFromScan(parsed);
      if (symbols.length) return symbols;
    } catch {
      // Try the next published scan file.
    }
  }
  return [];
}

async function hydratePublishedScanHistory() {
  const scanPath = SCAN_PATHS.find((path) => existsSync(path));
  if (!scanPath) return;
  let scan: SavedScan;
  try {
    scan = JSON.parse(readFileSync(scanPath, "utf8")) as SavedScan;
  } catch {
    return;
  }
  if (!scan.quotes?.length) return;

  let filled = 0;
  const quotes = scan.quotes.map((q) => {
    const file = `public/data/quotes/${q.symbol}.json`;
    if (!existsSync(file)) return q;
    try {
      const series = JSON.parse(readFileSync(file, "utf8")) as QuoteSeries;
      const bars = Array.isArray(series.bars) ? series.bars.slice(-120) : [];
      if (bars.length < 5) return q;
      filled += 1;
      return { ...q, history: bars };
    } catch {
      return q;
    }
  });

  const out = JSON.stringify({ ...scan, quotes });
  await mkdir("public/data", { recursive: true });
  await writeFile("public/data/us-scan.json", out);
  process.stdout.write(`Hydrated chart history for ${filled}/${quotes.length} published BUY names.\n`);
}

const symbols = [
  ...new Set([...VIN_WATCHLIST_SYMBOLS, ...DEFAULT_SYMBOLS, ...universeSymbols(), ...scanBuySymbols()]),
];

async function main() {
  await rm("public/data/quotes", { recursive: true, force: true });
  await mkdir("public/data/quotes", { recursive: true });
  const errors: { symbol: string; message: string }[] = [];
  const ok: string[] = [];

  await mapPool(symbols, 4, async (symbol) => {
    try {
      const series = await loadQuote(symbol, "5y", { allowSimulated: false });
      if (series.source === "simulated") {
        throw new Error("Skipped simulated fallback so Pages cannot serve fake prices.");
      }
      await writeFile(`public/data/quotes/${symbol}.json`, JSON.stringify(series));
      ok.push(symbol);
      process.stdout.write(`  ${symbol} ${series.source} ${series.bars.length} bars last=${series.bars.at(-1)?.close}\n`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "prefetch failed";
      errors.push({ symbol, message });
      process.stderr.write(`  ${symbol} FAIL ${message}\n`);
    }
  });

  const manifest = {
    generatedAt: new Date().toISOString(),
    count: ok.length,
    symbols: ok.sort(),
    errors,
  };
  await writeFile("public/data/manifest.json", JSON.stringify(manifest, null, 2));
  process.stdout.write(`Prefetched ${ok.length}/${symbols.length} quote series.\n`);
  await hydratePublishedScanHistory();
  if (ok.length === 0) {
    process.exit(1);
  }
}

void main();
