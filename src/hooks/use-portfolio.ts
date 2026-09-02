"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import {
  applyTrade,
  equity,
  loadPortfolio,
  resetPortfolio,
  savePortfolio,
  serverPortfolio,
  type TradeRequest,
} from "@/lib/trading";
import type { Portfolio } from "@/lib/types";

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function persist(next: Portfolio) {
  savePortfolio(next);
  emit();
}

export function usePortfolio(marks: Record<string, number>) {
  const portfolio = useSyncExternalStore(subscribe, loadPortfolio, serverPortfolio);
  const [message, setMessage] = useState<string | null>(null);

  const trade = useCallback((req: TradeRequest) => {
    const result = applyTrade(loadPortfolio(), req);
    if (!result.ok) {
      setMessage(result.message);
      return result;
    }
    persist(result.portfolio);
    setMessage(
      `${req.side === "BUY" ? "Bought" : "Sold"} ${req.shares} ${req.symbol} @ ${req.price.toFixed(2)}`
    );
    return result;
  }, []);

  const tradeMany = useCallback((reqs: TradeRequest[]) => {
    let current = loadPortfolio();
    let filled = 0;
    const notes: string[] = [];
    for (const req of reqs) {
      const result = applyTrade(current, req);
      if (result.ok) {
        current = result.portfolio;
        filled += 1;
      } else {
        notes.push(result.message);
      }
    }
    persist(current);
    if (filled === 0) {
      setMessage(notes[0] ?? "No signals were tradable.");
    } else {
      setMessage(`Filled ${filled} paper ${filled === 1 ? "order" : "orders"} from the model.`);
    }
  }, []);

  const reset = useCallback(() => {
    persist(resetPortfolio());
    setMessage("Paper book reset to $100,000 cash.");
  }, []);

  return {
    portfolio,
    equity: equity(portfolio, marks),
    trade,
    tradeMany,
    notify: setMessage,
    reset,
    message,
    clearMessage: () => setMessage(null),
  };
}
