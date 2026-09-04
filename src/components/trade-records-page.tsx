"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { StockNameInline } from "@/components/stock-name";
import { TradeOrderForm } from "@/components/trade-order-form";
import { displayStockName } from "@/lib/chinese-names";
import { ensureChineseNames } from "@/lib/chinese-names-store";
import { useChineseNameCache } from "@/hooks/use-chinese-name-cache";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePortfolio } from "@/hooks/use-portfolio";
import { clsxSign, formatMoney, formatPrice } from "@/lib/format";
import { aggregateTradesBySymbol, STARTING_CASH } from "@/lib/trading";
import { cn } from "@/lib/utils";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TradeRecordsPage() {
  const book = usePortfolio({});
  const chineseNames = useChineseNameCache();
  const fills = book.portfolio.fills;
  const pnl = book.equity - STARTING_CASH;
  const [sellEditor, setSellEditor] = useState<string | null>(null);

  const aggregated = useMemo(() => aggregateTradesBySymbol(fills), [fills]);

  useEffect(() => {
    const symbols = [
      ...fills.map((f) => f.symbol),
      ...book.portfolio.positions.map((p) => p.symbol),
    ];
    void ensureChineseNames(symbols);
  }, [fills, book.portfolio.positions]);

  const stats = useMemo(() => {
    const buys = fills.filter((f) => f.side === "BUY");
    const sells = fills.filter((f) => f.side === "SELL");
    const volume = fills.reduce((sum, f) => sum + f.notional, 0);
    const openPositions = book.portfolio.positions.length;
    return {
      symbols: aggregated.length,
      total: fills.length,
      buys: buys.length,
      sells: sells.length,
      volume,
      openPositions,
    };
  }, [fills, aggregated.length, book.portfolio.positions.length]);

  function sellPosition(symbol: string, name: string, shares: number, price: number) {
    const qty = Math.floor(shares);
    if (qty <= 0) {
      book.notify("Enter at least 1 share to sell.");
      return;
    }
    book.trade({
      symbol,
      name,
      side: "SELL",
      shares: qty,
      price,
      note: `Paper sell · ${qty} sh`,
    });
    setSellEditor(null);
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppNav
        subtitle={`${stats.symbols} stock${stats.symbols === 1 ? "" : "s"} · ${stats.total} fills`}
        right={
          <div className="grid grid-cols-3 gap-2 text-right sm:flex sm:items-center sm:gap-6">
            <div>
              <div className="text-[10px] tracking-wide text-white/40 uppercase">Equity</div>
              <div className="font-mono text-sm">{formatMoney(book.equity)}</div>
            </div>
            <div>
              <div className="text-[10px] tracking-wide text-white/40 uppercase">Cash</div>
              <div className="font-mono text-sm">{formatMoney(book.portfolio.cash)}</div>
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
            <h1 className="text-lg font-semibold tracking-tight">Trade records</h1>
            <p className="text-sm text-white/45">
              Paper trades grouped by stock. Selection on Desk is saved too.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/3 px-3 text-xs text-white/80 hover:bg-white/6"
            >
              <ArrowLeft className="size-3.5" /> Back to desk
            </Link>
            <Button size="sm" variant="ghost" onClick={book.reset}>
              <RotateCcw /> Reset book
            </Button>
          </div>
        </div>

        {book.message ? (
          <div className="rounded-lg border border-sky-400/20 bg-sky-400/8 px-3 py-2 text-sm text-sky-100">
            {book.message}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-5">
          <StatCard label="Stocks" value={String(stats.symbols)} />
          <StatCard label="All fills" value={String(stats.total)} />
          <StatCard label="Buys" value={String(stats.buys)} />
          <StatCard label="Sells" value={String(stats.sells)} />
          <StatCard label="Notional" value={formatMoney(stats.volume)} />
        </div>

        {book.portfolio.positions.length > 0 ? (
          <Card className="bg-[#10161d]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Open positions</CardTitle>
              <CardDescription>Enter qty or amount · sells at book avg cost</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="text-[10px] tracking-wide text-white/40 uppercase">
                  <tr className="border-b border-white/8">
                    <th className="py-2 pr-3 font-medium">Symbol</th>
                    <th className="py-2 pr-3 font-medium">Shares</th>
                    <th className="py-2 pr-3 font-medium">Avg cost</th>
                    <th className="py-2 pr-3 font-medium">Value</th>
                    <th className="py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {book.portfolio.positions.map((p) => (
                    <Fragment key={p.symbol}>
                      <tr className="border-b border-white/6">
                        <td className="py-2.5 pr-3">
                          <StockNameInline symbol={p.symbol} name={p.name} />
                        </td>
                        <td className="py-2.5 pr-3 font-mono">{p.shares}</td>
                        <td className="py-2.5 pr-3 font-mono">{formatPrice(p.avgPrice)}</td>
                        <td className="py-2.5 pr-3 font-mono">{formatMoney(p.shares * p.avgPrice)}</td>
                        <td className="py-2.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
                            disabled={sellEditor === p.symbol}
                            onClick={() => setSellEditor(p.symbol)}
                          >
                            Sell
                          </Button>
                        </td>
                      </tr>
                      {sellEditor === p.symbol ? (
                        <tr className="border-b border-white/6 bg-white/[0.02]">
                          <td colSpan={5} className="px-2 py-2">
                            <TradeOrderForm
                              side="SELL"
                              symbol={p.symbol}
                              name={p.name}
                              price={p.avgPrice}
                              defaultShares={p.shares}
                              maxShares={p.shares}
                              heldLabel={`hold ${p.shares} sh`}
                              onSubmit={(shares) => sellPosition(p.symbol, p.name, shares, p.avgPrice)}
                              onCancel={() => setSellEditor(null)}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ) : null}

        <Card className="bg-[#10161d]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By stock</CardTitle>
            <CardDescription>Aggregated buys and sells per symbol · newest activity first</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {aggregated.length === 0 ? (
              <p className="py-10 text-center text-sm text-white/45">
                No trades yet. Place buys or sells on the{" "}
                <Link href="/" className="text-sky-300 hover:underline">
                  desk
                </Link>
                .
              </p>
            ) : (
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="text-[10px] tracking-wide text-white/40 uppercase">
                  <tr className="border-b border-white/8">
                    <th className="py-2 pr-3 font-medium">Symbol</th>
                    <th className="py-2 pr-3 font-medium">Bought</th>
                    <th className="py-2 pr-3 font-medium">Sold</th>
                    <th className="py-2 pr-3 font-medium">Net</th>
                    <th className="py-2 pr-3 font-medium">Avg buy</th>
                    <th className="py-2 pr-3 font-medium">Avg sell</th>
                    <th className="py-2 pr-3 font-medium">Fills</th>
                    <th className="py-2 font-medium">Last</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregated.map((row) => (
                    <tr key={row.symbol} className="border-b border-white/6 last:border-0">
                      <td className="py-2.5 pr-3">
                        <div className="font-medium">{row.symbol}</div>
                        <div className="max-w-[160px] truncate text-[11px] text-white/40">
                          {displayStockName(row.symbol, row.name, chineseNames)}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-emerald-300">{row.buyShares}</td>
                      <td className="py-2.5 pr-3 font-mono text-rose-300">{row.sellShares}</td>
                      <td
                        className={cn(
                          "py-2.5 pr-3 font-mono",
                          row.netShares > 0 ? "text-emerald-300" : row.netShares < 0 ? "text-rose-300" : "text-white/65",
                        )}
                      >
                        {row.netShares}
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-white/65">
                        {row.avgBuyPrice != null ? formatPrice(row.avgBuyPrice) : "—"}
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-white/65">
                        {row.avgSellPrice != null ? formatPrice(row.avgSellPrice) : "—"}
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-white/65">{row.fillCount}</td>
                      <td className="py-2.5 whitespace-nowrap text-white/50">{formatWhen(row.lastAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {fills.length > 0 ? (
          <Card className="bg-[#10161d]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">All fills</CardTitle>
              <CardDescription>Individual orders · newest first</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-[10px] tracking-wide text-white/40 uppercase">
                  <tr className="border-b border-white/8">
                    <th className="py-2 pr-3 font-medium">When</th>
                    <th className="py-2 pr-3 font-medium">Side</th>
                    <th className="py-2 pr-3 font-medium">Symbol</th>
                    <th className="py-2 pr-3 font-medium">Shares</th>
                    <th className="py-2 pr-3 font-medium">Price</th>
                    <th className="py-2 pr-3 font-medium">Notional</th>
                    <th className="py-2 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {fills.map((f) => (
                    <tr key={f.id} className="border-b border-white/6 last:border-0">
                      <td className="py-2.5 pr-3 whitespace-nowrap text-white/65">{formatWhen(f.at)}</td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[11px]",
                            f.side === "BUY"
                              ? "border-emerald-500/25 text-emerald-300"
                              : "border-rose-500/25 text-rose-300",
                          )}
                        >
                          {f.side}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="font-medium">{f.symbol}</div>
                        <div className="max-w-[140px] truncate text-[11px] text-white/40">
                          {displayStockName(f.symbol, f.name, chineseNames)}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 font-mono">{f.shares}</td>
                      <td className="py-2.5 pr-3 font-mono">{formatPrice(f.price)}</td>
                      <td className="py-2.5 pr-3 font-mono">{formatMoney(f.notional)}</td>
                      <td className="max-w-[220px] py-2.5 text-[12px] text-white/50">{f.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ) : null}
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
