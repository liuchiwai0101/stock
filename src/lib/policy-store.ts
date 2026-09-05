import { POLICY_COOKIE, compactPolicy, expandPolicy, type AdaptivePolicy, type CompactPolicy } from "@/lib/adaptive-policy";

const STORAGE_KEY = "signal-desk-adaptive-policy-v1";

let cached: AdaptivePolicy | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribePolicy(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function loadPolicy(): AdaptivePolicy {
  if (cached) return cached;
  if (typeof window === "undefined") {
    cached = expandPolicy(null);
    return cached;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cached = expandPolicy(null);
      return cached;
    }
    const parsed = JSON.parse(raw) as AdaptivePolicy;
    if (parsed.version === 1 && parsed.modelBoosts) {
      cached = parsed;
      return cached;
    }
    cached = expandPolicy(parsed as unknown as CompactPolicy);
  } catch {
    cached = expandPolicy(null);
  }
  return cached;
}

export function savePolicy(policy: AdaptivePolicy) {
  cached = policy;
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(policy));
  const compact = encodeURIComponent(JSON.stringify(compactPolicy(policy)));
  document.cookie = `${POLICY_COOKIE}=${compact}; path=/; max-age=31536000; SameSite=Lax`;
  emit();
}

export function getServerSnapshotPolicy(): AdaptivePolicy {
  return expandPolicy(null);
}

export function parsePolicyCookie(value: string | undefined): AdaptivePolicy {
  if (!value) return expandPolicy(null);
  try {
    return expandPolicy(JSON.parse(decodeURIComponent(value)) as CompactPolicy);
  } catch {
    return expandPolicy(null);
  }
}
