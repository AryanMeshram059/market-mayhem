-- ============================================================================
-- Migration: 001_create_core_tables.sql
-- Description: Create core tables for Market Mayhem platform
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. TEAMS TABLE
-- ============================================================================
-- Represents a team participating in the game
-- Each team can have up to 5 participants sharing this account
CREATE TABLE teams (
  id SERIAL PRIMARY KEY,
  team_code VARCHAR(20) UNIQUE NOT NULL,
  team_name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  starting_capital NUMERIC(15,2) DEFAULT 100000000, -- ₹100 Crores (1 billion rupees)
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_teams_team_code ON teams(team_code);
COMMENT ON TABLE teams IS 'Teams participating in the Market Mayhem game simulation';
COMMENT ON COLUMN teams.starting_capital IS 'Starting capital in rupees: ₹100 Crores';

-- ============================================================================
-- 2. FUNDS TABLE
-- ============================================================================
-- Represents tradeable financial instruments
-- 11 investable funds + 1 cash (non-investable)
CREATE TABLE funds (
  id SERIAL PRIMARY KEY,
  fund_code VARCHAR(20) UNIQUE NOT NULL,
  fund_name VARCHAR(100) NOT NULL,
  is_cash BOOLEAN DEFAULT FALSE,
  current_nav NUMERIC(15,4),
  last_nav_update TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_funds_code ON funds(fund_code);
CREATE INDEX idx_funds_is_cash ON funds(is_cash);
COMMENT ON TABLE funds IS 'Tradeable financial instruments: 11 investable funds + 1 cash fund';
COMMENT ON COLUMN funds.current_nav IS 'Current Net Asset Value per unit';
COMMENT ON COLUMN funds.is_cash IS 'TRUE for cash fund (non-investable), FALSE for investable funds';

-- ============================================================================
-- 3. PORTFOLIOS TABLE
-- ============================================================================
-- Represents a team's cash balance
-- Fund holdings are stored in a separate holdings table
CREATE TABLE portfolios (
  team_id INTEGER PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  cash NUMERIC(15,2) NOT NULL DEFAULT 100000000, -- ₹100 Crores
  last_updated TIMESTAMP DEFAULT NOW(),
  CONSTRAINT positive_cash CHECK (cash >= 0)
);

CREATE INDEX idx_portfolios_updated ON portfolios(last_updated);
COMMENT ON TABLE portfolios IS 'Team cash balances and portfolio status';
COMMENT ON COLUMN portfolios.cash IS 'Current cash balance in rupees, must be non-negative';

-- ============================================================================
-- 4. HOLDINGS TABLE
-- ============================================================================
-- Represents a team's holdings in specific funds
-- One row per team-fund pair (eliminates duplicates with UNIQUE constraint)
CREATE TABLE holdings (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  fund_id INTEGER NOT NULL REFERENCES funds(id) ON DELETE RESTRICT,
  quantity NUMERIC(15,4) NOT NULL DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  CONSTRAINT positive_quantity CHECK (quantity >= 0),
  CONSTRAINT unique_team_fund UNIQUE(team_id, fund_id)
);

CREATE INDEX idx_holdings_team ON holdings(team_id);
CREATE INDEX idx_holdings_fund ON holdings(fund_id);
CREATE INDEX idx_holdings_team_fund ON holdings(team_id, fund_id);
COMMENT ON TABLE holdings IS 'Team holdings in investable funds';
COMMENT ON COLUMN holdings.quantity IS 'Quantity of fund units held, must be non-negative';

-- ============================================================================
-- 5. GAME_STATE TABLE
-- ============================================================================
-- Represents the current state of the game
-- This table should contain exactly 1 row (enforced by CHECK constraint)
CREATE TABLE game_state (
  id INTEGER PRIMARY KEY DEFAULT 1,
  current_round INTEGER NOT NULL DEFAULT 1,
  current_phase VARCHAR(20) NOT NULL DEFAULT 'NEWS_REVEAL',
  phase_start TIMESTAMP NOT NULL DEFAULT NOW(),
  phase_duration INTEGER NOT NULL, -- duration in seconds
  is_paused BOOLEAN DEFAULT FALSE,
  paused_at TIMESTAMP,
  remaining_time INTEGER, -- seconds remaining when paused
  CONSTRAINT single_row CHECK (id = 1),
  CONSTRAINT valid_round CHECK (current_round >= 1 AND current_round <= 15),
  CONSTRAINT valid_phase CHECK (current_phase IN ('NEWS_REVEAL', 'TRADING_OPEN', 'ORDER_LOCK', 'RESULTS_DISPLAY')),
  CONSTRAINT valid_duration CHECK (phase_duration > 0)
);

COMMENT ON TABLE game_state IS 'Singleton table containing current game state and round/phase information';
COMMENT ON COLUMN game_state.current_round IS 'Current round number (1-15)';
COMMENT ON COLUMN game_state.current_phase IS 'Current round phase: NEWS_REVEAL, TRADING_OPEN, ORDER_LOCK, RESULTS_DISPLAY';
COMMENT ON COLUMN game_state.phase_start IS 'Timestamp when current phase started';
COMMENT ON COLUMN game_state.phase_duration IS 'Duration of current phase in seconds';
COMMENT ON COLUMN game_state.is_paused IS 'TRUE if game timer is paused';
COMMENT ON COLUMN game_state.remaining_time IS 'Seconds remaining in current phase when paused';

-- ============================================================================
-- 6. PENDING_ORDERS TABLE
-- ============================================================================
-- Represents orders submitted but not yet executed
-- Cleared after ORDER_LOCK phase execution
CREATE TABLE pending_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  fund_id INTEGER NOT NULL REFERENCES funds(id) ON DELETE RESTRICT,
  order_type VARCHAR(10) NOT NULL,
  quantity NUMERIC(15,4) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  round INTEGER NOT NULL,
  CONSTRAINT valid_type CHECK (order_type IN ('buy', 'sell')),
  CONSTRAINT positive_quantity CHECK (quantity > 0),
  CONSTRAINT valid_round CHECK (round >= 1 AND round <= 15)
);

CREATE INDEX idx_pending_orders_team ON pending_orders(team_id);
CREATE INDEX idx_pending_orders_fund ON pending_orders(fund_id);
CREATE INDEX idx_pending_orders_round ON pending_orders(round);
COMMENT ON TABLE pending_orders IS 'Pending orders waiting for execution during ORDER_LOCK phase';
COMMENT ON COLUMN pending_orders.order_type IS 'Order type: buy or sell';

-- ============================================================================
-- 7. EXECUTED_ORDERS TABLE
-- ============================================================================
-- Represents orders that have been executed
-- Immutable record of all transaction history
CREATE TABLE executed_orders (
  id UUID PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  fund_id INTEGER NOT NULL REFERENCES funds(id) ON DELETE RESTRICT,
  order_type VARCHAR(10) NOT NULL,
  quantity NUMERIC(15,4) NOT NULL,
  nav_at_execution NUMERIC(15,4) NOT NULL,
  slippage_applied NUMERIC(15,4) DEFAULT 0,
  effective_nav NUMERIC(15,4) NOT NULL,
  brokerage_fee NUMERIC(15,4) NOT NULL,
  total_value NUMERIC(15,2) NOT NULL,
  executed_at TIMESTAMP DEFAULT NOW(),
  round INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'completed',
  error_message TEXT,
  CONSTRAINT valid_type CHECK (order_type IN ('buy', 'sell')),
  CONSTRAINT positive_quantity CHECK (quantity > 0),
  CONSTRAINT valid_status CHECK (status IN ('completed', 'failed')),
  CONSTRAINT non_negative_fees CHECK (brokerage_fee >= 0),
  CONSTRAINT valid_round CHECK (round >= 1 AND round <= 15)
);

CREATE INDEX idx_executed_orders_team ON executed_orders(team_id);
CREATE INDEX idx_executed_orders_team_time ON executed_orders(team_id, executed_at);
CREATE INDEX idx_executed_orders_fund ON executed_orders(fund_id);
CREATE INDEX idx_executed_orders_round ON executed_orders(round);
CREATE INDEX idx_executed_orders_status ON executed_orders(status);
COMMENT ON TABLE executed_orders IS 'Immutable record of all executed orders (completed and failed)';
COMMENT ON COLUMN executed_orders.status IS 'Execution status: completed or failed';
COMMENT ON COLUMN executed_orders.slippage_applied IS 'Slippage penalty percentage applied (0 if no slippage)';

-- ============================================================================
-- 8. P2P_TRADES TABLE
-- ============================================================================
-- Represents peer-to-peer trades between teams
-- Requires admin approval before execution
CREATE TABLE p2p_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer_team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  counterparty_team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  fund_id INTEGER NOT NULL REFERENCES funds(id) ON DELETE RESTRICT,
  quantity NUMERIC(15,4) NOT NULL,
  agreed_price NUMERIC(15,4) NOT NULL,
  proposer_direction VARCHAR(10) NOT NULL,
  status VARCHAR(20) DEFAULT 'awaiting_approval',
  created_at TIMESTAMP DEFAULT NOW(),
  approved_by VARCHAR(100),
  approved_at TIMESTAMP,
  executed_at TIMESTAMP,
  error_message TEXT,
  CONSTRAINT valid_direction CHECK (proposer_direction IN ('buy', 'sell')),
  CONSTRAINT valid_status CHECK (status IN ('awaiting_approval', 'approved', 'rejected', 'completed', 'failed')),
  CONSTRAINT positive_quantity CHECK (quantity > 0),
  CONSTRAINT positive_price CHECK (agreed_price > 0),
  CONSTRAINT different_teams CHECK (proposer_team_id != counterparty_team_id)
);

CREATE INDEX idx_p2p_proposer ON p2p_trades(proposer_team_id);
CREATE INDEX idx_p2p_counterparty ON p2p_trades(counterparty_team_id);
CREATE INDEX idx_p2p_status ON p2p_trades(status) WHERE status IN ('awaiting_approval', 'approved');
CREATE INDEX idx_p2p_created ON p2p_trades(created_at);
COMMENT ON TABLE p2p_trades IS 'Peer-to-peer trades between teams (requires admin approval)';
COMMENT ON COLUMN p2p_trades.proposer_direction IS 'Direction from proposer perspective: buy or sell';
COMMENT ON COLUMN p2p_trades.status IS 'Trade status: awaiting_approval, approved, rejected, completed, failed';

-- ============================================================================
-- 9. SCHEDULES TABLE
-- ============================================================================
-- Stores encrypted NAV schedule for all rounds
-- Immutable after creation (locked = TRUE)
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encrypted_data TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  locked BOOLEAN DEFAULT TRUE,
  uploaded_by VARCHAR(100),
  CONSTRAINT immutable_schedule CHECK (locked = TRUE)
);

CREATE INDEX idx_schedules_created ON schedules(created_at);
COMMENT ON TABLE schedules IS 'Encrypted NAV schedule (sealed pricing data for 11 funds × 15 rounds)';
COMMENT ON COLUMN schedules.locked IS 'Always TRUE; prevents modification (immutable)';
COMMENT ON COLUMN schedules.uploaded_by IS 'Admin username who uploaded the schedule';

-- ============================================================================
-- 10. NEWS_FEED TABLE
-- ============================================================================
-- Stores news content for each round
-- One news entry per round (enforced by UNIQUE constraint)
CREATE TABLE news_feed (
  id SERIAL PRIMARY KEY,
  round INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_round UNIQUE(round),
  CONSTRAINT valid_round CHECK (round >= 1 AND round <= 15)
);

CREATE INDEX idx_news_round ON news_feed(round);
COMMENT ON TABLE news_feed IS 'Market news content for each round (one entry per round)';
COMMENT ON COLUMN news_feed.round IS 'Round number (1-15)';

-- ============================================================================
-- 11. AUDIT_LOG TABLE
-- ============================================================================
-- Immutable append-only log of all state changes
-- Records all transactions, admin actions, and system events
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  team_id INTEGER REFERENCES teams(id),
  admin_username VARCHAR(100),
  round INTEGER CHECK (round IS NULL OR (round >= 1 AND round <= 15)),
  event_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_team ON audit_log(team_id, created_at);
CREATE INDEX idx_audit_type ON audit_log(event_type, created_at);
CREATE INDEX idx_audit_created ON audit_log(created_at);
COMMENT ON TABLE audit_log IS 'Immutable append-only audit log of all state changes and transactions';
COMMENT ON COLUMN audit_log.event_type IS 'Type of event: order_executed, p2p_executed, phase_transition, manual_adjustment, etc.';
COMMENT ON COLUMN audit_log.event_data IS 'JSON object containing detailed event information';

-- ============================================================================
-- 12. SESSIONS TABLE
-- ============================================================================
-- Tracks authenticated user sessions
-- Sessions expire after 4 hours of creation (not idle time)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  last_activity TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_sessions_team ON sessions(team_id) WHERE is_active = TRUE;
CREATE INDEX idx_sessions_token ON sessions(token_hash) WHERE is_active = TRUE;
CREATE INDEX idx_sessions_expiry ON sessions(expires_at) WHERE is_active = TRUE;
COMMENT ON TABLE sessions IS 'Authenticated session tokens for team members';
COMMENT ON COLUMN sessions.token_hash IS 'SHA-256 hash of the JWT token (not the token itself)';
COMMENT ON COLUMN sessions.expires_at IS 'Session expiration timestamp (4 hours from creation)';
COMMENT ON COLUMN sessions.is_active IS 'FALSE when session is logged out or expired';

-- ============================================================================
-- Verify initial game_state record
-- ============================================================================
-- Ensure exactly one row exists (will be initialized by application)
-- DO $$
-- BEGIN
--   IF NOT EXISTS (SELECT 1 FROM game_state WHERE id = 1) THEN
--     INSERT INTO game_state (id, phase_duration) VALUES (1, 60);
--   END IF;
-- END $$;
