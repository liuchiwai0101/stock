# Signal Desk

Paper-trading desk that **runs a price forecast** for the companies you pick, then lets you **trade the signals**.

The model is an ensemble of four classical time-series pieces, weighted by walk-forward error on recent history:

- Holt linear trend (double exponential smoothing on log prices)
- OLS log-price regression
- AR(1) on daily log returns
- 20/50 moving-average momentum

It projects a path over 1 week, 2 weeks, 1 month, or 1 quarter, with an 80% band from residual volatility, and turns that into BUY / HOLD / SELL plus a suggested position size.

Market data comes from Yahoo Finance (Stooq backup). If both feeds fail, the desk falls back to a simulated series so the UI still runs.

This is educational paper trading, not investment advice.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:43123](http://localhost:43123).

## Use it

1. Search a ticker or click a name (up to six on the blotter).
2. Pick a forecast horizon and wait for the run — or hit **Run model**.
3. Read the target, expected return, hit rate, and ensemble weights.
4. Buy/sell sized shares, **Execute signal**, or **Trade all signals**.
5. Positions and fills stay in this browser (`localStorage`). Reset restores $100,000 cash.

## API

`GET /api/run?symbols=AAPL,NVDA&horizon=21` — history + forecast + trade signal.

`GET /api/search?q=nvidia` — ticker lookup.
