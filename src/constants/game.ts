import type { Phase } from '@/types';

export const STARTING_CAPITAL = 100_000_000; // ₹100 Crores
export const TOTAL_TEAMS = 80;
export const TOTAL_ROUNDS = 15;
export const TOTAL_GAME_CAPITAL = STARTING_CAPITAL * TOTAL_TEAMS; // ₹8,000 Crores

export const BROKERAGE_RATE = 0.002; // 0.2%
export const SLIPPAGE_RATE = 0.05; // 5% penalty on excess
export const SLIPPAGE_THRESHOLD = 0.25; // 25% of starting capital
export const CASH_EROSION_RATE = 0.995; // 0.5% per round
export const CASH_EROSION_ROUNDS = 15;

export const INVESTABLE_FUNDS = 11;
export const SCHEDULE_ENTRIES = INVESTABLE_FUNDS * TOTAL_ROUNDS; // 165
export const MAX_NAV_CHANGE = 0.6; // ±60%

export const PHASE_DURATIONS: Record<Phase, number> = {
  NEWS_REVEAL: 60,
  TRADING_OPEN: 300,
  ORDER_LOCK: 120,
  RESULTS_DISPLAY: 60,
};

export const SESSION_TIMEOUT_HOURS = 4;
export const SESSION_TIMEOUT_SECONDS = SESSION_TIMEOUT_HOURS * 60 * 60;

export const RATE_LIMIT_REQUESTS_PER_MINUTE = 100;
export const RATE_LIMIT_ORDERS_PER_MINUTE = 10;
export const RATE_LIMIT_P2P_PER_MINUTE = 5;

export const POLL_INTERVAL_GAME_STATE_MS = 2500;
export const POLL_INTERVAL_PORTFOLIO_MS = 2500;
export const POLL_INTERVAL_LEADERBOARD_MS = 5000;
export const POLL_INTERVAL_ADMIN_MS = 2500;
