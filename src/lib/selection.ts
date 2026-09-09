import { canonicalizeTicker } from "@/lib/ticker";
import type { Horizon } from "@/lib/types";
import { DEFAULT_SYMBOLS } from "@/lib/universe";
import { currentUser, scopedStorageKey } from "@/lib/account";
import { MAX_WATCHLIST_SYMBOLS, vinDefaultSelection } from "@/lib/vin-watchlist";

const STORAGE_BASE = "signal-desk-selection-v1";

export type SavedSelection = {
  symbols: string[];
  active: string;
  horizon: Horizon;
};

const HORIZONS: Horizon[] = [5, 10, 21, 63];

export function defaultSelection(): SavedSelection {
  const user = typeof window !== "undefined" ? currentUser() : null;
  if (user?.username === "Vin") {
    return vinDefaultSelection();
  }
  return {
    symbols: [...DEFAULT_SYMBOLS],
    active: DEFAULT_SYMBOLS[0],
    horizon: 21,
  };
}

function storageKey(): string {
  return typeof window === "undefined" ? STORAGE_BASE : scopedStorageKey(STORAGE_BASE);
}

function normalizeSymbols(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw
        .map((s) => canonicalizeTicker(String(s)))
        .filter(Boolean)
        .slice(0, MAX_WATCHLIST_SYMBOLS),
    ),
  ];
}

export function loadSelection(): SavedSelection {
  if (typeof window === "undefined") return defaultSelection();
  try {
    const raw =
      window.localStorage.getItem(storageKey()) ?? window.localStorage.getItem(STORAGE_BASE);
    if (!raw) return defaultSelection();
    const parsed = JSON.parse(raw) as Partial<SavedSelection>;
    const unique = normalizeSymbols(parsed.symbols);
    const list = unique.length ? unique : defaultSelection().symbols;
    const activeRaw = typeof parsed.active === "string" ? canonicalizeTicker(parsed.active) : "";
    const active = list.includes(activeRaw) ? activeRaw : list[0];
    const horizon = HORIZONS.includes(parsed.horizon as Horizon)
      ? (parsed.horizon as Horizon)
      : 21;
    return { symbols: list, active, horizon };
  } catch {
    return defaultSelection();
  }
}

export function saveSelection(selection: SavedSelection) {
  if (typeof window === "undefined") return;
  const payload: SavedSelection = {
    symbols: selection.symbols.slice(0, MAX_WATCHLIST_SYMBOLS),
    active: selection.active,
    horizon: selection.horizon,
  };
  window.localStorage.setItem(storageKey(), JSON.stringify(payload));
}

/** Merge symbols into the current scoped watchlist (Vin or guest). */
export function addSymbolsToWatchlist(symbols: string[]): SavedSelection {
  const current = loadSelection();
  const merged = [
    ...new Set([
      ...current.symbols,
      ...symbols.map((s) => canonicalizeTicker(s)).filter(Boolean),
    ]),
  ].slice(0, MAX_WATCHLIST_SYMBOLS);
  const next: SavedSelection = {
    symbols: merged,
    active: merged.includes(current.active) ? current.active : (merged[0] ?? current.active),
    horizon: current.horizon,
  };
  saveSelection(next);
  return next;
}

/** Ensure Vin's Futu-derived watchlist is present on this device scope. */
export function ensureVinWatchlistSeeded(): SavedSelection | null {
  const user = currentUser();
  if (!user || user.username !== "Vin") return null;
  const seeded = vinDefaultSelection();
  const existingRaw = window.localStorage.getItem(storageKey());
  if (!existingRaw) {
    saveSelection(seeded);
    return seeded;
  }
  // Always ensure Futu US names are on Vin's list (additive).
  return addSymbolsToWatchlist([...seeded.symbols]);
}
