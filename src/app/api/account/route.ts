import { NextRequest, NextResponse } from "next/server";
import { loginServerAccount } from "@/lib/account-server";

export const dynamic = "force-dynamic";

const COOKIE = "sd-user";

export async function GET(req: NextRequest) {
  const raw = req.cookies.get(COOKIE)?.value;
  if (!raw) return NextResponse.json({ user: null });
  try {
    const user = JSON.parse(decodeURIComponent(raw)) as { id: string; username: string };
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ user: null });
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    action?: string;
    username?: string;
    password?: string;
  };

  if (body.action === "logout") {
    const res = NextResponse.json({ user: null });
    res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }

  if (body.action === "register") {
    return NextResponse.json({ error: "Account creation is disabled" }, { status: 403 });
  }

  try {
    if (body.action === "login") {
      const account = await loginServerAccount(body.username ?? "", body.password ?? "");
      const user = { id: account.id, username: account.username, createdAt: account.createdAt };
      const res = NextResponse.json({ user });
      res.cookies.set(COOKIE, encodeURIComponent(JSON.stringify(user)), {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
      return res;
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Account failed" },
      { status: 400 },
    );
  }
}
