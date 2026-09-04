import { chineseStockName } from "@/lib/chinese-names";
import { cn } from "@/lib/utils";

export function StockNameLines({
  symbol,
  name,
  compact = false,
  className,
}: {
  symbol: string;
  name: string;
  compact?: boolean;
  className?: string;
}) {
  const nameZh = chineseStockName(symbol);

  return (
    <div className={cn("min-w-0", className)}>
      <div className={cn("font-medium", compact ? "text-sm" : undefined)}>{symbol}</div>
      <div
        className={cn(
          "truncate text-white/40",
          compact ? "max-w-[120px] pl-4 text-[11px]" : "text-[11px]",
        )}
        title={name}
      >
        {name}
      </div>
      {nameZh ? (
        <div
          className={cn(
            "truncate text-amber-200/70",
            compact ? "max-w-[120px] pl-4 text-[10px]" : "text-[10px]",
          )}
          title={nameZh}
        >
          {nameZh}
        </div>
      ) : null}
    </div>
  );
}
