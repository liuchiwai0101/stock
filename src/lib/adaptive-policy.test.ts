import { describe, expect, it } from "vitest";
import { applyBoostsToWeights, defaultPolicy, updatePolicy } from "./adaptive-policy";

describe("adaptive policy", () => {
  it("upweights models with higher live hit rates", () => {
    const prev = defaultPolicy();
    const next = updatePolicy(prev, {
      samples: 20,
      liveHitRate: 0.65,
      modelHitRates: {
        holt: { hits: 12, n: 16 },
        ou: { hits: 2, n: 16 },
      },
      tradingWinRate: 0.6,
      tradingPnL: 800,
    });
    expect(next.modelBoosts.holt).toBeGreaterThan(next.modelBoosts.ou);
    expect(next.buyHurdleScale).toBeLessThan(1);
    expect(next.sizeScale).toBeGreaterThan(1);
  });

  it("raises the BUY hurdle when live hits are weak", () => {
    const next = updatePolicy(defaultPolicy(), {
      samples: 12,
      liveHitRate: 0.3,
      modelHitRates: {},
      tradingWinRate: 0.3,
      tradingPnL: -1200,
    });
    expect(next.buyHurdleScale).toBeGreaterThan(1);
    expect(next.sizeScale).toBeLessThan(1);
  });

  it("renormalizes boosted ensemble weights", () => {
    const weights = applyBoostsToWeights(
      {
        holt: 0.2,
        ols: 0.2,
        ar1: 0.1,
        momentum: 0.1,
        garch: 0.1,
        kalman: 0.1,
        arima: 0.05,
        ou: 0.05,
        ewma: 0.05,
        regime: 0.05,
      },
      { ...defaultPolicy().modelBoosts, holt: 2, ou: 0.5 },
    );
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
    expect(weights.holt).toBeGreaterThan(weights.ou);
  });
});
