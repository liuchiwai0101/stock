import { NextRequest, NextResponse } from "next/server";
import { searchDesk } from "@/lib/desk";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const results = await searchDesk(q);
  return NextResponse.json({ results });
}
