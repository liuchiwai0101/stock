import { FEE_BPS } from "@/lib/trading";
import type { Fill } from "@/lib/types";

/** Extra bid-ask friction on top of the 5 bps commission already booked. */
export const SPREAD_BPS = 5;

export function roundTripFriction(): number {
  return (2 * FEE_BPS + SPREAD_BPS) / 10_000;
}

export function costAwareWin(side: "BUY" | "SELL", fillPrice: number, mark: number): boolean {
  if (!(fillPrice > 0) || !(mark > 0)) return false;
  const friction = roundTripFriction();
  if (side === "BUY") return mark >= fillPrice * (1 + friction);
  return mark <= fillPrice * (1 - friction);
}

export function costAwareFillWinRate(fills: Fill[], marks: Record<string, number>): number {
  const scored = fills.filter((f) => (marks[f.symbol] ?? 0) > 0 && f.price > 0);
  if (scored.length === 0) return 0.5;
  let wins = 0;
  for (const f of scored) {
    if (costAwareWin(f.side, f.price, marks[f.symbol])) wins += 1;
  }
  return wins / scored.length;
}

/** Subtract estimated spread (fees are already in cash) so size does not grow on noisy marks. */
export function costAwarePnL(equityPnL: number, fills: Fill[]): number {
  const spread = fills.reduce((sum, f) => sum + Math.abs(f.notional) * (SPREAD_BPS / 10_000), 0);
  return equityPnL - spread;
}
