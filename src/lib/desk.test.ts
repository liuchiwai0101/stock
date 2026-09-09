import { describe, expect, it } from "vitest";
import { applyScanBatchBuys } from "./desk";
import type { CompanyForecast } from "./types";

function quote(symbol: string, last = 10): CompanyForecast {
  return { symbol, last } as CompanyForecast;
}

describe("applyScanBatchBuys", () => {
  it("keeps seeded BUYs that this batch did not re-forecast", () => {
    const buyMap = new Map<string, CompanyForecast>([
      ["AAA", quote("AAA", 1)],
      ["BBB", quote("BBB", 2)],
    ]);
    applyScanBatchBuys(buyMap, [quote("CCC", 3)], ["CCC"]);
    expect([...buyMap.keys()].sort()).toEqual(["AAA", "BBB", "CCC"]);
  });

  it("drops names this batch re-forecasted that are no longer BUY", () => {
    const buyMap = new Map<string, CompanyForecast>([
      ["AAA", quote("AAA", 1)],
      ["BBB", quote("BBB", 2)],
    ]);
    applyScanBatchBuys(buyMap, [quote("AAA", 9)], ["AAA", "BBB"]);
    expect([...buyMap.keys()]).toEqual(["AAA"]);
    expect(buyMap.get("AAA")?.last).toBe(9);
  });
});
