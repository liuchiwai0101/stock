"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { clsxSign, formatPct, formatPrice } from "@/lib/format";
import { MODEL_LABELS } from "@/lib/forecast";
import type { BacktestResult, CompanyForecast, ModelBreakdown, ModelId } from "@/lib/types";
import { cn } from "@/lib/utils";

const MODEL_IDS: ModelId[] = [
  "holt", "ols", "ar1", "momentum", "garch", "kalman", "arima", "ou", "ewma", "regime",
];

const MODEL_COLORS: Record<ModelId, string> = {
  holt: "bg-sky-400",
  ols: "bg-indigo-400",
  ar1: "bg-amber-400",
  momentum: "bg-emerald-400",
  garch: "bg-rose-400",
  kalman: "bg-violet-400",
  arima: "bg-cyan-400",
  ou: "bg-orange-400",
  ewma: "bg-lime-400",
  regime: "bg-fuchsia-400",
};

const GATE_LABELS: Record<keyof BacktestResult["checks"], string> = {
  hitRate: "Direction hit",
  sharpe: "Sharpe",
  drawdown: "Max drawdown",
  trades: "Min round-trips",
  direction: "Direction accuracy",
};

function Metric({ label, value, tone }: { label: string; value: string; tone?: number }) {
  return (
    <div className="rounded-lg bg-white/3 px-2.5 py-2">
      <div className="text-[10px] tracking-wide text-white/40 uppercase">{label}</div>
      <div className={cn("font-mono text-sm", tone != null && clsxSign(tone))}>{value}</div>
    </div>
  );
}

export function BacktestPanel({ backtest }: { backtest: BacktestResult }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/2 p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[11px] tracking-wide text-white/40 uppercase">1-year walk-forward backtest</div>
        <Badge
          variant="outline"
          className={
            backtest.passed ? "border-emerald-500/30 text-emerald-300" : "border-amber-500/30 text-amber-300"
          }
        >
          {backtest.passed ? "Passed" : "Failed"}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        <Metric label="Strategy" value={formatPct(backtest.totalReturn)} tone={backtest.totalReturn} />
        <Metric label="Benchmark" value={formatPct(backtest.benchmarkReturn)} tone={backtest.benchmarkReturn} />
        <Metric label="Sharpe" value={backtest.sharpe.toFixed(2)} tone={backtest.sharpe} />
        <Metric label="Max DD" value={formatPct(-backtest.maxDrawdown)} />
        <Metric label="Win rate" value={`${(backtest.winRate * 100).toFixed(0)}%`} />
        <Metric label="Round-trips" value={String(backtest.trades)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(Object.entries(backtest.checks) as [keyof BacktestResult["checks"], boolean][]).map(([key, ok]) => (
          <span
            key={key}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px]",
              ok ? "border-emerald-500/25 text-emerald-300/90" : "border-rose-500/25 text-rose-300/90"
            )}
          >
            {ok ? "✓" : "✗"} {GATE_LABELS[key]}
          </span>
        ))}
      </div>
      {backtest.tradeLog.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-[10px] tracking-wide text-white/40 uppercase">Recent backtest fills</div>
          <ul className="max-h-28 space-y-1 overflow-auto text-[11px] text-white/55">
            {backtest.tradeLog.slice(-6).map((t, i) => (
              <li key={`${t.date}-${t.signal}-${i}`} className="flex justify-between gap-2 font-mono">
                <span>
                  <span className={t.signal === "BUY" ? "text-emerald-400" : "text-rose-400"}>{t.signal}</span>{" "}
                  {t.date}
                </span>
                <span className={clsxSign(t.actualReturn)}>{formatPct(t.actualReturn)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-2 text-[11px] leading-relaxed text-white/45">{backtest.summary}</p>
    </div>
  );
}

export function ModelWeightsPanel({ quote }: { quote: CompanyForecast }) {
  const models = quote.models?.length
    ? quote.models
    : MODEL_IDS.map((id) => ({
        id,
        label: MODEL_LABELS[id],
        weight: quote.weights[id],
      }));
  const top = [...models].sort((a, b) => b.weight - a.weight).slice(0, 3);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <div className="text-[11px] tracking-wide text-white/40 uppercase">10-model ensemble</div>
        <div className="text-[10px] text-white/40">
          Top: {top.map((t) => `${t.id.toUpperCase()} ${(t.weight * 100).toFixed(0)}%`).join(" · ")}
        </div>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full">
        {MODEL_IDS.map((id) => (
          <div
            key={id}
            className={MODEL_COLORS[id]}
            style={{ width: `${quote.weights[id] * 100}%` }}
            title={`${MODEL_LABELS[id]} ${(quote.weights[id] * 100).toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-white/50 sm:grid-cols-5">
        {MODEL_IDS.map((id) => (
          <span key={id} title={MODEL_LABELS[id]}>
            <span className={cn("mr-1 inline-block size-1.5 rounded-full", MODEL_COLORS[id])} />
            {id.toUpperCase()} {(quote.weights[id] * 100).toFixed(0)}%
          </span>
        ))}
      </div>
    </div>
  );
}

export function ModelResultsTable({
  models,
  last,
  ensembleTarget,
}: {
  models: ModelBreakdown[];
  last: number;
  ensembleTarget: number;
}) {
  if (!models?.length) return null;
  const ensembleReturn = ensembleTarget / last - 1;

  return (
    <Card className="bg-[#10161d]">
      <CardHeader>
        <CardTitle className="text-base">Per-model forecast results</CardTitle>
        <CardDescription>
          Walk-forward RMSE sets the ensemble weight. Target is each model&apos;s {models.length}-model path end
          vs last {formatPrice(last)}. Ensemble target {formatPrice(ensembleTarget)} ({formatPct(ensembleReturn)}).
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="text-[11px] tracking-wide text-white/40 uppercase">
            <tr className="border-b border-white/8">
              <th className="py-2 pr-3 font-medium">#</th>
              <th className="py-2 pr-3 font-medium">Model</th>
              <th className="py-2 pr-3 font-medium">Category</th>
              <th className="py-2 pr-3 font-medium">Weight</th>
              <th className="py-2 pr-3 font-medium">Target</th>
              <th className="py-2 pr-3 font-medium">Exp.</th>
              <th className="py-2 pr-3 font-medium">RMSE</th>
              <th className="py-2 pr-3 font-medium">MAPE</th>
              <th className="py-2 font-medium">Hit</th>
            </tr>
          </thead>
          <tbody>
            {models.map((m, i) => (
              <tr key={m.id} className="border-b border-white/6 last:border-0 align-top">
                <td className="py-2.5 pr-3 text-white/40">{i + 1}</td>
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-2">
                    <span className={cn("size-2 shrink-0 rounded-full", MODEL_COLORS[m.id])} />
                    <div>
                      <div className="font-medium">{m.label}</div>
                      <div className="text-[10px] font-mono text-white/35">{m.id}</div>
                    </div>
                  </div>
                </td>
                <td className="py-2.5 pr-3 text-xs text-white/55">{m.category}</td>
                <td className="py-2.5 pr-3">
                  <div className="font-mono">{(m.weight * 100).toFixed(1)}%</div>
                  <div className="mt-1 h-1 w-16 overflow-hidden rounded-full bg-white/10">
                    <div className={cn("h-full", MODEL_COLORS[m.id])} style={{ width: `${m.weight * 100}%` }} />
                  </div>
                </td>
                <td className="py-2.5 pr-3 font-mono">{formatPrice(m.targetPrice)}</td>
                <td className={cn("py-2.5 pr-3 font-mono", clsxSign(m.expectedReturn))}>
                  {formatPct(m.expectedReturn)}
                </td>
                <td className="py-2.5 pr-3 font-mono text-white/65">{m.rmse.toFixed(2)}</td>
                <td className="py-2.5 pr-3 font-mono text-white/65">{(m.mape * 100).toFixed(1)}%</td>
                <td className="py-2.5 font-mono text-white/65">{(m.hitRate * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 grid gap-2 lg:grid-cols-2">
          {models.map((m) => (
            <div key={`${m.id}-detail`} className="rounded-lg border border-white/8 bg-white/2 px-3 py-2.5">
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="text-sm font-medium">{m.label}</div>
                <Badge variant="outline" className="text-[10px]">
                  {(m.weight * 100).toFixed(1)}% weight
                </Badge>
              </div>
              <p className="text-[11px] leading-relaxed text-white/55">{m.description}</p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-emerald-300/75">
                <span className="font-medium text-emerald-300/90">Purpose: </span>
                {m.purpose}
              </p>
              <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-sky-300/70">{m.formula}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export { Metric, MODEL_COLORS, MODEL_IDS };
