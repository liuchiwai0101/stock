"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { clsxSign, formatPct, formatPrice } from "@/lib/format";
import type { CompanyForecast, TradeSignal } from "@/lib/types";
import { cn } from "@/lib/utils";

function signalClass(signal: TradeSignal): string {
  if (signal === "BUY") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/20";
  if (signal === "SELL") return "bg-rose-500/15 text-rose-300 border-rose-500/20";
  return "bg-white/5 text-white/60 border-white/10";
}

export function StockSummaryTable({
  quotes,
  active,
  onSelect,
  onTrade,
  onTradeAll,
}: {
  quotes: CompanyForecast[];
  active: string;
  onSelect: (symbol: string) => void;
  onTrade: (q: CompanyForecast) => void;
  onTradeAll: () => void;
}) {
  const tradable = quotes.some((q) => q.liveReady && q.signal !== "HOLD");

  return (
    <Card className="bg-[#10161d]">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">Stock summary</CardTitle>
          <CardDescription>
            All selected names — price, model metrics, backtest, and trading advice in one table
          </CardDescription>
        </div>
        <Button size="sm" onClick={onTradeAll} disabled={!tradable}>
          Trade verified signals
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {quotes.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/45">Add tickers and run the model.</p>
        ) : (
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="text-[10px] tracking-wide text-white/40 uppercase">
              <tr className="border-b border-white/8">
                <th className="py-2 pr-3 font-medium">Stock</th>
                <th className="py-2 pr-3 font-medium">Last</th>
                <th className="py-2 pr-3 font-medium">Day</th>
                <th className="py-2 pr-3 font-medium">Target</th>
                <th className="py-2 pr-3 font-medium">Exp.</th>
                <th className="py-2 pr-3 font-medium">Signal</th>
                <th className="py-2 pr-3 font-medium">Conf.</th>
                <th className="py-2 pr-3 font-medium">Size</th>
                <th className="py-2 pr-3 font-medium">1y BT</th>
                <th className="py-2 pr-3 font-medium">Sharpe</th>
                <th className="py-2 pr-3 font-medium">Hit</th>
                <th className="py-2 pr-3 font-medium">MAPE</th>
                <th className="py-2 pr-3 font-medium">Top model</th>
                <th className="py-2 pr-3 font-medium">Summary</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => {
                const top = [...(q.models ?? [])].sort((a, b) => b.weight - a.weight)[0];
                return (
                  <tr
                    key={q.symbol}
                    className={cn(
                      "border-b border-white/6 align-top last:border-0",
                      q.symbol === active && "bg-white/3"
                    )}
                  >
                    <td className="py-2.5 pr-3">
                      <button type="button" onClick={() => onSelect(q.symbol)} className="text-left">
                        <div className="font-medium">{q.symbol}</div>
                        <div className="max-w-[100px] truncate text-[11px] text-white/40">{q.name}</div>
                      </button>
                    </td>
                    <td className="py-2.5 pr-3 font-mono whitespace-nowrap">{formatPrice(q.last)}</td>
                    <td className={cn("py-2.5 pr-3 font-mono whitespace-nowrap", clsxSign(q.changePct))}>
                      {formatPct(q.changePct)}
                    </td>
                    <td className="py-2.5 pr-3 font-mono whitespace-nowrap">{formatPrice(q.targetPrice)}</td>
                    <td className={cn("py-2.5 pr-3 font-mono whitespace-nowrap", clsxSign(q.expectedReturn))}>
                      {formatPct(q.expectedReturn)}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", signalClass(q.signal))}>
                        {q.signal}
                      </span>
                      {q.rawSignal !== q.signal && (
                        <div className="mt-0.5 text-[10px] text-white/35">raw {q.rawSignal}</div>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-white/65">
                      {(q.confidence * 100).toFixed(0)}%
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-white/65">
                      {q.recommendedWeight === 0
                        ? "—"
                        : `${(Math.abs(q.recommendedWeight) * 100).toFixed(0)}%`}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={q.liveReady ? "text-emerald-400" : "text-amber-400"}>
                        {q.liveReady ? "Pass" : "Fail"}
                      </span>
                      <div className="text-[10px] text-white/35">
                        {q.backtest.trades} rt · {(q.backtest.winRate * 100).toFixed(0)}% win
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-white/60">{q.backtest.sharpe.toFixed(2)}</td>
                    <td className="py-2.5 pr-3 font-mono text-white/60">
                      {(q.metrics.hitRate * 100).toFixed(0)}%
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-white/60">
                      {(q.metrics.mape * 100).toFixed(1)}%
                    </td>
                    <td className="py-2.5 pr-3">
                      {top ? (
                        <>
                          <div className="text-xs font-medium">{top.id.toUpperCase()}</div>
                          <div className="text-[10px] text-white/40">{(top.weight * 100).toFixed(0)}% wt</div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2.5 pr-3 max-w-[220px]">
                      <p className="line-clamp-2 text-[11px] leading-snug text-white/50" title={q.rationale}>
                        {q.rationale}
                      </p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "mt-1 text-[10px]",
                          q.source === "simulated" ? "text-white/40" : "text-sky-300/70"
                        )}
                      >
                        {q.source === "simulated" ? "Simulated" : "Live"}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-right">
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={q.signal === "HOLD" || !q.liveReady}
                        onClick={() => onTrade(q)}
                      >
                        Trade
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
