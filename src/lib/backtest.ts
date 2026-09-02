import { clamp, logReturns, maxDrawdown, mean, stdev } from "@/lib/math/stats";
import { fitEnsemble } from "@/lib/models/registry";
import type { BacktestResult, Horizon, TradeSignal } from "@/lib/types";

export const BACKTEST_DAYS = 252;
export const BACKTEST_STEP = 14;

export type BacktestGates = {
  minHitRate: number;
  minSharpe: number;
  maxDrawdown: number;
  minTrades: number;
  minDirectionAccuracy: number;
};

export const DEFAULT_GATES: BacktestGates = {
  minHitRate: 0.48,
  minSharpe: 0.1,
  maxDrawdown: 0.35,
  minTrades: 2,
  minDirectionAccuracy: 0.48,
};

function rawSignal(expectedReturn: number, vol: number, horizon: number): TradeSignal {
  const pathVol = vol * Math.sqrt(horizon);
  const hurdle = Math.max(0.008, 0.28 * pathVol);
  if (expectedReturn > hurdle) return "BUY";
  if (expectedReturn < -hurdle) return "SELL";
  return "HOLD";
}

/** Long-only walk-forward: BUY enters, SELL exits, HOLD maintains position. */
export function runBacktest(
  closes: number[],
  dates: string[],
  horizon: Horizon,
  gates: BacktestGates = DEFAULT_GATES
): BacktestResult {
  const minHistory = 120;
  const windowStart = Math.max(minHistory, closes.length - BACKTEST_DAYS - horizon);
  const trades: BacktestResult["tradeLog"] = [];
  const roundTripReturns: number[] = [];
  let directionHits = 0;
  let directionTotal = 0;
  let wins = 0;
  let losses = 0;
  let inPosition = false;
  let entryPrice = 0;
  let entryDate = "";

  for (let t = windowStart; t < closes.length - horizon; t += BACKTEST_STEP) {
    const train = closes.slice(0, t);
    if (train.length < minHistory) continue;

    const markPrice = train[train.length - 1];
    const { logPath } = fitEnsemble(train, horizon);
    const target = Math.exp(logPath[horizon - 1]);
    const expectedReturn = target / markPrice - 1;
    const vol = stdev(logReturns(train.slice(-60)));
    const signal = rawSignal(expectedReturn, vol, horizon);
    const futurePrice = closes[t + horizon - 1];
    const forwardReturn = futurePrice / markPrice - 1;

    if (signal !== "HOLD") {
      directionTotal++;
      if ((expectedReturn > 0 && forwardReturn > 0) || (expectedReturn < 0 && forwardReturn < 0)) {
        directionHits++;
      }
    }

    if (signal === "BUY" && !inPosition) {
      inPosition = true;
      entryPrice = markPrice;
      entryDate = dates[t - 1] ?? `t${t}`;
      trades.push({
        date: entryDate,
        signal: "BUY",
        price: markPrice,
        expectedReturn,
        actualReturn: forwardReturn,
      });
    } else if (signal === "SELL" && inPosition) {
      const realized = markPrice / entryPrice - 1;
      roundTripReturns.push(realized);
      if (realized > 0) wins++;
      else losses++;
      trades.push({
        date: dates[t - 1] ?? `t${t}`,
        signal: "SELL",
        price: markPrice,
        expectedReturn,
        actualReturn: realized,
      });
      inPosition = false;
    }
  }

  if (inPosition) {
    const exit = closes[closes.length - 1];
    const realized = exit / entryPrice - 1;
    roundTripReturns.push(realized);
    if (realized > 0) wins++;
    else losses++;
    trades.push({
      date: dates[closes.length - 1] ?? "close",
      signal: "SELL",
      price: exit,
      expectedReturn: 0,
      actualReturn: realized,
    });
  }

  const equity: number[] = [1];
  for (const r of roundTripReturns) {
    equity.push(equity[equity.length - 1] * (1 + r));
  }

  const startIdx = Math.max(0, closes.length - BACKTEST_DAYS);
  const benchReturn = closes[closes.length - 1] / closes[startIdx] - 1;
  const stratReturn = equity[equity.length - 1] - 1;
  const dd = maxDrawdown(equity);
  const tradeSharpe =
    roundTripReturns.length >= 2
      ? (mean(roundTripReturns) / (stdev(roundTripReturns) || 1e-6)) * Math.sqrt(roundTripReturns.length)
      : roundTripReturns.length === 1
        ? Math.sign(roundTripReturns[0]) * 0.35
        : 0;
  const hitRate = directionTotal ? directionHits / directionTotal : 0.5;
  const winRate = wins + losses ? wins / (wins + losses) : 0.5;

  const checks = {
    hitRate: hitRate >= gates.minHitRate,
    sharpe: tradeSharpe >= gates.minSharpe,
    drawdown: dd <= gates.maxDrawdown,
    trades: roundTripReturns.length >= gates.minTrades,
    direction: hitRate >= gates.minDirectionAccuracy,
  };

  const alphaPass =
    roundTripReturns.length >= 1 &&
    stratReturn > benchReturn &&
    dd <= gates.maxDrawdown &&
    hitRate >= gates.minHitRate;

  const accuracyPass =
    roundTripReturns.length >= 2 && hitRate >= 0.55 && dd <= gates.maxDrawdown;

  const passed = Object.values(checks).every(Boolean) || alphaPass || accuracyPass;

  return {
    periodDays: BACKTEST_DAYS,
    horizon,
    trades: roundTripReturns.length,
    winRate,
    hitRate,
    totalReturn: stratReturn,
    benchmarkReturn: benchReturn,
    sharpe: tradeSharpe,
    maxDrawdown: dd,
    passed,
    checks,
    gates,
    tradeLog: trades.slice(-12),
    summary: passed
      ? accuracyPass && !Object.values(checks).every(Boolean)
        ? `1-year backtest passed on direction accuracy (${(hitRate * 100).toFixed(0)}% hit, ${roundTripReturns.length} round-trips). Cleared for automated signals.`
        : alphaPass && !Object.values(checks).every(Boolean)
          ? `1-year backtest passed on alpha (${(stratReturn * 100).toFixed(1)}% vs bench ${(benchReturn * 100).toFixed(1)}%). Cleared for automated signals.`
          : `1-year long-only walk-forward passed (${roundTripReturns.length} round-trips, Sharpe ${tradeSharpe.toFixed(2)}, direction ${(hitRate * 100).toFixed(0)}%). Cleared for automated signals.`
      : `1-year backtest failed — ${Object.entries(checks)
          .filter(([, ok]) => !ok)
          .map(([k]) => k)
          .join(", ")} below gate. Automated signals stay blocked.`,
  };
}

export function kellyWeight(expectedReturn: number, vol: number, horizon: number): number {
  const pathVol = vol * Math.sqrt(horizon);
  if (pathVol <= 0) return 0;
  const edge = expectedReturn / (pathVol * pathVol);
  return clamp(edge * 0.25, -0.25, 0.25);
}
