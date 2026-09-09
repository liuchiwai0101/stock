"use client";

import {
  currentUser,
  getStorageScope,
  loginAccount,
  logoutAccount,
  type AccountUser,
} from "@/lib/account";
import { STATIC_DESK } from "@/lib/static-mode";

let cachedUser: AccountUser | null | undefined;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeAccount(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAccountSnapshot(): AccountUser | null {
  if (cachedUser !== undefined) return cachedUser;
  cachedUser = currentUser();
  return cachedUser;
}

export function getServerAccountSnapshot(): AccountUser | null {
  return null;
}

function setUser(user: AccountUser | null) {
  cachedUser = user;
  emit();
}

async function syncRemote(action: "login" | "logout", body?: Record<string, string>) {
  if (STATIC_DESK) return null;
  try {
    const res = await fetch("/api/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    if (!res.ok) return null;
    return (await res.json()) as { user?: AccountUser };
  } catch {
    return null;
  }
}

export async function loginAndSync(username: string, password: string): Promise<AccountUser> {
  const user = await loginAccount(username, password);
  setUser(user);
  await syncRemote("login", { username, password });
  await pullUserData();
  return user;
}

export async function logoutAndSync() {
  logoutAccount();
  setUser(null);
  await syncRemote("logout");
}

export async function pushUserData() {
  if (STATIC_DESK || typeof window === "undefined") return;
  const user = getAccountSnapshot();
  if (!user) return;
  try {
    const { loadSelection } = await import("@/lib/selection");
    const { loadSavedScan } = await import("@/lib/scan-cache");
    const { loadScanHistory } = await import("@/lib/scan-history");
    await fetch("/api/account/data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selection: loadSelection(),
        scan: loadSavedScan(),
        scanHistory: loadScanHistory(),
        scope: getStorageScope(),
      }),
    });
  } catch {
    // Local storage remains the source of truth offline.
  }
}

export async function pullUserData() {
  if (STATIC_DESK || typeof window === "undefined") return;
  const user = getAccountSnapshot();
  if (!user) return;
  try {
    const res = await fetch("/api/account/data", { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as {
      selection?: { symbols: string[]; active: string; horizon: number };
      scan?: unknown;
      scanHistory?: unknown;
    };
    if (json.selection) {
      const { saveSelection } = await import("@/lib/selection");
      saveSelection({
        symbols: json.selection.symbols,
        active: json.selection.active,
        horizon: json.selection.horizon as 5 | 10 | 21 | 63,
      });
    }
    if (json.scan) {
      const { saveSavedScan } = await import("@/lib/scan-cache");
      saveSavedScan(json.scan as Parameters<typeof saveSavedScan>[0]);
    }
    if (Array.isArray(json.scanHistory)) {
      const { replaceScanHistory } = await import("@/lib/scan-history");
      replaceScanHistory(json.scanHistory as Parameters<typeof replaceScanHistory>[0]);
    }
  } catch {
    // Keep local data.
  }
}

export async function pushGuestScan(scan: unknown) {
  if (STATIC_DESK || typeof window === "undefined") return;
  try {
    await fetch("/api/session-scan", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: getStorageScope(), scan }),
    });
  } catch {
    // ignore
  }
}
