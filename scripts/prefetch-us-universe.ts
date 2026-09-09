import { mkdir, writeFile } from "node:fs/promises";
import { loadUsEquityUniverse } from "../src/lib/us-universe";
import type { UsSymbolFile } from "../src/lib/us-symbols-file";

async function main() {
  const companies = await loadUsEquityUniverse(true);
  const file: UsSymbolFile = {
    generatedAt: new Date().toISOString(),
    count: companies.length,
    symbols: companies.map((c) => ({ symbol: c.symbol, name: c.name })),
  };
  await mkdir("public/data", { recursive: true });
  await writeFile("public/data/us-symbols.json", JSON.stringify(file));
  process.stdout.write(`Wrote ${companies.length} U.S. listed common stocks to public/data/us-symbols.json\n`);
}

void main();
