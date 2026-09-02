import { NextRequest, NextResponse } from "next/server";
import { runForecast } from "@/lib/forecast";
import { loadQuote } from "@/lib/market";
import { runVerificationSuite } from "@/lib/verification";
import type { Horizon, RunResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

const ALLOWED: Horizon[] = [5, 10, 21, 63];

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols") ?? "AAPL";
  const horizonRaw = Number(req.nextUrl.searchParams.get("horizon") ?? 21);
  const horizon = (ALLOWED.includes(horizonRaw as Horizon) ? horizonRaw : 21) as Horizon;
  const symbols = [...new Set(symbolsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(0, 6);

  if (symbols.length === 0) {
    return NextResponse.json({ error: "Pick at least one ticker." }, { status: 400 });
  }

  const errors: RunResponse["errors"] = [];
  const quotes = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const series = await loadQuote(symbol);
        return runForecast(series, horizon);
      } catch (err) {
        errors.push({
          symbol,
          message: err instanceof Error ? err.message : "Forecast failed",
        });
        return null;
      }
    })
  );

  const body: RunResponse = {
    horizon,
    generatedAt: new Date().toISOString(),
    verification: runVerificationSuite(),
    quotes: quotes.filter((q) => q !== null),
    errors,
  };

  return NextResponse.json(body);
}
