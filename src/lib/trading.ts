import type { Fill, Portfolio, Position } from "@/lib/types";

export const STARTING_CASH = 100_000;
export const FEE_BPS = 5;

const STORAGE_KEY = "signal-desk-portfolio-v1";
const EMPTY_BOOK: Portfolio = { cash: STARTING_CASH, positions: [], fills: [] };

let cachedRaw: string | null | undefined;
let cachedPortfolio: Portfolio = EMPTY_BOOK;

export function emptyPortfolio(): Portfolio {
  return { cash: STARTING_CASH, positions: [], fills: [] };
}

export function serverPortfolio(): Portfolio {
  return EMPTY_BOOK;
}

export function loadPortfolio(): Portfolio {
  if (typeof window === "undefined") return emptyPortfolio();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedPortfolio;
  cachedRaw = raw;
  if (!raw) {
    cachedPortfolio = emptyPortfolio();
    return cachedPortfolio;
  }
  try {
    const parsed = JSON.parse(raw) as Portfolio;
    if (!parsed || typeof parsed.cash !== "number") {
      cachedPortfolio = emptyPortfolio();
      return cachedPortfolio;
    }
    cachedPortfolio = {
      cash: parsed.cash,
      positions: parsed.positions ?? [],
      fills: parsed.fills ?? [],
    };
    return cachedPortfolio;
  } catch {
    cachedPortfolio = emptyPortfolio();
    return cachedPortfolio;
  }
}

export function savePortfolio(portfolio: Portfolio) {
  const raw = JSON.stringify(portfolio);
  window.localStorage.setItem(STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedPortfolio = portfolio;
}

function fee(notional: number): number {
  return Math.abs(notional) * (FEE_BPS / 10_000);
}

export type TradeRequest = {
  symbol: string;
  name: string;
  side: "BUY" | "SELL";
  shares: number;
  price: number;
  note?: string;
};

export type TradeResult =
  | { ok: true; portfolio: Portfolio; fill: Fill }
  | { ok: false; message: string; portfolio: Portfolio };

export type AggregatedTrade = {
  symbol: string;
  name: string;
  buyShares: number;
  sellShares: number;
  netShares: number;
  buyNotional: number;
  sellNotional: number;
  avgBuyPrice: number | null;
  avgSellPrice: number | null;
  fillCount: number;
  lastAt: string;
};

export function aggregateTradesBySymbol(fills: Fill[]): AggregatedTrade[] {
  const bySymbol = new Map<string, AggregatedTrade>();

  for (const fill of fills) {
    const existing = bySymbol.get(fill.symbol);
    const row: AggregatedTrade = existing ?? {
      symbol: fill.symbol,
      name: fill.name,
      buyShares: 0,
      sellShares: 0,
      netShares: 0,
      buyNotional: 0,
      sellNotional: 0,
      avgBuyPrice: null,
      avgSellPrice: null,
      fillCount: 0,
      lastAt: fill.at,
    };

    row.fillCount += 1;
    if (fill.at > row.lastAt) {
      row.lastAt = fill.at;
      row.name = fill.name;
    }

    if (fill.side === "BUY") {
      row.buyShares += fill.shares;
      row.buyNotional += fill.notional;
    } else {
      row.sellShares += fill.shares;
      row.sellNotional += fill.notional;
    }

    row.netShares = row.buyShares - row.sellShares;
    row.avgBuyPrice = row.buyShares > 0 ? row.buyNotional / row.buyShares : null;
    row.avgSellPrice = row.sellShares > 0 ? row.sellNotional / row.sellShares : null;
    bySymbol.set(fill.symbol, row);
  }

  return [...bySymbol.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export function applyTrade(portfolio: Portfolio, req: TradeRequest): TradeResult {
  const shares = Math.floor(req.shares);
  if (shares <= 0) return { ok: false, message: "Share count must be at least 1.", portfolio };
  if (!(req.price > 0)) return { ok: false, message: "Price is unavailable.", portfolio };

  const notional = shares * req.price;
  const cost = fee(notional);
  const existing = portfolio.positions.find((p) => p.symbol === req.symbol);

  if (req.side === "BUY") {
    const needed = notional + cost;
    if (needed > portfolio.cash + 1e-6) {
      return { ok: false, message: "Not enough cash for this buy.", portfolio };
    }
    const nextPositions: Position[] = existing
      ? portfolio.positions.map((p) =>
          p.symbol === req.symbol
            ? {
                ...p,
                avgPrice: (p.avgPrice * p.shares + notional) / (p.shares + shares),
                shares: p.shares + shares,
              }
            : p
        )
      : [
          ...portfolio.positions,
          {
            symbol: req.symbol,
            name: req.name,
            shares,
            avgPrice: req.price,
            openedAt: new Date().toISOString(),
          },
        ];
    const fill: Fill = {
      id: crypto.randomUUID(),
      symbol: req.symbol,
      name: req.name,
      side: "BUY",
      shares,
      price: req.price,
      notional,
      at: new Date().toISOString(),
      note: req.note ?? "Paper buy",
    };
    return {
      ok: true,
      fill,
      portfolio: {
        cash: portfolio.cash - needed,
        positions: nextPositions,
        fills: [fill, ...portfolio.fills],
      },
    };
  }

  const held = existing?.shares ?? 0;
  if (held < shares) {
    return { ok: false, message: `You only hold ${held} shares of ${req.symbol}.`, portfolio };
  }
  const proceeds = notional - cost;
  const remaining = held - shares;
  const nextPositions =
    remaining === 0
      ? portfolio.positions.filter((p) => p.symbol !== req.symbol)
      : portfolio.positions.map((p) => (p.symbol === req.symbol ? { ...p, shares: remaining } : p));
  const fill: Fill = {
    id: crypto.randomUUID(),
    symbol: req.symbol,
    name: req.name,
    side: "SELL",
    shares,
    price: req.price,
    notional,
    at: new Date().toISOString(),
    note: req.note ?? "Paper sell",
  };
  return {
    ok: true,
    fill,
    portfolio: {
      cash: portfolio.cash + proceeds,
      positions: nextPositions,
      fills: [fill, ...portfolio.fills],
    },
  };
}

export function equity(portfolio: Portfolio, marks: Record<string, number>): number {
  const stock = portfolio.positions.reduce((sum, p) => sum + p.shares * (marks[p.symbol] ?? p.avgPrice), 0);
  return portfolio.cash + stock;
}

export function sharesForWeight(equityValue: number, price: number, weight: number): number {
  if (price <= 0) return 0;
  const dollars = Math.abs(weight) * equityValue;
  return Math.max(0, Math.floor(dollars / price));
}

export function sharesFromNotional(notional: number, price: number): number {
  if (!(price > 0) || !(notional > 0)) return 0;
  return Math.floor(notional / price);
}

export function resetPortfolio(): Portfolio {
  const current = typeof window !== "undefined" ? loadPortfolio() : emptyPortfolio();
  const next: Portfolio = {
    cash: STARTING_CASH,
    positions: [],
    fills: current.fills,
  };
  if (typeof window !== "undefined") savePortfolio(next);
  return next;
}
