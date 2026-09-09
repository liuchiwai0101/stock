import type { Fill, Portfolio, Position } from "@/lib/types";
import { STARTING_CASH, equity } from "@/lib/trading";

export type PositionPnL = {
  symbol: string;
  name: string;
  shares: number;
  avgPrice: number;
  mark: number;
  costBasis: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPct: number;
  openedAt: string;
};

export type RealizedSymbolPnL = {
  symbol: string;
  name: string;
  buyShares: number;
  sellShares: number;
  buyNotional: number;
  sellNotional: number;
  realizedPnL: number;
  netShares: number;
};

export type BookPnL = {
  startingCash: number;
  cash: number;
  equity: number;
  invested: number;
  totalPnL: number;
  totalPnLPct: number;
  unrealizedPnL: number;
  realizedPnL: number;
  positions: PositionPnL[];
  realizedBySymbol: RealizedSymbolPnL[];
};

export function positionPnL(position: Position, mark: number): PositionPnL {
  const costBasis = position.shares * position.avgPrice;
  const marketValue = position.shares * mark;
  const unrealizedPnL = marketValue - costBasis;
  const unrealizedPct = costBasis > 0 ? unrealizedPnL / costBasis : 0;
  return {
    symbol: position.symbol,
    name: position.name,
    shares: position.shares,
    avgPrice: position.avgPrice,
    mark,
    costBasis,
    marketValue,
    unrealizedPnL,
    unrealizedPct,
    openedAt: position.openedAt,
  };
}

export function realizedPnLBySymbol(fills: Fill[]): RealizedSymbolPnL[] {
  const bySymbol = new Map<string, RealizedSymbolPnL>();

  for (const fill of fills) {
    const row =
      bySymbol.get(fill.symbol) ??
      ({
        symbol: fill.symbol,
        name: fill.name,
        buyShares: 0,
        sellShares: 0,
        buyNotional: 0,
        sellNotional: 0,
        realizedPnL: 0,
        netShares: 0,
      } satisfies RealizedSymbolPnL);

    if (fill.side === "BUY") {
      row.buyShares += fill.shares;
      row.buyNotional += fill.notional;
    } else {
      row.sellShares += fill.shares;
      row.sellNotional += fill.notional;
    }
    row.netShares = row.buyShares - row.sellShares;
    const avgBuy = row.buyShares > 0 ? row.buyNotional / row.buyShares : 0;
    row.realizedPnL = row.sellNotional - avgBuy * row.sellShares;
    bySymbol.set(fill.symbol, row);
  }

  return [...bySymbol.values()].sort((a, b) => b.realizedPnL - a.realizedPnL);
}

export function computeBookPnL(
  portfolio: Portfolio,
  marks: Record<string, number>,
  startingCash = STARTING_CASH,
): BookPnL {
  const positions = portfolio.positions.map((p) =>
    positionPnL(p, marks[p.symbol] ?? p.avgPrice),
  );
  const unrealizedPnL = positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
  const realizedBySymbol = realizedPnLBySymbol(portfolio.fills);
  const realizedPnL = realizedBySymbol.reduce((sum, r) => sum + r.realizedPnL, 0);
  const equityValue = equity(portfolio, marks);
  const invested = positions.reduce((sum, p) => sum + p.marketValue, 0);
  const totalPnL = equityValue - startingCash;

  return {
    startingCash,
    cash: portfolio.cash,
    equity: equityValue,
    invested,
    totalPnL,
    totalPnLPct: startingCash > 0 ? totalPnL / startingCash : 0,
    unrealizedPnL,
    realizedPnL,
    positions,
    realizedBySymbol,
  };
}
