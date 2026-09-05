import { describe, expect, it } from "vitest";
import {
  AUTO_TRADE_MIN_SAMPLES,
  applyBoostsToWeights,
  canAutoTrade,
  defaultPolicy,
  updatePolicy,
  type PolicyUpdateInput,
} from "./adaptive-policy";

function input(overrides: Partial<PolicyUpdateInput> = {}): PolicyUpdateInput {
  return {
    samples: 20,
    liveHitRate: 0.5,
    horizonSamples: 0,
    horizonHitRate: 0.5,
    modelHitRates: {},
    modelHitRatesCalm: {},
    modelHitRatesHigh: {},
    tradingWinRate: 0.5,
    tradingPnL: 0,
    ...overrides,
  };
}

describe("adaptive policy", () => {
  it("upweights models with higher live hit rates and grows size after the sample gate", () => {
    const next = updatePolicy(
      defaultPolicy(),
      input({
        samples: AUTO_TRADE_MIN_SAMPLES,
        liveHitRate: 0.65,
        modelHitRates: {
          holt: { hits: 12, n: 16 },
          ou: { hits: 2, n: 16 },
        },
        modelHitRatesCalm: {
          holt: { hits: 10, n: 12 },
          ou: { hits: 1, n: 12 },
        },
        tradingWinRate: 0.6,
        tradingPnL: 800,
      }),
    );
    expect(next.modelBoosts.holt).toBeGreaterThan(next.modelBoosts.ou);
    expect(next.modelBoostsCalm.holt).toBeGreaterThan(next.modelBoostsCalm.ou);
    expect(next.buyHurdleScale).toBeLessThan(1);
    expect(next.sizeScale).toBeGreaterThan(1);
  });

  it("raises the BUY hurdle when live hits are weak but freezes size until 25 samples", () => {
    const next = updatePolicy(
      defaultPolicy(),
      input({
        samples: 12,
        liveHitRate: 0.3,
        tradingWinRate: 0.3,
        tradingPnL: -1200,
      }),
    );
    expect(next.buyHurdleScale).toBeGreaterThan(1);
    expect(next.sizeScale).toBe(1);
  });

  it("locks batch auto-trade until 25 scored calls and 48% live hit", () => {
    const locked = defaultPolicy();
    expect(canAutoTrade(locked)).toBe(false);
    expect(
      canAutoTrade({
        ...locked,
        samples: AUTO_TRADE_MIN_SAMPLES,
        liveHitRate: 0.4,
      }),
    ).toBe(false);
    expect(
      canAutoTrade({
        ...locked,
        samples: AUTO_TRADE_MIN_SAMPLES,
        liveHitRate: 0.48,
      }),
    ).toBe(true);
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
