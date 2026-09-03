"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_GATES } from "@/lib/backtest";
import { clsxSign, formatPct, formatPrice } from "@/lib/format";
import { MODEL_LABELS } from "@/lib/forecast";
import { MODEL_CATALOG } from "@/lib/model-catalog";
import type { CompanyForecast, ModelBreakdown, ModelId } from "@/lib/types";
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

const CHECKS = [
  {
    title: "Finite forecast path",
    detail: "Each model must return a full horizon of finite prices — no NaN or broken paths.",
  },
  {
    title: "Walk-forward RMSE",
    detail: "Lower recent forecast error earns higher ensemble weight (softmax over inverse RMSE).",
  },
  {
    title: "Direction hit rate",
    detail: `Model must call the right up/down move often enough (gate ≥ ${(DEFAULT_GATES.minHitRate * 100).toFixed(0)}%).`,
  },
  {
    title: "1-year backtest gates",
    detail: `Strategy Sharpe ≥ ${DEFAULT_GATES.minSharpe}, max drawdown ≤ ${(DEFAULT_GATES.maxDrawdown * 100).toFixed(0)}%, enough round-trips, or clear alpha vs buy-and-hold.`,
  },
  {
    title: "Live-ready lock",
    detail: "If the ticker’s 1-year backtest fails, automated BUY/SELL is forced to HOLD (manual paper trades still allowed).",
  },
];

export function ModelGuidePanel({ quote }: { quote: CompanyForecast }) {
  const models = quote.models?.length
    ? quote.models
    : MODEL_CATALOG.map((m) => ({
        ...m,
        weight: quote.weights[m.id] ?? 0,
        hitRate: 0,
        targetPrice: quote.last,
        expectedReturn: 0,
        rmse: 0,
        mape: 0,
      }));

  return (
    <Card className="bg-[#10161d]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">What each model does and what we check</CardTitle>
        <CardDescription>
          Plain-language roles for {quote.symbol}, plus the gates that unlock automated signals.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {models.map((m) => (
            <div key={m.id} className="rounded-lg border border-white/8 bg-white/2 px-3 py-2.5">
              <div className="mb-1 flex items-center gap-2">
                <span className={cn("size-2 shrink-0 rounded-full", MODEL_COLORS[m.id])} />
                <span className="text-sm font-medium">{m.label}</span>
                <span className="ml-auto font-mono text-[10px] text-white/40">
                  {(m.weight * 100).toFixed(0)}% wt
                </span>
              </div>
              <p className="text-[12px] leading-snug text-white/65">{m.purpose}</p>
              <p className="mt-1.5 text-[11px] leading-snug text-white/40">{m.description}</p>
            </div>
          ))}
        </div>

        <div>
          <div className="mb-2 text-[11px] tracking-wide text-white/40 uppercase">Checks before auto-trade</div>
          <ul className="space-y-2">
            {CHECKS.map((c) => (
              <li key={c.title} className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
                <div className="text-sm font-medium text-white/85">{c.title}</div>
                <p className="mt-0.5 text-[12px] leading-snug text-white/50">{c.detail}</p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-white/40">
            Current ticker: {quote.liveReady ? "backtest cleared — signals live" : "backtest failed — auto-trade blocked"}
            {" · "}hit {(quote.metrics.hitRate * 100).toFixed(0)}% · Sharpe {quote.backtest.sharpe.toFixed(2)}
          </p>
        </div>
      </CardContent>
    </Card>
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
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="text-[11px] tracking-wide text-white/40 uppercase">Ensemble mix</div>
        <div className="truncate text-[10px] text-white/40">
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
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Per-model results</CardTitle>
        <CardDescription>
          Ensemble {formatPrice(ensembleTarget)} ({formatPct(ensembleReturn)})
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="text-[11px] tracking-wide text-white/40 uppercase">
            <tr className="border-b border-white/8">
              <th className="py-2 pr-3 font-medium">Model</th>
              <th className="py-2 pr-3 font-medium">Weight</th>
              <th className="py-2 pr-3 font-medium">Target</th>
              <th className="py-2 pr-3 font-medium">Exp.</th>
              <th className="py-2 font-medium">Hit</th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr key={m.id} className="border-b border-white/6 last:border-0">
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <span className={cn("size-2 shrink-0 rounded-full", MODEL_COLORS[m.id])} />
                    <span className="font-medium">{m.label}</span>
                  </div>
                </td>
                <td className="py-2 pr-3 font-mono">{(m.weight * 100).toFixed(1)}%</td>
                <td className="py-2 pr-3 font-mono">{formatPrice(m.targetPrice)}</td>
                <td className={cn("py-2 pr-3 font-mono", clsxSign(m.expectedReturn))}>
                  {formatPct(m.expectedReturn)}
                </td>
                <td className="py-2 font-mono text-white/65">{(m.hitRate * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export { MODEL_COLORS, MODEL_IDS };
