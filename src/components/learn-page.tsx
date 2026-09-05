"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { FlaskConical, RefreshCw } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MODEL_IDS } from "@/lib/adaptive-policy";
import { liveHitRate } from "@/lib/evaluate-predictions";
import { clsxSign, formatMoney, formatPct } from "@/lib/format";
import { runLearnCycle, type LearnReport } from "@/lib/learn-cycle";
import { loadPredictionLog, modelHitRates } from "@/lib/prediction-log";
import { getServerSnapshotPolicy, loadPolicy, subscribePolicy } from "@/lib/policy-store";
import { MODEL_LABELS } from "@/lib/models/registry";
import { cn } from "@/lib/utils";

export function LearnPage() {
  const policy = useSyncExternalStore(subscribePolicy, loadPolicy, getServerSnapshotPolicy);
  const [log, setLog] = useState(() => loadPredictionLog());
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<LearnReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshLog = useCallback(() => {
    setLog(loadPredictionLog());
  }, []);

  async function evaluateNow() {
    setBusy(true);
    setError(null);
    try {
      const next = await runLearnCycle();
      setReport(next);
      refreshLog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evaluation failed");
    } finally {
      setBusy(false);
    }
  }

  const hit = useMemo(() => liveHitRate(log), [log]);
  const modelRates = useMemo(() => modelHitRates(log), [log]);
  const scored = log.filter((r) => r.evaluated);

  return (
    <div className="flex min-h-full flex-col">
      <AppNav subtitle="Self-evaluation · live model weights adapt from daily results" />
      <main className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Learn</h1>
            <p className="text-sm text-white/45">
              Verify yesterday&apos;s suggestions and trades, then retune ensemble boosts before the next scan
            </p>
          </div>
          <Button size="sm" onClick={() => void evaluateNow()} disabled={busy}>
            {busy ? <RefreshCw className="animate-spin" /> : <FlaskConical />}
            Evaluate now
          </Button>
        </div>

        {error ? (
          <div className="rounded-lg border border-rose-400/20 bg-rose-400/8 px-3 py-2 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {report ? (
          <div className="rounded-lg border border-sky-400/20 bg-sky-400/8 px-3 py-2 text-sm text-sky-100">
            Scored {report.evaluated} new prediction{report.evaluated === 1 ? "" : "s"} · live hit{" "}
            {(report.liveHitRate * 100).toFixed(0)}% · trade win {(report.tradingWinRate * 100).toFixed(0)}%
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Scored calls" value={String(hit.n)} />
          <Stat label="Live hit rate" value={`${(hit.rate * 100).toFixed(0)}%`} tone={hit.rate - 0.5} />
          <Stat label="BUY hurdle" value={`${policy.buyHurdleScale.toFixed(2)}×`} />
          <Stat label="Size scale" value={`${policy.sizeScale.toFixed(2)}×`} />
        </div>

        <Card className="bg-[#10161d]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">How the loop works</CardTitle>
            <CardDescription>Predictions change only after live verification — not from backtest alone</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-white/70 sm:grid-cols-3">
            <div>
              <div className="mb-1 font-medium text-white">1. Capture</div>
              Daily top-10 suggestions and paper trades are logged with each model&apos;s lean.
            </div>
            <div>
              <div className="mb-1 font-medium text-white">2. Verify</div>
              Next session, actual prices score direction hits per model and P&amp;L on fills.
            </div>
            <div>
              <div className="mb-1 font-medium text-white">3. Adapt</div>
              Models that were right get more ensemble weight. Weak live hit raises the BUY hurdle and cuts size.
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#10161d]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Live model boosts</CardTitle>
            <CardDescription>
              Walk-forward RMSE still sets the base mix · these multipliers come from daily verification
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-[10px] tracking-wide text-white/40 uppercase">
                <tr className="border-b border-white/8">
                  <th className="py-2 pr-3 font-medium">Model</th>
                  <th className="py-2 pr-3 font-medium">Live hits</th>
                  <th className="py-2 pr-3 font-medium">Boost</th>
                  <th className="py-2 font-medium">Effect</th>
                </tr>
              </thead>
              <tbody>
                {MODEL_IDS.map((id) => {
                  const row = modelRates[id];
                  const boost = policy.modelBoosts[id] ?? 1;
                  return (
                    <tr key={id} className="border-b border-white/6 last:border-0">
                      <td className="py-2.5 pr-3">
                        <div className="font-medium">{id}</div>
                        <div className="text-[11px] text-white/40">{MODEL_LABELS[id]}</div>
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-white/70">
                        {row && row.n > 0 ? `${row.hits}/${row.n}` : "—"}
                      </td>
                      <td className={cn("py-2.5 pr-3 font-mono", boost >= 1 ? "text-emerald-300" : "text-amber-300")}>
                        {boost.toFixed(2)}×
                      </td>
                      <td className="py-2.5 text-[12px] text-white/45">
                        {boost > 1.05 ? "Upweighted" : boost < 0.95 ? "Downweighted" : "Neutral"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="bg-[#10161d]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent verified suggestions</CardTitle>
            <CardDescription>Direction vs next-session price · used to retune tomorrow&apos;s mix</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {scored.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/45">
                No scored calls yet. Run a scan, wait until the next session, then click Evaluate now.
              </p>
            ) : (
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-[10px] tracking-wide text-white/40 uppercase">
                  <tr className="border-b border-white/8">
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Symbol</th>
                    <th className="py-2 pr-3 font-medium">Signal</th>
                    <th className="py-2 pr-3 font-medium">Pred</th>
                    <th className="py-2 pr-3 font-medium">Actual</th>
                    <th className="py-2 font-medium">Hit</th>
                  </tr>
                </thead>
                <tbody>
                  {scored.slice(0, 30).map((row) => (
                    <tr key={row.id} className="border-b border-white/6 last:border-0">
                      <td className="py-2.5 pr-3 text-white/55">{row.date}</td>
                      <td className="py-2.5 pr-3 font-medium">{row.symbol}</td>
                      <td className="py-2.5 pr-3">{row.signal}</td>
                      <td className={cn("py-2.5 pr-3 font-mono", clsxSign(row.expectedReturn))}>
                        {formatPct(row.expectedReturn)}
                      </td>
                      <td className={cn("py-2.5 pr-3 font-mono", clsxSign(row.evaluated?.actualReturn ?? 0))}>
                        {formatPct(row.evaluated?.actualReturn ?? 0)}
                      </td>
                      <td
                        className={cn(
                          "py-2.5 font-medium",
                          row.evaluated?.directionHit ? "text-emerald-300" : "text-rose-300",
                        )}
                      >
                        {row.evaluated?.directionHit ? "Hit" : "Miss"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-white/35">
          Historical 1-year backtest stays the gate for liveReady. Adaptive boosts only reshape the ensemble and
          trade size after out-of-sample daily results. Trading P&amp;L last marked: {formatMoney(policy.tradingPnL)}.
        </p>
      </main>
    </div>
  );
}

function Stat({ label, value, tone = 0 }: { label: string; value: string; tone?: number }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/2 px-3 py-2.5">
      <div className="text-[10px] tracking-wide text-white/40 uppercase">{label}</div>
      <div className={cn("mt-1 font-mono text-sm", tone !== 0 ? clsxSign(tone) : "text-white")}>{value}</div>
    </div>
  );
}
