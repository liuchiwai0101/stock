import { clamp, logReturns, maxDrawdown, mean, stdev } from "@/lib/math/stats";
import { fitEnsemble } from "@/lib/models/registry";
import type { BacktestResult, Horizon, TradeSignal } from "@/lib/types";

export const BACKTEST_DAYS = 252;
export const BACKTEST_STEP = 21;

export type BacktestGates = {
  minHitRate: number;
  minSharpe: number;
  maxDrawdown: number;
  minTrades: number;
  minDirectionAccuracy: number;
};

export const DEFAULT_GATES: BacktestGates = {
  minHitRate: 0.5,
  minSharpe: 0.15,
  maxDrawdown: 0.4,
  minTrades: 3,
  minDirectionAccuracy: 0.48,
};

function rawSignal(expectedReturn: number, vol: number, horizon: number): TradeSignal {
  const pathVol = vol * Math.sqrt(horizon);
  const hurdle = Math.max(0.008, 0.28 * pathVol);
  if (expectedReturn > hurdle) return "BUY";
  if (expectedReturn < -hurdle) return "SELL";
  return "HOLD";
}

export function runBacktest(
  closes: number[],
  dates: string[],
  horizon: Horizon,
  gates: BacktestGates = DEFAULT_GATES
): BacktestResult {
  const minHistory = 120;
  const windowStart = Math.max(minHistory, closes.length - BACKTEST_DAYS - horizon);
  const tradeReturns: number[] = [];
  const trades: BacktestResult["tradeLog"] = [];
  let directionHits = 0;
  let directionTotal = 0;
  let wins = 0;
  let losses = 0;

  for (let t = windowStart; t < closes.length - horizon; t += BACKTEST_STEP) {
    const train = closes.slice(0, t);
    if (train.length < minHistory) continue;

    const { logPath } = fitEnsemble(train, horizon);
    const last = train[train.length - 1];
    const target = Math.exp(logPath[horizon - 1]);
    const expectedReturn = target / last - 1;
    const vol = stdev(logReturns(train.slice(-60)));
    const signal = rawSignal(expectedReturn, vol, horizon);
    const actualReturn = closes[t + horizon - 1] / last - 1;

    if (signal !== "HOLD") {
      directionTotal++;
      if ((expectedReturn > 0 && actualReturn > 0) || (expectedReturn < 0 && actualReturn < 0)) {
        directionHits++;
      }
    }

    if (signal === "BUY") {
      tradeReturns.push(actualReturn);
      if (actualReturn > 0) wins++;
      else losses++;
      trades.push({
        date: dates[t - 1] ?? `t${t}`,
        signal: "BUY",
        price: last,
        expectedReturn,
        actualReturn,
      });
    } else if (signal === "SELL") {
      const shortReturn = -actualReturn;
      tradeReturns.push(shortReturn * 0.5);
      if (shortReturn > 0) wins++;
      else losses++;
      trades.push({
        date: dates[t - 1] ?? `t${t}`,
        signal: "SELL",
        price: last,
        expectedReturn,
        actualReturn: shortReturn * 0.5,
      });
    }
  }

  const equity: number[] = [1];
  for (const r of tradeReturns) {
    equity.push(equity[equity.length - 1] * (1 + r));
  }

  const startIdx = Math.max(0, closes.length - BACKTEST_DAYS);
  const benchReturn = closes[closes.length - 1] / closes[startIdx] - 1;
  const stratReturn = equity[equity.length - 1] - 1;
  const dd = maxDrawdown(equity);
  const tradeSharpe =
    tradeReturns.length >= 2
      ? (mean(tradeReturns) / stdev(tradeReturns)) * Math.sqrt(252 / horizon)
      : tradeReturns.length === 1
        ? (tradeReturns[0] > 0 ? 0.5 : -0.5)
        : 0;
  const hitRate = directionTotal ? directionHits / directionTotal : 0.5;
  const winRate = wins + losses ? wins / (wins + losses) : 0.5;

  const checks = {
    hitRate: hitRate >= gates.minHitRate,
    sharpe: tradeSharpe >= gates.minSharpe,
    drawdown: dd <= gates.maxDrawdown,
    trades: trades.length >= gates.minTrades,
    direction: hitRate >= gates.minDirectionAccuracy,
  };

  const passed = Object.values(checks).every(Boolean);

  return {
    periodDays: BACKTEST_DAYS,
    horizon,
    trades: trades.length,
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
      ? `1-year walk-forward passed (${trades.length} round-trips, Sharpe ${tradeSharpe.toFixed(2)}, direction hit ${(hitRate * 100).toFixed(0)}%). Cleared for paper/live suggestion.`
      : `1-year walk-forward failed — ${Object.entries(checks)
          .filter(([, ok]) => !ok)
          .map(([k]) => k)
          .join(", ")} below gate. Signal blocked until backtest improves.`,
  };
}

export function kellyWeight(expectedReturn: number, vol: number, horizon: number): number {
  const pathVol = vol * Math.sqrt(horizon);
  if (pathVol <= 0) return 0;
  const edge = expectedReturn / (pathVol * pathVol);
  return clamp(edge * 0.25, -0.25, 0.25);
}
