"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  LoaderCircle,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { ForecastChart } from "@/components/forecast-chart";
import { StockSummaryTable } from "@/components/stock-summary-table";
import { ModelWeightsPanel } from "@/components/analysis-panels";
import { VerificationBanner } from "@/components/verification-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { usePortfolio } from "@/hooks/use-portfolio";
import { clsxSign, formatCompact, formatMoney, formatPct, formatPrice } from "@/lib/format";
import { STARTING_CASH, sharesForWeight } from "@/lib/trading";
import type { CompanyForecast, Horizon, RunResponse, TradeSignal } from "@/lib/types";
import { DEFAULT_SYMBOLS, UNIVERSE } from "@/lib/universe";
import { cn } from "@/lib/utils";

const HORIZONS: { value: Horizon; label: string }[] = [
  { value: 5, label: "1 week" },
  { value: 10, label: "2 weeks" },
  { value: 21, label: "1 month" },
  { value: 63, label: "1 quarter" },
];

type SearchHit = { symbol: string; name: string; type: string };

function signalClass(signal: TradeSignal): string {
  if (signal === "BUY") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/20";
  if (signal === "SELL") return "bg-rose-500/15 text-rose-300 border-rose-500/20";
  return "bg-white/5 text-white/60 border-white/10";
}

export function Dashboard() {
  const [symbols, setSymbols] = useState<string[]>(DEFAULT_SYMBOLS);
  const [active, setActive] = useState<string>(DEFAULT_SYMBOLS[0]);
  const [horizon, setHorizon] = useState<Horizon>(21);
  const [run, setRun] = useState<RunResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shareOverride, setShareOverride] = useState<Record<string, number>>({});
  const searchRef = useRef<HTMLDivElement>(null);
  const requestSeq = useRef(0);

  const marks = useMemo(() => {
    const m: Record<string, number> = {};
    for (const q of run?.quotes ?? []) m[q.symbol] = q.last;
    return m;
  }, [run]);

  const book = usePortfolio(marks);
  const quote = run?.quotes.find((q) => q.symbol === active) ?? run?.quotes[0] ?? null;
  const recommendedShares = quote
    ? Math.max(1, sharesForWeight(book.equity, quote.last, quote.recommendedWeight) || 10)
    : 10;
  const shares = quote ? (shareOverride[quote.symbol] ?? recommendedShares) : recommendedShares;
  const visibleHits = query.trim() ? hits : [];

  const load = useCallback(async (nextSymbols: string[], nextHorizon: Horizon) => {
    if (nextSymbols.length === 0) {
      setRun(null);
      setLoading(false);
      setError("Add a company to run the forecast.");
      return;
    }
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/run?symbols=${encodeURIComponent(nextSymbols.join(","))}&horizon=${nextHorizon}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as RunResponse & { error?: string };
      if (seq !== requestSeq.current) return;
      if (!res.ok) throw new Error(json.error ?? "Forecast failed");
      if (!json.quotes?.length) {
        throw new Error(
          json.errors?.length
            ? json.errors.map((e) => `${e.symbol}: ${e.message}`).join(" · ")
            : "No forecasts returned for the selected tickers.",
        );
      }
      setRun(json);
      setActive((prev) =>
        json.quotes.some((q) => q.symbol === prev) ? prev : (json.quotes[0]?.symbol ?? prev),
      );
      if (json.errors.length) {
        setError(json.errors.map((e) => `${e.symbol}: ${e.message}`).join(" · "));
      }
    } catch (err) {
      if (seq !== requestSeq.current) return;
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Could not run the model.");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load(symbols, horizon);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      requestSeq.current += 1;
    };
  }, [symbols, horizon, load]);

  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const t = window.setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const json = (await res.json()) as { results: SearchHit[] };
      setHits(json.results ?? []);
      setSearchOpen(true);
    }, 220);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!searchRef.current?.contains(e.target as Node)) setSearchOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function addSymbol(symbol: string) {
    const next = symbol.toUpperCase();
    setSymbols((prev) => {
      if (prev.includes(next)) return prev;
      if (prev.length >= 6) return [...prev.slice(1), next];
      return [...prev, next];
    });
    setActive(next);
    setQuery("");
    setSearchOpen(false);
  }

  function removeSymbol(symbol: string) {
    setSymbols((prev) => {
      const next = prev.filter((s) => s !== symbol);
      if (symbol === active && next[0]) setActive(next[0]);
      return next;
    });
  }

  function execute(side: "BUY" | "SELL", q: CompanyForecast, count: number, note: string) {
    book.trade({
      symbol: q.symbol,
      name: q.name,
      side,
      shares: count,
      price: q.last,
      note,
    });
  }

  function signalOrder(q: CompanyForecast) {
    const rec = Math.max(1, sharesForWeight(book.equity, q.last, q.recommendedWeight));
    const note = `Model ${q.signal} · ${formatPct(q.expectedReturn)} over ${horizon}d`;
    if (q.signal === "BUY") {
      return {
        symbol: q.symbol,
        name: q.name,
        side: "BUY" as const,
        shares: rec,
        price: q.last,
        note,
      };
    }
    if (q.signal === "SELL") {
      const held = book.portfolio.positions.find((p) => p.symbol === q.symbol)?.shares ?? 0;
      if (held <= 0) return null;
      return {
        symbol: q.symbol,
        name: q.name,
        side: "SELL" as const,
        shares: Math.min(held, rec),
        price: q.last,
        note,
      };
    }
    return null;
  }

  function tradeSignal(q: CompanyForecast) {
    if (!q.liveReady) {
      book.notify(`${q.symbol}: 1-year backtest failed — signal blocked until verification passes.`);
      return;
    }
    if (q.signal === "HOLD") return;
    const order = signalOrder(q);
    if (!order) {
      book.notify(`No ${q.symbol} shares to sell — this desk does not short.`);
      return;
    }
    book.trade(order);
  }

  function tradeAllSignals() {
    const orders = (run?.quotes ?? [])
      .map(signalOrder)
      .filter((o): o is NonNullable<typeof o> => o !== null);
    if (orders.length === 0) {
      book.notify("No tradable signals. BUY names size automatically; SELL needs an open long.");
      return;
    }
    book.tradeMany(orders);
  }

  const pnl = book.equity - STARTING_CASH;
  const pnlPct = pnl / STARTING_CASH;
  const readyCount = run?.quotes.filter((q) => q.liveReady).length ?? 0;

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-white/8 bg-[#0b1016]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/25">
              <Activity className="size-4" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">Signal Desk</div>
              <div className="text-[11px] text-white/45">
                Paper forecasts
                {run ? ` · ${readyCount}/${run.quotes.length} trade-ready` : ""}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-right sm:flex sm:items-center sm:gap-6">
            <Stat label="Equity" value={formatMoney(book.equity)} />
            <Stat label="Cash" value={formatMoney(book.portfolio.cash)} />
            <Stat label="P&L" value={formatMoney(pnl)} hint={formatPct(pnlPct)} tone={pnl} />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-6 px-4 py-5 sm:px-6 sm:py-6">
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div ref={searchRef} className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-white/35" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => visibleHits.length && setSearchOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && query.trim()) addSymbol(query.trim());
                }}
                placeholder="Add ticker…"
                className="h-10 bg-white/3 pl-8"
              />
              {searchOpen && visibleHits.length > 0 && (
                <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-white/10 bg-[#121820] shadow-2xl">
                  {visibleHits.map((hit) => (
                    <button
                      key={hit.symbol}
                      type="button"
                      onClick={() => addSymbol(hit.symbol)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-white/6"
                    >
                      <span className="font-medium">{hit.symbol}</span>
                      <span className="truncate pl-4 text-xs text-white/50">{hit.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {HORIZONS.map((h) => (
                <Button
                  key={h.value}
                  size="sm"
                  variant={horizon === h.value ? "default" : "outline"}
                  onClick={() => setHorizon(h.value)}
                >
                  {h.label}
                </Button>
              ))}
              <Button size="sm" variant="secondary" onClick={() => void load(symbols, horizon)} disabled={loading}>
                {loading ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
                Run
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {symbols.map((symbol) => (
              <button
                key={symbol}
                type="button"
                onClick={() => setActive(symbol)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition",
                  active === symbol
                    ? "border-sky-400/40 bg-sky-400/15 text-sky-100"
                    : "border-white/10 bg-white/3 text-white/70 hover:bg-white/6",
                )}
              >
                {symbol}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSymbol(symbol);
                  }}
                  className="rounded-full p-0.5 hover:bg-white/15"
                >
                  <X className="size-3" />
                </span>
              </button>
            ))}
            {UNIVERSE.filter((c) => !symbols.includes(c.symbol))
              .slice(0, 4)
              .map((c) => (
                <button
                  key={c.symbol}
                  type="button"
                  onClick={() => addSymbol(c.symbol)}
                  className="rounded-full border border-dashed border-white/12 px-2.5 py-1 text-xs text-white/40 hover:border-white/25 hover:text-white/70"
                >
                  + {c.symbol}
                </button>
              ))}
          </div>
        </section>

        {book.message && (
          <div className="flex items-center justify-between rounded-lg border border-sky-400/20 bg-sky-400/8 px-3 py-2 text-sm text-sky-100">
            <span>{book.message}</span>
            <button type="button" onClick={book.clearMessage} className="text-sky-200/70 hover:text-white">
              <X className="size-4" />
            </button>
          </div>
        )}

        {error && !quote && (
          <Card className="border-rose-500/20 bg-rose-500/8">
            <CardHeader>
              <CardTitle>Could not load data</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        )}

        {loading && !run && (
          <div className="grid gap-4">
            <Card className="h-[220px] animate-pulse bg-white/4" />
            <Card className="h-[280px] animate-pulse bg-white/4" />
          </div>
        )}

        {quote && (
          <>
            <section className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Suggestions</h2>
                <p className="text-sm text-white/45">
                  Each stock with ensemble and per-model suggestion values — select a row for chart and trade.
                </p>
              </div>

              <StockSummaryTable
                quotes={run?.quotes ?? []}
                active={active}
                onSelect={setActive}
                onTrade={tradeSignal}
                onTradeAll={tradeAllSignals}
              />

              <div className="grid gap-4 lg:grid-cols-[1.35fr_0.9fr]">
                <Card className="bg-[#10161d]">
                  <CardHeader className="border-b border-white/6 pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-xl">
                          {quote.symbol}{" "}
                          <span className="text-base font-normal text-white/40">{quote.name}</span>
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {formatPrice(quote.last)} · {formatPct(quote.expectedReturn)} expected ·{" "}
                          {quote.liveReady ? "backtest pass" : "auto-trade blocked"}
                        </CardDescription>
                      </div>
                      <Badge className={cn("px-3 py-1", signalClass(quote.signal))} variant="outline">
                        {quote.signal}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-3">
                    <ForecastChart quote={quote} />
                  </CardContent>
                </Card>

                <div className="flex flex-col gap-4">
                  <Card className="bg-[#10161d]">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Trade</CardTitle>
                      <CardDescription>
                        {shares} sh · {formatMoney(shares * quote.last)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Slider
                        min={1}
                        max={Math.max(20, sharesForWeight(book.equity, quote.last, 0.35))}
                        value={[shares]}
                        onValueChange={(v) => {
                          const next = Array.isArray(v) ? Math.round(Number(v[0])) : Math.round(Number(v));
                          setShareOverride((prev) => ({ ...prev, [quote.symbol]: Math.max(1, next) }));
                        }}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                          onClick={() =>
                            execute("BUY", quote, shares, `Manual buy · target ${formatPrice(quote.targetPrice)}`)
                          }
                        >
                          <ArrowUpRight /> Buy
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() =>
                            execute("SELL", quote, shares, `Manual sell · target ${formatPrice(quote.targetPrice)}`)
                          }
                        >
                          <ArrowDownRight /> Sell
                        </Button>
                      </div>
                      <Button
                        variant="secondary"
                        className="w-full"
                        onClick={() => tradeSignal(quote)}
                        disabled={quote.signal === "HOLD" || !quote.liveReady}
                      >
                        Execute {quote.signal}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#10161d]">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <div>
                        <CardTitle className="text-base">Positions</CardTitle>
                        <CardDescription>Paper book</CardDescription>
                      </div>
                      <Button size="sm" variant="ghost" onClick={book.reset}>
                        <RotateCcw />
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {book.portfolio.positions.length === 0 ? (
                        <p className="text-sm text-white/45">No open lots.</p>
                      ) : (
                        <ul className="flex flex-col gap-2">
                          {book.portfolio.positions.map((p) => {
                            const last = marks[p.symbol] ?? p.avgPrice;
                            const upnl = (last / p.avgPrice - 1) * p.shares * p.avgPrice;
                            return (
                              <li
                                key={p.symbol}
                                className="flex items-center justify-between rounded-lg bg-white/3 px-3 py-2"
                              >
                                <div>
                                  <div className="text-sm font-medium">
                                    {p.symbol}{" "}
                                    <span className="text-white/40">{p.shares}</span>
                                  </div>
                                  <div className="text-[11px] text-white/40">
                                    {formatCompact(p.shares * last)}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={cn("font-mono text-sm", clsxSign(upnl))}>
                                    {formatMoney(upnl)}
                                  </span>
                                  <Button
                                    size="xs"
                                    variant="outline"
                                    onClick={() => {
                                      const q = run?.quotes.find((x) => x.symbol === p.symbol);
                                      if (!q) return;
                                      execute("SELL", q, p.shares, "Close position");
                                    }}
                                    disabled={!run?.quotes.find((x) => x.symbol === p.symbol)}
                                  >
                                    Close
                                  </Button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Models</h2>
                <p className="text-sm text-white/45">
                  Weight mix for {quote.symbol} · hit {(quote.metrics.hitRate * 100).toFixed(0)}% · Sharpe{" "}
                  {quote.backtest.sharpe.toFixed(2)}
                </p>
              </div>

              {run?.verification && <VerificationBanner verification={run.verification} />}

              <Card className="bg-[#10161d]">
                <CardContent className="pt-5">
                  <ModelWeightsPanel quote={quote} />
                </CardContent>
              </Card>
            </section>
          </>
        )}

        <p className="pb-4 text-center text-[11px] text-white/35">
          Educational paper trading only — not investment advice.
        </p>
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: number;
}) {
  return (
    <div>
      <div className="text-[10px] tracking-wide text-white/40 uppercase">{label}</div>
      <div className={cn("font-mono text-sm sm:text-base", tone != null && clsxSign(tone))}>
        {value}
        {hint ? <span className="ml-1 text-[11px] text-white/40">{hint}</span> : null}
      </div>
    </div>
  );
}
