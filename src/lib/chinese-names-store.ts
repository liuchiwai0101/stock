import { CHINESE_NAMES } from "@/lib/chinese-names";

const STORAGE_KEY = "signal-desk-chinese-names-v1";

type RuntimeCache = Record<string, string>;

let runtimeCache: RuntimeCache | null = null;
let mergedSnapshot: RuntimeCache = { ...CHINESE_NAMES };
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function loadRuntimeCache(): RuntimeCache {
  if (runtimeCache) return runtimeCache;
  if (typeof window === "undefined") {
    runtimeCache = {};
    return runtimeCache;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    runtimeCache = raw ? (JSON.parse(raw) as RuntimeCache) : {};
  } catch {
    runtimeCache = {};
  }
  return runtimeCache;
}

function refreshMergedSnapshot() {
  mergedSnapshot = { ...CHINESE_NAMES, ...loadRuntimeCache() };
}

function saveRuntimeCache(cache: RuntimeCache) {
  runtimeCache = cache;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  }
  refreshMergedSnapshot();
  emit();
}

export function subscribeChineseNames(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Stable reference for useSyncExternalStore — only changes when names are merged. */
export function getMergedChineseNames(): RuntimeCache {
  if (typeof window !== "undefined" && runtimeCache === null) {
    refreshMergedSnapshot();
  }
  return mergedSnapshot;
}

export function mergeChineseNames(names: Record<string, string>) {
  const next = { ...loadRuntimeCache() };
  let changed = false;
  for (const [symbol, name] of Object.entries(names)) {
    const key = symbol.trim().toUpperCase();
    const clean = name.trim();
    if (!key || !clean) continue;
    if (next[key] !== clean) {
      next[key] = clean;
      changed = true;
    }
  }
  if (changed) saveRuntimeCache(next);
}

const inflight = new Map<string, Promise<void>>();

export async function ensureChineseNames(symbols: string[]) {
  if (typeof window === "undefined") return;

  const merged = getMergedChineseNames();
  const missing = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))].filter(
    (s) => !merged[s],
  );
  if (missing.length === 0) return;

  const batchKey = missing.sort().join(",");
  const existing = inflight.get(batchKey);
  if (existing) return existing;

  const job = (async () => {
    const chunkSize = 50;
    for (let i = 0; i < missing.length; i += chunkSize) {
      const chunk = missing.slice(i, i + chunkSize);
      const res = await fetch(`/api/chinese-names?symbols=${encodeURIComponent(chunk.join(","))}`, {
        cache: "no-store",
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { names?: Record<string, string> };
      if (json.names) mergeChineseNames(json.names);
    }
  })().finally(() => {
    inflight.delete(batchKey);
  });

  inflight.set(batchKey, job);
  return job;
}
