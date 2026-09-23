import { describe, expect, it } from "vitest";
import { isLikelyTicker, resolveListedSymbol, searchListedMarkets, searchTradableMarkets, type ListedSymbol } from "@/lib/ticker-search";

const ROWS: ListedSymbol[] = [
  { symbol: "0981.HK", name: "中芯国际", market: "HK", aliases: [] },
  { symbol: "688981.SS", name: "中芯国际", market: "CN", aliases: [] },
  { symbol: "0939.HK", name: "建设银行", market: "HK", aliases: [] },
  { symbol: "601611.SS", name: "中国核建", market: "CN", aliases: [] },
  { symbol: "AAPL", name: "Apple", market: "US", aliases: ["苹果"] },
  { symbol: "0700.HK", name: "腾讯控股", market: "HK", aliases: [] },
  { symbol: "0883.HK", name: "中国海洋石油", market: "HK", aliases: [] },
];

describe("searchListedMarkets", () => {
  it("finds Hong Kong, A-share, and US names for a Chinese query", () => {
    const hits = searchListedMarkets("中", ROWS);
    const markets = new Set(hits.map((hit) => hit.type));
    expect(markets.has("HK")).toBe(true);
    expect(markets.has("CN")).toBe(true);
    expect(hits.map((hit) => hit.symbol)).not.toContain("中");
  });

  it("matches a US Chinese alias", () => {
    expect(searchListedMarkets("苹果", ROWS).map((hit) => hit.symbol)).toEqual(["AAPL"]);
  });

  it("matches a Hong Kong ticker prefix", () => {
    expect(searchListedMarkets("0700", ROWS)[0]?.symbol).toBe("0700.HK");
  });
});

describe("searchTradableMarkets", () => {
  it("returns Hong Kong and A-share hits for 中芯", async () => {
    const hits = await searchTradableMarkets("中芯");
    const symbols = hits.map((hit) => hit.symbol);
    expect(symbols).toContain("0981.HK");
    expect(symbols).toContain("688981.SS");
  });
});

describe("resolveListedSymbol", () => {
  it("maps 中国海洋石油 to the Hong Kong ticker", () => {
    expect(resolveListedSymbol("中国海洋石油", ROWS)).toEqual({
      symbol: "0883.HK",
      name: "中国海洋石油",
    });
  });
});

describe("isLikelyTicker", () => {
  it("accepts market suffixes and rejects a Chinese name", () => {
    expect(isLikelyTicker("1810.hk")).toBe(true);
    expect(isLikelyTicker("中芯国际")).toBe(false);
  });
});
