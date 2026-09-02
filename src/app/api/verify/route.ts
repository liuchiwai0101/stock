import { NextResponse } from "next/server";
import { getVerificationSummary } from "@/lib/verification-cache";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const result = getVerificationSummary(force);
  return NextResponse.json(result, { status: result.passed ? 200 : 503 });
}
