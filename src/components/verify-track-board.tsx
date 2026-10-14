"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { clsxSign, formatPct, formatPrice } from "@/lib/format";
import { MODEL_LABELS } from "@/lib/models/registry";
import type { CompanyForecast, ModelId } from "@/lib/types";
import {
  getVerifyTrack,
  modelRollingConfidence,
  rollingConfidence,
  snapshotsForSymbol,
  type VerifyStore,
} from "@/lib/verify-track";
import { cn } from "@/lib/utils";

const ALL_MODELS = Object.keys(MODEL_LABELS) as ModelId[];

export function VerifyTrackBoard({
  symbol,
  quote,
  store,
  onChangeModels,
  onStop,
  onEvaluate,
  evaluating = false,
}: {
  symbol: string;
  quote?: CompanyForecast | null;
  store: VerifyStore;
  onChangeModels: (models: ModelId[]) => void;
  onStop: () => void;
  onEvaluate: () => void;
  evaluating?: boolean;
}) {
  const track = getVerifyTrack(symbol, store);
  const rows = useMemo(() => snapshotsForSymbol(symbol, store), [symbol, store]);
  const ensemble = useMemo(() => rollingConfidence(rows), [rows]);
  const modelRates = useMemo(
    () =>
      (track?.chosenModels ?? []).map((id) => ({
        id,
        ...modelRollingConfidence(rows, id),
      })),
    [rows, track?.chosenModels],
  );

  if (!track) return null;

  function toggleModel(id: ModelId) {
    const current = new Set(track!.chosenModels);
    if (current.has(id)) current.delete(id);
    else current.add(id);
    onChangeModels([...current]);
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Verify · {track.symbol}</h2>
          <p className="text-sm text-white/45">
            Daily AI call for {track.name}. Score next day vs later price · rolling confidence from
            scored days.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" onClick={onEvaluate} disabled={evaluating}>
            {evaluating ? "Scoring…" : "Score pending"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onStop}>
            Stop watch
          </Button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <Stat label="Scored days" value={`${ensemble.hits} / ${ensemble.n || "—"}`} />
        <Stat
          label="Rolling confidence"
          value={ensemble.n ? `${(ensemble.rate * 100).toFixed(0)}%` : "—"}
          tone={ensemble.n ? ensemble.rate - 0.5 : 0}
        />
        <Stat label="Latest signal" value={rows[0]?.signal ?? quote?.signal ?? "—"} />
        <Stat
          label="Latest confidence"
          value={
            rows[0]
              ? `${(rows[0].confidence * 100).toFixed(0)}%`
              : quote
                ? `${(quote.confidence * 100).toFixed(0)}%`
                : "—"
          }
        />
      </div>

      <Card className="bg-[#10161d]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Models to track</CardTitle>
          <CardDescription>
            Ensemble is always scored. Toggle models to keep on the board.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1.5">
          {ALL_MODELS.map((id) => {
            const on = track.chosenModels.includes(id);
            const rate = modelRates.find((m) => m.id === id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggleModel(id)}
                className={cn(
                  "rounded-md border px-2 py-1 text-[11px] transition",
                  on
                    ? "border-sky-400/35 bg-sky-400/12 text-sky-100"
                    : "border-white/10 text-white/45 hover:border-white/25",
                )}
              >
                {MODEL_LABELS[id]}
                {rate && rate.n > 0 ? ` · ${(rate.rate * 100).toFixed(0)}%` : ""}
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card className="bg-[#10161d]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Confidence board</CardTitle>
          <CardDescription>
            Call date → prediction → later price → hit/miss · {track.horizon}d horizon setting
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/45">
              No daily snapshot yet. Keep this stock on Holdings and Analyze — today&apos;s call is
              saved automatically.
            </p>
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm leading-none">
              <thead className="text-[11px] tracking-wide text-white/40 uppercase">
                <tr className="border-b border-white/8">
                  <th className="px-2 py-1.5 font-medium">Call date</th>
                  <th className="px-2 py-1.5 font-medium">Signal</th>
                  <th className="px-2 py-1.5 font-medium">Pred. return</th>
                  <th className="px-2 py-1.5 font-medium">Call price</th>
                  <th className="px-2 py-1.5 font-medium">Later price</th>
                  <th className="px-2 py-1.5 font-medium">Actual</th>
                  <th className="px-2 py-1.5 font-medium">Ensemble</th>
                  {track.chosenModels.map((id) => (
                    <th key={id} className="px-2 py-1.5 font-medium">
                      {MODEL_LABELS[id]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-white/6 last:border-0">
                    <td className="px-2 py-1.5 font-mono text-[12px] text-white/70">{row.date}</td>
                    <td className="px-2 py-1.5">
                      <span
                        className={cn(
                          "rounded-full border px-1.5 py-px text-[11px]",
                          row.signal === "BUY"
                            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                            : row.signal === "SELL"
                              ? "border-rose-500/25 bg-rose-500/10 text-rose-300"
                              : "border-white/10 bg-white/5 text-white/60",
                        )}
                      >
                        {row.signal}
                      </span>
                    </td>
                    <td className={cn("px-2 py-1.5 font-mono text-[12px]", clsxSign(row.expectedReturn))}>
                      {formatPct(row.expectedReturn)}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-[12px]">{formatPrice(row.last)}</td>
                    <td className="px-2 py-1.5 font-mono text-[12px]">
                      {row.evaluated ? formatPrice(row.evaluated.mark) : "—"}
                    </td>
                    <td
                      className={cn(
                        "px-2 py-1.5 font-mono text-[12px]",
                        row.evaluated ? clsxSign(row.evaluated.actualReturn) : "text-white/35",
                      )}
                    >
                      {row.evaluated ? formatPct(row.evaluated.actualReturn) : "pending"}
                    </td>
                    <td className="px-2 py-1.5 text-[12px]">
                      <HitMiss hit={row.evaluated?.ensembleHit} />
                    </td>
                    {track.chosenModels.map((id) => (
                      <td key={id} className="px-2 py-1.5 text-[12px]">
                        <HitMiss hit={row.evaluated?.modelHits[id]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function HitMiss({ hit }: { hit?: boolean }) {
  if (hit == null) return <span className="text-white/35">—</span>;
  return (
    <span className={hit ? "text-emerald-300" : "text-rose-300"}>{hit ? "Hit" : "Miss"}</span>
  );
}

function Stat({
  label,
  value,
  tone = 0,
}: {
  label: string;
  value: string;
  tone?: number;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/3 px-3 py-2">
      <div className="text-[11px] text-white/40">{label}</div>
      <div
        className={cn(
          "mt-0.5 text-sm font-medium",
          tone > 0.02 ? "text-emerald-300" : tone < -0.02 ? "text-rose-300" : "text-white/85",
        )}
      >
        {value}
      </div>
    </div>
  );
}
