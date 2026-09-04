import { displayStockName } from "@/lib/chinese-names";
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
  const label = displayStockName(symbol, name);

  return (
    <span
      className={cn("inline-flex min-w-0 max-w-[200px] items-baseline gap-1.5", className)}
      title={name !== label ? `${symbol} · ${name}` : symbol}
    >
      <span className="shrink-0 font-medium">{symbol}</span>
      <span className="truncate text-[11px] text-white/45">{label}</span>
    </span>
  );
}
