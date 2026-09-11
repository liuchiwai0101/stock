"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { ForecastChart } from "@/components/forecast-chart";
import { StockNameInline } from "@/components/stock-name";
import { TradeOrderForm } from "@/components/trade-order-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { clsxSign, formatPct, formatPrice } from "@/lib/format";
import { ensureChineseNames } from "@/lib/chinese-names-store";
import { fetchQuoteBars, fetchRun, quoteWithHistory } from "@/lib/desk-fetch";
import type { CompanyForecast, Horizon, ModelId, TradeSignal } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Deploy nudge after PR #22 so Pages picks up stacked mobile stock cards. */

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

type SortColumn =
  | "symbol"
  | "last"
  | "target"
  | "exp"
  | "hit"
  | "conf"
  | "sharpe"
  | "signal"
  | "bt"
  | ModelId;

type SortDir = "asc" | "desc";

const RANK_COL = "w-8 min-w-8 max-w-8";
const STOCK_COL_WATCH = "w-[11rem] min-w-[11rem] max-w-[11rem] sm:w-[14rem] sm:min-w-[14rem] sm:max-w-[14rem]";
const STOCK_COL_BUY = "w-[10rem] min-w-[10rem] max-w-[10rem] sm:w-[12rem] sm:min-w-[12rem] sm:max-w-[12rem]";
/* Keep below sticky desk chrome (z-20) so mobile scroll doesn’t feel locked. */
/* Deploy nudge after PR #13. */
const STICKY_RANK = "sticky left-0 z-[5]";
const STICKY_STOCK = "sticky left-8 z-[5]";
const PRICE_COL = "min-w-[6.75rem] whitespace-nowrap";
const NUM_COL = "min-w-[5.5rem] whitespace-nowrap";
const TAG_COL = "min-w-[4.5rem] whitespace-nowrap";
const ACTION_COL = "min-w-[9rem] whitespace-nowrap";

type TradeEditor = { symbol: string; side: "BUY" | "SELL" };

function signalClass(signal: TradeSignal): string {
  if (signal === "BUY") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/20";
  if (signal === "SELL") return "bg-rose-500/15 text-rose-300 border-rose-500/20";
  return "bg-white/5 text-white/60 border-white/10";
}

function signalRank(signal: TradeSignal): number {
  if (signal === "BUY") return 2;
  if (signal === "HOLD") return 1;
  return 0;
}

function modelSuggestion(q: CompanyForecast, id: ModelId) {
  return q.models?.find((m) => m.id === id) ?? null;
}

function compareRows(
  a: CompanyForecast,
  b: CompanyForecast,
  column: SortColumn,
  dir: SortDir,
): number {
  let cmp = 0;
  switch (column) {
    case "symbol":
      cmp = a.symbol.localeCompare(b.symbol);
      break;
    case "last":
      cmp = a.last - b.last;
      break;
    case "target":
      cmp = a.targetPrice - b.targetPrice;
      break;
    case "exp":
      cmp = a.expectedReturn - b.expectedReturn;
      break;
    case "hit":
      cmp = a.metrics.hitRate - b.metrics.hitRate;
      break;
    case "conf":
      cmp = a.confidence - b.confidence;
      break;
    case "sharpe":
      cmp = a.backtest.sharpe - b.backtest.sharpe;
      break;
    case "signal":
      cmp = signalRank(a.signal) - signalRank(b.signal);
      break;
    case "bt":
      cmp = Number(a.liveReady) - Number(b.liveReady);
      break;
    default: {
      const ma = modelSuggestion(a, column);
      const mb = modelSuggestion(b, column);
      const va = ma?.expectedReturn ?? -Infinity;
      const vb = mb?.expectedReturn ?? -Infinity;
      cmp = va - vb;
      break;
    }
  }
  if (cmp === 0) cmp = a.symbol.localeCompare(b.symbol);
  return dir === "asc" ? cmp : -cmp;
}

function RowActions({
  q,
  watchSet,
  heldShares,
  onAddSymbol,
  onRemoveSymbol,
  onBuy,
  onSell,
}: {
  q: CompanyForecast;
  watchSet: Set<string>;
  heldShares: Record<string, number>;
  onAddSymbol?: (symbol: string) => void;
  onRemoveSymbol?: (symbol: string) => void;
  onBuy: () => void;
  onSell: () => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {onAddSymbol && onRemoveSymbol ? (
        watchSet.has(q.symbol.toUpperCase()) ? (
          <Button
            size="xs"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveSymbol(q.symbol);
            }}
          >
            Remove
          </Button>
        ) : (
          <Button
            size="xs"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onAddSymbol(q.symbol);
            }}
          >
            Add
          </Button>
        )
      ) : null}
      <Button
        size="xs"
        variant="outline"
        disabled={!q.liveReady}
        onClick={(e) => {
          e.stopPropagation();
          onBuy();
        }}
      >
        Buy
      </Button>
      <Button
        size="xs"
        variant="outline"
        disabled={(heldShares[q.symbol] ?? 0) <= 0}
        onClick={(e) => {
          e.stopPropagation();
          onSell();
        }}
      >
        Sell
      </Button>
    </div>
  );
}

function Metric({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-md bg-white/[0.04] px-2 py-1.5">
      <div className="text-[10px] leading-none tracking-wide text-white/40 uppercase">{label}</div>
      <div className="mt-1 font-mono text-[13px] leading-tight tabular-nums break-all">{children}</div>
    </div>
  );
}

function SortHeader({
  label,
  column,
  sort,
  onSort,
  className,
}: {
  label: string;
  column: SortColumn;
  sort: { column: SortColumn; dir: SortDir };
  onSort: (column: SortColumn) => void;
  className?: string;
}) {
  const active = sort.column === column;
  return (
    <th className={cn("py-2 pr-3 font-medium", className)}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "inline-flex items-center gap-1 whitespace-nowrap text-left leading-tight transition hover:text-white/75",
          active ? "text-sky-200" : "text-white/40",
        )}
      >
        <span>{label}</span>
        <span className="font-mono text-[9px]">{active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}

export function StockSummaryTable({
  quotes,
  active,
  onSelect,
  onBuy,
  onSell,
  onTradeAll,
  onAddSymbol,
  onRemoveSymbol,
  watchlistSymbols = [],
  heldShares = {},
  suggestedShares,
  mode = "watch",
  scanMeta,
  horizon = 21,
}: {
  quotes: CompanyForecast[];
  active: string;
  onSelect: (symbol: string) => void;
  onBuy: (q: CompanyForecast, shares: number) => void;
  onSell: (q: CompanyForecast, shares: number) => void;
  onTradeAll: () => void;
  onAddSymbol?: (symbol: string) => void;
  onRemoveSymbol?: (symbol: string) => void;
  watchlistSymbols?: string[];
  heldShares?: Record<string, number>;
  suggestedShares?: (q: CompanyForecast) => number;
  mode?: "watch" | "buyList";
  scanMeta?: { scanned: number; total?: number; passed: number; buyCount: number } | null;
  horizon?: Horizon;
}) {
  const buyList = mode === "buyList";
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tradeEditor, setTradeEditor] = useState<TradeEditor | null>(null);
  const [detailQuotes, setDetailQuotes] = useState<Record<string, CompanyForecast>>({});
  const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>({});
  const [detailError, setDetailError] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ column: SortColumn; dir: SortDir }>({
    column: buyList ? "hit" : "symbol",
    dir: buyList ? "desc" : "asc",
  });
  const watchSet = useMemo(() => new Set(watchlistSymbols.map((s) => s.toUpperCase())), [watchlistSymbols]);

  const baseRows = useMemo(() => {
    return buyList ? quotes.filter((q) => q.liveReady && q.signal === "BUY") : quotes;
  }, [quotes, buyList]);

  const rows = useMemo(() => {
    return [...baseRows].sort((a, b) => compareRows(a, b, sort.column, sort.dir));
  }, [baseRows, sort]);

  const tradable = rows.some((q) => q.liveReady && q.signal !== "HOLD");
  const colCount = 2 + 4 + (buyList ? 2 : 0) + 2 + 1;
  const stockCol = buyList ? STOCK_COL_BUY : STOCK_COL_WATCH;

  useEffect(() => {
    void ensureChineseNames(quotes.map((q) => q.symbol));
  }, [quotes]);

  function toggleSort(column: SortColumn) {
    setSort((prev) =>
      prev.column === column
        ? { column, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { column, dir: column === "symbol" ? "asc" : "desc" },
    );
  }

  function loadDetail(symbol: string, q: CompanyForecast | undefined) {
    const cached = detailQuotes[symbol];
    const source = cached ?? q;
    if (!source || source.history.length >= 5 || detailLoading[symbol]) return;

    setDetailLoading((prev) => ({ ...prev, [symbol]: true }));
    setDetailError((prev) => {
      const next = { ...prev };
      delete next[symbol];
      return next;
    });
    void (async () => {
      let hasBars = false;
      try {
        const bars = await fetchQuoteBars(symbol);
        if (bars?.length) {
          hasBars = true;
          setDetailQuotes((prev) => ({ ...prev, [symbol]: quoteWithHistory(source, bars) }));
        }
        const json = await fetchRun([symbol], horizon);
        const full = json.quotes?.[0];
        if (full && full.history.length > 0) {
          setDetailQuotes((prev) => ({ ...prev, [symbol]: full }));
          return;
        }
        if (!hasBars) {
          setDetailError((prev) => ({
            ...prev,
            [symbol]: "Could not load chart history for this ticker.",
          }));
        }
      } catch {
        if (!hasBars) {
          setDetailError((prev) => ({
            ...prev,
            [symbol]: "Could not load chart history for this ticker.",
          }));
        }
      } finally {
        setDetailLoading((prev) => ({ ...prev, [symbol]: false }));
      }
    })();
  }

  function toggleRow(symbol: string) {
    if (expanded === symbol) {
      setExpanded(null);
      return;
    }
    setExpanded(symbol);
    onSelect(symbol);
    loadDetail(symbol, quotes.find((row) => row.symbol === symbol));
  }

  return (
    <Card className="overflow-visible bg-[#10161d]">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">
            {buyList ? "US buy list · all U.S. stocks" : "All stocks × models"}
          </CardTitle>
          <CardDescription>
            {buyList
              ? scanMeta
                ? `${scanMeta.scanned.toLocaleString()}${scanMeta.total ? ` / ${scanMeta.total.toLocaleString()}` : ""} stocks scanned · ${scanMeta.passed.toLocaleString()} passed · ${scanMeta.buyCount} BUY · tap a card for chart`
                : "Full U.S. listed common-stock scan · Pass + BUY · tap a card for chart"
              : "Each stock lists last, target, and expected on its own row · tap for chart"}
          </CardDescription>
        </div>
        <Button size="sm" onClick={onTradeAll} disabled={!tradable}>
          Trade verified
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-hidden px-3 md:overflow-x-auto">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/45">
            {buyList
              ? "No U.S. names currently pass the 1-year backtest with a BUY signal. Try another horizon or rescan."
              : "Add tickers and run the model."}
          </p>
        ) : (
          <>
            <div className="space-y-2 md:hidden">
              {rows.map((q, index) => {
                const isOpen = expanded === q.symbol;
                const detail = detailQuotes[q.symbol] ?? q;
                const loading = Boolean(detailLoading[q.symbol]);
                const err = detailError[q.symbol];
                return (
                  <div
                    key={q.symbol}
                    className={cn(
                      "rounded-lg border border-white/10 bg-white/[0.03] p-3",
                      (isOpen || q.symbol === active) && "border-sky-400/25 bg-white/[0.05]",
                    )}
                  >
                    <button
                      type="button"
                      className="flex w-full items-start gap-2 text-left"
                      onClick={() => toggleRow(q.symbol)}
                      aria-expanded={isOpen}
                    >
                      <span className="w-5 shrink-0 font-mono text-[11px] text-white/40">{index + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-white/35">{isOpen ? "▾" : "▸"}</span>
                          <StockNameInline symbol={q.symbol} name={q.name} className="min-w-0 flex-1" />
                        </span>
                      </span>
                      <span className={cn("shrink-0 rounded-full border px-1.5 py-0.5 text-[10px]", signalClass(q.signal))}>
                        {q.signal}
                      </span>
                    </button>
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      <Metric label="Last">
                        <span className="block">{formatPrice(q.last)}</span>
                        <span className={cn("block text-[11px]", clsxSign(q.changePct))}>{formatPct(q.changePct)}</span>
                      </Metric>
                      <Metric label="Target">{formatPrice(q.targetPrice)}</Metric>
                      <Metric label="Expected">
                        <span className={clsxSign(q.expectedReturn)}>{formatPct(q.expectedReturn)}</span>
                      </Metric>
                      <Metric label="Hit">{(q.metrics.hitRate * 100).toFixed(0)}%</Metric>
                      <Metric label="Backtest">
                        <span className={q.liveReady ? "text-emerald-400" : "text-amber-400"}>
                          {q.liveReady ? "Pass" : "Fail"}
                        </span>
                      </Metric>
                      {buyList ? (
                        <Metric label="Conf">{(q.confidence * 100).toFixed(0)}%</Metric>
                      ) : (
                        <Metric label="Sharpe">{q.backtest.sharpe.toFixed(2)}</Metric>
                      )}
                    </div>
                    <div className="mt-2">
                      <RowActions
                        q={q}
                        watchSet={watchSet}
                        heldShares={heldShares}
                        onAddSymbol={onAddSymbol}
                        onRemoveSymbol={onRemoveSymbol}
                        onBuy={() => setTradeEditor({ symbol: q.symbol, side: "BUY" })}
                        onSell={() => setTradeEditor({ symbol: q.symbol, side: "SELL" })}
                      />
                    </div>
                    {tradeEditor?.symbol === q.symbol ? (
                      <div className="mt-2">
                        <TradeOrderForm
                          side={tradeEditor.side}
                          symbol={q.symbol}
                          name={q.name}
                          price={q.last}
                          defaultShares={
                            tradeEditor.side === "BUY"
                              ? Math.max(1, suggestedShares?.(q) ?? 1)
                              : (heldShares[q.symbol] ?? 1)
                          }
                          maxShares={tradeEditor.side === "SELL" ? heldShares[q.symbol] : undefined}
                          heldLabel={
                            tradeEditor.side === "SELL" ? `hold ${heldShares[q.symbol] ?? 0} sh` : undefined
                          }
                          onSubmit={(shares) => {
                            if (tradeEditor.side === "BUY") onBuy(q, shares);
                            else onSell(q, shares);
                            setTradeEditor(null);
                          }}
                          onCancel={() => setTradeEditor(null)}
                        />
                      </div>
                    ) : null}
                    {isOpen ? (
                      <div className="mt-3">
                        {!buyList && (q.models?.length ?? 0) > 0 ? (
                          <div className="mb-2 flex flex-wrap gap-1">
                            {MODEL_COLUMNS.map((c) => {
                              const m = modelSuggestion(q, c.id);
                              if (!m) return null;
                              return (
                                <span
                                  key={c.id}
                                  className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/4 px-1.5 py-0.5 text-[10px]"
                                >
                                  <span className="text-white/45">{c.short}</span>
                                  <span className={cn("font-mono", clsxSign(m.expectedReturn))}>
                                    {formatPct(m.expectedReturn)}
                                  </span>
                                </span>
                              );
                            })}
                          </div>
                        ) : null}
                        {loading && detail.history.length < 5 ? (
                          <div className="flex h-[180px] items-center justify-center text-sm text-white/45">
                            Loading chart for {q.symbol}…
                          </div>
                        ) : err && detail.history.length < 5 ? (
                          <div className="flex h-[140px] flex-col items-center justify-center gap-2 text-sm text-amber-200/85">
                            <span>{err}</span>
                            <Button size="xs" variant="outline" onClick={() => loadDetail(q.symbol, q)}>
                              Retry
                            </Button>
                          </div>
                        ) : (
                          <ForecastChart quote={detail} compact />
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="hidden max-w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] md:block">
            <table className="w-max min-w-full text-left text-sm">
            <colgroup>
              <col className="w-8" />
              <col className={buyList ? "w-[12rem]" : "w-[14rem]"} />
              <col />
              <col />
              <col />
              <col />
              {buyList ? <col /> : null}
              {buyList ? <col /> : null}
              <col />
              <col />
              <col className="w-[7rem]" />
            </colgroup>
            <thead className="text-[10px] font-medium tracking-normal">
              <tr className="border-b border-white/8">
                <th
                  className={cn(
                    RANK_COL,
                    STICKY_RANK,
                    "bg-[#10161d] py-1.5 pr-1 font-medium text-white/40",
                  )}
                >
                  Rank
                </th>
                <SortHeader
                  label="Stock"
                  column="symbol"
                  sort={sort}
                  onSort={toggleSort}
                  className={cn(stockCol, STICKY_STOCK, "bg-[#10161d]")}
                />
                <SortHeader
                  label="Last price"
                  column="last"
                  sort={sort}
                  onSort={toggleSort}
                  className={PRICE_COL}
                />
                <SortHeader
                  label="Target price"
                  column="target"
                  sort={sort}
                  onSort={toggleSort}
                  className={PRICE_COL}
                />
                <SortHeader
                  label="Expected return"
                  column="exp"
                  sort={sort}
                  onSort={toggleSort}
                  className={NUM_COL}
                />
                <SortHeader label="Hit rate" column="hit" sort={sort} onSort={toggleSort} className={NUM_COL} />
                {buyList ? (
                  <SortHeader
                    label="Confidence"
                    column="conf"
                    sort={sort}
                    onSort={toggleSort}
                    className={NUM_COL}
                  />
                ) : null}
                {buyList ? (
                  <SortHeader
                    label="Sharpe ratio"
                    column="sharpe"
                    sort={sort}
                    onSort={toggleSort}
                    className={NUM_COL}
                  />
                ) : null}
                <SortHeader
                  label="Signal"
                  column="signal"
                  sort={sort}
                  onSort={toggleSort}
                  className={TAG_COL}
                />
                <SortHeader label="Backtest" column="bt" sort={sort} onSort={toggleSort} className={NUM_COL} />
                <th className={cn(ACTION_COL, "py-1.5 font-medium text-white/40")} />
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
                      <td
                        className={cn(
                          RANK_COL,
                          STICKY_RANK,
                          "bg-inherit py-1.5 pr-1 font-mono text-[11px] text-white/40",
                        )}
                      >
                        {index + 1}
                      </td>
                      <td
                        className={cn(
                          stockCol,
                          STICKY_STOCK,
                          "overflow-hidden py-1.5 pr-2",
                          isOpen || q.symbol === active ? "bg-[#141a21]" : "bg-[#10161d]",
                        )}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRow(q.symbol);
                          }}
                          className="flex w-full min-w-0 items-center gap-1 overflow-hidden text-left"
                          aria-expanded={isOpen}
                        >
                          <span className="inline-block w-3 shrink-0 text-white/35">{isOpen ? "▾" : "▸"}</span>
                          <StockNameInline symbol={q.symbol} name={q.name} className="min-w-0 flex-1" />
                        </button>
                      </td>
                      <td className={cn(PRICE_COL, "py-1.5 pr-2 font-mono text-[12px]")}>
                        {formatPrice(q.last)}
                        <div className={cn("text-[10px]", clsxSign(q.changePct))}>{formatPct(q.changePct)}</div>
                      </td>
                      <td className={cn(PRICE_COL, "py-1.5 pr-2 font-mono text-[12px]")}>{formatPrice(q.targetPrice)}</td>
                      <td className={cn(NUM_COL, "py-1.5 pr-2 font-mono text-[12px]", clsxSign(q.expectedReturn))}>
                        {formatPct(q.expectedReturn)}
                      </td>
                      <td className={cn(NUM_COL, "py-1.5 pr-2 font-mono text-[12px] text-sky-200")}>
                        {(q.metrics.hitRate * 100).toFixed(0)}%
                      </td>
                      {buyList ? (
                        <td className={cn(NUM_COL, "py-1.5 pr-2 font-mono text-[12px] text-white/65")}>
                          {(q.confidence * 100).toFixed(0)}%
                        </td>
                      ) : null}
                      {buyList ? (
                        <td className={cn(NUM_COL, "py-1.5 pr-2 font-mono text-[12px] text-white/65")}>
                          {q.backtest.sharpe.toFixed(2)}
                        </td>
                      ) : null}
                      <td className={cn(TAG_COL, "py-1.5 pr-2")}>
                        <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px]", signalClass(q.signal))}>
                          {q.signal}
                        </span>
                      </td>
                      <td className={cn(NUM_COL, "py-1.5 pr-2 text-[12px]")}>
                        <span className={q.liveReady ? "text-emerald-400" : "text-amber-400"}>
                          {q.liveReady ? "Pass" : "Fail"}
                        </span>
                      </td>
                      <td className={cn(ACTION_COL, "py-1.5 text-right")}>
                        <RowActions
                          q={q}
                          watchSet={watchSet}
                          heldShares={heldShares}
                          onAddSymbol={onAddSymbol}
                          onRemoveSymbol={onRemoveSymbol}
                          onBuy={() => setTradeEditor({ symbol: q.symbol, side: "BUY" })}
                          onSell={() => setTradeEditor({ symbol: q.symbol, side: "SELL" })}
                        />
                      </td>
                    </tr>
                    {tradeEditor?.symbol === q.symbol ? (
                      <tr className="border-b border-white/6 bg-white/[0.02]">
                        <td colSpan={colCount} className="px-2 py-2 sm:px-3">
                          <TradeOrderForm
                            side={tradeEditor.side}
                            symbol={q.symbol}
                            name={q.name}
                            price={q.last}
                            defaultShares={
                              tradeEditor.side === "BUY"
                                ? Math.max(1, suggestedShares?.(q) ?? 1)
                                : (heldShares[q.symbol] ?? 1)
                            }
                            maxShares={tradeEditor.side === "SELL" ? heldShares[q.symbol] : undefined}
                            heldLabel={
                              tradeEditor.side === "SELL"
                                ? `hold ${heldShares[q.symbol] ?? 0} sh`
                                : undefined
                            }
                            onSubmit={(shares) => {
                              if (tradeEditor.side === "BUY") onBuy(q, shares);
                              else onSell(q, shares);
                              setTradeEditor(null);
                            }}
                            onCancel={() => setTradeEditor(null)}
                          />
                        </td>
                      </tr>
                    ) : null}
                    {isOpen ? (
                      <tr className="border-b border-white/6 last:border-0 bg-white/[0.02]">
                        <td colSpan={colCount} className="p-0">
                          <div className="w-full px-2 pt-2 pb-3 sm:px-3">
                            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 px-1">
                              <div className="text-xs text-white/55">
                                <StockNameInline symbol={q.symbol} name={q.name} />
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
                            {!buyList && (q.models?.length ?? 0) > 0 ? (
                              <div className="mb-2 flex flex-wrap gap-1 px-1">
                                {MODEL_COLUMNS.map((c) => {
                                  const m = modelSuggestion(q, c.id);
                                  if (!m) return null;
                                  return (
                                    <span
                                      key={c.id}
                                      className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/4 px-1.5 py-0.5 text-[10px]"
                                      title={`${m.label} · wt ${(m.weight * 100).toFixed(0)}%`}
                                    >
                                      <span className="text-white/45">{c.short}</span>
                                      <span className={cn("font-mono", clsxSign(m.expectedReturn))}>
                                        {formatPct(m.expectedReturn)}
                                      </span>
                                    </span>
                                  );
                                })}
                              </div>
                            ) : null}
                            {(() => {
                              const detail = detailQuotes[q.symbol] ?? q;
                              const loading = Boolean(detailLoading[q.symbol]);
                              const err = detailError[q.symbol];
                              if (loading && detail.history.length < 5) {
                                return (
                                  <div className="flex h-[200px] items-center justify-center text-sm text-white/45 sm:h-[220px]">
                                    Loading chart for {q.symbol}…
                                  </div>
                                );
                              }
                              if (err && detail.history.length < 5) {
                                return (
                                  <div className="flex h-[160px] flex-col items-center justify-center gap-2 text-sm text-amber-200/85">
                                    <span>{err}</span>
                                    <Button
                                      size="xs"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        loadDetail(q.symbol, q);
                                      }}
                                    >
                                      Retry
                                    </Button>
                                  </div>
                                );
                              }
                              return <ForecastChart quote={detail} compact />;
                            })()}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
