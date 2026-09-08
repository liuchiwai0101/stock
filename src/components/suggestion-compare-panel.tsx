"use client";

import Link from "next/link";
import { formatPct } from "@/lib/format";
import type { SuggestionCompare } from "@/lib/suggestion-compare";
import { cn } from "@/lib/utils";

function statusLabel(status: SuggestionCompare["rows"][number]["status"]) {
  if (status === "new") return "New";
  if (status === "kept") return "Kept";
  return "Dropped";
}

function statusClass(status: SuggestionCompare["rows"][number]["status"]) {
  if (status === "new") return "text-emerald-300";
  if (status === "kept") return "text-sky-200";
  return "text-amber-300";
}

export function SuggestionComparePanel({
  compare,
  compact = false,
}: {
  compare: SuggestionCompare;
  compact?: boolean;
}) {
  const rows = compact ? compare.rows.slice(0, 12) : compare.rows;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold tracking-tight">Previous suggestion compare</h3>
          <p className="text-sm text-white/45">
            {compare.previousDate} vs {compare.currentDate} · {compare.newCount} new · {compare.keptCount}{" "}
            kept · {compare.droppedCount} dropped
          </p>
        </div>
        {compact ? (
          <Link href="/verify" className="text-xs text-sky-300 hover:underline">
            Full verify →
          </Link>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <MetaChip
          label="Prev scanned"
          value={compare.previousMeta.scanned}
          detail={`of ${compare.previousMeta.total.toLocaleString()}`}
        />
        <MetaChip label="Prev BUY" value={compare.previousMeta.buyCount} />
        <MetaChip
          label="Now scanned"
          value={compare.currentMeta.scanned}
          detail={`of ${compare.currentMeta.total.toLocaleString()}`}
        />
        <MetaChip label="Now BUY" value={compare.currentMeta.buyCount} highlight />
      </div>
      <div className="overflow-x-auto rounded-lg border border-white/8">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-[10px] tracking-wide text-white/40 uppercase">
            <tr className="border-b border-white/8">
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Stock</th>
              <th className="px-3 py-2 font-medium">Rank</th>
              <th className="px-3 py-2 font-medium">Prev exp.</th>
              <th className="px-3 py-2 font-medium">Now exp.</th>
              <th className="px-3 py-2 font-medium">Hit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.symbol} className="border-b border-white/6 last:border-0">
                <td className={cn("px-3 py-2 text-xs font-medium", statusClass(row.status))}>
                  {statusLabel(row.status)}
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium">{row.symbol}</div>
                  <div className="text-[11px] text-white/40">{row.name}</div>
                </td>
                <td className="px-3 py-2 font-mono text-white/70">
                  {row.previousRank ?? "—"} → {row.currentRank ?? "—"}
                </td>
                <td className="px-3 py-2 font-mono text-white/70">
                  {row.previousExpected != null ? formatPct(row.previousExpected) : "—"}
                </td>
                <td className="px-3 py-2 font-mono text-white/70">
                  {row.currentExpected != null ? formatPct(row.currentExpected) : "—"}
                </td>
                <td className="px-3 py-2 font-mono text-white/55">
                  {row.previousHitRate != null ? `${(row.previousHitRate * 100).toFixed(0)}%` : "—"}
                  {row.currentHitRate != null ? ` → ${(row.currentHitRate * 100).toFixed(0)}%` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetaChip({
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
        highlight ? "border-emerald-500/25 bg-emerald-500/10" : "border-white/10 bg-white/3",
      )}
    >
      <div className="text-[10px] tracking-wide text-white/45 uppercase">{label}</div>
      <div className={cn("font-mono text-sm font-semibold", highlight ? "text-emerald-300" : "text-white/90")}>
        {value.toLocaleString()}
        {detail ? <span className="ml-1 text-[11px] font-normal text-white/45">{detail}</span> : null}
      </div>
    </div>
  );
}
