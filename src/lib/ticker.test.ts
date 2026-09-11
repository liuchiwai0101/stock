import { describe, expect, it } from "vitest";
import { mergeTickerSearchHits } from "@/lib/ticker";

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
