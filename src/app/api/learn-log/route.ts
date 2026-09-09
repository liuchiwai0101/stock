import { NextRequest, NextResponse } from "next/server";
import { mergeLearnStore, readLearnStore } from "@/lib/learn-store";
import type { AdaptivePolicy } from "@/lib/adaptive-policy";
import type { LoggedPrediction } from "@/lib/prediction-log";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = await readLearnStore();
  return NextResponse.json(store);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    predictions?: LoggedPrediction[];
    policy?: AdaptivePolicy;
  };
  const store = await mergeLearnStore(body);
  return NextResponse.json(store);
}
