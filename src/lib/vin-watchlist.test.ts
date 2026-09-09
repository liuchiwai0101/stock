import { describe, expect, it } from "vitest";
import { MAX_WATCHLIST_SYMBOLS, VIN_WATCHLIST_SYMBOLS, vinDefaultSelection } from "./vin-watchlist";

describe("Vin watchlist", () => {
  it("includes Futu US and HK/A holdings for Vin", () => {
    expect(VIN_WATCHLIST_SYMBOLS).toContain("TSLA");
    expect(VIN_WATCHLIST_SYMBOLS).toContain("SQQQ");
    expect(VIN_WATCHLIST_SYMBOLS).toContain("LMND");
    expect(VIN_WATCHLIST_SYMBOLS).toContain("CRCL");
    expect(VIN_WATCHLIST_SYMBOLS).toContain("1810.HK");
    expect(VIN_WATCHLIST_SYMBOLS).toContain("0981.HK");
    expect(VIN_WATCHLIST_SYMBOLS).toContain("0939.HK");
    expect(VIN_WATCHLIST_SYMBOLS).toContain("000858.SZ");
    expect(VIN_WATCHLIST_SYMBOLS).toContain("601611.SS");
    expect(VIN_WATCHLIST_SYMBOLS.length).toBeGreaterThanOrEqual(12);
    expect(VIN_WATCHLIST_SYMBOLS.length).toBeLessThanOrEqual(MAX_WATCHLIST_SYMBOLS);
  });

  it("defaults active to first symbol", () => {
    const sel = vinDefaultSelection();
    expect(sel.active).toBe(sel.symbols[0]);
    expect(sel.horizon).toBe(21);
  });
});
