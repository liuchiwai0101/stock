"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FlaskConical, RefreshCw, ShieldCheck } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { SuggestionComparePanel } from "@/components/suggestion-compare-panel";
import { VerificationBanner } from "@/components/verification-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { horizonHitRate, liveHitRate } from "@/lib/evaluate-predictions";
import { clsxSign, formatPct } from "@/lib/format";
import { MODEL_REGISTRY } from "@/lib/models/registry";
import { loadPredictionLog, modelHitRates, type LoggedPrediction } from "@/lib/prediction-log";
import { loadScanHistory, type DailyScanRecord } from "@/lib/scan-history";
import { compareLatestScans } from "@/lib/suggestion-compare";
import { getVerificationSummary } from "@/lib/verification-cache";
import { runVerifyCycle, type VerifyReport } from "@/lib/verify-cycle";
import { cn } from "@/lib/utils";

export function VerifyPage() {
  const [log, setLog] = useState<LoggedPrediction[]>([]);
  const [history, setHistory] = useState<DailyScanRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<VerifyReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verification, setVerification] = useState(() => getVerificationSummary());

  const refresh = useCallback(() => {
    setLog(loadPredictionLog());
    setHistory(loadScanHistory());
  }, []);

  const evaluateNow = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setVerification(getVerificationSummary(true));
      const next = await runVerifyCycle();
      setReport(next);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evaluation failed");
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  useEffect(() => {
    queueMicrotask(() => {
      refresh();
      void evaluateNow();
    });
  }, [evaluateNow, refresh]);

  const hit = useMemo(() => liveHitRate(log), [log]);
  const horizon = useMemo(() => horizonHitRate(log), [log]);
  const modelRates = useMemo(() => modelHitRates(log), [log]);
  const scored = log.filter((r) => r.evaluated);
  const latest = history[0];
  const compare = compareLatestScans(history);

  return (
    <div className="flex min-h-full flex-col">
      <AppNav subtitle="Continuous verification · previous suggestion compare" />
      <main className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Verify</h1>
            <p className="text-sm text-white/45">
              Re-check the model suite, score prior BUY suggestions against newer quotes, and compare
              the last two scans
            </p>
          </div>
          <Button size="sm" onClick={() => void evaluateNow()} disabled={busy}>
            {busy ? <RefreshCw className="animate-spin" /> : <FlaskConical />}
            Evaluate now
          </Button>
        </div>

        <VerificationBanner verification={verification} />

        {error ? (
          <div className="rounded-lg border border-rose-400/20 bg-rose-400/8 px-3 py-2 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {report ? (
          <div className="rounded-lg border border-sky-400/20 bg-sky-400/8 px-3 py-2 text-sm text-sky-100">
            Scored {report.evaluated} next-session call{report.evaluated === 1 ? "" : "s"}
            {report.horizonEvaluated ? ` · ${report.horizonEvaluated} horizon` : ""}
            {report.waitingForNewerQuotes
              ? ` · ${report.waitingForNewerQuotes} waiting for a newer quote snapshot`
              : ""}
            {" · live hit "}
            {(report.liveHitRate * 100).toFixed(0)}%
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="U.S. scanned" value={latest ? latest.scanMeta.scanned.toLocaleString() : "—"} />
          <Stat
            label="Universe"
            value={latest ? latest.scanMeta.total.toLocaleString() : "—"}
          />
          <Stat label="Passed 1y BT" value={latest ? latest.scanMeta.passed.toLocaleString() : "—"} />
          <Stat label="BUY" value={latest ? latest.scanMeta.buyCount.toLocaleString() : "—"} />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Scored calls" value={`${hit.hits} / ${hit.n}`} />
          <Stat label="Live hit" value={`${(hit.rate * 100).toFixed(0)}%`} tone={hit.rate - 0.5} />
          <Stat
            label="Horizon hit"
            value={horizon.n ? `${(horizon.rate * 100).toFixed(0)}%` : "—"}
          />
        </div>

        {compare ? (
          <Card className="bg-[#10161d]">
            <CardContent className="pt-5">
              <SuggestionComparePanel compare={compare} />
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-[#10161d]">
            <CardHeader>
              <CardTitle className="text-base">Previous suggestion compare</CardTitle>
              <CardDescription>
                Run Scan US buys at least twice (or after a newer quote snapshot) to compare the last
                two suggestion lists.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <Card className="bg-[#10161d]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Live model hits</CardTitle>
            <CardDescription>Direction hits per model from scored previous suggestions</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="text-[10px] tracking-wide text-white/40 uppercase">
                <tr className="border-b border-white/8">
                  <th className="py-2 pr-3 font-medium">Model</th>
                  <th className="py-2 pr-3 font-medium">Live hits</th>
                  <th className="py-2 font-medium">Rate</th>
                </tr>
              </thead>
              <tbody>
                {MODEL_REGISTRY.map((model) => {
                  const row = modelRates[model.id];
                  const rate = row && row.n > 0 ? row.hits / row.n : null;
                  return (
                    <tr key={model.id} className="border-b border-white/6 last:border-0">
                      <td className="py-2.5 pr-3">
                        <div className="font-medium">{model.id}</div>
                        <div className="text-[11px] text-white/40">{model.label}</div>
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-white/70">
                        {row && row.n > 0 ? `${row.hits}/${row.n}` : "—"}
                      </td>
                      <td className={cn("py-2.5 font-mono", rate == null ? "text-white/40" : clsxSign(rate - 0.5))}>
                        {rate == null ? "—" : `${(rate * 100).toFixed(0)}%`}
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
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4 text-emerald-300" />
              Recent verified suggestions
            </CardTitle>
            <CardDescription>Direction vs later snapshot price · used to compare prior BUY calls</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {scored.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/45">
                No scored calls yet. Scan US buys, then Evaluate now after quotes move forward.
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
                    <th className="py-2 pr-3 font-medium">Hit</th>
                    <th className="py-2 font-medium">Horizon</th>
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
                          "py-2.5 pr-3 font-medium",
                          row.evaluated?.directionHit ? "text-emerald-300" : "text-rose-300",
                        )}
                      >
                        {row.evaluated?.directionHit ? "Hit" : "Miss"}
                      </td>
                      <td className="py-2.5 text-white/55">
                        {row.horizonEvaluated
                          ? row.horizonEvaluated.directionHit
                            ? "Hit"
                            : "Miss"
                          : `${row.horizon}d`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: number;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/3 px-3 py-2">
      <div className="text-[10px] tracking-wide text-white/40 uppercase">{label}</div>
      <div className={cn("font-mono text-base", tone != null && clsxSign(tone))}>{value}</div>
    </div>
  );
}
