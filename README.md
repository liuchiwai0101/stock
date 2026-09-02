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

## API

- `GET /api/run?symbols=AAPL,MSFT&horizon=21`
- `GET /api/verify?force=1`
- `GET /api/search?q=nvidia`

Educational paper trading only — not investment advice.
