import { logReturns, stdev } from "@/lib/math/stats";

export type VolRegime = "calm" | "high";

/** Short/long realized vol: high when 20d vol is elevated vs 60d. */
export function volRegimeFromCloses(closes: number[]): VolRegime {
  if (closes.length < 40) return "calm";
  const rets = logReturns(closes);
  const short = stdev(rets.slice(-20));
  const long = stdev(rets.slice(-Math.min(60, rets.length)));
  if (!(long > 0)) return "calm";
  return short / long > 1.15 ? "high" : "calm";
}
