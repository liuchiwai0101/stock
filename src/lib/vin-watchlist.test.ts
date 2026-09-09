import { describe, expect, it } from "vitest";
import { MAX_WATCHLIST_SYMBOLS, VIN_WATCHLIST_SYMBOLS, vinDefaultSelection } from "./vin-watchlist";

describe("Vin watchlist", () => {
  it("includes Futu US holdings for Vin", () => {
    expect(VIN_WATCHLIST_SYMBOLS).toContain("TSLA");
    expect(VIN_WATCHLIST_SYMBOLS).toContain("SQQQ");
    expect(VIN_WATCHLIST_SYMBOLS).toContain("LMND");
    expect(VIN_WATCHLIST_SYMBOLS).toContain("CRCL");
    expect(VIN_WATCHLIST_SYMBOLS.length).toBeGreaterThanOrEqual(6);
    expect(VIN_WATCHLIST_SYMBOLS.length).toBeLessThanOrEqual(MAX_WATCHLIST_SYMBOLS);
  });

  it("defaults active to first symbol", () => {
    const sel = vinDefaultSelection();
    expect(sel.active).toBe(sel.symbols[0]);
    expect(sel.horizon).toBe(21);
  });
});
