# Signal Desk

Institutional-grade stock forecast desk with **10 quant models**, **1-year walk-forward backtest**, and **self-verification** before automated signals fire.

## Models

| ID | Model | Category |
|----|-------|----------|
| holt | Holt linear trend | Exponential smoothing |
| ols | OLS log-price regression | Factor regression |
| ar1 | AR(1) return model | Time series |
| momentum | Cross-sectional momentum | Quant factor |
| garch | GARCH(1,1) vol forecast | Volatility modeling |
| kalman | Kalman local trend | State-space |
| arima | ARIMA(1,1,0) | Time series |
| ou | Ornstein–Uhlenbeck MR | Mean reversion |
| ewma | RiskMetrics EWMA | Risk parity |
| regime | Vol regime switch | Regime detection |

Ensemble weights = inverse walk-forward RMSE (softmax).

## 1-year backtest gate

Long-only walk-forward over 252 trading days (rebalance every 14 sessions). A ticker is **trade-ready** when it passes **any** of:

1. All strict gates (direction ≥48%, Sharpe ≥0.10, max DD ≤35%, ≥2 round-trips)
2. **Alpha path** — beats benchmark with ≥1 round-trip and direction ≥48%
3. **Accuracy path** — ≥55% direction hit with ≥2 round-trips and DD ≤35%

Failed tickers still show forecasts; automated signals stay **HOLD** until backtest clears.

## Self-verification

```bash
npm test                 # 17 checks — models, ensemble, backtest, pipeline
curl localhost:43123/api/verify
```

## Review on GitHub

Live site: **[https://liuchiwai0101.github.io/stock/](https://liuchiwai0101.github.io/stock/)**

GitHub Pages publishes from **`main`** / **`docs/`**. In the repo: **Settings → Pages → Deploy from a branch → `main` / `/docs`**.

The desk is a static app. Quotes are snapshotted at deploy time; the 10 models still run in your browser (watchlist, US buy scan, paper trades).

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:43123](http://localhost:43123).

- Desk (`/`) — forecasts, ticker selection (saved in the browser), paper trades
- **Scan US buys** — scans the liquid U.S. universe, keeps only 1-year backtest **Pass** + ensemble **BUY**, sorted by model hit rate (high → low)
- Trade records (`/trades`) — full list of every saved fill

## API

- `GET /api/run?symbols=AAPL,MSFT&horizon=21`
- `GET /api/scan?horizon=21` — U.S. buy list (pass + BUY, hit-rate sorted)
- `GET /api/verify?force=1`
- `GET /api/search?q=nvidia`

Educational paper trading only — not investment advice.
