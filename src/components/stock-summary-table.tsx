"use client";

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
          <CardTitle className="text-base">All stocks</CardTitle>
          <CardDescription>Price, target, signal, backtest</CardDescription>
        </div>
        <Button size="sm" onClick={onTradeAll} disabled={!tradable}>
          Trade verified
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {quotes.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/45">Add tickers and run the model.</p>
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-[10px] tracking-wide text-white/40 uppercase">
              <tr className="border-b border-white/8">
                <th className="py-2 pr-3 font-medium">Stock</th>
                <th className="py-2 pr-3 font-medium">Last</th>
                <th className="py-2 pr-3 font-medium">Target</th>
                <th className="py-2 pr-3 font-medium">Exp.</th>
                <th className="py-2 pr-3 font-medium">Signal</th>
                <th className="py-2 pr-3 font-medium">BT</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr
                  key={q.symbol}
                  className={cn(
                    "border-b border-white/6 last:border-0",
                    q.symbol === active && "bg-white/3",
                  )}
                >
                  <td className="py-2.5 pr-3">
                    <button type="button" onClick={() => onSelect(q.symbol)} className="text-left">
                      <div className="font-medium">{q.symbol}</div>
                      <div className="max-w-[120px] truncate text-[11px] text-white/40">{q.name}</div>
                    </button>
                  </td>
                  <td className="py-2.5 pr-3 font-mono whitespace-nowrap">
                    {formatPrice(q.last)}
                    <div className={cn("text-[11px]", clsxSign(q.changePct))}>{formatPct(q.changePct)}</div>
                  </td>
                  <td className="py-2.5 pr-3 font-mono whitespace-nowrap">{formatPrice(q.targetPrice)}</td>
                  <td className={cn("py-2.5 pr-3 font-mono whitespace-nowrap", clsxSign(q.expectedReturn))}>
                    {formatPct(q.expectedReturn)}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", signalClass(q.signal))}>
                      {q.signal}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className={q.liveReady ? "text-emerald-400" : "text-amber-400"}>
                      {q.liveReady ? "Pass" : "Fail"}
                    </span>
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
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
