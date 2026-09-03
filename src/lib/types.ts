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

export type ModelId =
  | "holt"
  | "ols"
  | "ar1"
  | "momentum"
  | "garch"
  | "kalman"
  | "arima"
  | "ou"
  | "ewma"
  | "regime";

export type ModelWeights = Record<ModelId, number>;

export type ModelBreakdown = {
  id: ModelId;
  label: string;
  category: string;
  description: string;
  purpose: string;
  formula: string;
  weight: number;
  rmse: number;
  mape: number;
  hitRate: number;
  targetPrice: number;
  expectedReturn: number;
};

export type ModelMetrics = {
  rmse: number;
  mape: number;
  hitRate: number;
  residualVol: number;
};

export type BacktestCheck = {
  hitRate: boolean;
  sharpe: boolean;
  drawdown: boolean;
  trades: boolean;
  direction: boolean;
};

export type BacktestTrade = {
  date: string;
  signal: "BUY" | "SELL";
  price: number;
  expectedReturn: number;
  actualReturn: number;
};

export type BacktestResult = {
  periodDays: number;
  horizon: Horizon;
  trades: number;
  winRate: number;
  hitRate: number;
  totalReturn: number;
  benchmarkReturn: number;
  sharpe: number;
  maxDrawdown: number;
  passed: boolean;
  checks: BacktestCheck;
  gates: {
    minHitRate: number;
    minSharpe: number;
    maxDrawdown: number;
    minTrades: number;
    minDirectionAccuracy: number;
  };
  tradeLog: BacktestTrade[];
  summary: string;
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
  rawSignal: TradeSignal;
  confidence: number;
  recommendedWeight: number;
  liveReady: boolean;
  metrics: ModelMetrics;
  weights: ModelWeights;
  models: ModelBreakdown[];
  backtest: BacktestResult;
  rationale: string;
};

export type RunResponse = {
  horizon: Horizon;
  generatedAt: string;
  verification: VerificationSummary | null;
  quotes: CompanyForecast[];
  errors: { symbol: string; message: string }[];
};

export type VerificationCase = {
  name: string;
  passed: boolean;
  detail: string;
};

export type VerificationSummary = {
  passed: boolean;
  ranAt: string;
  cases: VerificationCase[];
  modelCount: number;
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
