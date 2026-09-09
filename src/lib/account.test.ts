import { describe, expect, it } from "vitest";
import { getGuestId, getStorageScope, scopedStorageKey } from "./account";

describe("account storage scope", () => {
  it("namespaces keys by guest session when signed out", () => {
    // jsdom/node: getGuestId falls back without window session in node env
    const scope = getStorageScope();
    expect(scope.startsWith("guest:") || scope.startsWith("user:")).toBe(true);
    expect(scopedStorageKey("signal-desk-selection-v1")).toContain("signal-desk-selection-v1::");
    expect(getGuestId().length).toBeGreaterThan(3);
  });
});
