import { NextRequest, NextResponse } from "next/server";
import { parseHorizon, parseSymbols, runDesk } from "@/lib/desk";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols") ?? "AAPL";
  const horizon = parseHorizon(Number(req.nextUrl.searchParams.get("horizon") ?? 21));
  const symbols = parseSymbols(symbolsParam);

  if (symbols.length === 0) {
    return NextResponse.json({ error: "Pick at least one ticker." }, { status: 400 });
  }

  const body = await runDesk(symbols, horizon);
  return NextResponse.json(body);
}
