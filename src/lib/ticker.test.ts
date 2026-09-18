import { describe, expect, it } from "vitest";
import { mergeTickerSearchHits, tickerFromAddField } from "@/lib/ticker";

describe("tickerFromAddField", () => {
  it("uppercases and trims spaces from the native input value", () => {
    expect(tickerFromAddField("  dell ")).toBe("DELL");
  });

  it("returns empty when the field is blank", () => {
    expect(tickerFromAddField("")).toBe("");
    expect(tickerFromAddField(null)).toBe("");
  });

  it("canonicalizes China/HK suffixes", () => {
    expect(tickerFromAddField("858.sz")).toBe("000858.SZ");
    expect(tickerFromAddField("1810.hk")).toBe("1810.HK");
  });
});

describe("mergeTickerSearchHits", () => {
  it("keeps the typed ticker first even when remote search is empty", () => {
    expect(mergeTickerSearchHits("dell", [], (s) => s)).toEqual([
      { symbol: "DELL", name: "DELL", type: "EQUITY" },
    ]);
  });

  it("does not duplicate the typed symbol from remote results", () => {
    const rows = mergeTickerSearchHits(
      "aapl",
      [
        { symbol: "AAPL", name: "Apple", type: "EQUITY" },
        { symbol: "MSFT", name: "Microsoft", type: "EQUITY" },
      ],
      (s) => s,
    );
    expect(rows.map((r) => r.symbol)).toEqual(["AAPL", "MSFT"]);
  });
});
