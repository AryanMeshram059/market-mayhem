export const TOTAL_ROUNDS = 15;
export const TOTAL_TEAMS = 20;
export const INVESTABLE_FUNDS = 11;
export const MAX_NAV_CHANGE = 0.6;

export const STARTING_CAPITAL = 1_000_000_000; // Rs 100 Cr
export const BROKERAGE_RATE = 0.002;
export const SLIPPAGE_THRESHOLD_RATE = 0.25;
export const SLIPPAGE_RATE = 0.02;
export const CASH_EROSION_RATE = 0.005;
export const P2P_MAX_TRADE_VALUE = 100_000_000; // Rs 10 Cr

export const SESSION_TTL_SECONDS = 4 * 60 * 60;

export const PHASE_DURATIONS = {
  IDLE: 0,
  NEWS_REVEAL: 60,
  TRADING_OPEN: 300,
  ORDER_LOCK: 120,
  RESULTS_DISPLAY: 60,
} as const;

export const PHASES = [
  'IDLE',
  'NEWS_REVEAL',
  'TRADING_OPEN',
  'ORDER_LOCK',
  'RESULTS_DISPLAY',
] as const;
