"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LoaderCircle, Radar, Search, Sparkles, X } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { displayStockName } from "@/lib/chinese-names";
import { ensureChineseNames, mergeChineseNames } from "@/lib/chinese-names-store";
import { appendPredictionsFromPicks } from "@/lib/prediction-log";
import { selectTopPicks } from "@/lib/pick-score";
import { clearPartialScan, fetchPublishedUsScan, loadBestPreviewScan, savePartialScan, saveSavedScan } from "@/lib/scan-cache";
import { getAccountSnapshot, pushGuestScan, pushUserData } from "@/lib/account-store";
import { CAPTURE_TIMEZONE } from "@/lib/market-hours";
import { appendDailyScan, loadScanHistory, todayCaptureKey } from "@/lib/scan-history";
import { compareLatestScans } from "@/lib/suggestion-compare";
import { useChineseNameCache } from "@/hooks/use-chinese-name-cache";
import { StockSummaryTable } from "@/components/stock-summary-table";
import { SuggestionComparePanel } from "@/components/suggestion-compare-panel";
import { ScanReviewPanel } from "@/components/scan-review-panel";
import { ModelGuidePanel, ModelWeightsPanel } from "@/components/analysis-panels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePortfolio } from "@/hooks/use-portfolio";
import { formatPct } from "@/lib/format";
import { applyScanBatchBuys } from "@/lib/desk";
import { fetchRun, fetchScanBatch, fetchScanCount, fetchSearch } from "@/lib/desk-fetch";
import { STATIC_DESK } from "@/lib/static-mode";
import { applyLiveQuote } from "@/lib/live-quote";
import { usePriceMarks } from "@/hooks/use-price-marks";
import { defaultSelection, ensureVinWatchlistSeeded, loadSelection, saveSelection } from "@/lib/selection";
import { sharesForWeight } from "@/lib/trading";
import type { CompanyForecast, Horizon, RunResponse } from "@/lib/types";
import { canonicalizeTicker, mergeTickerSearchHits, tickerFromAddField } from "@/lib/ticker";
import { isLikelyTicker, resolveTradableSymbol, resolveWatchlistSymbols } from "@/lib/ticker-search";
import { MAX_WATCHLIST_SYMBOLS } from "@/lib/vin-watchlist";
import { UNIVERSE, companyName } from "@/lib/universe";
import { cn } from "@/lib/utils";

/** Deploy nudge after PR #19 so GitHub Pages rebuilds Scan full US. */
const HORIZONS: { value: Horizon; label: string }[] = [
  { value: 5, label: "1 week" },
  { value: 10, label: "2 weeks" },
  { value: 21, label: "1 month" },
  { value: 63, label: "1 quarter" },
];

type SearchHit = { symbol: string; name: string; type: string };

export type DeskPage = "holdings" | "scan";

export function Dashboard({ page = "holdings" }: { page?: DeskPage }) {
  const defaults = defaultSelection();
  const [symbols, setSymbols] = useState<string[]>(defaults.symbols);
  const [active, setActive] = useState<string>(defaults.active);
  const [horizon, setHorizon] = useState<Horizon>(defaults.horizon);
  const [selectionReady, setSelectionReady] = useState(false);
  const [run, setRun] = useState<RunResponse | null>(null);
  const [runLoading, setRunLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"watch" | "buyList">(page === "scan" ? "buyList" : "watch");
  const [scanMeta, setScanMeta] = useState<{
    scanned: number;
    total: number;
    passed: number;
    buyCount: number;
  } | null>(null);
  const searchRef = useRef<HTMLFormElement>(null);
  const tickerInputRef = useRef<HTMLInputElement>(null);
  const requestSeq = useRef(0);
  const busy = runLoading || scanLoading;

  const priceSymbols = useMemo(() => {
    const set = new Set<string>(symbols);
    for (const q of run?.quotes ?? []) set.add(q.symbol);
    return [...set].slice(0, 80);
  }, [symbols, run]);
  const livePrices = usePriceMarks(priceSymbols, priceSymbols.length > 0, 60_000);

  const marks = useMemo(() => {
    const m: Record<string, number> = {};
    for (const q of run?.quotes ?? []) m[q.symbol] = q.last;
    for (const [symbol, last] of Object.entries(livePrices.marks)) m[symbol] = last;
    return m;
  }, [run, livePrices.marks]);

  const liveQuotes = useMemo(() => {
    if (!run) return [];
    return run.quotes.map((q) => {
      const mark = livePrices.quoteMap.get(q.symbol);
      return mark ? applyLiveQuote(q, mark) : q;
    });
  }, [run, livePrices.quoteMap]);

  const book = usePortfolio(marks);

  const heldShares = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of book.portfolio.positions) m[p.symbol] = p.shares;
    return m;
  }, [book.portfolio.positions]);
  const [scanHistory, setScanHistory] = useState(() => loadScanHistory());
  const suggestionCompare = useMemo(() => compareLatestScans(scanHistory), [scanHistory]);
  const chineseNames = useChineseNameCache();
  const quote = liveQuotes.find((q) => q.symbol === active) ?? liveQuotes[0] ?? null;
  const menuHits = useMemo(() => {
    if (!query.trim()) return [];
    if (isLikelyTicker(query)) return mergeTickerSearchHits(query, hits, (s) => companyName(s));
    return hits.slice(0, 12);
  }, [query, hits]);

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
      setRunLoading(false);
      setError("Add a company to run the forecast.");
      return;
    }
    const seq = ++requestSeq.current;
    setScanLoading(false);
    setRunLoading(true);
    setError(null);
    setScanNotice(null);
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
      if (seq === requestSeq.current) setRunLoading(false);
    }
  }, []);

  const scanBuyList = useCallback(async (nextHorizon: Horizon) => {
    const seq = ++requestSeq.current;
    setRunLoading(false);
    setScanLoading(true);
    setError(null);
    setScanNotice("Scanning all U.S. listed stocks again…");
    setViewMode("buyList");
    setScanMeta(null);
    try {
      const published = STATIC_DESK ? await fetchPublishedUsScan({ cacheBust: true }) : null;
      const total = await fetchScanCount(true);
      if (seq !== requestSeq.current) return;

      const batchSize = STATIC_DESK ? 80 : 120;
      let offset = 0;
      let processed = 0;
      let passed = 0;
      let errorCount = 0;
      const seededPassed = published?.scanMeta.passed ?? 0;
      const buyMap = new Map<string, CompanyForecast>();
      let latestVerification: RunResponse["verification"] | null = null;

      if (published) {
        for (const quote of published.quotes) buyMap.set(quote.symbol, quote);
        const seeded = [...buyMap.values()].sort((a, b) => {
          const hit = b.metrics.hitRate - a.metrics.hitRate;
          if (Math.abs(hit) > 1e-9) return hit;
          return b.confidence - a.confidence;
        });
        setRun({
          horizon: nextHorizon,
          generatedAt: published.generatedAt,
          verification: null,
          quotes: seeded,
          errors: [],
        });
        setScanMeta({
          scanned: 0,
          total: published.scanMeta.total || total,
          passed: seededPassed,
          buyCount: seeded.length,
        });
        setActive((prev) =>
          seeded.some((q) => q.symbol === prev) ? prev : (seeded[0]?.symbol ?? prev),
        );
      }

      while (true) {
        const json = await fetchScanBatch(nextHorizon, offset, batchSize, true);
        if (seq !== requestSeq.current) return;

        processed = json.processed ?? processed + (json.scanned ?? 0);
        passed += json.passed ?? 0;
        const skipped = STATIC_DESK
          ? (json.errors ?? []).filter((e) => /No snapshot for /i.test(e.message)).length
          : 0;
        errorCount += (json.errors?.length ?? 0) - skipped;
        latestVerification = json.verification;
        applyScanBatchBuys(buyMap, json.quotes, json.reviewed);

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
          passed: STATIC_DESK ? Math.max(seededPassed, passed) : passed,
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
            passed: STATIC_DESK ? Math.max(seededPassed, passed) : passed,
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
          appendDailyScan({
            date: todayCaptureKey(),
            horizon: nextHorizon,
            capturedAt: json.generatedAt,
            timezone: CAPTURE_TIMEZONE,
            scanMeta: finalMeta,
            topPicks: selectTopPicks(buys, 10),
          });
          setScanHistory(loadScanHistory());
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
            setScanNotice(null);
            setError(
              `Scan finished with ${errorCount} data issues across ${json.total ?? total} tickers. Showing ${buys.length} BUY names that passed.`,
            );
          } else {
            setError(null);
            setScanNotice(
              `Scan complete · ${finalMeta.scanned.toLocaleString()} scanned · ${finalMeta.buyCount} BUY`,
            );
          }
          break;
        }
        offset += batchSize;
        if (STATIC_DESK) await new Promise((r) => setTimeout(r, 16));
      }
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setScanNotice(null);
      setError(err instanceof Error ? err.message : "US buy scan failed.");
      setScanMeta(null);
    } finally {
      if (seq === requestSeq.current) setScanLoading(false);
    }
  }, []);

  useEffect(() => {
    ensureVinWatchlistSeeded();
    const saved = loadSelection();
    const preferredMode: "watch" | "buyList" = page === "scan" ? "buyList" : "watch";
    void loadBestPreviewScan().then(async (cachedScan) => {
      const resolved = await resolveWatchlistSymbols(saved.symbols);
      setSymbols(resolved);
      setActive(resolved.includes(saved.active) ? saved.active : (resolved[0] ?? saved.active));
      setHorizon(saved.horizon);
      setViewMode(preferredMode);
      if (preferredMode === "buyList" && cachedScan) {
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
  }, [page]);

  useEffect(() => {
    if (!selectionReady) return;
    saveSelection({ symbols, active, horizon, viewMode });
    if (getAccountSnapshot()) void pushUserData();
  }, [symbols, active, horizon, viewMode, selectionReady]);

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
      try {
        const results = await fetchSearch(q);
        setHits(results);
        setSearchOpen(true);
      } catch {
        setHits([]);
        setSearchOpen(true);
      }
    }, 220);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onDoc(e: Event) {
      if (!searchRef.current?.contains(e.target as Node)) setSearchOpen(false);
    }
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, []);

  function addSymbol(symbol: string) {
    void resolveTradableSymbol(symbol).then((resolved) => {
      const next = resolved?.symbol || (isLikelyTicker(symbol) ? canonicalizeTicker(symbol) : "");
      if (!next) return;
      if (resolved?.name && resolved.name !== next) mergeChineseNames({ [next]: resolved.name });
      commitSymbol(next);
    });
  }

  function commitSymbol(next: string) {
    if (!next) return;
    setViewMode("watch");
    setSymbols((prev) => {
      if (prev.includes(next)) return prev;
      if (prev.length >= MAX_WATCHLIST_SYMBOLS) return [...prev.slice(1), next];
      return [...prev, next];
    });
    setActive(next);
    setQuery("");
    setHits([]);
    setSearchOpen(false);
    if (tickerInputRef.current) tickerInputRef.current.value = "";
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
          page === "scan"
            ? run
              ? `US scan · ${scanMeta?.buyCount ?? run.quotes.length} BUY · saved daily for review`
              : "US scan · rank model results · save each day"
            : run
              ? `Holdings · ${readyCount}/${run.quotes.length} trade-ready · model list for decisions`
              : "Holdings · your stocks + model analysis"
        }
      />

      <main className="mx-auto flex w-full max-w-[1360px] flex-1 flex-col gap-3 px-3 py-3 sm:gap-6 sm:px-6 sm:py-6">
        {/* Sticky only from sm up — on phones the tall chrome was locking the viewport. */}
        <section className="space-y-2 border-b border-white/6 bg-[#0b1016] pb-3 sm:sticky sm:top-14 sm:z-20 sm:-mx-6 sm:space-y-3 sm:bg-[#0b1016]/95 sm:px-6 sm:py-3 sm:backdrop-blur-xl">
          <div className="hidden flex-wrap items-center justify-between gap-2 sm:flex">
            <p className="text-xs text-white/40">
              {page === "scan"
                ? "Scan results refresh and save each day so you can check whether model calls matched price moves."
                : "Your watchlist and open positions with all-model analysis attached for decisions."}{" "}
              Paper fills live on{" "}
              <Link href="/auto" className="text-sky-300 hover:underline">
                Auto Trade
              </Link>
              .
            </p>
            <Link href="/auto" className="text-xs text-sky-300/90 hover:underline">
              {book.portfolio.fills.length} trade record
              {book.portfolio.fills.length === 1 ? "" : "s"} →
            </Link>
          </div>
          {/* Deploy nudge after PR #23 so Pages rebuilds the iPhone Safari ticker-add fix. */}
          <div className="flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-center">
            {page === "holdings" ? (
            <form
              ref={searchRef}
              className="relative flex min-w-0 flex-1 gap-1.5"
              autoComplete="off"
              action="#"
              onSubmit={(e) => {
                e.preventDefault();
                const native =
                  tickerInputRef.current?.value ??
                  String(new FormData(e.currentTarget).get("sd-watchlist-ticker") ?? "");
                const next = tickerFromAddField(native || query);
                if (isLikelyTicker(next)) {
                  addSymbol(next);
                  return;
                }
                const exact = menuHits.find(
                  (hit) => hit.name.replace(/\s+/g, "") === (native || query).replace(/\s+/g, "") || hit.symbol === next,
                );
                if (exact) {
                  addSymbol(exact.symbol);
                  return;
                }
                tickerInputRef.current?.focus();
              }}
            >
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-white/35" />
                <Input
                  ref={tickerInputRef}
                  type="text"
                  name="sd-watchlist-ticker"
                  inputMode="text"
                  enterKeyHint="go"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  lang="en"
                  data-1p-ignore="true"
                  data-lpignore="true"
                  data-form-type="other"
                  defaultValue=""
                  onChange={(e) => {
                    setQuery(e.currentTarget.value);
                    setSearchOpen(true);
                  }}
                  onCompositionEnd={(e) => {
                    setQuery(e.currentTarget.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="搜索港股 / A股 / 美股"
                  aria-label="搜索并添加港股、A股或美股"
                  className="h-10 bg-white/3 pl-8"
                />
                {searchOpen && menuHits.length > 0 ? (
                  <div className="absolute z-40 mt-1 max-h-[40vh] w-full overflow-y-auto rounded-lg border border-white/10 bg-[#121820] shadow-2xl">
                    {menuHits.map((hit) => (
                      <button
                        key={hit.symbol}
                        type="button"
                        onClick={() => addSymbol(hit.symbol)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-white/6"
                      >
                        <span className="min-w-0">
                          <span className="font-medium">{hit.symbol}</span>
                          <span className="block truncate text-xs text-white/50">
                            {displayStockName(hit.symbol, hit.name, chineseNames)}
                          </span>
                        </span>
                        <span className="shrink-0 text-[11px] text-white/35">{hit.type === "EQUITY" ? "美股" : hit.type}</span>
                        <span className="shrink-0 text-[11px] text-sky-300">Add</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <Button type="submit" size="sm" className="h-10 shrink-0 px-3">
                Add
              </Button>
            </form>
            ) : (
              <div className="min-w-0 flex-1">
                <h1 className="text-base font-semibold tracking-tight sm:text-lg">US Scan</h1>
                <p className="text-xs text-white/45 sm:text-sm">
                  Rank by model results · refresh daily or manually · review prediction accuracy
                </p>
              </div>
            )}
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
              {page === "holdings" ? (
                <Button size="sm" variant="secondary" onClick={() => void load(symbols, horizon)} disabled={runLoading}>
                  {runLoading ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
                  Analyze
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void scanBuyList(horizon)}
                  disabled={scanLoading}
                >
                  {scanLoading ? <LoaderCircle className="animate-spin" /> : <Radar />}
                  Scan full US
                </Button>
              )}
            </div>
          </div>
          {page === "holdings" ? (
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
          ) : null}
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

        {scanNotice && viewMode === "buyList" ? (
          <div className="rounded-lg border border-sky-400/20 bg-sky-400/8 px-3 py-2 text-sm text-sky-100">
            {scanNotice}
          </div>
        ) : null}

        {busy && (
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/3 px-3 py-2 text-sm text-white/65">
            <LoaderCircle className="size-4 animate-spin text-sky-300" />
            {viewMode === "buyList"
              ? scanMeta
                ? `Scanning ${scanMeta.scanned.toLocaleString()} / ${scanMeta.total.toLocaleString()} U.S. stocks for 1-year Pass + BUY…`
                : "Scanning all U.S. listed stocks again…"
              : "Loading forecasts…"}
          </div>
        )}

        {busy && !run && (
          <div className="grid gap-4">
            <Card className="h-[220px] animate-pulse bg-white/4" />
            <Card className="h-[280px] animate-pulse bg-white/4" />
          </div>
        )}

        {run ? (
          <>
            <section className="space-y-2 sm:space-y-3">
              <div className="space-y-2">
                <h2 className="hidden text-lg font-semibold tracking-tight sm:block">
                  {page === "scan" ? "US scan results" : "Holdings analysis"}
                </h2>
                <p className="hidden text-sm text-white/45 sm:block">
                  {page === "scan"
                    ? `Saved U.S. listed scan · ${run.horizon}d horizon · sort by model columns · last prices from Yahoo`
                    : "Your stocks with per-model suggestions — last prices refresh from Yahoo."}
                  {livePrices.updatedAt
                    ? ` · refreshed ${new Date(livePrices.updatedAt).toLocaleString()}`
                    : livePrices.loading
                      ? " · fetching latest closes…"
                      : ""}
                </p>
                {viewMode === "buyList" && scanMeta ? (
                  <div className="flex gap-1.5 sm:flex-wrap sm:gap-2 sm:pt-1">
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

              {viewMode === "buyList" && suggestionCompare ? (
                <Card className="bg-[#10161d]">
                  <CardContent className="pt-5">
                    <SuggestionComparePanel compare={suggestionCompare} compact />
                  </CardContent>
                </Card>
              ) : null}

              <StockSummaryTable
                quotes={liveQuotes}
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

            {page === "scan" ? <ScanReviewPanel /> : null}

            {quote && page !== "scan" ? (
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
        ) : viewMode === "buyList" && !busy ? (
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

        {page === "scan" && !run ? <ScanReviewPanel /> : null}

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
        "min-w-0 flex-1 rounded-md border px-2 py-1 sm:rounded-lg sm:px-3 sm:py-2",
        highlight
          ? "border-emerald-500/25 bg-emerald-500/10"
          : "border-white/10 bg-white/3",
      )}
    >
      <div className="text-[9px] tracking-wide text-white/45 uppercase sm:text-[10px]">{label}</div>
      <div
        className={cn(
          "font-mono text-sm font-semibold sm:text-lg",
          highlight ? "text-emerald-300" : "text-white/90",
        )}
      >
        {value.toLocaleString()}
        {detail ? <span className="ml-1 text-xs font-normal text-white/45">{detail}</span> : null}
      </div>
    </div>
  );
}
