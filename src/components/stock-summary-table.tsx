"use client";

import { Fragment, useMemo } from "react";
import { ForecastChart } from "@/components/forecast-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { clsxSign, formatPct, formatPrice } from "@/lib/format";
import type { CompanyForecast, ModelId, TradeSignal } from "@/lib/types";
import { cn } from "@/lib/utils";

const MODEL_COLUMNS: { id: ModelId; short: string }[] = [
  { id: "holt", short: "Holt" },
  { id: "ols", short: "OLS" },
  { id: "ar1", short: "AR1" },
  { id: "momentum", short: "Mom" },
  { id: "garch", short: "GARCH" },
  { id: "kalman", short: "Kalman" },
  { id: "arima", short: "ARIMA" },
  { id: "ou", short: "OU" },
  { id: "ewma", short: "EWMA" },
  { id: "regime", short: "Regime" },
];

function signalClass(signal: TradeSignal): string {
  if (signal === "BUY") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/20";
  if (signal === "SELL") return "bg-rose-500/15 text-rose-300 border-rose-500/20";
  return "bg-white/5 text-white/60 border-white/10";
}

function modelSuggestion(q: CompanyForecast, id: ModelId) {
  return q.models?.find((m) => m.id === id) ?? null;
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
  const modelCols = useMemo(() => {
    const present = new Set(quotes.flatMap((q) => (q.models ?? []).map((m) => m.id)));
    if (present.size === 0) return MODEL_COLUMNS;
    return MODEL_COLUMNS.filter((c) => present.has(c.id));
  }, [quotes]);
  const colCount = 6 + modelCols.length;
  const activeQuote = quotes.find((q) => q.symbol === active) ?? null;

  return (
    <Card className="bg-[#10161d]">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">All stocks × models</CardTitle>
          <CardDescription>
            Select a row to show its forecast chart under the table
          </CardDescription>
        </div>
        <Button size="sm" onClick={onTradeAll} disabled={!tradable}>
          Trade verified
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {quotes.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/45">Add tickers and run the model.</p>
        ) : (
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="text-[10px] tracking-wide text-white/40 uppercase">
              <tr className="border-b border-white/8">
                <th className="sticky left-0 z-10 bg-[#10161d] py-2 pr-3 font-medium">Stock</th>
                <th className="py-2 pr-3 font-medium">Last</th>
                <th className="py-2 pr-3 font-medium">Ensemble</th>
                <th className="py-2 pr-3 font-medium">Signal</th>
                <th className="py-2 pr-3 font-medium">BT</th>
                {modelCols.map((c) => (
                  <th key={c.id} className="py-2 pr-3 font-medium whitespace-nowrap">
                    {c.short}
                  </th>
                ))}
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <Fragment key={q.symbol}>
                  <tr
                    className={cn(
                      "border-b border-white/6",
                      q.symbol === active && "bg-white/3",
                      q.symbol !== active && "last:border-0",
                    )}
                    onClick={() => onSelect(q.symbol)}
                  >
                    <td
                      className={cn(
                        "sticky left-0 z-10 py-2.5 pr-3",
                        q.symbol === active ? "bg-[#141a21]" : "bg-[#10161d]",
                      )}
                    >
                      <button type="button" onClick={() => onSelect(q.symbol)} className="text-left">
                        <div className="font-medium">{q.symbol}</div>
                        <div className="max-w-[110px] truncate text-[11px] text-white/40">{q.name}</div>
                      </button>
                    </td>
                    <td className="py-2.5 pr-3 font-mono whitespace-nowrap">
                      {formatPrice(q.last)}
                      <div className={cn("text-[11px]", clsxSign(q.changePct))}>{formatPct(q.changePct)}</div>
                    </td>
                    <td className="py-2.5 pr-3 font-mono whitespace-nowrap">
                      {formatPrice(q.targetPrice)}
                      <div className={cn("text-[11px]", clsxSign(q.expectedReturn))}>
                        {formatPct(q.expectedReturn)}
                      </div>
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
                    {modelCols.map((c) => {
                      const m = modelSuggestion(q, c.id);
                      if (!m) {
                        return (
                          <td key={c.id} className="py-2.5 pr-3 font-mono text-white/30">
                            —
                          </td>
                        );
                      }
                      return (
                        <td
                          key={c.id}
                          className="py-2.5 pr-3 font-mono whitespace-nowrap"
                          title={`${m.label}: ${formatPrice(m.targetPrice)} · wt ${(m.weight * 100).toFixed(0)}%`}
                        >
                          <span className={clsxSign(m.expectedReturn)}>{formatPct(m.expectedReturn)}</span>
                          <div className="text-[10px] text-white/35">{formatPrice(m.targetPrice)}</div>
                        </td>
                      );
                    })}
                    <td className="py-2.5 text-right">
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={q.signal === "HOLD" || !q.liveReady}
                        onClick={(e) => {
                          e.stopPropagation();
                          onTrade(q);
                        }}
                      >
                        Trade
                      </Button>
                    </td>
                  </tr>
                  {q.symbol === active && activeQuote ? (
                    <tr className="border-b border-white/6 last:border-0 bg-white/[0.02]">
                      <td colSpan={colCount} className="p-0">
                        <div className="w-full px-2 pt-2 pb-3 sm:px-3">
                          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 px-1">
                            <div className="text-xs text-white/55">
                              <span className="font-medium text-white/80">{activeQuote.symbol}</span>
                              {" · "}
                              {formatPrice(activeQuote.last)}
                              {" · "}
                              <span className={clsxSign(activeQuote.expectedReturn)}>
                                {formatPct(activeQuote.expectedReturn)}
                              </span>
                              {" expected"}
                              {!activeQuote.liveReady ? " · auto-trade blocked" : ""}
                            </div>
                            <span
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-[11px]",
                                signalClass(activeQuote.signal),
                              )}
                            >
                              {activeQuote.signal}
                            </span>
                          </div>
                          <ForecastChart quote={activeQuote} compact />
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
