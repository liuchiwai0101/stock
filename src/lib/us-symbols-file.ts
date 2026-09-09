export type UsSymbolFile = {
  generatedAt: string;
  count: number;
  symbols: Array<string | { symbol: string; name?: string }>;
};

export function parseUsSymbolFile(json: unknown): string[] {
  if (!json || typeof json !== "object") return [];
  const symbols = (json as UsSymbolFile).symbols;
  if (!Array.isArray(symbols)) return [];
  const out: string[] = [];
  for (const row of symbols) {
    if (typeof row === "string" && row.trim()) out.push(row.trim().toUpperCase());
    else if (row && typeof row === "object" && typeof row.symbol === "string" && row.symbol.trim()) {
      out.push(row.symbol.trim().toUpperCase());
    }
  }
  return [...new Set(out)];
}

export async function fetchPublicSymbolList(base = ""): Promise<string[]> {
  const prefix = base.replace(/\/$/, "");
  for (const file of ["us-symbols.json", "manifest.json"]) {
    try {
      const res = await fetch(`${prefix}/data/${file}`, { cache: "force-cache" });
      if (!res.ok) continue;
      const symbols = parseUsSymbolFile(await res.json());
      if (symbols.length) return symbols;
    } catch {
      // Try the next bundled file.
    }
  }
  return [];
}
