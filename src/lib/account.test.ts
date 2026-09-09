import { describe, expect, it } from "vitest";
import { getGuestId, getStorageScope, scopedStorageKey } from "./account";
import {
  defaultPasswordFor,
  findHardcodedAccount,
  listHardcodedUsernames,
  verifyHardcodedPassword,
} from "./hardcoded-accounts";

describe("account storage scope", () => {
  it("namespaces keys by guest session when signed out", () => {
    const scope = getStorageScope();
    expect(scope.startsWith("guest:") || scope.startsWith("user:")).toBe(true);
    expect(scopedStorageKey("signal-desk-selection-v1")).toContain("signal-desk-selection-v1::");
    expect(getGuestId().length).toBeGreaterThan(3);
  });
});

describe("hardcoded accounts", () => {
  it("includes Vin with password Vin123", () => {
    expect(listHardcodedUsernames()).toContain("Vin");
    expect(findHardcodedAccount("vin")?.username).toBe("Vin");
    expect(defaultPasswordFor("Vin")).toBe("Vin123");
    expect(verifyHardcodedPassword("Vin", "Vin123")).toBe(true);
    expect(verifyHardcodedPassword("Vin", "wrong")).toBe(false);
  });
});
