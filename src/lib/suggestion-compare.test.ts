import { describe, expect, it } from "vitest";
import type { DailyPick } from "@/lib/pick-score";
import type { ScanMeta } from "@/lib/scan-history";
import { comparePickLists } from "@/lib/suggestion-compare";

function pick(partial: Partial<DailyPick> & Pick<DailyPick, "symbol" | "rank">): DailyPick {
  return {
    name: partial.symbol,
    last: 100,
    targetPrice: 110,
    expectedReturn: 0.1,
    confidence: 0.6,
    hitRate: 0.55,
    sharpe: 0.4,
    pickScore: 0.5,
    modelBuyVotes: 6,
    modelCount: 10,
    recommendedWeight: 0.1,
    signal: "BUY",
    liveReady: true,
    horizon: 21,
    modelLeans: {},
    ...partial,
  };
}

const meta = (buyCount: number): ScanMeta => ({
  scanned: 100,
  total: 100,
  passed: 20,
  buyCount,
});

describe("suggestion compare", () => {
  it("labels new, kept, and dropped names between scans", () => {
    const previous = [pick({ symbol: "AAPL", rank: 1 }), pick({ symbol: "MSFT", rank: 2, expectedReturn: 0.04 })];
    const current = [pick({ symbol: "NVDA", rank: 1 }), pick({ symbol: "AAPL", rank: 2, expectedReturn: 0.12 })];
    const cmp = comparePickLists(previous, current, "2026-09-01", "2026-09-08", meta(2), meta(2));
    expect(cmp.newCount).toBe(1);
    expect(cmp.keptCount).toBe(1);
    expect(cmp.droppedCount).toBe(1);
    expect(cmp.rows.find((r) => r.symbol === "NVDA")?.status).toBe("new");
    expect(cmp.rows.find((r) => r.symbol === "AAPL")?.status).toBe("kept");
    expect(cmp.rows.find((r) => r.symbol === "MSFT")?.status).toBe("dropped");
  });
});
