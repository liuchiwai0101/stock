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
      className={cn("flex min-w-0 items-baseline gap-1 overflow-hidden", className)}
      title={name !== label ? `${symbol} · ${name}` : `${symbol} · ${name}`}
    >
      <span className="shrink-0 font-medium">{symbol}</span>
      <span className="truncate text-[11px] text-white/45">{label}</span>
    </span>
  );
}
