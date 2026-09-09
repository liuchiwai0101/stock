"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  CAPTURE_HOUR,
  CAPTURE_MINUTE,
  CAPTURE_TIMEZONE,
  dateKeyInTimeZone,
  shouldRunDailyCapture,
} from "@/lib/market-hours";
import { appendPnlSnapshot, snapshotDateKey } from "@/lib/pnl-snapshots";
import { computeBookPnL } from "@/lib/pnl";
import { runLearnCycle } from "@/lib/learn-cycle";
import { hasCaptureForDate } from "@/lib/scan-history";
import { runFullUsScan } from "@/lib/run-us-scan";
import { loadPortfolio } from "@/lib/trading";
import type { Horizon } from "@/lib/types";

type DailyCaptureState = {
  capturing: boolean;
  lastCaptureDate: string | null;
  lastError: string | null;
  progress: { processed: number; total: number; passed: number; buyCount: number } | null;
  triggerCapture: () => Promise<void>;
};

const DailyCaptureContext = createContext<DailyCaptureState | null>(null);

const DEFAULT_HORIZON: Horizon = 21;

function savePnlSnapshotForToday(marks: Record<string, number> = {}) {
  const portfolio = loadPortfolio();
  const book = computeBookPnL(portfolio, marks);
  appendPnlSnapshot({
    date: snapshotDateKey(),
    at: new Date().toISOString(),
    equity: book.equity,
    cash: book.cash,
    totalPnL: book.totalPnL,
    unrealizedPnL: book.unrealizedPnL,
    realizedPnL: book.realizedPnL,
    positionCount: portfolio.positions.length,
  });
}

export function DailyCaptureProvider({ children }: { children: React.ReactNode }) {
  const [capturing, setCapturing] = useState(false);
  const [lastCaptureDate, setLastCaptureDate] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [progress, setProgress] = useState<DailyCaptureState["progress"]>(null);
  const runningRef = useRef(false);
  const lastTickRef = useRef<string | null>(null);

  const triggerCapture = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setCapturing(true);
    setLastError(null);
    try {
      await runLearnCycle();
      const { scan } = await runFullUsScan(DEFAULT_HORIZON, setProgress);
      setLastCaptureDate(scan.date);
      savePnlSnapshotForToday();
    } catch (err) {
      setLastError(err instanceof Error ? err.message : "Daily capture failed");
    } finally {
      setCapturing(false);
      setProgress(null);
      runningRef.current = false;
    }
  }, []);

  useEffect(() => {
    void runLearnCycle().catch(() => undefined);
    const tick = () => {
      const now = new Date();
      const dateKey = dateKeyInTimeZone(now, CAPTURE_TIMEZONE);
      const minuteKey = `${dateKey}T${CAPTURE_HOUR}:${CAPTURE_MINUTE}`;

      if (!shouldRunDailyCapture(now)) return;
      if (lastTickRef.current === minuteKey) return;
      if (hasCaptureForDate(dateKey)) {
        lastTickRef.current = minuteKey;
        return;
      }

      lastTickRef.current = minuteKey;
      void triggerCapture();
    };

    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [triggerCapture]);

  return (
    <DailyCaptureContext.Provider
      value={{ capturing, lastCaptureDate, lastError, progress, triggerCapture }}
    >
      {children}
    </DailyCaptureContext.Provider>
  );
}

export function useDailyCapture() {
  const ctx = useContext(DailyCaptureContext);
  if (!ctx) {
    throw new Error("useDailyCapture must be used within DailyCaptureProvider");
  }
  return ctx;
}

export function useDailyCaptureOptional() {
  return useContext(DailyCaptureContext);
}
