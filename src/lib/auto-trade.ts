import { isScanFreshToday } from "@/lib/scan-freshness";
import type { AutoTradeSettings } from "@/lib/auto-trade-settings";
import { equity, sharesForWeight, type TradeRequest } from "@/lib/trading";
import type { CompanyForecast, Portfolio } from "@/lib/types";

export type AutoTradeSkipReason = "disabled" | "scan_missing" | "scan_stale" | "no_actions";

export type AutoTradePlan = {
  ok: true;
  scanGeneratedAt: string;
  buys: TradeRequest[];
  sells: TradeRequest[];
  skippedBuys: { symbol: string; reason: string }[];
} | {
  ok: false;
  reason: AutoTradeSkipReason;
  detail: string;
};

/**
 * Build paper buy/sell orders from a fresh US scan.
 * Callers must refresh the scan when stale (daily window) or on manual trigger
 * before invoking this — never trade on yesterday's results.
 */
export function planAutoTrades(args: {
  quotes: CompanyForecast[];
  scanGeneratedAt: string | null | undefined;
  portfolio: Portfolio;
  settings: AutoTradeSettings;
  requireFreshToday?: boolean;
  now?: Date;
}): AutoTradePlan {
  const {
    quotes,
    scanGeneratedAt,
    portfolio,
    settings,
    requireFreshToday = true,
    now = new Date(),
  } = args;

  if (!settings.enabled) {
    return { ok: false, reason: "disabled", detail: "Auto trade is off." };
  }
  if (!scanGeneratedAt || !quotes.length) {
    return { ok: false, reason: "scan_missing", detail: "No scan results available." };
  }
  if (requireFreshToday && !isScanFreshToday(scanGeneratedAt, now)) {
    return {
      ok: false,
      reason: "scan_stale",
      detail: "Scan is not from today. Refresh the US scan before trading.",
    };
  }

  const marks: Record<string, number> = {};
  for (const q of quotes) marks[q.symbol] = q.last;
  for (const p of portfolio.positions) {
    if (marks[p.symbol] == null) marks[p.symbol] = p.avgPrice;
  }
  const bookEquity = equity(portfolio, marks);
  const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));

  const sells: TradeRequest[] = [];
  for (const pos of portfolio.positions) {
    const q = bySymbol.get(pos.symbol);
    if (!q) continue;
    const shouldSell =
      (settings.sellOnSellSignal && q.signal === "SELL") ||
      (settings.sellOnHoldSignal && q.signal === "HOLD");
    if (!shouldSell) continue;
    const shares = Math.floor(pos.shares);
    if (shares <= 0) continue;
    sells.push({
      symbol: pos.symbol,
      name: pos.name || q.name,
      side: "SELL",
      shares,
      price: q.last,
      note: `Auto sell · ${q.signal} · scan ${scanGeneratedAt}`,
    });
  }

  const openAfterSells = portfolio.positions.filter(
    (p) => !sells.some((s) => s.symbol === p.symbol),
  ).length;
  const slots = Math.max(0, settings.maxPositions - openAfterSells);
  const buyCandidates = quotes
    .filter(
      (q) =>
        q.signal === "BUY" &&
        q.liveReady &&
        q.metrics.hitRate >= settings.minHitRate &&
        q.expectedReturn >= settings.minExpectedReturn &&
        !portfolio.positions.some((p) => p.symbol === q.symbol && !sells.some((s) => s.symbol === p.symbol)),
    )
    .sort((a, b) => b.metrics.hitRate - a.metrics.hitRate || b.expectedReturn - a.expectedReturn);

  const buys: TradeRequest[] = [];
  const skippedBuys: { symbol: string; reason: string }[] = [];
  let cashLeft = portfolio.cash + sells.reduce((sum, s) => sum + s.shares * s.price, 0);

  for (const q of buyCandidates) {
    if (buys.length >= slots) {
      skippedBuys.push({ symbol: q.symbol, reason: "max positions" });
      continue;
    }
    const weight = Math.min(settings.maxWeight, Math.max(0.02, q.recommendedWeight || settings.maxWeight));
    const shares = Math.max(1, sharesForWeight(bookEquity, q.last, weight));
    const cost = shares * q.last;
    if (cashLeft - cost < settings.cashReserve) {
      skippedBuys.push({ symbol: q.symbol, reason: "cash reserve" });
      continue;
    }
    if (cost > cashLeft) {
      skippedBuys.push({ symbol: q.symbol, reason: "insufficient cash" });
      continue;
    }
    buys.push({
      symbol: q.symbol,
      name: q.name,
      side: "BUY",
      shares,
      price: q.last,
      note: `Auto buy · hit ${(q.metrics.hitRate * 100).toFixed(0)}% · scan ${scanGeneratedAt}`,
    });
    cashLeft -= cost;
  }

  if (!buys.length && !sells.length) {
    return {
      ok: false,
      reason: "no_actions",
      detail: "Fresh scan loaded, but no names met buy/sell rules.",
    };
  }

  return {
    ok: true,
    scanGeneratedAt,
    buys,
    sells,
    skippedBuys,
  };
}
