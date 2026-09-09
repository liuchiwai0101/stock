import { NextRequest, NextResponse } from "next/server";
import { ipHash, readGuestScan, writeGuestScan } from "@/lib/account-server";

export const dynamic = "force-dynamic";

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get("scope");
  const key = scope || `ip:${ipHash(clientIp(req))}`;
  const scan = await readGuestScan(key);
  return NextResponse.json({ key, scan });
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as { scope?: string; scan?: unknown };
  const key = body.scope || `ip:${ipHash(clientIp(req))}`;
  await writeGuestScan(key, body.scan ?? null);
  return NextResponse.json({ ok: true, key });
}
