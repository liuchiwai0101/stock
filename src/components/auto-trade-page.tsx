"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bot, LoaderCircle, Radar, RefreshCw } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePortfolio } from "@/hooks/use-portfolio";
import { planAutoTrades } from "@/lib/auto-trade";
import {
  DEFAULT_AUTO_TRADE_SETTINGS,
  loadAutoTradeSettings,
  saveAutoTradeSettings,
  type AutoTradeSettings,
} from "@/lib/auto-trade-settings";
import { formatMoney, formatPct } from "@/lib/format";
import { runFullUsScan } from "@/lib/run-us-scan";
import { fetchPublishedUsScan, loadBestPreviewScan, type SavedScan } from "@/lib/scan-cache";
import { isScanFreshToday, scanFreshnessLabel } from "@/lib/scan-freshness";
import { STATIC_DESK } from "@/lib/static-mode";
import type { Horizon } from "@/lib/types";
import { cn } from "@/lib/utils";

type ActivityItem = {
  at: string;
  kind: "info" | "ok" | "skip" | "error";
  text: string;
};

export function AutoTradePage() {
  const [settings, setSettings] = useState<AutoTradeSettings>(DEFAULT_AUTO_TRADE_SETTINGS);
  const [ready, setReady] = useState(false);
  const [scan, setScan] = useState<SavedScan | null>(null);
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [horizon, setHorizon] = useState<Horizon>(21);

  const marks = useMemo(() => {
    const m: Record<string, number> = {};
    for (const q of scan?.quotes ?? []) m[q.symbol] = q.last;
    return m;
  }, [scan]);
  const book = usePortfolio(marks);

  const freshness = scanFreshnessLabel(scan?.generatedAt);
  const freshToday = isScanFreshToday(scan?.generatedAt);

  useEffect(() => {
    queueMicrotask(() => {
      const saved = loadAutoTradeSettings();
      setSettings(saved);
      void loadBestPreviewScan().then((cached) => {
        if (cached) {
          setScan(cached);
          setHorizon(cached.horizon);
        }
        setReady(true);
      });
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveAutoTradeSettings(settings);
  }, [ready, settings]);

  const pushActivity = useCallback((item: Omit<ActivityItem, "at">) => {
    setActivity((prev) => [{ at: new Date().toISOString(), ...item }, ...prev].slice(0, 40));
  }, []);

  const refreshScan = useCallback(async (opts?: { manageBusy?: boolean }) => {
    const manageBusy = opts?.manageBusy ?? true;
    if (manageBusy) setBusy(true);
    pushActivity({ kind: "info", text: "Refreshing US scan before trading…" });
    try {
      if (STATIC_DESK) {
        const published = await fetchPublishedUsScan({ cacheBust: true });
        if (!published) throw new Error("Published US scan unavailable.");
        setScan(published);
        setHorizon(published.horizon);
        pushActivity({
          kind: "ok",
          text: `Scan loaded · ${published.scanMeta.buyCount} BUY · ${new Date(published.generatedAt).toLocaleString()}`,
        });
        return published;
      }
      const { scan: record, quotes } = await runFullUsScan(horizon);
      const next: SavedScan = {
        horizon: record.horizon,
        generatedAt: record.capturedAt,
        scanMeta: record.scanMeta,
        quotes,
      };
      setScan(next);
      pushActivity({
        kind: "ok",
        text: `Scan complete · ${record.scanMeta.buyCount} BUY · ${record.date}`,
      });
      return next;
    } catch (err) {
      pushActivity({
        kind: "error",
        text: err instanceof Error ? err.message : "Scan refresh failed",
      });
      return null;
    } finally {
      if (manageBusy) setBusy(false);
    }
  }, [horizon, pushActivity]);

  const runRound = useCallback(
    async (manualRefresh: boolean) => {
      setBusy(true);
      try {
        let nextScan = scan;
        const needsRefresh = manualRefresh || !isScanFreshToday(nextScan?.generatedAt);
        if (needsRefresh) {
          nextScan = await refreshScan({ manageBusy: false });
        }
        if (!nextScan) {
          pushActivity({ kind: "skip", text: "No fresh scan — round skipped (never trades on old data)." });
          return;
        }
        if (!isScanFreshToday(nextScan.generatedAt)) {
          pushActivity({
            kind: "skip",
            text: "Scan still not from today after refresh — round skipped.",
          });
          return;
        }

        const plan = planAutoTrades({
          quotes: nextScan.quotes,
          scanGeneratedAt: nextScan.generatedAt,
          portfolio: book.portfolio,
          settings: { ...settings, enabled: true },
        });

        if (!plan.ok) {
          pushActivity({ kind: "skip", text: plan.detail });
          return;
        }

        const orders = [...plan.sells, ...plan.buys];
        book.tradeMany(orders);
        pushActivity({
          kind: "ok",
          text: `Round filled · ${plan.buys.length} buy · ${plan.sells.length} sell · scan ${new Date(plan.scanGeneratedAt).toLocaleString()}`,
        });
        for (const skip of plan.skippedBuys.slice(0, 5)) {
          pushActivity({ kind: "skip", text: `Skipped ${skip.symbol}: ${skip.reason}` });
        }
      } finally {
        setBusy(false);
      }
    },
    [book, pushActivity, refreshScan, scan, settings],
  );

  return (
    <div className="flex min-h-full flex-col">
      <AppNav subtitle="Paper auto trade · fresh daily scan required each round" />
      <main className="mx-auto flex w-full max-w-[1360px] flex-1 flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Auto Trade</h1>
            <p className="text-sm text-white/45">
              Paper buy/sell from US scan suggestions. Every round refreshes the scan when it is not from today,
              or when you trigger manually — never uses yesterday&apos;s data.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" onClick={() => void refreshScan()} disabled={busy}>
              {busy ? <LoaderCircle className="animate-spin" /> : <Radar />}
              Refresh scan
            </Button>
            <Button size="sm" onClick={() => void runRound(true)} disabled={busy}>
              {busy ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
              Run round
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <Stat
            label="Scan used"
            value={
              freshness === "fresh" ? "Fresh today" : freshness === "stale" ? "Stale" : "Missing"
            }
            tone={freshness === "fresh" ? 1 : -1}
          />
          <Stat
            label="Captured"
            value={scan ? new Date(scan.generatedAt).toLocaleString() : "—"}
          />
          <Stat label="BUY names" value={scan ? String(scan.scanMeta.buyCount) : "—"} />
          <Stat label="Cash" value={formatMoney(book.portfolio.cash)} />
        </div>

        {!freshToday ? (
          <div className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
            Scan is not from today. Run round will refresh the US scan first.{" "}
            <Link href="/scan" className="text-sky-300 hover:underline">
              Open US Scan
            </Link>
          </div>
        ) : null}

        <Card className="bg-[#10161d]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="size-4 text-sky-300" />
              Rules
            </CardTitle>
            <CardDescription>Paper-only for v1. Source is the latest fresh US scan.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/3 px-3 py-2 text-sm">
              <span>Auto trade enabled</span>
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings((s) => ({ ...s, enabled: e.target.checked }))}
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/3 px-3 py-2 text-sm">
              <span>Sell on SELL signal</span>
              <input
                type="checkbox"
                checked={settings.sellOnSellSignal}
                onChange={(e) => setSettings((s) => ({ ...s, sellOnSellSignal: e.target.checked }))}
              />
            </label>
            <Field
              label="Min hit rate"
              value={settings.minHitRate}
              onChange={(n) => setSettings((s) => ({ ...s, minHitRate: n }))}
              step={0.01}
            />
            <Field
              label="Min expected return"
              value={settings.minExpectedReturn}
              onChange={(n) => setSettings((s) => ({ ...s, minExpectedReturn: n }))}
              step={0.01}
            />
            <Field
              label="Max positions"
              value={settings.maxPositions}
              onChange={(n) => setSettings((s) => ({ ...s, maxPositions: Math.floor(n) }))}
              step={1}
            />
            <Field
              label="Max weight / name"
              value={settings.maxWeight}
              onChange={(n) => setSettings((s) => ({ ...s, maxWeight: n }))}
              step={0.01}
            />
            <Field
              label="Cash reserve"
              value={settings.cashReserve}
              onChange={(n) => setSettings((s) => ({ ...s, cashReserve: n }))}
              step={100}
            />
            <div className="rounded-lg border border-white/10 bg-white/3 px-3 py-2 text-sm text-white/55">
              Buy when ensemble BUY, live-ready, hit ≥ {formatPct(settings.minHitRate)}, expected ≥{" "}
              {formatPct(settings.minExpectedReturn)}.
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="bg-[#10161d]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Open positions</CardTitle>
              <CardDescription>{book.portfolio.positions.length} names</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {book.portfolio.positions.length === 0 ? (
                <p className="py-6 text-center text-sm text-white/45">No open paper positions.</p>
              ) : (
                book.portfolio.positions.map((p) => (
                  <div
                    key={p.symbol}
                    className="flex items-center justify-between border-b border-white/6 py-2 text-sm last:border-0"
                  >
                    <div>
                      <div className="font-medium">{p.symbol}</div>
                      <div className="text-[11px] text-white/40">{p.shares} sh · avg {formatMoney(p.avgPrice)}</div>
                    </div>
                    <div className="font-mono text-white/70">
                      {formatMoney((marks[p.symbol] ?? p.avgPrice) * p.shares)}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#10161d]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Activity</CardTitle>
              <CardDescription>Scan refresh and paper fills</CardDescription>
            </CardHeader>
            <CardContent className="max-h-80 space-y-2 overflow-y-auto">
              {activity.length === 0 ? (
                <p className="py-6 text-center text-sm text-white/45">
                  Run a round to refresh the scan and place paper orders.
                </p>
              ) : (
                activity.map((item) => (
                  <div
                    key={`${item.at}-${item.text}`}
                    className={cn(
                      "rounded-md border px-2.5 py-2 text-xs",
                      item.kind === "ok" && "border-emerald-500/20 bg-emerald-500/8 text-emerald-100",
                      item.kind === "skip" && "border-amber-500/20 bg-amber-500/8 text-amber-100",
                      item.kind === "error" && "border-rose-500/20 bg-rose-500/8 text-rose-100",
                      item.kind === "info" && "border-white/10 bg-white/3 text-white/70",
                    )}
                  >
                    <div className="text-[10px] text-white/40">{new Date(item.at).toLocaleString()}</div>
                    <div>{item.text}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="bg-[#10161d]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent fills</CardTitle>
            <CardDescription>
              Same paper book as Holdings.{" "}
              <button type="button" className="text-sky-300 hover:underline" onClick={book.reset}>
                Reset cash
              </button>
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-[10px] tracking-wide text-white/40 uppercase">
                <tr className="border-b border-white/8">
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">Side</th>
                  <th className="py-2 pr-3 font-medium">Symbol</th>
                  <th className="py-2 pr-3 font-medium">Shares</th>
                  <th className="py-2 font-medium">Price</th>
                </tr>
              </thead>
              <tbody>
                {[...book.portfolio.fills].reverse().slice(0, 20).map((f) => (
                  <tr key={f.id} className="border-b border-white/6 last:border-0">
                    <td className="py-2 pr-3 text-xs text-white/50">{new Date(f.at).toLocaleString()}</td>
                    <td className="py-2 pr-3 font-medium">{f.side}</td>
                    <td className="py-2 pr-3">{f.symbol}</td>
                    <td className="py-2 pr-3 font-mono">{f.shares}</td>
                    <td className="py-2 font-mono">{formatMoney(f.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {book.portfolio.fills.length === 0 ? (
              <p className="py-6 text-center text-sm text-white/45">No fills yet.</p>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/3 px-3 py-2">
      <div className="text-[10px] tracking-wide text-white/40 uppercase">{label}</div>
      <div
        className={cn(
          "font-mono text-sm sm:text-base",
          tone == null ? "text-white/90" : tone > 0 ? "text-emerald-300" : "text-amber-200",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step: number;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-white/55">{label}</span>
      <Input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9 bg-white/3"
      />
    </label>
  );
}
