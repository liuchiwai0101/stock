import { NextRequest, NextResponse } from "next/server";
import { searchTickers } from "@/lib/market";
import { UNIVERSE } from "@/lib/universe";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) {
    return NextResponse.json({ results: UNIVERSE.slice(0, 8).map((c) => ({ symbol: c.symbol, name: c.name, type: "EQUITY" })) });
  }
  const results = await searchTickers(q);
  return NextResponse.json({ results });
}
