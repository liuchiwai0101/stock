import { NextRequest, NextResponse } from "next/server";
import { fetchChineseNamesFromTencent } from "@/lib/chinese-name-fetch";
import { chineseStockName } from "@/lib/chinese-names";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols") ?? "";
  const symbols = [...new Set(symbolsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(
    0,
    60,
  );

  if (symbols.length === 0) {
    return NextResponse.json({ error: "Provide symbols query param." }, { status: 400 });
  }

  const names: Record<string, string> = {};
  const toFetch: string[] = [];

  for (const symbol of symbols) {
    const staticName = chineseStockName(symbol);
    if (staticName) {
      names[symbol] = staticName;
    } else {
      toFetch.push(symbol);
    }
  }

  if (toFetch.length > 0) {
    try {
      const fetched = await fetchChineseNamesFromTencent(toFetch);
      Object.assign(names, fetched);
    } catch (err) {
      return NextResponse.json(
        {
          error: err instanceof Error ? err.message : "Chinese name lookup failed",
          names,
        },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({ names });
}
