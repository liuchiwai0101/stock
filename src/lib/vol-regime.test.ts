import { describe, expect, it } from "vitest";
import { volRegimeFromCloses } from "./vol-regime";

describe("volRegimeFromCloses", () => {
  it("labels a quiet path as calm", () => {
    const closes = Array.from({ length: 80 }, (_, i) => 100 + i * 0.1);
    expect(volRegimeFromCloses(closes)).toBe("calm");
  });

  it("labels a late spike as high vol", () => {
    const closes = [
      ...Array.from({ length: 60 }, (_, i) => 100 + (i % 2) * 0.2),
      ...Array.from({ length: 20 }, (_, i) => 100 + (i % 2 === 0 ? 8 : -8)),
    ];
    expect(volRegimeFromCloses(closes)).toBe("high");
  });
});
