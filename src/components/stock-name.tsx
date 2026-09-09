"use client";

import { useSyncExternalStore } from "react";
import { CHINESE_NAMES, displayStockName } from "@/lib/chinese-names";
import { getMergedChineseNames, subscribeChineseNames } from "@/lib/chinese-names-store";
import { cn } from "@/lib/utils";

export function StockNameInline({
  symbol,
  name,
  className,
}: {
  symbol: string;
  name: string;
  className?: string;
}) {
  const cache = useSyncExternalStore(
    subscribeChineseNames,
    getMergedChineseNames,
    () => CHINESE_NAMES,
  );
  const label = displayStockName(symbol, name, cache);

  return (
    <span
      className={cn("flex min-w-0 items-baseline gap-1 overflow-hidden", className)}
      title={`${symbol} · ${name}`}
    >
      <span className="shrink-0 font-medium">{symbol}</span>
      <span className="truncate text-[11px] text-white/45">{label}</span>
    </span>
  );
}
