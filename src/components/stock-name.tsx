import { chineseStockName } from "@/lib/chinese-names";
import { cn } from "@/lib/utils";

function shortName(name: string, max = 22): string {
  const clean = name.replace(/\s+Common Stock.*$/i, "").replace(/\s+Inc\.?$/i, "").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

export function StockNameInline({
  symbol,
  name,
  className,
}: {
  symbol: string;
  name: string;
  className?: string;
}) {
  const nameZh = chineseStockName(symbol);
  const label = nameZh ?? shortName(name);

  return (
    <span
      className={cn("inline-flex min-w-0 max-w-[200px] items-baseline gap-1.5", className)}
      title={nameZh ? `${name} · ${nameZh}` : name}
    >
      <span className="shrink-0 font-medium">{symbol}</span>
      <span className="truncate text-[11px] text-white/45">{label}</span>
    </span>
  );
}
