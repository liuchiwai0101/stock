import { mkdir, rm, writeFile } from "node:fs/promises";
import { loadQuote } from "../src/lib/market";
import { mapPool } from "../src/lib/scan-pool";
import { VIN_WATCHLIST_SYMBOLS } from "../src/lib/vin-watchlist";
import { DEFAULT_SYMBOLS, universeSymbols } from "../src/lib/universe";

const symbols = [...new Set([...VIN_WATCHLIST_SYMBOLS, ...DEFAULT_SYMBOLS, ...universeSymbols()])];

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
  if (ok.length === 0) {
    process.exit(1);
  }
}

void main();
