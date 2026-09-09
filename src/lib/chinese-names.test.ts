import { describe, expect, it } from "vitest";
import { displayStockName } from "./chinese-names";

describe("displayStockName", () => {
  it("prefers Chinese over English", () => {
    expect(displayStockName("JNJ", "Johnson & Johnson")).toBe("强生");
    expect(displayStockName("100.HK", "wrong etf")).toBe("MINIMAX");
    expect(displayStockName("0100.HK", "MINIMAX-W")).toBe("MINIMAX");
  });

  it("falls back to shortened English", () => {
    expect(displayStockName("ZZZZ", "Some Long Company Inc.")).toBe("Some Long Company");
  });
});
