import { mkdir, writeFile } from "node:fs/promises";
import { copyFileSync, existsSync } from "node:fs";
import { runForecast } from "../src/lib/forecast";
import { loadQuote } from "../src/lib/market";
import { defaultPolicy } from "../src/lib/adaptive-policy";
import { mapPool } from "../src/lib/scan-pool";
import { slimForecastForPublish, type SavedScan } from "../src/lib/scan-cache";
import type { CompanyForecast, Horizon } from "../src/lib/types";
import { usEquitySymbols } from "../src/lib/us-universe";

const HORIZON: Horizon = 21;
const CONCURRENCY = 8;
const BATCH = 80;

async function main() {
  await mkdir("public/data", { recursive: true });
  const reuseFrom = ["public/data/us-scan.json", "data/us-scan.json", "docs/data/us-scan.json"];
  const existing = reuseFrom.find((p) => existsSync(p));
  if (existing && process.env.FORCE_FULL_US_SCAN !== "1") {
    if (existing !== "public/data/us-scan.json") {
      copyFileSync(existing, "public/data/us-scan.json");
    }
    process.stdout.write(`Reusing ${existing} (set FORCE_FULL_US_SCAN=1 to rescan).\n`);
    return;
  }

  const symbols = await usEquitySymbols();
  const policy = defaultPolicy();
  const buyMap = new Map<string, CompanyForecast>();
  let processed = 0;
  let passed = 0;
  let errors = 0;

  for (let offset = 0; offset < symbols.length; offset += BATCH) {
    const batch = symbols.slice(offset, offset + BATCH);
    const scanned = await mapPool(batch, CONCURRENCY, async (symbol) => {
      try {
        const series = await loadQuote(symbol, "5y", { allowSimulated: false });
        return runForecast(series, HORIZON, policy);
      } catch {
        errors += 1;
        return null;
      }
    });
    processed += batch.length;
    passed += scanned.filter((q) => q?.liveReady).length;
    for (const quote of scanned) {
      if (quote && quote.liveReady && quote.signal === "BUY") {
        buyMap.set(quote.symbol, slimForecastForPublish(quote));
      }
    }
    process.stdout.write(
      `  scanned ${processed}/${symbols.length} · passed ${passed} · BUY ${buyMap.size} · miss ${errors}\n`,
    );
  }

  const quotes = [...buyMap.values()].sort((a, b) => {
    const hit = b.metrics.hitRate - a.metrics.hitRate;
    if (Math.abs(hit) > 1e-9) return hit;
    return b.confidence - a.confidence;
  });

  const scan: SavedScan = {
    horizon: HORIZON,
    generatedAt: new Date().toISOString(),
    scanMeta: {
      scanned: processed,
      total: symbols.length,
      passed,
      buyCount: quotes.length,
    },
    quotes,
  };

  await mkdir("public/data", { recursive: true });
  await writeFile("public/data/us-scan.json", JSON.stringify(scan));
  process.stdout.write(
    `Wrote full U.S. scan: ${processed}/${symbols.length} scanned · ${quotes.length} BUY names.\n`,
  );
}

void main();
