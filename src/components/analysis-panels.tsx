import { Badge } from "@/components/ui/badge";
import { clsxSign, formatPct } from "@/lib/format";
import { MODEL_LABELS } from "@/lib/forecast";
import type { BacktestResult, CompanyForecast, ModelId } from "@/lib/types";
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
  hitRate: "Direction hit ≥50%",
  sharpe: "Sharpe gate",
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
      <p className="mt-2 text-[11px] leading-relaxed text-white/45">{backtest.summary}</p>
    </div>
  );
}

export function ModelWeightsPanel({ quote }: { quote: CompanyForecast }) {
  const top = MODEL_IDS.map((id) => ({ id, w: quote.weights[id] }))
    .sort((a, b) => b.w - a.w)
    .slice(0, 3);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <div className="text-[11px] tracking-wide text-white/40 uppercase">10-model ensemble</div>
        <div className="text-[10px] text-white/40">
          Top: {top.map((t) => `${t.id.toUpperCase()} ${(t.w * 100).toFixed(0)}%`).join(" · ")}
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

export { Metric };
