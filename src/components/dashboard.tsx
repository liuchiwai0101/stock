"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LoaderCircle, Radar, Search, Sparkles, X } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { displayStockName } from "@/lib/chinese-names";
import { ensureChineseNames } from "@/lib/chinese-names-store";
import { appendPredictionsFromPicks } from "@/lib/prediction-log";
import { selectTopPicks } from "@/lib/pick-score";
import { clearPartialScan, loadBestPreviewScan, savePartialScan, saveSavedScan } from "@/lib/scan-cache";
import { getAccountSnapshot, pushGuestScan, pushUserData } from "@/lib/account-store";
import { useChineseNameCache } from "@/hooks/use-chinese-name-cache";
import { StockSummaryTable } from "@/components/stock-summary-table";
import { ModelGuidePanel, ModelWeightsPanel } from "@/components/analysis-panels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePortfolio } from "@/hooks/use-portfolio";
import { formatPct } from "@/lib/format";
import { fetchRun, fetchScanBatch, fetchScanCount, fetchSearch } from "@/lib/desk-fetch";
import { defaultSelection, ensureVinWatchlistSeeded, loadSelection, saveSelection } from "@/lib/selection";
import { sharesForWeight } from "@/lib/trading";
import type { CompanyForecast, Horizon, RunResponse } from "@/lib/types";
import { UNIVERSE } from "@/lib/universe";
import { cn } from "@/lib/utils";

const HORIZONS: { value: Horizon; label: string }[] = [
  { value: 5, label: "1 week" },
  { value: 10, label: "2 weeks" },
  { value: 21, label: "1 month" },
  { value: 63, label: "1 quarter" },
];

type SearchHit = { symbol: string; name: string; type: string };

export function Dashboard() {
  const defaults = defaultSelection();
  const [symbols, setSymbols] = useState<string[]>(defaults.symbols);
  const [active, setActive] = useState<string>(defaults.active);
  const [horizon, setHorizon] = useState<Horizon>(defaults.horizon);
  const [selectionReady, setSelectionReady] = useState(false);
  const [run, setRun] = useState<RunResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"watch" | "buyList">("buyList");
  const [scanMeta, setScanMeta] = useState<{
    scanned: number;
    total: number;
    passed: number;
    buyCount: number;
  } | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const requestSeq = useRef(0);

  const marks = useMemo(() => {
    const m: Record<string, number> = {};
    for (const q of run?.quotes ?? []) m[q.symbol] = q.last;
    return m;
  }, [run]);

  const book = usePortfolio(marks);

  const heldShares = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of book.portfolio.positions) m[p.symbol] = p.shares;
    return m;
  }, [book.portfolio.positions]);
  const chineseNames = useChineseNameCache();
  const quote = run?.quotes.find((q) => q.symbol === active) ?? run?.quotes[0] ?? null;
  const visibleHits = query.trim() ? hits : [];

  useEffect(() => {
    const tickers = [
      ...(run?.quotes.map((q) => q.symbol) ?? []),
      ...hits.map((h) => h.symbol),
      ...symbols,
    ];
    void ensureChineseNames(tickers);
  }, [run?.quotes, hits, symbols]);

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
    setViewMode("watch");
    setScanMeta(null);
    try {
      const json = await fetchRun(nextSymbols, nextHorizon);
      if (seq !== requestSeq.current) return;
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

  const scanBuyList = useCallback(async (nextHorizon: Horizon) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    setViewMode("buyList");
    setScanMeta(null);
    try {
      const total = await fetchScanCount();
      if (seq !== requestSeq.current) return;

      const batchSize = 120;
      let offset = 0;
      let processed = 0;
      let passed = 0;
      let errorCount = 0;
      const buyMap = new Map<string, CompanyForecast>();
      let latestVerification: RunResponse["verification"] | null = null;

      while (true) {
        const json = await fetchScanBatch(nextHorizon, offset, batchSize);
        if (seq !== requestSeq.current) return;

        processed = json.processed ?? processed + (json.scanned ?? 0);
        passed += json.passed ?? 0;
        errorCount += json.errors?.length ?? 0;
        latestVerification = json.verification;

        for (const quote of json.quotes) {
          buyMap.set(quote.symbol, quote);
        }

        const buys = [...buyMap.values()].sort((a, b) => {
          const hit = b.metrics.hitRate - a.metrics.hitRate;
          if (Math.abs(hit) > 1e-9) return hit;
          return b.confidence - a.confidence;
        });

        setRun({
          horizon: nextHorizon,
          generatedAt: json.generatedAt,
          verification: latestVerification ?? json.verification,
          quotes: buys,
          errors: [],
        });
        const progressMeta = {
          scanned: processed,
          total: json.total ?? total,
          passed,
          buyCount: buys.length,
        };
        setScanMeta(progressMeta);
        savePartialScan({
          horizon: nextHorizon,
          generatedAt: json.generatedAt,
          scanMeta: progressMeta,
          quotes: buys,
        });
        setActive((prev) =>
          buys.some((q) => q.symbol === prev) ? prev : (buys[0]?.symbol ?? ""),
        );

        if (json.done) {
          const finalRun: RunResponse = {
            horizon: nextHorizon,
            generatedAt: json.generatedAt,
            verification: latestVerification ?? json.verification,
            quotes: buys,
            errors: [],
          };
          const finalMeta = {
            scanned: processed,
            total: json.total ?? total,
            passed,
            buyCount: buys.length,
          };
          saveSavedScan({
            horizon: nextHorizon,
            generatedAt: json.generatedAt,
            scanMeta: finalMeta,
            quotes: buys,
          });
          appendPredictionsFromPicks(
            json.generatedAt.slice(0, 10),
            selectTopPicks(buys, 10),
            nextHorizon,
          );
          clearPartialScan();
          setRun(finalRun);
          setScanMeta(finalMeta);
          if (getAccountSnapshot()) void pushUserData();
          else {
            void pushGuestScan({
              horizon: nextHorizon,
              generatedAt: json.generatedAt,
              scanMeta: finalMeta,
              quotes: buys.slice(0, 80).map((q) => ({
                symbol: q.symbol,
                name: q.name,
                last: q.last,
                targetPrice: q.targetPrice,
                expectedReturn: q.expectedReturn,
                signal: q.signal,
                confidence: q.confidence,
                liveReady: q.liveReady,
                hitRate: q.metrics.hitRate,
                sharpe: q.backtest.sharpe,
              })),
            });
          }
          if (errorCount > 0) {
            setError(
              `Scan finished with ${errorCount} data issues across ${json.total ?? total} tickers. Showing ${buys.length} BUY names that passed.`,
            );
          }
          break;
        }
        offset += batchSize;
      }
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(err instanceof Error ? err.message : "US buy scan failed.");
      setScanMeta(null);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    ensureVinWatchlistSeeded();
    const saved = loadSelection();
    void loadBestPreviewScan().then((cachedScan) => {
      setSymbols(saved.symbols);
      setActive(saved.active);
      setHorizon(saved.horizon);
      if (cachedScan) {
        setViewMode("buyList");
        setRun({
          horizon: cachedScan.horizon,
          generatedAt: cachedScan.generatedAt,
          verification: null,
          quotes: cachedScan.quotes,
          errors: [],
        });
        setScanMeta(cachedScan.scanMeta);
        setActive((prev) =>
          cachedScan.quotes.some((q) => q.symbol === prev)
            ? prev
            : (cachedScan.quotes[0]?.symbol ?? saved.active),
        );
      }
      setSelectionReady(true);
    });
  }, []);

  useEffect(() => {
    if (!selectionReady) return;
    saveSelection({ symbols, active, horizon });
    if (getAccountSnapshot()) void pushUserData();
  }, [symbols, active, horizon, selectionReady]);

  useEffect(() => {
    if (!selectionReady) return;
    if (viewMode === "buyList") return;
    const timer = window.setTimeout(() => {
      void load(symbols, horizon);
    }, 0);
    // Only cancel the scheduled timer — do not bump requestSeq here.
    // Bumping on viewMode→buyList cleanup was discarding in-flight scan results.
    return () => {
      window.clearTimeout(timer);
    };
  }, [symbols, horizon, load, selectionReady, viewMode]);

  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const t = window.setTimeout(async () => {
      const results = await fetchSearch(q);
      setHits(results);
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
      if (prev.length >= 20) return [...prev.slice(1), next];
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

  function buyStock(q: CompanyForecast, shares: number) {
    if (!q.liveReady) {
      book.notify(`${q.symbol}: 1-year backtest failed — buy blocked until verification passes.`);
      return;
    }
    const qty = Math.floor(shares);
    if (qty <= 0) {
      book.notify("Enter at least 1 share to buy.");
      return;
    }
    book.trade({
      symbol: q.symbol,
      name: q.name,
      side: "BUY",
      shares: qty,
      price: q.last,
      note: `Paper buy · ${qty} sh · ${formatPct(q.expectedReturn)} over ${horizon}d`,
    });
  }

  function sellStock(q: CompanyForecast, shares: number) {
    const held = heldShares[q.symbol] ?? 0;
    if (held <= 0) {
      book.notify(`No ${q.symbol} shares to sell.`);
      return;
    }
    const qty = Math.min(held, Math.floor(shares));
    if (qty <= 0) {
      book.notify("Enter at least 1 share to sell.");
      return;
    }
    book.trade({
      symbol: q.symbol,
      name: q.name,
      side: "SELL",
      shares: qty,
      price: q.last,
      note: `Paper sell · ${qty} sh`,
    });
  }

  function tradeAllSignals() {
    const orders = (run?.quotes ?? [])
      .filter((q) => q.liveReady && q.signal === "BUY")
      .map((q) => {
        const shares = Math.max(1, sharesForWeight(book.equity, q.last, q.recommendedWeight));
        return {
          symbol: q.symbol,
          name: q.name,
          side: "BUY" as const,
          shares,
          price: q.last,
          note: `Model BUY · ${formatPct(q.expectedReturn)} over ${horizon}d`,
        };
      });
    if (orders.length === 0) {
      book.notify("No verified BUY signals to trade.");
      return;
    }
    book.tradeMany(orders);
  }

  const readyCount = run?.quotes.filter((q) => q.liveReady).length ?? 0;

  return (
    <div className="flex min-h-full flex-col">
      <AppNav
        subtitle={
          run
            ? `Paper forecasts · ${readyCount}/${run.quotes.length} trade-ready · selection saved`
            : "Paper forecasts · selection saved in this browser"
        }
      />

      <main className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-4 px-4 py-4 sm:gap-6 sm:px-6 sm:py-6">
        {/* Sticky only from sm up — on phones the tall chrome was locking the viewport. */}
        <section className="space-y-2 border-b border-white/6 bg-[#0b1016] pb-3 sm:sticky sm:top-14 sm:z-20 sm:-mx-6 sm:space-y-3 sm:bg-[#0b1016]/95 sm:px-6 sm:py-3 sm:backdrop-blur-xl">
          <div className="hidden flex-wrap items-center justify-between gap-2 sm:flex">
            <p className="text-xs text-white/40">
              Tickers stay saved to your account or this browser. Full trade list lives on{" "}
              <Link href="/trades" className="text-sky-300 hover:underline">
                Trade records
              </Link>
              .
            </p>
            <Link href="/trades" className="text-xs text-sky-300/90 hover:underline">
              {book.portfolio.fills.length} trade record
              {book.portfolio.fills.length === 1 ? "" : "s"} →
            </Link>
          </div>
          <div className="flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-center">
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
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-white/6"
                    >
                      <span className="min-w-0">
                        <span className="font-medium">{hit.symbol}</span>
                        <span className="block truncate text-xs text-white/50">
                          {displayStockName(hit.symbol, hit.name, chineseNames)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="inline-flex shrink-0 rounded-lg border border-white/10 bg-white/3 p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    // Cancel in-flight scan/load so the chrome stays usable and view switches immediately.
                    requestSeq.current += 1;
                    setLoading(false);
                    setError(null);
                    setViewMode("watch");
                  }}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-xs transition",
                    viewMode === "watch"
                      ? "bg-sky-400/15 text-sky-100"
                      : "text-white/55 hover:bg-white/5 hover:text-white/85",
                  )}
                >
                  Watchlist
                </button>
                <button
                  type="button"
                  onClick={() => {
                    requestSeq.current += 1;
                    setLoading(false);
                    setError(null);
                    setViewMode("buyList");
                    void loadBestPreviewScan().then((cached) => {
                      if (cached) {
                        setRun({
                          horizon: cached.horizon,
                          generatedAt: cached.generatedAt,
                          verification: null,
                          quotes: cached.quotes,
                          errors: [],
                        });
                        setScanMeta(cached.scanMeta);
                        setActive((prev) =>
                          cached.quotes.some((q) => q.symbol === prev)
                            ? prev
                            : (cached.quotes[0]?.symbol ?? prev),
                        );
                      } else {
                        setRun(null);
                        setScanMeta(null);
                      }
                    });
                  }}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-xs transition",
                    viewMode === "buyList"
                      ? "bg-sky-400/15 text-sky-100"
                      : "text-white/55 hover:bg-white/5 hover:text-white/85",
                  )}
                >
                  US buys
                </button>
              </div>
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
                {loading && viewMode === "watch" ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
                Run
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void scanBuyList(horizon)}
                disabled={loading}
              >
                {loading && viewMode === "buyList" ? <LoaderCircle className="animate-spin" /> : <Radar />}
                Scan full US
              </Button>
            </div>
          </div>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [-webkit-overflow-scrolling:touch] sm:flex-wrap sm:overflow-visible">
            {symbols.map((symbol) => (
              <button
                key={symbol}
                type="button"
                onClick={() => setActive(symbol)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition",
                  active === symbol
                    ? "border-sky-400/40 bg-sky-400/15 text-sky-100"
                    : "border-white/10 bg-white/3 text-white/70 hover:bg-white/6",
                )}
              >
                {symbol}
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Remove ${symbol}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSymbol(symbol);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      removeSymbol(symbol);
                    }
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
                  className="shrink-0 rounded-full border border-dashed border-white/12 px-2.5 py-1 text-xs text-white/40 hover:border-white/25 hover:text-white/70"
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

        {error && !run && (
          <Card className="border-rose-500/20 bg-rose-500/8">
            <CardHeader>
              <CardTitle>Could not load data</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        )}

        {loading && (
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/3 px-3 py-2 text-sm text-white/65">
            <LoaderCircle className="size-4 animate-spin text-sky-300" />
            {viewMode === "buyList"
              ? scanMeta
                ? `Scanning ${scanMeta.scanned.toLocaleString()} / ${scanMeta.total.toLocaleString()} U.S. stocks for 1-year Pass + BUY…`
                : "Loading full U.S. stock universe…"
              : "Loading forecasts…"}
          </div>
        )}

        {loading && !run && (
          <div className="grid gap-4">
            <Card className="h-[220px] animate-pulse bg-white/4" />
            <Card className="h-[280px] animate-pulse bg-white/4" />
          </div>
        )}

        {run ? (
          <>
            <section className="space-y-3">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold tracking-tight">
                  {viewMode === "buyList" ? "Suggested buys" : "Suggestions"}
                </h2>
                <p className="text-sm text-white/45">
                  {viewMode === "buyList"
                    ? `Saved U.S. listed scan · ${run.horizon}d horizon · click Scan full US to refresh`
                    : "Stocks with per-model suggestions — rows start collapsed; tap to expand a chart."}
                </p>
                {viewMode === "buyList" && scanMeta ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <ScanStat
                      label="Scanned"
                      value={scanMeta.scanned}
                      detail={scanMeta.total ? `of ${scanMeta.total.toLocaleString()}` : undefined}
                    />
                    <ScanStat label="Passed 1y BT" value={scanMeta.passed} />
                    <ScanStat label="BUY" value={scanMeta.buyCount} highlight />
                  </div>
                ) : null}
              </div>

              {error && viewMode === "buyList" ? (
                <p className="text-xs text-amber-200/80">{error}</p>
              ) : null}

              <StockSummaryTable
                quotes={run.quotes}
                active={active}
                onSelect={setActive}
                onBuy={buyStock}
                onSell={sellStock}
                onTradeAll={tradeAllSignals}
                onAddSymbol={addSymbol}
                onRemoveSymbol={removeSymbol}
                watchlistSymbols={symbols}
                heldShares={heldShares}
                suggestedShares={(q) =>
                  Math.max(1, sharesForWeight(book.equity, q.last, q.recommendedWeight))
                }
                mode={viewMode}
                scanMeta={scanMeta}
                horizon={run.horizon}
              />
            </section>

            {quote ? (
              <section className="space-y-3">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">Models</h2>
                  <p className="text-sm text-white/45">
                    Weight mix for {quote.symbol} · hit {(quote.metrics.hitRate * 100).toFixed(0)}% · Sharpe{" "}
                    {quote.backtest.sharpe.toFixed(2)}
                  </p>
                </div>

                <ModelGuidePanel quote={quote} />

                <Card className="bg-[#10161d]">
                  <CardContent className="pt-5">
                    <ModelWeightsPanel quote={quote} />
                  </CardContent>
                </Card>
              </section>
            ) : null}
          </>
        ) : viewMode === "buyList" && !loading ? (
          <Card className="border-white/10 bg-[#10161d]">
            <CardHeader>
              <CardTitle className="text-base">Suggested buys</CardTitle>
              <CardDescription>
                No saved scan yet. Click <strong className="text-white/70">Scan full US</strong> to scan
                all U.S. listed common stocks. Results are saved until you scan again.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <p className="pb-4 text-center text-[11px] text-white/35">
          Educational paper trading only — not investment advice.
        </p>
      </main>
    </div>
  );
}

function ScanStat({
  label,
  value,
  detail,
  highlight = false,
}: {
  label: string;
  value: number;
  detail?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2",
        highlight
          ? "border-emerald-500/25 bg-emerald-500/10"
          : "border-white/10 bg-white/3",
      )}
    >
      <div className="text-[10px] tracking-wide text-white/45 uppercase">{label}</div>
      <div
        className={cn(
          "font-mono text-lg font-semibold",
          highlight ? "text-emerald-300" : "text-white/90",
        )}
      >
        {value.toLocaleString()}
        {detail ? <span className="ml-1 text-xs font-normal text-white/45">{detail}</span> : null}
      </div>
    </div>
  );
}
