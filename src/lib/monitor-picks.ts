import { loadSavedScan } from "@/lib/scan-cache";
import { getLatestDailyScan } from "@/lib/scan-history";
import { selectTopPicks } from "@/lib/pick-score";
import type { DailyPick } from "@/lib/pick-score";
import type { CompanyForecast, Horizon } from "@/lib/types";

export type MonitorPickSource = {
  picks: DailyPick[];
  source: "daily" | "scan" | null;
  horizon: Horizon;
  updatedAt: string | null;
};

export function loadMonitorPicks(): MonitorPickSource {
  const daily = getLatestDailyScan();
  if (daily?.topPicks.length) {
    return {
      picks: daily.topPicks,
      source: "daily",
      horizon: daily.horizon,
      updatedAt: daily.capturedAt,
    };
  }

  const saved = loadSavedScan();
  if (saved?.quotes.length) {
    return {
      picks: selectTopPicks(saved.quotes, 10),
      source: "scan",
      horizon: saved.horizon,
      updatedAt: saved.generatedAt,
    };
  }

  return { picks: [], source: null, horizon: 21, updatedAt: null };
}

export async function refreshMonitorSignals(
  symbols: string[],
  horizon: Horizon,
): Promise<CompanyForecast[]> {
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  const quotes: CompanyForecast[] = [];

  for (let i = 0; i < unique.length; i += 6) {
    const chunk = unique.slice(i, i + 6);
    const res = await fetch(
      `/api/run?symbols=${encodeURIComponent(chunk.join(","))}&horizon=${horizon}`,
      { cache: "no-store" },
    );
    const json = (await res.json()) as { quotes?: CompanyForecast[]; error?: string };
    if (!res.ok) throw new Error(json.error ?? "Model refresh failed");
    quotes.push(...(json.quotes ?? []));
  }

  return quotes;
}

export function picksFromForecasts(quotes: CompanyForecast[]): DailyPick[] {
  return selectTopPicks(
    quotes.filter((q) => q.liveReady && q.signal === "BUY"),
    10,
  );
}
