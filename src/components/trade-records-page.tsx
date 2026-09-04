"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { displayStockName } from "@/lib/chinese-names";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePortfolio } from "@/hooks/use-portfolio";
import { clsxSign, formatMoney, formatPrice } from "@/lib/format";
import { STARTING_CASH } from "@/lib/trading";
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
  const fills = book.portfolio.fills;
  const pnl = book.equity - STARTING_CASH;

  const stats = useMemo(() => {
    const buys = fills.filter((f) => f.side === "BUY");
    const sells = fills.filter((f) => f.side === "SELL");
    const volume = fills.reduce((sum, f) => sum + f.notional, 0);
    return {
      total: fills.length,
      buys: buys.length,
      sells: sells.length,
      volume,
    };
  }, [fills]);

  return (
    <div className="flex min-h-full flex-col">
      <AppNav
        subtitle={`${stats.total} saved trade ${stats.total === 1 ? "record" : "records"}`}
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
              Full paper-trade history stored in this browser. Selection on Desk is saved too.
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

        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard label="All fills" value={String(stats.total)} />
          <StatCard label="Buys" value={String(stats.buys)} />
          <StatCard label="Sells" value={String(stats.sells)} />
          <StatCard label="Notional" value={formatMoney(stats.volume)} />
        </div>

        <Card className="bg-[#10161d]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Full list</CardTitle>
            <CardDescription>Newest first · persists across visits</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {fills.length === 0 ? (
              <p className="py-10 text-center text-sm text-white/45">
                No trades yet. Place buys or sells on the{" "}
                <Link href="/" className="text-sky-300 hover:underline">
                  desk
                </Link>
                .
              </p>
            ) : (
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
                          {displayStockName(f.symbol, f.name)}
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
            )}
          </CardContent>
        </Card>

        {book.portfolio.positions.length > 0 ? (
          <Card className="bg-[#10161d]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Open positions</CardTitle>
              <CardDescription>Current paper book</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {book.portfolio.positions.map((p) => (
                  <li
                    key={p.symbol}
                    className="flex items-center justify-between rounded-lg bg-white/3 px-3 py-2 text-sm"
                  >
                    <div>
                      <div className="font-medium">
                        {p.symbol}{" "}
                        <span className="text-white/40">{p.shares} sh</span>
                      </div>
                      <div className="text-[11px] text-white/40">avg {formatPrice(p.avgPrice)}</div>
                    </div>
                    <div className="font-mono text-white/65">{formatMoney(p.shares * p.avgPrice)}</div>
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/2 px-3 py-2.5">
      <div className="text-[10px] tracking-wide text-white/40 uppercase">{label}</div>
      <div className="mt-1 font-mono text-sm text-white">{value}</div>
    </div>
  );
}
