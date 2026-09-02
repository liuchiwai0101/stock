export type Horizon = 5 | 10 | 21 | 63;

export type DataSource = "yahoo" | "stooq" | "simulated";

export type Bar = {
  date: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
};

export type ForecastPoint = {
  date: string;
  mean: number;
  lo: number;
  hi: number;
};

export type ModelWeights = {
  holt: number;
  ols: number;
  ar1: number;
  momentum: number;
};

export type ModelMetrics = {
  rmse: number;
  mape: number;
  hitRate: number;
  residualVol: number;
};

export type TradeSignal = "BUY" | "SELL" | "HOLD";

export type CompanyForecast = {
  symbol: string;
  name: string;
  currency: string;
  last: number;
  changePct: number;
  source: DataSource;
  history: Bar[];
  forecast: ForecastPoint[];
  targetPrice: number;
  expectedReturn: number;
  annualizedReturn: number;
  signal: TradeSignal;
  confidence: number;
  recommendedWeight: number;
  metrics: ModelMetrics;
  weights: ModelWeights;
  rationale: string;
};

export type RunResponse = {
  horizon: Horizon;
  generatedAt: string;
  quotes: CompanyForecast[];
  errors: { symbol: string; message: string }[];
};

export type Position = {
  symbol: string;
  name: string;
  shares: number;
  avgPrice: number;
  openedAt: string;
};

export type Fill = {
  id: string;
  symbol: string;
  name: string;
  side: "BUY" | "SELL";
  shares: number;
  price: number;
  notional: number;
  at: string;
  note: string;
};

export type Portfolio = {
  cash: number;
  positions: Position[];
  fills: Fill[];
};
