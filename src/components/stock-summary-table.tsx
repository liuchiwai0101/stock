"use client";

import { Fragment, useMemo, useState } from "react";
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
  mode = "watch",
  scanMeta,
}: {
  quotes: CompanyForecast[];
  active: string;
  onSelect: (symbol: string) => void;
  onTrade: (q: CompanyForecast) => void;
  onTradeAll: () => void;
  mode?: "watch" | "buyList";
  scanMeta?: { scanned: number; total?: number; passed: number; buyCount: number } | null;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const buyList = mode === "buyList";
  const rows = useMemo(() => {
    const list = buyList
      ? quotes.filter((q) => q.liveReady && q.signal === "BUY")
      : quotes;
    return [...list].sort((a, b) => {
      if (!buyList) return 0;
      const hit = b.metrics.hitRate - a.metrics.hitRate;
      if (Math.abs(hit) > 1e-9) return hit;
      return b.confidence - a.confidence;
    });
  }, [quotes, buyList]);

  const tradable = rows.some((q) => q.liveReady && q.signal !== "HOLD");
  const modelCols = useMemo(() => {
    if (buyList) return [];
    const present = new Set(quotes.flatMap((q) => (q.models ?? []).map((m) => m.id)));
    if (present.size === 0) return MODEL_COLUMNS;
    return MODEL_COLUMNS.filter((c) => present.has(c.id));
  }, [quotes, buyList]);
  const colCount = (buyList ? 8 : 6) + modelCols.length;

  function toggleRow(symbol: string) {
    if (expanded === symbol) {
      setExpanded(null);
      return;
    }
    setExpanded(symbol);
    onSelect(symbol);
  }

  return (
    <Card className="bg-[#10161d]">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">
            {buyList ? "US buy list · all U.S. stocks" : "All stocks × models"}
          </CardTitle>
          <CardDescription>
            {buyList
              ? scanMeta
                ? `${scanMeta.scanned.toLocaleString()}${scanMeta.total ? ` / ${scanMeta.total.toLocaleString()}` : ""} stocks scanned · ${scanMeta.passed.toLocaleString()} passed · ${scanMeta.buyCount} BUY · sorted by hit rate`
                : "Full U.S. listed stock scan · Pass + BUY · sorted by hit rate"
              : "Charts start collapsed — tap a row to expand or collapse"}
          </CardDescription>
        </div>
        <Button size="sm" onClick={onTradeAll} disabled={!tradable}>
          Trade verified
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/45">
            {buyList
              ? "No U.S. names currently pass the 1-year backtest with a BUY signal. Try another horizon or rescan."
              : "Add tickers and run the model."}
          </p>
        ) : (
          <table className={cn("w-full text-left text-sm", buyList ? "min-w-[720px]" : "min-w-[1100px]")}>
            <thead className="text-[10px] tracking-wide text-white/40 uppercase">
              <tr className="border-b border-white/8">
                <th className="sticky left-0 z-10 bg-[#10161d] py-2 pr-3 font-medium">#</th>
                <th className="sticky left-8 z-10 bg-[#10161d] py-2 pr-3 font-medium">Stock</th>
                <th className="py-2 pr-3 font-medium">Last</th>
                <th className="py-2 pr-3 font-medium">Target</th>
                <th className="py-2 pr-3 font-medium">Exp.</th>
                <th className="py-2 pr-3 font-medium">Hit</th>
                {buyList ? <th className="py-2 pr-3 font-medium">Conf.</th> : null}
                {buyList ? <th className="py-2 pr-3 font-medium">Sharpe</th> : null}
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
              {rows.map((q, index) => {
                const isOpen = expanded === q.symbol;
                return (
                  <Fragment key={q.symbol}>
                    <tr
                      className={cn(
                        "cursor-pointer border-b border-white/6",
                        (isOpen || q.symbol === active) && "bg-white/3",
                      )}
                      onClick={() => toggleRow(q.symbol)}
                    >
                      <td className="sticky left-0 z-10 bg-inherit py-2.5 pr-3 font-mono text-white/40">
                        {index + 1}
                      </td>
                      <td
                        className={cn(
                          "sticky left-8 z-10 py-2.5 pr-3",
                          isOpen || q.symbol === active ? "bg-[#141a21]" : "bg-[#10161d]",
                        )}
                      >
                        <button type="button" onClick={() => toggleRow(q.symbol)} className="text-left">
                          <div className="font-medium">
                            <span className="mr-1 inline-block w-3 text-white/35">{isOpen ? "▾" : "▸"}</span>
                            {q.symbol}
                          </div>
                          <div className="max-w-[120px] truncate pl-4 text-[11px] text-white/40">{q.name}</div>
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
                      <td className="py-2.5 pr-3 font-mono text-sky-200 whitespace-nowrap">
                        {(q.metrics.hitRate * 100).toFixed(0)}%
                      </td>
                      {buyList ? (
                        <td className="py-2.5 pr-3 font-mono text-white/65">
                          {(q.confidence * 100).toFixed(0)}%
                        </td>
                      ) : null}
                      {buyList ? (
                        <td className="py-2.5 pr-3 font-mono text-white/65">
                          {q.backtest.sharpe.toFixed(2)}
                        </td>
                      ) : null}
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
                    {isOpen ? (
                      <tr className="border-b border-white/6 last:border-0 bg-white/[0.02]">
                        <td colSpan={colCount} className="p-0">
                          <div className="w-full px-2 pt-2 pb-3 sm:px-3">
                            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 px-1">
                              <div className="text-xs text-white/55">
                                <span className="font-medium text-white/80">{q.symbol}</span>
                                {" · hit "}
                                {(q.metrics.hitRate * 100).toFixed(0)}%
                                {" · "}
                                {formatPrice(q.last)}
                                {" · "}
                                <span className={clsxSign(q.expectedReturn)}>{formatPct(q.expectedReturn)}</span>
                                {" expected"}
                              </div>
                              <span
                                className={cn(
                                  "rounded-full border px-2 py-0.5 text-[11px]",
                                  signalClass(q.signal),
                                )}
                              >
                                {q.signal}
                              </span>
                            </div>
                            <ForecastChart quote={q} compact />
                          </div>
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
  );
}
