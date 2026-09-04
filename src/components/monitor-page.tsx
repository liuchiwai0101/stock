"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LineChart, LoaderCircle, RefreshCw, Radar, Sparkles, TrendingUp } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { useDailyCaptureOptional } from "@/components/daily-capture-provider";
import { StockNameInline } from "@/components/stock-name";
import { TradeOrderForm } from "@/components/trade-order-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePortfolio } from "@/hooks/use-portfolio";
import { usePriceMarks } from "@/hooks/use-price-marks";
import { isUsMarketOpen } from "@/lib/market-hours";
import { clsxSign, formatMoney, formatPct, formatPrice } from "@/lib/format";
import {
  buildModelBuyOrder,
  buildModelBuyOrders,
  buildModelSellOrder,
  progressToTarget,
} from "@/lib/model-trade";
import {
  loadMonitorPicks,
  picksFromForecasts,
  refreshMonitorSignals,
  type MonitorPickSource,
} from "@/lib/monitor-picks";
import { computeBookPnL } from "@/lib/pnl";
import { appendPnlSnapshot, snapshotDateKey } from "@/lib/pnl-snapshots";
import { getLatestDailyScan, loadScanHistory } from "@/lib/scan-history";
import { ensureChineseNames } from "@/lib/chinese-names-store";
import { sharesForWeight, STARTING_CASH } from "@/lib/trading";
import type { DailyPick } from "@/lib/pick-score";
import { cn } from "@/lib/utils";

type TradeEditor = { symbol: string; side: "BUY" | "SELL" };

const REALTIME_POLL_MS = 15_000;

export function MonitorPage() {
  const daily = useDailyCaptureOptional();
  const [history, setHistory] = useState(() => loadScanHistory());
  const [tradeEditor, setTradeEditor] = useState<TradeEditor | null>(null);
  const [pickState, setPickState] = useState<MonitorPickSource>(() => loadMonitorPicks());
  const [refreshingSignals, setRefreshingSignals] = useState(false);
  const [signalError, setSignalError] = useState<string | null>(null);

  const picks = pickState.picks;
  const horizon = pickState.horizon;

  const portfolioBook = usePortfolio({});
  const watchSymbols = useMemo(() => {
    const symbols = picks.map((p) => p.symbol);
    const positions = portfolioBook.portfolio.positions.map((p) => p.symbol);
    return [...new Set([...symbols, ...positions])];
  }, [picks, portfolioBook.portfolio.positions]);

  const marketOpen = isUsMarketOpen();
  const pollMs = marketOpen ? REALTIME_POLL_MS : 60_000;

  const { marks, quoteMap, loading, error, updatedAt, refresh } = usePriceMarks(
    watchSymbols,
    watchSymbols.length > 0,
    pollMs,
  );
  const book = usePortfolio(marks);

  useEffect(() => {
    void ensureChineseNames(watchSymbols);
  }, [watchSymbols]);

  const heldShares = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of book.portfolio.positions) m[p.symbol] = p.shares;
    return m;
  }, [book.portfolio.positions]);

  const bookPnl = useMemo(() => computeBookPnL(book.portfolio, marks), [book.portfolio, marks]);

  const reloadPicks = useCallback(() => {
    setPickState(loadMonitorPicks());
    setHistory(loadScanHistory());
  }, []);

  const refreshModelSignals = useCallback(async () => {
    const symbols =
      picks.length > 0
        ? picks.map((p) => p.symbol)
        : loadMonitorPicks().picks.map((p) => p.symbol);
    if (symbols.length === 0) {
      setSignalError("No picks to refresh. Run Capture now or scan on Desk first.");
      return;
    }
    setRefreshingSignals(true);
    setSignalError(null);
    try {
      const quotes = await refreshMonitorSignals(symbols, horizon);
      const next = picksFromForecasts(quotes);
      if (next.length === 0) {
        setSignalError("No verified BUY signals after refresh.");
      }
      setPickState({
        picks: next,
        source: pickState.source,
        horizon,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      setSignalError(err instanceof Error ? err.message : "Model refresh failed");
    } finally {
      setRefreshingSignals(false);
    }
  }, [picks, horizon, pickState.source]);

  useEffect(() => {
    const today = snapshotDateKey();
    appendPnlSnapshot({
      date: today,
      at: new Date().toISOString(),
      equity: bookPnl.equity,
      cash: bookPnl.cash,
      totalPnL: bookPnl.totalPnL,
      unrealizedPnL: bookPnl.unrealizedPnL,
      realizedPnL: bookPnl.realizedPnL,
      positionCount: bookPnl.positions.length,
    });
  }, [
    bookPnl.equity,
    bookPnl.cash,
    bookPnl.totalPnL,
    bookPnl.unrealizedPnL,
    bookPnl.realizedPnL,
    bookPnl.positions.length,
  ]);

  function buyPick(pick: DailyPick, shares: number) {
    const price = marks[pick.symbol] ?? pick.last;
    book.trade({
      symbol: pick.symbol,
      name: pick.name,
      side: "BUY",
      shares,
      price,
      note: `Monitor buy · rank #${pick.rank}`,
    });
    setTradeEditor(null);
  }

  function sellPick(pick: DailyPick, shares: number) {
    const held = heldShares[pick.symbol] ?? 0;
    const qty = Math.min(held, shares);
    if (qty <= 0) {
      book.notify(`No ${pick.symbol} shares to sell.`);
      return;
    }
    const price = marks[pick.symbol] ?? pick.last;
    book.trade({
      symbol: pick.symbol,
      name: pick.name,
      side: "SELL",
      shares: qty,
      price,
      note: `Monitor sell · ${qty} sh`,
    });
    setTradeEditor(null);
  }

  function modelBuy(pick: DailyPick) {
    if (!pick.liveReady || pick.signal !== "BUY") {
      book.notify(`${pick.symbol}: model signal not BUY — trade blocked.`);
      return;
    }
    const price = marks[pick.symbol] ?? pick.last;
    book.trade(buildModelBuyOrder(pick, book.equity, price));
  }

  function modelSell(pick: DailyPick) {
    const held = heldShares[pick.symbol] ?? 0;
    const price = marks[pick.symbol] ?? pick.last;
    const order = buildModelSellOrder(pick, held, price);
    if (!order) {
      book.notify(`No ${pick.symbol} shares to sell.`);
      return;
    }
    book.trade(order);
  }

  function tradeAllModelBuys() {
    const orders = buildModelBuyOrders(picks, book.equity, marks);
    if (orders.length === 0) {
      book.notify("No model BUY picks to trade.");
      return;
    }
    book.tradeMany(orders);
  }

  const buyableCount = picks.filter((p) => p.liveReady && p.signal === "BUY").length;

  return (
    <div className="flex min-h-full flex-col">
      <AppNav
        subtitle={marketOpen ? "Live · model suggestions · paper trades" : "Market closed · delayed quotes"}
        right={
          <div className="grid grid-cols-3 gap-2 text-right sm:flex sm:items-center sm:gap-6">
            <div>
              <div className="text-[10px] tracking-wide text-white/40 uppercase">Equity</div>
              <div className="font-mono text-sm">{formatMoney(book.equity)}</div>
            </div>
            <div>
              <div className="text-[10px] tracking-wide text-white/40 uppercase">Market</div>
              <div className={cn("font-mono text-sm", marketOpen ? "text-emerald-300" : "text-white/55")}>
                {marketOpen ? "Open" : "Closed"}
              </div>
            </div>
            <div>
              <div className="text-[10px] tracking-wide text-white/40 uppercase">P&L</div>
              <div className={cn("font-mono text-sm", clsxSign(bookPnl.totalPnL))}>
                {formatMoney(bookPnl.totalPnL)}
              </div>
            </div>
          </div>
        }
      />

      <main className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight">Monitor</h1>
              {marketOpen ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                  Live {pollMs / 1000}s
                </span>
              ) : null}
            </div>
            <p className="text-sm text-white/45">
              Real-time prices · trade model BUY suggestions · review P&L anytime
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={refreshingSignals || buyableCount === 0}
              onClick={() => void refreshModelSignals()}
            >
              {refreshingSignals ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
              Refresh signals
            </Button>
            <Button size="sm" variant="outline" disabled={buyableCount === 0} onClick={tradeAllModelBuys}>
              <TrendingUp /> Trade all model BUYs
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={daily?.capturing}
              onClick={() => void daily?.triggerCapture().then(reloadPicks)}
            >
              {daily?.capturing ? <LoaderCircle className="animate-spin" /> : <Radar />}
              Capture now
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw className={cn(loading && "animate-spin")} /> Prices
            </Button>
            <Link href="/pnl">
              <Button size="sm" variant="ghost">
                <LineChart /> P&L review
              </Button>
            </Link>
          </div>
        </div>

        {daily?.capturing && daily.progress ? (
          <div className="rounded-lg border border-sky-400/20 bg-sky-400/8 px-3 py-2 text-sm text-sky-100">
            Scanning {daily.progress.processed}/{daily.progress.total} · {daily.progress.buyCount} BUY ·{" "}
            {daily.progress.passed} passed backtest
          </div>
        ) : null}

        {signalError ? (
          <div className="rounded-lg border border-amber-400/20 bg-amber-400/8 px-3 py-2 text-sm text-amber-100">
            {signalError}
          </div>
        ) : null}

        {daily?.lastError ? (
          <div className="rounded-lg border border-rose-400/20 bg-rose-400/8 px-3 py-2 text-sm text-rose-100">
            {daily.lastError}
          </div>
        ) : null}

        {book.message ? (
          <div className="rounded-lg border border-sky-400/20 bg-sky-400/8 px-3 py-2 text-sm text-sky-100">
            {book.message}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-amber-400/20 bg-amber-400/8 px-3 py-2 text-sm text-amber-100">
            {error}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-5">
          <StatCard label="Model BUYs" value={String(buyableCount)} />
          <StatCard label="Unrealized" value={formatMoney(bookPnl.unrealizedPnL)} tone={bookPnl.unrealizedPnL} />
          <StatCard label="Realized" value={formatMoney(bookPnl.realizedPnL)} tone={bookPnl.realizedPnL} />
          <StatCard
            label="Signals"
            value={pickState.updatedAt ? new Date(pickState.updatedAt).toLocaleTimeString() : "—"}
          />
          <StatCard
            label="Prices"
            value={updatedAt ? new Date(updatedAt).toLocaleTimeString() : "—"}
          />
        </div>

        <Card className="border-sky-400/15 bg-sky-400/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="text-sm text-white/70">
              Paper book · {formatMoney(bookPnl.equity)} equity · {formatPct(bookPnl.totalPnLPct)} total return
            </div>
            <Link href="/pnl" className="text-sm text-sky-300 hover:underline">
              Open full P&L review →
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-[#10161d]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Model suggestions</CardTitle>
            <CardDescription>
              Top 10 after full model review · source: {pickState.source ?? "none"} · horizon {horizon}d
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {picks.length === 0 ? (
              <p className="py-10 text-center text-sm text-white/45">
                No picks yet. Click <strong className="text-white/70">Capture now</strong> or scan on{" "}
                <Link href="/" className="text-sky-300 hover:underline">
                  Desk
                </Link>
                .
              </p>
            ) : (
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="text-[10px] tracking-wide text-white/40 uppercase">
                  <tr className="border-b border-white/8">
                    <th className="py-2 pr-3 font-medium">#</th>
                    <th className="py-2 pr-3 font-medium">Stock</th>
                    <th className="py-2 pr-3 font-medium">Last</th>
                    <th className="py-2 pr-3 font-medium">Target</th>
                    <th className="py-2 pr-3 font-medium">To target</th>
                    <th className="py-2 pr-3 font-medium">Signal</th>
                    <th className="py-2 pr-3 font-medium">Exp</th>
                    <th className="py-2 pr-3 font-medium">Hit</th>
                    <th className="py-2 pr-3 font-medium">Held</th>
                    <th className="py-2 font-medium">Trade</th>
                  </tr>
                </thead>
                <tbody>
                  {picks.map((pick) => {
                    const live = quoteMap.get(pick.symbol);
                    const last = live?.last ?? pick.last;
                    const change = live?.changePct ?? 0;
                    const toTarget = progressToTarget(last, pick.targetPrice);
                    const canModelBuy = pick.liveReady && pick.signal === "BUY";
                    return (
                      <Fragment key={pick.symbol}>
                        <tr className="border-b border-white/6">
                          <td className="py-2.5 pr-3 font-mono text-white/45">{pick.rank}</td>
                          <td className="py-2.5 pr-3">
                            <StockNameInline symbol={pick.symbol} name={pick.name} />
                          </td>
                          <td className="py-2.5 pr-3 font-mono">
                            {formatPrice(last)}
                            <div className={cn("text-[11px]", clsxSign(change))}>{formatPct(change)}</div>
                          </td>
                          <td className="py-2.5 pr-3 font-mono">{formatPrice(pick.targetPrice)}</td>
                          <td className={cn("py-2.5 pr-3 font-mono", clsxSign(toTarget))}>
                            {formatPct(toTarget)}
                          </td>
                          <td className="py-2.5 pr-3">
                            <span
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-[11px]",
                                pick.signal === "BUY"
                                  ? "border-emerald-500/25 text-emerald-300"
                                  : "border-white/10 text-white/50",
                              )}
                            >
                              {pick.signal}
                            </span>
                          </td>
                          <td className={cn("py-2.5 pr-3 font-mono", clsxSign(pick.expectedReturn))}>
                            {formatPct(pick.expectedReturn)}
                          </td>
                          <td className="py-2.5 pr-3 font-mono text-sky-200">
                            {(pick.hitRate * 100).toFixed(0)}%
                          </td>
                          <td className="py-2.5 pr-3 font-mono">{heldShares[pick.symbol] ?? 0}</td>
                          <td className="py-2.5">
                            <div className="flex flex-wrap justify-end gap-1">
                              <Button
                                size="xs"
                                variant="outline"
                                disabled={!canModelBuy}
                                className="border-emerald-500/30 text-emerald-300"
                                onClick={() => modelBuy(pick)}
                              >
                                Model buy
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                disabled={(heldShares[pick.symbol] ?? 0) <= 0}
                                onClick={() => modelSell(pick)}
                              >
                                Model sell
                              </Button>
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => setTradeEditor({ symbol: pick.symbol, side: "BUY" })}
                              >
                                Custom
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {tradeEditor?.symbol === pick.symbol ? (
                          <tr className="border-b border-white/6 bg-white/[0.02]">
                            <td colSpan={10} className="px-2 py-2">
                              <TradeOrderForm
                                side={tradeEditor.side}
                                symbol={pick.symbol}
                                name={pick.name}
                                price={last}
                                defaultShares={
                                  tradeEditor.side === "BUY"
                                    ? Math.max(
                                        1,
                                        sharesForWeight(
                                          book.equity,
                                          last,
                                          pick.recommendedWeight > 0
                                            ? pick.recommendedWeight
                                            : 0.08,
                                        ),
                                      )
                                    : (heldShares[pick.symbol] ?? 1)
                                }
                                maxShares={
                                  tradeEditor.side === "SELL" ? heldShares[pick.symbol] : undefined
                                }
                                heldLabel={
                                  tradeEditor.side === "SELL"
                                    ? `hold ${heldShares[pick.symbol] ?? 0} sh`
                                    : undefined
                                }
                                onSubmit={(shares) =>
                                  tradeEditor.side === "BUY"
                                    ? buyPick(pick, shares)
                                    : sellPick(pick, shares)
                                }
                                onCancel={() => setTradeEditor(null)}
                              />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {book.portfolio.positions.length > 0 ? (
          <Card className="bg-[#10161d]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Open positions</CardTitle>
              <CardDescription>Live marks · unrealized P&L updates with prices</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-[10px] tracking-wide text-white/40 uppercase">
                  <tr className="border-b border-white/8">
                    <th className="py-2 pr-3 font-medium">Stock</th>
                    <th className="py-2 pr-3 font-medium">Shares</th>
                    <th className="py-2 pr-3 font-medium">Avg</th>
                    <th className="py-2 pr-3 font-medium">Last</th>
                    <th className="py-2 pr-3 font-medium">Value</th>
                    <th className="py-2 pr-3 font-medium">Unrealized</th>
                  </tr>
                </thead>
                <tbody>
                  {bookPnl.positions.map((row) => (
                    <tr key={row.symbol} className="border-b border-white/6 last:border-0">
                      <td className="py-2.5 pr-3">
                        <StockNameInline symbol={row.symbol} name={row.name} />
                      </td>
                      <td className="py-2.5 pr-3 font-mono">{row.shares}</td>
                      <td className="py-2.5 pr-3 font-mono">{formatPrice(row.avgPrice)}</td>
                      <td className="py-2.5 pr-3 font-mono">{formatPrice(row.mark)}</td>
                      <td className="py-2.5 pr-3 font-mono">{formatMoney(row.marketValue)}</td>
                      <td className={cn("py-2.5 pr-3 font-mono", clsxSign(row.unrealizedPnL))}>
                        {formatMoney(row.unrealizedPnL)}
                        <div className="text-[11px]">{formatPct(row.unrealizedPct)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ) : null}

        {history.length > 0 ? (
          <Card className="bg-[#10161d]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Capture history</CardTitle>
              <CardDescription>Latest: {getLatestDailyScan()?.date ?? "—"}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {history.slice(0, 7).map((row) => (
                  <li
                    key={row.date}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/3 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{row.date}</span>
                    <span className="font-mono text-[11px] text-white/45">
                      {row.topPicks
                        .slice(0, 6)
                        .map((p) => p.symbol)
                        .join(", ")}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </main>
    </div>
  );
}

function StatCard({ label, value, tone = 0 }: { label: string; value: string; tone?: number }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/2 px-3 py-2.5">
      <div className="text-[10px] tracking-wide text-white/40 uppercase">{label}</div>
      <div className={cn("mt-1 font-mono text-sm", tone !== 0 ? clsxSign(tone) : "text-white")}>{value}</div>
    </div>
  );
}
