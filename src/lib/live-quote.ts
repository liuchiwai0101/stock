import type { CompanyForecast } from "@/lib/types";

export type LiveMark = {
  symbol: string;
  last: number;
  changePct: number;
  at: string;
};

/** Overlay a fresh last price onto a forecast row without rerunning models. Deploy nudge after PR #17. */
export function applyLiveQuote(quote: CompanyForecast, live: LiveMark): CompanyForecast {
  if (!(live.last > 0)) return quote;
  const history = quote.history.map((b) => ({ ...b }));
  const lastBar = history[history.length - 1];
  if (lastBar && live.at && live.at >= lastBar.date) {
    if (live.at === lastBar.date) {
      history[history.length - 1] = { ...lastBar, close: live.last };
    } else {
      history.push({
        date: live.at,
        close: live.last,
        open: live.last,
        high: live.last,
        low: live.last,
        volume: 0,
      });
    }
  }
  return {
    ...quote,
    last: Math.round(live.last * 100) / 100,
    changePct: live.changePct,
    history,
    expectedReturn: live.last > 0 ? quote.targetPrice / live.last - 1 : quote.expectedReturn,
  };
}
