import type { DailyPick } from "@/lib/pick-score";
import { loadPolicy } from "@/lib/policy-store";
import { sharesForWeight, type TradeRequest } from "@/lib/trading";
import { formatPct } from "@/lib/format";

export function modelWeight(pick: DailyPick): number {
  const policy = typeof window === "undefined" ? null : loadPolicy();
  const size = policy?.sizeScale ?? 1;
  const base = pick.recommendedWeight > 0 ? pick.recommendedWeight : Math.min(0.1, Math.max(0.03, Math.abs(pick.expectedReturn) * 2));
  return Math.min(0.28, Math.max(0.03, base * size));
}

export function buildModelBuyOrder(
  pick: DailyPick,
  equity: number,
  price: number,
): TradeRequest {
  const shares = Math.max(1, sharesForWeight(equity, price, modelWeight(pick)));
  return {
    symbol: pick.symbol,
    name: pick.name,
    side: "BUY",
    shares,
    price,
    note: `Model BUY · #${pick.rank} · ${formatPct(pick.expectedReturn)} exp`,
  };
}

export function buildModelSellOrder(
  pick: DailyPick,
  held: number,
  price: number,
): TradeRequest | null {
  if (held <= 0) return null;
  return {
    symbol: pick.symbol,
    name: pick.name,
    side: "SELL",
    shares: held,
    price,
    note: `Model SELL · closed ${held} sh`,
  };
}

export function buildModelBuyOrders(
  picks: DailyPick[],
  equity: number,
  marks: Record<string, number>,
): TradeRequest[] {
  return picks
    .filter((p) => p.liveReady && p.signal === "BUY")
    .map((pick) => {
      const price = marks[pick.symbol] ?? pick.last;
      return buildModelBuyOrder(pick, equity, price);
    });
}

export function progressToTarget(last: number, target: number): number {
  if (!(target > 0) || !(last > 0)) return 0;
  return (last - target) / target;
}
