import type { PHASES } from './constants';

export type GamePhase = (typeof PHASES)[number];
export type OrderType = 'buy' | 'sell';
export type OrderStatus = 'pending' | 'completed' | 'failed';
export type P2PStatus =
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'failed';

export interface Team {
  id: number;
  team_code: string;
  team_name: string;
  starting_capital: number;
}

export interface Fund {
  id: number;
  fund_code: string;
  fund_name: string;
  is_cash: boolean;
  current_nav: number;
  last_nav_update: string | null;
}

export interface GameState {
  round: number;
  phase: GamePhase;
  phase_start: string;
  phase_duration: number;
  phase_ends_at: string | null;
  time_remaining: number;
  is_paused: boolean;
}

export interface HoldingView {
  fund_id: number;
  fund_code: string;
  fund_name: string;
  quantity: number;
  current_nav: number;
  market_value: number;
}

export interface PortfolioView {
  team_id: number;
  cash: number;
  holdings: HoldingView[];
  total_value: number;
  last_updated: string | null;
}

export interface ScheduleFund {
  fund_code: string;
  navValues: number[];
}

export interface SchedulePayload {
  funds: ScheduleFund[];
}

export interface TokenPayload {
  role: 'team' | 'admin';
  team_id?: number;
  team_code?: string;
  username?: string;
  iat: number;
  exp: number;
}
