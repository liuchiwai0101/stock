import type { DailyPick } from "@/lib/pick-score";
import { getLatestDailyScan } from "@/lib/scan-history";
import type { CompanyForecast, Horizon } from "@/lib/types";

const STORAGE_KEY = "signal-desk-us-scan-v1";
const PARTIAL_KEY = "signal-desk-us-scan-partial";

export type SavedScan = {
  horizon: Horizon;
  generatedAt: string;
  scanMeta: {
    scanned: number;
    total: number;
    passed: number;
    buyCount: number;
  };
  quotes: CompanyForecast[];
};

/** Strip heavy series data so large scans fit in localStorage. */
export function slimForecastForCache(q: CompanyForecast): CompanyForecast {
  return {
    ...q,
    history: [],
    forecast: [],
    models: [],
    weights: q.weights,
    rationale: "",
  };
}

function slimScan(scan: SavedScan): SavedScan {
  return {
    ...scan,
    quotes: scan.quotes.map(slimForecastForCache),
  };
}

export function pickToForecast(pick: DailyPick, horizon: Horizon): CompanyForecast {
  return {
    symbol: pick.symbol,
    name: pick.name,
    currency: "USD",
    last: pick.last,
    changePct: 0,
    source: "yahoo",
    history: [],
    forecast: [],
    targetPrice: pick.targetPrice,
    expectedReturn: pick.expectedReturn,
    annualizedReturn: pick.expectedReturn,
    signal: pick.signal,
    rawSignal: pick.signal,
    confidence: pick.confidence,
    recommendedWeight: pick.recommendedWeight,
    liveReady: pick.liveReady,
    metrics: {
      rmse: 0,
      mape: 0,
      hitRate: pick.hitRate,
      residualVol: 0,
    },
    weights: {} as CompanyForecast["weights"],
    models: [],
    backtest: {
      periodDays: 252,
      horizon,
      trades: 0,
      winRate: 0,
      hitRate: pick.hitRate,
      totalReturn: 0,
      benchmarkReturn: 0,
      sharpe: pick.sharpe,
      maxDrawdown: 0,
      passed: pick.liveReady,
      checks: {
        hitRate: pick.liveReady,
        sharpe: pick.liveReady,
        drawdown: pick.liveReady,
        trades: pick.liveReady,
        direction: pick.liveReady,
      },
      gates: {
        minHitRate: 0.48,
        minSharpe: 0.1,
        maxDrawdown: 0.35,
        minTrades: 2,
        minDirectionAccuracy: 0.48,
      },
      tradeLog: [],
      summary: pick.liveReady ? "Pass" : "Fail",
    },
    rationale: "",
  };
}

export function loadSavedScan(): SavedScan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedScan>;
    if (!parsed.quotes || !Array.isArray(parsed.quotes) || !parsed.scanMeta) return null;
    return {
      horizon: (parsed.horizon ?? 21) as Horizon,
      generatedAt: parsed.generatedAt ?? new Date().toISOString(),
      scanMeta: {
        scanned: Number(parsed.scanMeta.scanned) || 0,
        total: Number(parsed.scanMeta.total) || 0,
        passed: Number(parsed.scanMeta.passed) || 0,
        buyCount: Number(parsed.scanMeta.buyCount) || parsed.quotes.length,
      },
      quotes: parsed.quotes,
    };
  } catch {
    return null;
  }
}

export function loadPartialScan(): SavedScan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PARTIAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedScan>;
    if (!parsed.quotes || !Array.isArray(parsed.quotes) || !parsed.scanMeta) return null;
    return {
      horizon: (parsed.horizon ?? 21) as Horizon,
      generatedAt: parsed.generatedAt ?? new Date().toISOString(),
      scanMeta: {
        scanned: Number(parsed.scanMeta.scanned) || 0,
        total: Number(parsed.scanMeta.total) || 0,
        passed: Number(parsed.scanMeta.passed) || 0,
        buyCount: Number(parsed.scanMeta.buyCount) || parsed.quotes.length,
      },
      quotes: parsed.quotes,
    };
  } catch {
    return null;
  }
}

/** Best available scan preview: full cache → in-progress scan → daily top picks. */
export function loadPreviewScan(): SavedScan | null {
  const saved = loadSavedScan();
  if (saved?.quotes.length) return saved;

  const partial = loadPartialScan();
  if (partial?.quotes.length) return partial;

  const daily = getLatestDailyScan();
  if (daily?.topPicks.length) {
    return {
      horizon: daily.horizon,
      generatedAt: daily.capturedAt,
      scanMeta: {
        scanned: daily.scanMeta.scanned,
        total: daily.scanMeta.total,
        passed: daily.scanMeta.passed,
        buyCount: daily.scanMeta.buyCount,
      },
      quotes: daily.topPicks.map((p) => pickToForecast(p, daily.horizon)),
    };
  }

  return null;
}

export function saveSavedScan(scan: SavedScan) {
  if (typeof window === "undefined") return;
  const slim = slimScan(scan);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
    window.sessionStorage.removeItem(PARTIAL_KEY);
  } catch {
    try {
      const smaller = {
        ...slim,
        quotes: slim.quotes.slice(0, 250),
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(smaller));
      window.sessionStorage.removeItem(PARTIAL_KEY);
    } catch {
      // Preview still available in session until tab closes.
    }
  }
}

export function savePartialScan(scan: SavedScan) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PARTIAL_KEY, JSON.stringify(slimScan(scan)));
  } catch {
    // Ignore quota errors for partial preview.
  }
}

export function clearPartialScan() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PARTIAL_KEY);
}

export function clearSavedScan() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.sessionStorage.removeItem(PARTIAL_KEY);
}
