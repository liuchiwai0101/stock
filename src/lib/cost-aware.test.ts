import { describe, expect, it } from "vitest";
import { costAwarePnL, costAwareWin, roundTripFriction, SPREAD_BPS } from "./cost-aware";
import { FEE_BPS } from "./trading";
import type { Fill } from "./types";

describe("cost-aware P&L", () => {
  it("charges 5 bps each side plus 5 bps spread", () => {
    expect(roundTripFriction()).toBeCloseTo((2 * FEE_BPS + SPREAD_BPS) / 10_000, 10);
  });

  it("counts a buy as a win only after the mark clears round-trip friction", () => {
    expect(costAwareWin("BUY", 100, 100.1)).toBe(false);
    expect(costAwareWin("BUY", 100, 100.16)).toBe(true);
    expect(costAwareWin("SELL", 100, 99.9)).toBe(false);
    expect(costAwareWin("SELL", 100, 99.84)).toBe(true);
  });

  it("subtracts spread from booked equity P&L", () => {
    const fills: Fill[] = [
      {
        id: "1",
        at: "2026-09-01T00:00:00.000Z",
        symbol: "AAPL",
        name: "Apple",
        side: "BUY",
        shares: 10,
        price: 100,
        notional: 1000,
        note: "test",
      },
    ];
    expect(costAwarePnL(10, fills)).toBeCloseTo(10 - 0.5, 8);
  });
});
