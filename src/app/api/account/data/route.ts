import { NextRequest, NextResponse } from "next/server";
import { readUserData, writeUserData } from "@/lib/account-server";

export const dynamic = "force-dynamic";

const COOKIE = "sd-user";

function userIdFromRequest(req: NextRequest): string | null {
  const raw = req.cookies.get(COOKIE)?.value;
  if (!raw) return null;
  try {
    const user = JSON.parse(decodeURIComponent(raw)) as { id?: string };
    return user.id ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const userId = userIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const data = await readUserData(userId);
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const userId = userIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = (await req.json()) as {
    selection?: unknown;
    scan?: unknown;
    scanHistory?: unknown;
  };
  const data = await writeUserData(userId, {
    selection: body.selection,
    scan: body.scan,
    scanHistory: body.scanHistory,
  });
  return NextResponse.json(data);
}
