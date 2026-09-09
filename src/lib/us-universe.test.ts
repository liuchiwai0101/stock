import { describe, expect, it } from "vitest";

const NASDAQ_SAMPLE = `Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares
AAPL|Apple Inc. Common Stock|Q|N|N|100|N|N
TEST|Test Security|Q|Y|N|100|N|N
QQQ|Invesco QQQ Trust|G|N|N|100|Y|N
AACIW|Example Warrant|G|N|N|100|N|N
File Creation Time: 090420260900`

const OTHER_SAMPLE = `ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot Size|Test Issue|NASDAQ Symbol
MSFT|Microsoft Corporation Common Stock|Q|MSFT|N|100|N|MSFT
AAA|Some ETF|P|AAA|Y|100|N|AAA
File Creation Time: 090420260900`

describe("US equity universe parsing", () => {
  it("keeps common stocks and drops ETFs, test issues, and warrants", async () => {
    const { loadUsEquityUniverse } = await import("./us-universe");
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("nasdaqlisted")) {
        return new Response(NASDAQ_SAMPLE, { status: 200 });
      }
      if (url.includes("otherlisted")) {
        return new Response(OTHER_SAMPLE, { status: 200 });
      }
      throw new Error(`unexpected fetch: ${url}`);
    };

    try {
      const universe = await loadUsEquityUniverse(true);
      const symbols = universe.map((c) => c.symbol);
      expect(symbols).toContain("AAPL");
      expect(symbols).toContain("MSFT");
      expect(symbols).not.toContain("QQQ");
      expect(symbols).not.toContain("TEST");
      expect(symbols).not.toContain("AACIW");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
