import { NextResponse } from "next/server";
import { runVerificationSuite } from "@/lib/verification";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = runVerificationSuite();
  return NextResponse.json(result, { status: result.passed ? 200 : 503 });
}
