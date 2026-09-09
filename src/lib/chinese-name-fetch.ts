const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
};

function parseTencentLine(line: string): { symbol: string; name: string } | null {
  const match = line.match(/v_us([A-Z0-9.^]+)="([^"]+)"/);
  if (!match) return null;
  const parts = match[2].split("~");
  const name = parts[1]?.trim();
  if (!name) return null;
  return { symbol: match[1].toUpperCase(), name };
}

/** Fetch Chinese display names for U.S. tickers via Tencent quote API (GBK). */
export async function fetchChineseNamesFromTencent(
  symbols: string[],
): Promise<Record<string, string>> {
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(0, 60);
  if (unique.length === 0) return {};

  const query = unique.map((s) => `us${s.replace(/\./g, "")}`).join(",");
  const url = `https://qt.gtimg.cn/q=${query}`;
  const res = await fetch(url, { headers: FETCH_HEADERS, cache: "no-store" });
  if (!res.ok) throw new Error(`Tencent names ${res.status}`);

  const buf = new Uint8Array(await res.arrayBuffer());
  const text = new TextDecoder("gbk").decode(buf);
  const out: Record<string, string> = {};

  for (const line of text.split("\n")) {
    const row = parseTencentLine(line.trim());
    if (!row) continue;
    out[row.symbol] = row.name;
  }

  return out;
}
