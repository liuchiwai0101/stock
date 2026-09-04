import { describe, expect, it } from "vitest";
import { chineseStockName } from "./chinese-names";

describe("chineseStockName", () => {
  it("returns Chinese names for known tickers", () => {
    expect(chineseStockName("aapl")).toBe("苹果");
    expect(chineseStockName("JNJ")).toBe("强生");
    expect(chineseStockName("WMT")).toBe("沃尔玛");
  });

  it("returns undefined when no mapping exists", () => {
    expect(chineseStockName("ZZZZQ")).toBeUndefined();
  });
});
