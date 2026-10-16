import { chineseStockName, displayStockName } from "@/lib/chinese-names";
import { marketLabel, marketOfSymbol } from "@/lib/ticker-search";
import { canonicalizeTicker } from "@/lib/ticker";
import { UNIVERSE } from "@/lib/universe";

export type CompanyIntro = {
  symbol: string;
  name: string;
  market: string;
  sector?: string;
  summary: string;
  source: "wikipedia" | "local";
  url?: string;
};

const cache = new Map<string, CompanyIntro>();
const inflight = new Map<string, Promise<CompanyIntro>>();

function sectorFor(symbol: string): string | undefined {
  return UNIVERSE.find((c) => c.symbol === canonicalizeTicker(symbol))?.sector;
}

function localIntro(symbol: string, name: string, chineseNames?: Record<string, string>): CompanyIntro {
  const key = canonicalizeTicker(symbol);
  const market = marketLabel(marketOfSymbol(key));
  const sector = sectorFor(key);
  const label = displayStockName(key, name, chineseNames);
  const zh = chineseNames?.[key] ?? chineseStockName(key);
  const parts = [
    `${label}（${key}）是一只${market}标的`,
    sector ? `，所属板块 ${sector}` : "",
    zh && zh !== label && zh !== key ? `，中文常称 ${zh}` : "",
    "。展开行后可查看模型预测路径；完整公司简介暂不可用时显示此基础信息。",
  ];
  return {
    symbol: key,
    name: label,
    market,
    sector,
    summary: parts.join(""),
    source: "local",
  };
}

async function wikiSummary(title: string, lang: "en" | "zh"): Promise<{
  title: string;
  extract: string;
  url?: string;
  description?: string;
} | null> {
  const host = lang === "zh" ? "zh.wikipedia.org" : "en.wikipedia.org";
  const res = await fetch(`https://${host}/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    type?: string;
    title?: string;
    extract?: string;
    description?: string;
    content_urls?: { desktop?: { page?: string } };
  };
  if (json.type === "disambiguation") return null;
  const extract = json.extract?.trim();
  if (!extract || extract.length < 40) return null;
  return {
    title: json.title ?? title,
    extract,
    description: json.description,
    url: json.content_urls?.desktop?.page,
  };
}

async function wikiSearch(query: string, lang: "en" | "zh"): Promise<string[]> {
  const host = lang === "zh" ? "zh.wikipedia.org" : "en.wikipedia.org";
  const url = `https://${host}/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=5&namespace=0&format=json&origin=*`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = (await res.json()) as [string, string[], string[], string[]];
  return Array.isArray(json?.[1]) ? json[1] : [];
}

function looksCorporate(description?: string, extract?: string): boolean {
  const text = `${description ?? ""} ${extract ?? ""}`.toLowerCase();
  return /company|corporation|inc\.|ltd|limited|group|bank|petroleum|manufacturer|控股|公司|集团|银行|能源|石油/.test(
    text,
  );
}

async function fetchWikiIntro(
  symbol: string,
  name: string,
  chineseNames?: Record<string, string>,
): Promise<CompanyIntro | null> {
  const key = canonicalizeTicker(symbol);
  const market = marketLabel(marketOfSymbol(key));
  const sector = sectorFor(key);
  const label = displayStockName(key, name, chineseNames);
  const zh = chineseNames?.[key] ?? chineseStockName(key);
  const queries =
    market === "美股"
      ? [name, label, key].filter(Boolean)
      : [zh, name, label, key].filter(Boolean);
  const langs: ("en" | "zh")[] = market === "美股" ? ["en", "zh"] : ["zh", "en"];

  for (const lang of langs) {
    for (const query of queries) {
      if (!query || query.length < 2) continue;
      try {
        const titles = await wikiSearch(query, lang);
        for (const title of titles.slice(0, 3)) {
          const page = await wikiSummary(title, lang);
          if (!page) continue;
          if (!looksCorporate(page.description, page.extract) && title.toLowerCase() !== name.toLowerCase()) {
            continue;
          }
          return {
            symbol: key,
            name: label,
            market,
            sector,
            summary: page.extract.slice(0, 420),
            source: "wikipedia",
            url: page.url,
          };
        }
      } catch {
        // Try the next query/language.
      }
    }
  }
  return null;
}

export async function fetchCompanyIntro(
  symbol: string,
  name: string,
  chineseNames?: Record<string, string>,
): Promise<CompanyIntro> {
  const key = canonicalizeTicker(symbol);
  const hit = cache.get(key);
  if (hit) return hit;
  const pending = inflight.get(key);
  if (pending) return pending;

  const job = (async () => {
    const remote = await fetchWikiIntro(key, name, chineseNames);
    const intro = remote ?? localIntro(key, name, chineseNames);
    cache.set(key, intro);
    return intro;
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, job);
  return job;
}
