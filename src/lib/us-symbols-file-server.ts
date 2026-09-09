import { parseUsSymbolFile, type UsSymbolFile } from "@/lib/us-symbols-file";

export async function readBundledSymbolList(): Promise<string[]> {
  if (typeof window !== "undefined") return [];
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const candidates = [
    join(process.cwd(), "public/data/us-symbols.json"),
    join(process.cwd(), "data/us-symbols.json"),
    join(process.cwd(), "docs/data/us-symbols.json"),
  ];
  for (const file of candidates) {
    try {
      const raw = await readFile(file, "utf8");
      const symbols = parseUsSymbolFile(JSON.parse(raw) as UsSymbolFile);
      if (symbols.length > 0) return symbols;
    } catch {
      // Keep looking.
    }
  }
  return [];
}
