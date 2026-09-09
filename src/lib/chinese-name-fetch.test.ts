import { describe, expect, it } from "vitest";

function parseTencentLine(line: string): { symbol: string; name: string } | null {
  const match = line.match(/v_us([A-Z0-9.^]+)="([^"]+)"/);
  if (!match) return null;
  const parts = match[2].split("~");
  const name = parts[1]?.trim();
  if (!name) return null;
  return { symbol: match[1].toUpperCase(), name };
}

describe("Tencent Chinese name parser", () => {
  it("extracts symbol and Chinese name from quote line", () => {
    const line =
      'v_usINLF="200~因立夫~INLF.OQ~3.71~3.68~3.78~20155~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~~2026-09-04 09:34:19~0.03~0.76~3.78~3.71~USD~20155~75771~1.85~-0.00~~-0.00~~1.96~0.03879~0.04043~Inlif Limited~-1056.00~4544.00~2.12~0~0.25~~0.04043~-99.76~-3.69~GP~-41.26~-25.19~-21.77~-17.78~-99.54~1090298~1046046~21.64~-0.00~~3.76~~~";';
    expect(parseTencentLine(line)).toEqual({ symbol: "INLF", name: "因立夫" });
  });
});
