// Core domain types for Market Mayhem platform

export type TeamId = number;
export type FundId = number;
export type OrderId = string;
export type TradeId = string;

export type RoundNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;
export type Phase = 'NEWS_REVEAL' | 'TRADING_OPEN' | 'ORDER_LOCK' | 'RESULTS_DISPLAY';
export type OrderType = 'buy' | 'sell';
export type P2PStatus =
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'failed';

export interface GameState {
  round: number;
  phase: Phase;
  phase_start: number;
  phase_duration: number;
  time_remaining: number;
  is_paused: boolean;
}

export interface Team {
  id: TeamId;
  team_code: string;
  team_name: string;
  starting_capital: number;
  password_hash?: string;
}

export interface Portfolio {
  team_id: TeamId;
  cash: number;
  holdings: Holding[];
  total_value: number;
  last_updated: number;
}

export interface Holding {
  fund_id: FundId;
  fund_code?: string;
  fund_name?: string;
  quantity: number;
  current_nav: number;
  market_value: number;
}

export interface Fund {
  id: FundId;
  fund_code: string;
  fund_name: string;
  is_cash: boolean;
  current_nav: number;
  last_nav_update: number;
}

export interface Order {
  id: OrderId;
  team_id: TeamId;
  fund_id: FundId;
  order_type: OrderType;
  quantity: number;
  created_at: number;
  round: number;
}

export interface ExecutedOrder extends Order {
  nav_at_execution: number;
  slippage_applied: number;
  effective_nav: number;
  brokerage_fee: number;
  total_value: number;
  executed_at: number;
  status: 'completed' | 'failed';
  error_message?: string;
}

export interface P2PTrade {
  id: TradeId;
  proposer_team_id: TeamId;
  counterparty_team_id: TeamId;
  fund_id: FundId;
  quantity: number;
  agreed_price: number;
  proposer_direction: OrderType;
  status: P2PStatus;
  created_at: number;
  approved_by?: string;
  approved_at?: number;
  executed_at?: number;
  error_message?: string;
}

export interface LeaderboardEntry {
  rank: number;
  team_id: TeamId;
  team_name: string;
  portfolio_value: number;
  change_from_start?: number;
}

export interface AuditLogEntry {
  id: bigint;
  event_type: string;
  team_id?: TeamId;
  admin_username?: string;
  round?: number;
  event_data: Record<string, unknown>;
  created_at: number;
}

export interface ScheduleFund {
  id: FundId;
  fund_code: string;
  navValues: number[];
}

export interface Schedule {
  funds: ScheduleFund[];
}

export interface LoginRequest {
  team_code: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  team_id: TeamId;
  team_name: string;
}

export interface AdminLoginRequest {
  username: string;
  password: string;
}

export interface OrderSubmission {
  fund_id: FundId;
  type: OrderType;
  quantity: number;
}

export interface OrderResponse {
  order_id: OrderId;
  status: 'pending';
  estimated_cost: number;
}

export interface P2PProposal {
  counterparty_team_id: TeamId;
  fund_id: FundId;
  quantity: number;
  price_per_unit: number;
  direction: OrderType;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

export interface JWTPayload {
  team_id?: TeamId;
  team_code?: string;
  role: 'team' | 'admin';
  username?: string;
  iat: number;
  exp: number;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
