"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { LoaderCircle, RefreshCw, Radar } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { useDailyCaptureOptional } from "@/components/daily-capture-provider";
import { StockNameInline } from "@/components/stock-name";
import { TradeOrderForm } from "@/components/trade-order-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePortfolio } from "@/hooks/use-portfolio";
import { usePriceMarks } from "@/hooks/use-price-marks";
import { CAPTURE_HOUR, CAPTURE_TIMEZONE, isUsMarketOpen } from "@/lib/market-hours";
import { clsxSign, formatMoney, formatPct, formatPrice } from "@/lib/format";
import { getLatestDailyScan, loadScanHistory } from "@/lib/scan-history";
import { sharesForWeight, STARTING_CASH } from "@/lib/trading";
import type { DailyPick } from "@/lib/pick-score";
import { cn } from "@/lib/utils";

type TradeEditor = { symbol: string; side: "BUY" | "SELL" };

export function MonitorPage() {
  const daily = useDailyCaptureOptional();
  const [history, setHistory] = useState(() => loadScanHistory());
  const [tradeEditor, setTradeEditor] = useState<TradeEditor | null>(null);
  const [latest, setLatest] = useState(() => getLatestDailyScan());

  const portfolioBook = usePortfolio({});
  const watchSymbols = useMemo(() => {
    const picks = latest?.topPicks.map((p) => p.symbol) ?? [];
    const positions = portfolioBook.portfolio.positions.map((p) => p.symbol);
    return [...new Set([...picks, ...positions])];
  }, [latest, portfolioBook.portfolio.positions]);

  const { marks, quoteMap, loading, error, updatedAt, refresh } = usePriceMarks(
    watchSymbols,
    watchSymbols.length > 0,
  );
  const book = usePortfolio(marks);

  const heldShares = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of book.portfolio.positions) m[p.symbol] = p.shares;
    return m;
  }, [book.portfolio.positions]);

  const pnl = book.equity - STARTING_CASH;
  const marketOpen = isUsMarketOpen();

  function reloadHistory() {
    setHistory(loadScanHistory());
    setLatest(getLatestDailyScan());
  }

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

  return (
    <div className="flex min-h-full flex-col">
      <AppNav
        subtitle={`Top 10 picks · auto capture ${CAPTURE_HOUR}:00 ${CAPTURE_TIMEZONE}`}
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
              <div className={cn("font-mono text-sm", clsxSign(pnl))}>{formatMoney(pnl)}</div>
            </div>
          </div>
        }
      />

      <main className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Monitor</h1>
            <p className="text-sm text-white/45">
              Daily top 10 after full model review · prices refresh every 60s · trade anytime
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={daily?.capturing}
              onClick={() => void daily?.triggerCapture().then(reloadHistory)}
            >
              {daily?.capturing ? <LoaderCircle className="animate-spin" /> : <Radar />}
              {daily?.capturing ? "Capturing…" : "Capture now"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw className={cn(loading && "animate-spin")} /> Refresh prices
            </Button>
          </div>
        </div>

        {daily?.capturing && daily.progress ? (
          <div className="rounded-lg border border-sky-400/20 bg-sky-400/8 px-3 py-2 text-sm text-sky-100">
            Scanning {daily.progress.processed}/{daily.progress.total} · {daily.progress.buyCount} BUY ·{" "}
            {daily.progress.passed} passed backtest
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

        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard label="Latest capture" value={latest?.date ?? "—"} />
          <StatCard label="Top picks" value={String(latest?.topPicks.length ?? 0)} />
          <StatCard label="History days" value={String(history.length)} />
          <StatCard
            label="Prices updated"
            value={updatedAt ? new Date(updatedAt).toLocaleTimeString() : "—"}
          />
        </div>

        <Card className="bg-[#10161d]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Today&apos;s top 10</CardTitle>
            <CardDescription>
              Ranked by ensemble hit rate, confidence, expected return, Sharpe, and model votes
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {!latest?.topPicks.length ? (
              <p className="py-10 text-center text-sm text-white/45">
                No daily capture yet. Keep this tab open at {CAPTURE_HOUR}:00 {CAPTURE_TIMEZONE} on U.S.
                trading days, or click <strong className="text-white/70">Capture now</strong>.
              </p>
            ) : (
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="text-[10px] tracking-wide text-white/40 uppercase">
                  <tr className="border-b border-white/8">
                    <th className="py-2 pr-3 font-medium">#</th>
                    <th className="py-2 pr-3 font-medium">Stock</th>
                    <th className="py-2 pr-3 font-medium">Last</th>
                    <th className="py-2 pr-3 font-medium">Target</th>
                    <th className="py-2 pr-3 font-medium">Exp</th>
                    <th className="py-2 pr-3 font-medium">Hit</th>
                    <th className="py-2 pr-3 font-medium">Models</th>
                    <th className="py-2 pr-3 font-medium">Score</th>
                    <th className="py-2 pr-3 font-medium">Held</th>
                    <th className="py-2 font-medium">Trade</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.topPicks.map((pick) => {
                    const live = quoteMap.get(pick.symbol);
                    const last = live?.last ?? pick.last;
                    const change = live?.changePct ?? 0;
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
                          <td className={cn("py-2.5 pr-3 font-mono", clsxSign(pick.expectedReturn))}>
                            {formatPct(pick.expectedReturn)}
                          </td>
                          <td className="py-2.5 pr-3 font-mono text-sky-200">
                            {(pick.hitRate * 100).toFixed(0)}%
                          </td>
                          <td className="py-2.5 pr-3 font-mono text-white/65">
                            {pick.modelBuyVotes}/{pick.modelCount}
                          </td>
                          <td className="py-2.5 pr-3 font-mono text-white/65">
                            {(pick.pickScore * 100).toFixed(1)}
                          </td>
                          <td className="py-2.5 pr-3 font-mono">{heldShares[pick.symbol] ?? 0}</td>
                          <td className="py-2.5">
                            <div className="flex gap-1">
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => setTradeEditor({ symbol: pick.symbol, side: "BUY" })}
                              >
                                Buy
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                disabled={(heldShares[pick.symbol] ?? 0) <= 0}
                                onClick={() => setTradeEditor({ symbol: pick.symbol, side: "SELL" })}
                              >
                                Sell
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
                                        sharesForWeight(book.equity, last, pick.expectedReturn > 0 ? 0.08 : 0.05),
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
              <CardDescription>Live marks · trade from monitor</CardDescription>
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
                  {book.portfolio.positions.map((p) => {
                    const last = marks[p.symbol] ?? p.avgPrice;
                    const value = p.shares * last;
                    const unrealized = value - p.shares * p.avgPrice;
                    const unrealizedPct = p.avgPrice > 0 ? unrealized / (p.shares * p.avgPrice) : 0;
                    return (
                      <tr key={p.symbol} className="border-b border-white/6 last:border-0">
                        <td className="py-2.5 pr-3">
                          <StockNameInline symbol={p.symbol} name={p.name} />
                        </td>
                        <td className="py-2.5 pr-3 font-mono">{p.shares}</td>
                        <td className="py-2.5 pr-3 font-mono">{formatPrice(p.avgPrice)}</td>
                        <td className="py-2.5 pr-3 font-mono">{formatPrice(last)}</td>
                        <td className="py-2.5 pr-3 font-mono">{formatMoney(value)}</td>
                        <td className={cn("py-2.5 pr-3 font-mono", clsxSign(unrealized))}>
                          {formatMoney(unrealized)}
                          <div className="text-[11px]">{formatPct(unrealizedPct)}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ) : null}

        <Card className="bg-[#10161d]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Capture history</CardTitle>
            <CardDescription>One record per trading day · top 10 saved</CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-white/45">No history yet.</p>
            ) : (
              <ul className="space-y-2">
                {history.slice(0, 14).map((row) => (
                  <li
                    key={row.date}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/3 px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">{row.date}</span>
                      <span className="ml-2 text-white/40">
                        {row.topPicks.length} picks · {row.scanMeta.buyCount} BUY
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-white/45">
                      {row.topPicks
                        .slice(0, 5)
                        .map((p) => p.symbol)
                        .join(", ")}
                      {row.topPicks.length > 5 ? "…" : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-white/35">
          Auto-capture runs at {CAPTURE_HOUR}:00 {CAPTURE_TIMEZONE} on U.S. market weekdays while this app
          is open. Review profit and loss on the{" "}
          <Link href="/pnl" className="text-sky-300 hover:underline">
            P&L page
          </Link>
          .
        </p>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/2 px-3 py-2.5">
      <div className="text-[10px] tracking-wide text-white/40 uppercase">{label}</div>
      <div className="mt-1 font-mono text-sm text-white">{value}</div>
    </div>
  );
}
