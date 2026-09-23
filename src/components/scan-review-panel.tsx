"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FlaskConical, RefreshCw } from "lucide-react";
import { SuggestionComparePanel } from "@/components/suggestion-compare-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { horizonHitRate, liveHitRate } from "@/lib/evaluate-predictions";
import { clsxSign } from "@/lib/format";
import { runLearnCycle, type LearnReport } from "@/lib/learn-cycle";
import { MODEL_REGISTRY } from "@/lib/models/registry";
import { loadPredictionLog, modelHitRates } from "@/lib/prediction-log";
import { loadScanHistory } from "@/lib/scan-history";
import { compareLatestScans } from "@/lib/suggestion-compare";
import { cn } from "@/lib/utils";

export function ScanReviewPanel() {
  const [log, setLog] = useState(() => loadPredictionLog());
  const [history, setHistory] = useState(() => loadScanHistory());
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<LearnReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLog(loadPredictionLog());
    setHistory(loadScanHistory());
  }, []);

  const evaluateNow = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await runLearnCycle();
      setReport(next);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evaluation failed");
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  useEffect(() => {
    queueMicrotask(() => refresh());
  }, [refresh]);

  const hit = useMemo(() => liveHitRate(log), [log]);
  const horizon = useMemo(() => horizonHitRate(log), [log]);
  const modelRates = useMemo(() => modelHitRates(log), [log]);
  const compare = useMemo(() => compareLatestScans(history), [history]);
  const latest = history[0];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Daily review</h2>
          <p className="text-sm text-white/45">
            Check whether prior BUY suggestions matched later prices. Latest saved day:{" "}
            {latest?.date ?? "none yet"}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void evaluateNow()} disabled={busy}>
          {busy ? <RefreshCw className="animate-spin" /> : <FlaskConical />}
          Evaluate predictions
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-400/20 bg-rose-400/8 px-3 py-2 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {report ? (
        <div className="rounded-lg border border-sky-400/20 bg-sky-400/8 px-3 py-2 text-sm text-sky-100">
          Scored {report.evaluated} call{report.evaluated === 1 ? "" : "s"}
          {report.horizonEvaluated ? ` · ${report.horizonEvaluated} horizon` : ""}
          {" · live hit "}
          {(report.liveHitRate * 100).toFixed(0)}%
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <ReviewStat label="Scored calls" value={`${hit.hits} / ${hit.n}`} />
        <ReviewStat label="Live hit" value={`${(hit.rate * 100).toFixed(0)}%`} tone={hit.rate - 0.5} />
        <ReviewStat label="Horizon hit" value={horizon.n ? `${(horizon.rate * 100).toFixed(0)}%` : "—"} />
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
              Run Scan full US on two different days to compare new, kept, and dropped BUY names.
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
    </section>
  );
}

function ReviewStat({
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
      <div className={cn("font-mono text-base", tone == null ? "text-white/90" : clsxSign(tone))}>{value}</div>
    </div>
  );
}
