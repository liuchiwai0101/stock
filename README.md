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

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:43123](http://localhost:43123).

## Run on GitHub

This app uses Next.js API routes (`/api/run`, `/api/scan`, etc.), so it needs a Node.js server. GitHub Pages (static hosting) is not supported.

### GitHub Codespaces (recommended)

1. Open the repo on GitHub and click **Code** → **Codespaces** → **Create codespace on main**
2. Wait for `npm ci` to finish, then the dev server starts on port **43123**
3. Open the forwarded port when prompted (or use the **Ports** tab)

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/liuchiwai0101/stock)

### GitHub Actions CI

Every push and pull request to `main` runs lint, tests, and a production build via [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

### Docker (GitHub Container Registry)

After merging to `main`, GitHub Actions publishes a container image to:

`ghcr.io/liuchiwai0101/stock:main`

Run it locally:

```bash
docker run --rm -p 43123:43123 ghcr.io/liuchiwai0101/stock:main
```

Then open [http://localhost:43123](http://localhost:43123).

- Desk (`/`) — forecasts, ticker selection (saved in the browser), paper trades
- **Scan US buys** — scans the liquid U.S. universe, keeps only 1-year backtest **Pass** + ensemble **BUY**, sorted by model hit rate (high → low)
- Trade records (`/trades`) — full list of every saved fill

## API

- `GET /api/run?symbols=AAPL,MSFT&horizon=21`
- `GET /api/scan?horizon=21` — U.S. buy list (pass + BUY, hit-rate sorted)
- `GET /api/verify?force=1`
- `GET /api/search?q=nvidia`

Educational paper trading only — not investment advice.
