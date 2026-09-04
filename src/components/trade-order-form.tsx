"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/format";
import { sharesFromNotional } from "@/lib/trading";
import { cn } from "@/lib/utils";

export function TradeOrderForm({
  side,
  symbol,
  price,
  defaultShares,
  maxShares,
  heldLabel,
  onSubmit,
  onCancel,
  className,
}: {
  side: "BUY" | "SELL";
  symbol: string;
  price: number;
  defaultShares: number;
  maxShares?: number;
  heldLabel?: string;
  onSubmit: (shares: number) => void;
  onCancel: () => void;
  className?: string;
}) {
  const startShares = Math.max(1, Math.floor(defaultShares));
  const [shares, setShares] = useState(String(startShares));
  const [amount, setAmount] = useState((startShares * price).toFixed(2));

  function syncFromShares(raw: string) {
    setShares(raw);
    const n = Math.floor(Number(raw));
    if (Number.isFinite(n) && n > 0 && price > 0) {
      setAmount((n * price).toFixed(2));
    }
  }

  function syncFromAmount(raw: string) {
    setAmount(raw);
    const dollars = Number(raw);
    if (Number.isFinite(dollars) && dollars > 0 && price > 0) {
      setShares(String(Math.max(1, sharesFromNotional(dollars, price))));
    }
  }

  function handleSubmit() {
    const n = Math.floor(Number(shares));
    if (!Number.isFinite(n) || n <= 0) return;
    if (maxShares != null && n > maxShares) return;
    onSubmit(n);
  }

  const parsed = Math.floor(Number(shares));
  const invalid = !Number.isFinite(parsed) || parsed <= 0;
  const tooMany = maxShares != null && parsed > maxShares;

  return (
    <div
      className={cn(
        "flex flex-wrap items-end gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <div>
        <label className="mb-0.5 block text-[10px] tracking-wide text-white/40 uppercase">Qty</label>
        <Input
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          value={shares}
          onChange={(e) => syncFromShares(e.target.value)}
          className="h-7 w-[4.5rem] font-mono text-xs"
        />
      </div>
      <div>
        <label className="mb-0.5 block text-[10px] tracking-wide text-white/40 uppercase">Amount</label>
        <Input
          type="number"
          min={0.01}
          step={0.01}
          inputMode="decimal"
          value={amount}
          onChange={(e) => syncFromAmount(e.target.value)}
          className="h-7 w-[5.5rem] font-mono text-xs"
        />
      </div>
      <div className="pb-1 text-[10px] text-white/45">
        @ {formatPrice(price)}
        {heldLabel ? ` · ${heldLabel}` : null}
      </div>
      <Button
        size="xs"
        variant="outline"
        disabled={invalid || tooMany}
        className={cn(
          side === "BUY"
            ? "border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
            : "border-rose-500/30 text-rose-300 hover:bg-rose-500/10",
        )}
        onClick={handleSubmit}
      >
        {side === "BUY" ? "Buy" : "Sell"} {symbol}
      </Button>
      <Button size="xs" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
      {tooMany ? (
        <span className="pb-1 text-[10px] text-rose-300">Max {maxShares} sh</span>
      ) : null}
    </div>
  );
}
