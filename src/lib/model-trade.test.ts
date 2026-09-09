import { describe, expect, it } from "vitest";
import { buildModelBuyOrder, modelWeight } from "./model-trade";
import type { DailyPick } from "./pick-score";

const pick: DailyPick = {
  rank: 1,
  symbol: "AAPL",
  name: "Apple",
  last: 200,
  targetPrice: 220,
  expectedReturn: 0.1,
  confidence: 0.7,
  hitRate: 0.6,
  sharpe: 0.5,
  pickScore: 0.8,
  modelBuyVotes: 8,
  modelCount: 10,
  recommendedWeight: 0.08,
  signal: "BUY",
  liveReady: true,
};

describe("model-trade", () => {
  it("uses recommended weight for sizing", () => {
    expect(modelWeight(pick)).toBe(0.08);
    const order = buildModelBuyOrder(pick, 100_000, 200);
    expect(order.side).toBe("BUY");
    expect(order.shares).toBeGreaterThan(0);
    expect(order.note).toContain("Model BUY");
  });
});
