import { NextRequest, NextResponse } from "next/server";
import { loadQuote } from "@/lib/market";
import { mapPool } from "@/lib/scan-pool";

export const dynamic = "force-dynamic";

const CONCURRENCY = 8;

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols") ?? "";
  const symbols = [...new Set(symbolsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(
    0,
    30,
  );

  if (symbols.length === 0) {
    return NextResponse.json({ error: "Provide symbols query param." }, { status: 400 });
  }

  const errors: { symbol: string; message: string }[] = [];
  const quotes = await mapPool(symbols, CONCURRENCY, async (symbol) => {
    try {
      const series = await loadQuote(symbol, "5d");
      const bars = series.bars;
      const lastBar = bars[bars.length - 1];
      const prevBar = bars[bars.length - 2];
      const last = lastBar?.close ?? 0;
      const prev = prevBar?.close ?? last;
      const changePct = prev > 0 ? last / prev - 1 : 0;
      return {
        symbol: series.symbol,
        name: series.name,
        last,
        changePct,
        at: lastBar?.date ?? new Date().toISOString().slice(0, 10),
        source: series.source,
      };
    } catch (err) {
      errors.push({
        symbol,
        message: err instanceof Error ? err.message : "Quote failed",
      });
      return null;
    }
  });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    quotes: quotes.filter((q) => q !== null),
    errors,
  });
}
