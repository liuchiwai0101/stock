import type { Horizon } from "@/lib/types";
import { DEFAULT_SYMBOLS } from "@/lib/universe";

const STORAGE_KEY = "signal-desk-selection-v1";

export type SavedSelection = {
  symbols: string[];
  active: string;
  horizon: Horizon;
};

const HORIZONS: Horizon[] = [5, 10, 21, 63];

export function defaultSelection(): SavedSelection {
  return {
    symbols: [...DEFAULT_SYMBOLS],
    active: DEFAULT_SYMBOLS[0],
    horizon: 21,
  };
}

export function loadSelection(): SavedSelection {
  if (typeof window === "undefined") return defaultSelection();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSelection();
    const parsed = JSON.parse(raw) as Partial<SavedSelection>;
    const symbols = Array.isArray(parsed.symbols)
      ? parsed.symbols
          .map((s) => String(s).trim().toUpperCase())
          .filter(Boolean)
          .slice(0, 6)
      : DEFAULT_SYMBOLS;
    const unique = [...new Set(symbols)];
    const list = unique.length ? unique : [...DEFAULT_SYMBOLS];
    const active =
      typeof parsed.active === "string" && list.includes(parsed.active.toUpperCase())
        ? parsed.active.toUpperCase()
        : list[0];
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
    symbols: selection.symbols.slice(0, 6),
    active: selection.active,
    horizon: selection.horizon,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}
