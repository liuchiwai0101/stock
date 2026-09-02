# Signal Desk

Paper-trading desk with an **institutional-grade 10-model ensemble**, **1-year walk-forward backtest**, and **self-verification** before any automated trade signal fires.

## Models (top-tier quant stack)

Each model forecasts log-price paths; the ensemble weights them by inverse walk-forward RMSE:

| Model | Category |
|-------|----------|
| Holt linear trend | Exponential smoothing |
| OLS log-price regression | Factor regression |
| AR(1) return model | Time series |
| Cross-sectional momentum | Quant factor |
| GARCH(1,1) vol forecast | Volatility modeling |
| Kalman local trend | State-space |
| ARIMA(1,1,0) | Time series |
| Ornstein–Uhlenbeck MR | Mean reversion |
| RiskMetrics EWMA (λ=0.94) | Risk parity |
| Vol regime switch | Regime detection |

## 1-year backtest gate

Before a ticker gets a tradable BUY/SELL (vs HOLD), it must pass a **252-day walk-forward backtest**:

- Direction hit rate ≥ 50%
- Sharpe ≥ 0.15 (per round-trip, annualized)
- Max drawdown ≤ 40%
- At least 3 round-trips in the test window

Failed tickers still show forecasts and allow **manual paper trades**, but automated signals stay blocked.

## Self-verification

```bash
npm test          # 17 unit/integration checks (models, ensemble, backtest, pipeline)
curl localhost:43123/api/verify   # same suite via HTTP
```

All checks must pass before the desk reports verification green.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:43123](http://localhost:43123).

## API

- `GET /api/run?symbols=AAPL,NVDA&horizon=21` — forecast + backtest + gated signal
- `GET /api/verify` — self-verification suite
- `GET /api/search?q=nvidia` — ticker lookup

Educational only — not investment advice.
