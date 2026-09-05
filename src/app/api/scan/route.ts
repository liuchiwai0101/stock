import { NextRequest, NextResponse } from "next/server";
import { parseHorizon, scanBuyList } from "@/lib/desk";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const horizon = parseHorizon(Number(req.nextUrl.searchParams.get("horizon") ?? 21));
  const body = await scanBuyList(horizon);
  return NextResponse.json(body);
}
