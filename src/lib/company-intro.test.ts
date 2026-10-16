import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCompanyIntro } from "@/lib/company-intro";

describe("fetchCompanyIntro", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("falls back to a local market intro when Wikipedia is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({}),
      })),
    );

    const intro = await fetchCompanyIntro("MPC", "Marathon Petroleum");
    expect(intro.symbol).toBe("MPC");
    expect(intro.market).toBe("美股");
    expect(intro.source).toBe("local");
    expect(intro.summary).toContain("MPC");
  });
});
