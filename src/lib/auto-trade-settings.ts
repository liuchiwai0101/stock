import { scopedStorageKey } from "@/lib/account";

const STORAGE_BASE = "signal-desk-auto-trade-v1";

export type AutoTradeSettings = {
  enabled: boolean;
  minHitRate: number;
  minExpectedReturn: number;
  maxPositions: number;
  maxWeight: number;
  cashReserve: number;
  sellOnSellSignal: boolean;
  sellOnHoldSignal: boolean;
};

export const DEFAULT_AUTO_TRADE_SETTINGS: AutoTradeSettings = {
  enabled: false,
  minHitRate: 0.48,
  minExpectedReturn: 0.02,
  maxPositions: 8,
  maxWeight: 0.12,
  cashReserve: 5_000,
  sellOnSellSignal: true,
  sellOnHoldSignal: false,
};

function storageKey() {
  return typeof window === "undefined" ? STORAGE_BASE : scopedStorageKey(STORAGE_BASE);
}

export function loadAutoTradeSettings(): AutoTradeSettings {
  if (typeof window === "undefined") return { ...DEFAULT_AUTO_TRADE_SETTINGS };
  try {
    const raw = window.localStorage.getItem(storageKey());
    if (!raw) return { ...DEFAULT_AUTO_TRADE_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AutoTradeSettings>;
    return {
      enabled: Boolean(parsed.enabled),
      minHitRate:
        typeof parsed.minHitRate === "number" ? parsed.minHitRate : DEFAULT_AUTO_TRADE_SETTINGS.minHitRate,
      minExpectedReturn:
        typeof parsed.minExpectedReturn === "number"
          ? parsed.minExpectedReturn
          : DEFAULT_AUTO_TRADE_SETTINGS.minExpectedReturn,
      maxPositions:
        typeof parsed.maxPositions === "number"
          ? Math.max(1, Math.floor(parsed.maxPositions))
          : DEFAULT_AUTO_TRADE_SETTINGS.maxPositions,
      maxWeight:
        typeof parsed.maxWeight === "number" ? parsed.maxWeight : DEFAULT_AUTO_TRADE_SETTINGS.maxWeight,
      cashReserve:
        typeof parsed.cashReserve === "number"
          ? parsed.cashReserve
          : DEFAULT_AUTO_TRADE_SETTINGS.cashReserve,
      sellOnSellSignal:
        typeof parsed.sellOnSellSignal === "boolean"
          ? parsed.sellOnSellSignal
          : DEFAULT_AUTO_TRADE_SETTINGS.sellOnSellSignal,
      sellOnHoldSignal:
        typeof parsed.sellOnHoldSignal === "boolean"
          ? parsed.sellOnHoldSignal
          : DEFAULT_AUTO_TRADE_SETTINGS.sellOnHoldSignal,
    };
  } catch {
    return { ...DEFAULT_AUTO_TRADE_SETTINGS };
  }
}

export function saveAutoTradeSettings(settings: AutoTradeSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(), JSON.stringify(settings));
}
