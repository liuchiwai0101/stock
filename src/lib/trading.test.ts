import { describe, expect, it } from "vitest";
import { aggregateTradesBySymbol, applyTrade, emptyPortfolio, sharesFromNotional } from "./trading";

describe("aggregateTradesBySymbol", () => {
  it("combines multiple fills for the same symbol", () => {
    const fills = [
      {
        id: "1",
        symbol: "AAPL",
        name: "Apple",
        side: "BUY" as const,
        shares: 10,
        price: 100,
        notional: 1000,
        at: "2026-01-01T10:00:00.000Z",
        note: "buy 1",
      },
      {
        id: "2",
        symbol: "AAPL",
        name: "Apple",
        side: "BUY" as const,
        shares: 5,
        price: 110,
        notional: 550,
        at: "2026-01-02T10:00:00.000Z",
        note: "buy 2",
      },
      {
        id: "3",
        symbol: "AAPL",
        name: "Apple",
        side: "SELL" as const,
        shares: 3,
        price: 120,
        notional: 360,
        at: "2026-01-03T10:00:00.000Z",
        note: "sell 1",
      },
    ];

    const rows = aggregateTradesBySymbol(fills);
    expect(rows).toHaveLength(1);
    expect(rows[0].buyShares).toBe(15);
    expect(rows[0].sellShares).toBe(3);
    expect(rows[0].netShares).toBe(12);
    expect(rows[0].avgBuyPrice).toBeCloseTo(103.333, 2);
    expect(rows[0].avgSellPrice).toBe(120);
    expect(rows[0].fillCount).toBe(3);
  });
});

describe("sharesFromNotional", () => {
  it("converts dollar amount to whole shares at price", () => {
    expect(sharesFromNotional(1000, 150)).toBe(6);
    expect(sharesFromNotional(0, 10)).toBe(0);
  });
});

describe("applyTrade sell", () => {
  it("reduces aggregated position when selling held shares", () => {
    let book = emptyPortfolio();
    const buy = applyTrade(book, {
      symbol: "MSFT",
      name: "Microsoft",
      side: "BUY",
      shares: 10,
      price: 200,
    });
    expect(buy.ok).toBe(true);
    if (!buy.ok) return;
    book = buy.portfolio;

    const sell = applyTrade(book, {
      symbol: "MSFT",
      name: "Microsoft",
      side: "SELL",
      shares: 4,
      price: 210,
    });
    expect(sell.ok).toBe(true);
    if (!sell.ok) return;

    const row = aggregateTradesBySymbol(sell.portfolio.fills)[0];
    expect(row.netShares).toBe(6);
    expect(sell.portfolio.positions[0]?.shares).toBe(6);
  });
});
