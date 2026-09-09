import { describe, expect, it } from "vitest";
import { displayStockName } from "./chinese-names";

describe("displayStockName", () => {
  it("prefers Chinese over English", () => {
    expect(displayStockName("JNJ", "Johnson & Johnson")).toBe("强生");
    expect(displayStockName("WMT", "Walmart Inc.")).toBe("沃尔玛");
  });

  it("falls back to shortened English", () => {
    expect(displayStockName("ZZZZ", "Some Long Company Inc.")).toBe("Some Long Company");
  });
});
