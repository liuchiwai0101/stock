import type { VerificationSummary } from "@/lib/types";
import { runVerificationSuite } from "@/lib/verification";

let cached: VerificationSummary | null = null;
let cachedAt = 0;
const TTL_MS = 60_000;

export function getVerificationSummary(force = false): VerificationSummary {
  const now = Date.now();
  if (!force && cached && now - cachedAt < TTL_MS) return cached;
  cached = runVerificationSuite();
  cachedAt = now;
  return cached;
}

export function clearVerificationCache() {
  cached = null;
  cachedAt = 0;
}
