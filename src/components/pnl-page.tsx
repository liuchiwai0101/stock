"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppNav } from "@/components/app-nav";
import { StockNameInline } from "@/components/stock-name";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePortfolio } from "@/hooks/use-portfolio";
import { usePriceMarks } from "@/hooks/use-price-marks";
import { clsxSign, formatMoney, formatPct } from "@/lib/format";
import { computeBookPnL } from "@/lib/pnl";
import {
  appendPnlSnapshot,
  filterSnapshotsByPeriod,
  loadPnlSnapshots,
  snapshotDateKey,
} from "@/lib/pnl-snapshots";
import { STARTING_CASH } from "@/lib/trading";
import { cn } from "@/lib/utils";

const PERIODS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "All", days: null },
] as const;

export function PnlPage() {
  const [periodDays, setPeriodDays] = useState<number | null>(30);
  const [snapshots, setSnapshots] = useState(() => loadPnlSnapshots());

  const portfolioBook = usePortfolio({});
  const symbols = useMemo(
    () => portfolioBook.portfolio.positions.map((p) => p.symbol),
    [portfolioBook.portfolio.positions],
  );
  const { marks } = usePriceMarks(symbols, symbols.length > 0);
  const book = usePortfolio(marks);

  const pnl = useMemo(() => computeBookPnL(book.portfolio, marks), [book.portfolio, marks]);

  useEffect(() => {
    const today = snapshotDateKey();
    queueMicrotask(() => {
      setSnapshots((prev) => {
        if (prev.some((s) => s.date === today)) return prev;
        return appendPnlSnapshot({
          date: today,
          at: new Date().toISOString(),
          equity: pnl.equity,
          cash: pnl.cash,
          totalPnL: pnl.totalPnL,
          unrealizedPnL: pnl.unrealizedPnL,
          realizedPnL: pnl.realizedPnL,
          positionCount: pnl.positions.length,
        });
      });
    });
  }, [pnl.equity, pnl.cash, pnl.totalPnL, pnl.unrealizedPnL, pnl.realizedPnL, pnl.positions.length]);

  const chartData = useMemo(() => {
    const rows = filterSnapshotsByPeriod(snapshots, periodDays);
    if (rows.length === 0) {
      return [{ date: snapshotDateKey(), equity: pnl.equity, totalPnL: pnl.totalPnL }];
    }
    return rows.map((s) => ({
      date: s.date.slice(5),
      equity: s.equity,
      totalPnL: s.totalPnL,
    }));
  }, [snapshots, periodDays, pnl.equity, pnl.totalPnL]);

  const periodChange = useMemo(() => {
    const rows = filterSnapshotsByPeriod(snapshots, periodDays);
    if (rows.length < 2) return pnl.totalPnL;
    return rows[rows.length - 1].totalPnL - rows[0].totalPnL;
  }, [snapshots, periodDays, pnl.totalPnL]);

  return (
    <div className="flex min-h-full flex-col">
      <AppNav
        subtitle="Profit & loss review by period"
        right={
          <div className="grid grid-cols-3 gap-2 text-right sm:flex sm:items-center sm:gap-6">
            <div>
              <div className="text-[10px] tracking-wide text-white/40 uppercase">Equity</div>
              <div className="font-mono text-sm">{formatMoney(pnl.equity)}</div>
            </div>
            <div>
              <div className="text-[10px] tracking-wide text-white/40 uppercase">Total P&L</div>
              <div className={cn("font-mono text-sm", clsxSign(pnl.totalPnL))}>{formatMoney(pnl.totalPnL)}</div>
            </div>
            <div>
              <div className="text-[10px] tracking-wide text-white/40 uppercase">Return</div>
              <div className={cn("font-mono text-sm", clsxSign(pnl.totalPnLPct))}>
                {formatPct(pnl.totalPnLPct)}
              </div>
            </div>
          </div>
        }
      />

      <main className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Profit & loss</h1>
            <p className="text-sm text-white/45">
              Review realized and unrealized results · daily snapshots saved in this browser
            </p>
          </div>
          <div className="flex gap-1 rounded-lg border border-white/10 bg-white/3 p-0.5">
            {PERIODS.map((p) => (
              <Button
                key={p.label}
                size="xs"
                variant={periodDays === p.days ? "default" : "ghost"}
                onClick={() => setPeriodDays(p.days)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard label="Starting" value={formatMoney(STARTING_CASH)} />
          <StatCard label="Unrealized" value={formatMoney(pnl.unrealizedPnL)} tone={pnl.unrealizedPnL} />
          <StatCard label="Realized" value={formatMoney(pnl.realizedPnL)} tone={pnl.realizedPnL} />
          <StatCard label="Period Δ" value={formatMoney(periodChange)} tone={periodChange} />
        </div>

        <Card className="bg-[#10161d]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Equity curve</CardTitle>
            <CardDescription>Daily snapshot · {chartData.length} point(s)</CardDescription>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    background: "#10161d",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value) => formatMoney(Number(value ?? 0))}
                />
                <Line
                  type="monotone"
                  dataKey="equity"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={false}
                  name="Equity"
                />
                <Line
                  type="monotone"
                  dataKey="totalPnL"
                  stroke="#34d399"
                  strokeWidth={1.5}
                  dot={false}
                  name="Total P&L"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-[#10161d]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Open positions</CardTitle>
            <CardDescription>Unrealized profit and loss at live marks</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {pnl.positions.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/45">
                No open positions. Trade from the{" "}
                <Link href="/monitor" className="text-sky-300 hover:underline">
                  monitor
                </Link>{" "}
                page.
              </p>
            ) : (
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-[10px] tracking-wide text-white/40 uppercase">
                  <tr className="border-b border-white/8">
                    <th className="py-2 pr-3 font-medium">Stock</th>
                    <th className="py-2 pr-3 font-medium">Shares</th>
                    <th className="py-2 pr-3 font-medium">Avg cost</th>
                    <th className="py-2 pr-3 font-medium">Mark</th>
                    <th className="py-2 pr-3 font-medium">Cost</th>
                    <th className="py-2 pr-3 font-medium">Value</th>
                    <th className="py-2 font-medium">Unrealized</th>
                  </tr>
                </thead>
                <tbody>
                  {pnl.positions.map((row) => (
                    <tr key={row.symbol} className="border-b border-white/6 last:border-0">
                      <td className="py-2.5 pr-3">
                        <StockNameInline symbol={row.symbol} name={row.name} />
                      </td>
                      <td className="py-2.5 pr-3 font-mono">{row.shares}</td>
                      <td className="py-2.5 pr-3 font-mono">{formatMoney(row.avgPrice)}</td>
                      <td className="py-2.5 pr-3 font-mono">{formatMoney(row.mark)}</td>
                      <td className="py-2.5 pr-3 font-mono">{formatMoney(row.costBasis)}</td>
                      <td className="py-2.5 pr-3 font-mono">{formatMoney(row.marketValue)}</td>
                      <td className={cn("py-2.5 pr-3 font-mono", clsxSign(row.unrealizedPnL))}>
                        {formatMoney(row.unrealizedPnL)}
                        <div className="text-[11px]">{formatPct(row.unrealizedPct)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#10161d]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Realized by symbol</CardTitle>
            <CardDescription>Sell notional minus buy notional per ticker</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {pnl.realizedBySymbol.filter((r) => r.sellShares > 0).length === 0 ? (
              <p className="text-sm text-white/45">No closed sells yet.</p>
            ) : (
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-[10px] tracking-wide text-white/40 uppercase">
                  <tr className="border-b border-white/8">
                    <th className="py-2 pr-3 font-medium">Stock</th>
                    <th className="py-2 pr-3 font-medium">Bought</th>
                    <th className="py-2 pr-3 font-medium">Sold</th>
                    <th className="py-2 pr-3 font-medium">Net sh</th>
                    <th className="py-2 font-medium">Realized P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {pnl.realizedBySymbol
                    .filter((r) => r.sellShares > 0)
                    .map((row) => (
                      <tr key={row.symbol} className="border-b border-white/6 last:border-0">
                        <td className="py-2.5 pr-3">
                          <StockNameInline symbol={row.symbol} name={row.name} />
                        </td>
                        <td className="py-2.5 pr-3 font-mono">{row.buyShares}</td>
                        <td className="py-2.5 pr-3 font-mono">{row.sellShares}</td>
                        <td className="py-2.5 pr-3 font-mono">{row.netShares}</td>
                        <td className={cn("py-2.5 pr-3 font-mono", clsxSign(row.realizedPnL))}>
                          {formatMoney(row.realizedPnL)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function StatCard({ label, value, tone = 0 }: { label: string; value: string; tone?: number }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/2 px-3 py-2.5">
      <div className="text-[10px] tracking-wide text-white/40 uppercase">{label}</div>
      <div className={cn("mt-1 font-mono text-sm", clsxSign(tone))}>{value}</div>
    </div>
  );
}
