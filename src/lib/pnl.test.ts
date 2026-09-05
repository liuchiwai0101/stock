import { describe, expect, it } from "vitest";
import { computeBookPnL } from "./pnl";
import { emptyPortfolio } from "./trading";

describe("computeBookPnL", () => {
  it("computes unrealized and total pnl with marks", () => {
    const portfolio = {
      cash: 90_000,
      positions: [
        {
          symbol: "AAPL",
          name: "Apple",
          shares: 10,
          avgPrice: 100,
          openedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      fills: [
        {
          id: "1",
          symbol: "AAPL",
          name: "Apple",
          side: "BUY" as const,
          shares: 10,
          price: 100,
          notional: 1000,
          at: "2026-01-01T00:00:00.000Z",
          note: "buy",
        },
      ],
    };
    const book = computeBookPnL(portfolio, { AAPL: 110 });
    expect(book.unrealizedPnL).toBe(100);
    expect(book.realizedPnL).toBe(0);
    expect(book.equity).toBe(90_000 + 1_100);
    expect(book.totalPnL).toBe(book.equity - 100_000);
  });

  it("realizes P&L only on closed shares", () => {
    const portfolio = {
      cash: 90_500,
      positions: [
        {
          symbol: "AAPL",
          name: "Apple",
          shares: 5,
          avgPrice: 100,
          openedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      fills: [
        {
          id: "1",
          symbol: "AAPL",
          name: "Apple",
          side: "BUY" as const,
          shares: 10,
          price: 100,
          notional: 1000,
          at: "2026-01-01T00:00:00.000Z",
          note: "buy",
        },
        {
          id: "2",
          symbol: "AAPL",
          name: "Apple",
          side: "SELL" as const,
          shares: 5,
          price: 110,
          notional: 550,
          at: "2026-01-02T00:00:00.000Z",
          note: "sell",
        },
      ],
    };
    const book = computeBookPnL(portfolio, { AAPL: 110 });
    expect(book.realizedPnL).toBe(50);
    expect(book.unrealizedPnL).toBe(50);
  });

  it("handles empty portfolio", () => {
    const book = computeBookPnL(emptyPortfolio(), {});
    expect(book.totalPnL).toBe(0);
    expect(book.positions).toHaveLength(0);
  });
});
