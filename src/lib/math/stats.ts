export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export function logReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    out.push(Math.log(closes[i] / closes[i - 1]));
  }
  return out;
}

export function logPrices(closes: number[]): number[] {
  return closes.map((c) => Math.log(c));
}

export function softmaxInvError(errors: number[]): number[] {
  const inv = errors.map((e) => 1 / (e + 1e-6));
  const s = inv.reduce((a, b) => a + b, 0);
  return inv.map((x) => x / s);
}

export function maxDrawdown(equity: number[]): number {
  if (equity.length === 0) return 0;
  let peak = equity[0];
  let maxDd = 0;
  for (const v of equity) {
    peak = Math.max(peak, v);
    if (peak > 0) maxDd = Math.max(maxDd, (peak - v) / peak);
  }
  return maxDd;
}

export function sharpeRatio(returns: number[], annualize = 252): number {
  if (returns.length < 2) return 0;
  const m = mean(returns);
  const s = stdev(returns);
  if (s === 0) return 0;
  return (m / s) * Math.sqrt(annualize);
}
