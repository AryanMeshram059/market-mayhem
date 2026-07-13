-- ============================================================================
-- Migration: 003_create_indexes.sql
-- Description: Create additional indexes for performance optimization
-- ============================================================================

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- ============================================================================
-- TEAMS INDEXES
-- ============================================================================
-- Already created in 001, but adding additional ones for query performance

-- Index for finding teams by name (used in admin console)
CREATE INDEX idx_teams_name ON teams(team_name);

-- ============================================================================
-- PORTFOLIOS INDEXES
-- ============================================================================
-- Index for portfolio valuation queries (finding rich teams)
CREATE INDEX idx_portfolios_cash ON portfolios(cash DESC);

-- Index for portfolio updates during trading
CREATE INDEX idx_portfolios_team_updated ON portfolios(team_id, last_updated DESC);

-- ============================================================================
-- HOLDINGS INDEXES
-- ============================================================================
-- Composite index for fund holdings lookups
CREATE INDEX idx_holdings_fund_team ON holdings(fund_id, team_id);

-- Index for valuation queries (all holdings for a team)
CREATE INDEX idx_holdings_team_quantity ON holdings(team_id, quantity) WHERE quantity > 0;

-- Index for fund-level queries (all teams holding a fund)
CREATE INDEX idx_holdings_fund_quantity ON holdings(fund_id, quantity DESC) WHERE quantity > 0;

-- ============================================================================
-- PENDING_ORDERS INDEXES
-- ============================================================================
-- Composite index for order retrieval by team and round
CREATE INDEX idx_pending_orders_team_round ON pending_orders(team_id, round);

-- Index for batch processing (get all pending orders for a round)
CREATE INDEX idx_pending_orders_round_team ON pending_orders(round, team_id);

-- Index for fund-level order monitoring
CREATE INDEX idx_pending_orders_fund_round ON pending_orders(fund_id, round);

-- ============================================================================
-- EXECUTED_ORDERS INDEXES
-- ============================================================================
-- Index for leaderboard computation (total executed value per team)
CREATE INDEX idx_executed_orders_team_round ON executed_orders(team_id, round);

-- Index for order history retrieval (recent orders for a team)
CREATE INDEX idx_executed_orders_team_recent ON executed_orders(team_id, executed_at DESC);

-- Index for round completion queries
CREATE INDEX idx_executed_orders_round_status ON executed_orders(round, status);

-- Index for fund price tracking
CREATE INDEX idx_executed_orders_fund_round ON executed_orders(fund_id, round);

-- Composite index for audit queries (what happened to a fund across rounds)
CREATE INDEX idx_executed_orders_fund_status ON executed_orders(fund_id, status, executed_at DESC);

-- ============================================================================
-- P2P_TRADES INDEXES
-- ============================================================================
-- Composite index for admin approval queue
CREATE INDEX idx_p2p_status_created ON p2p_trades(status, created_at DESC);

-- Index for team-specific P2P trade history
CREATE INDEX idx_p2p_proposer_status ON p2p_trades(proposer_team_id, status);
CREATE INDEX idx_p2p_counterparty_status ON p2p_trades(counterparty_team_id, status);

-- Index for fund-specific P2P volume analysis
CREATE INDEX idx_p2p_fund_status ON p2p_trades(fund_id, status);

-- Index for execution queries
CREATE INDEX idx_p2p_executed_at ON p2p_trades(executed_at DESC) WHERE executed_at IS NOT NULL;

-- ============================================================================
-- AUDIT_LOG INDEXES
-- ============================================================================
-- Index for retrieving audit trail for dispute resolution
CREATE INDEX idx_audit_team_type ON audit_log(team_id, event_type, created_at DESC);

-- Index for admin action tracking
CREATE INDEX idx_audit_admin ON audit_log(admin_username, created_at DESC);

-- Index for event-specific queries (all order executions, all manual adjustments, etc.)
CREATE INDEX idx_audit_event_type_round ON audit_log(event_type, round, created_at DESC);

-- Index for recent system events
CREATE INDEX idx_audit_recent ON audit_log(created_at DESC);

-- Partial index for error tracking
CREATE INDEX idx_audit_errors ON audit_log(created_at DESC) 
  WHERE event_type IN ('order_failed', 'p2p_failed', 'validation_error');

-- ============================================================================
-- SESSIONS INDEXES
-- ============================================================================
-- Index for session validation (already created as partial index in 001)
-- Adding composite index for cleanup queries
CREATE INDEX idx_sessions_active_expiry ON sessions(is_active, expires_at) 
  WHERE is_active = TRUE;

-- Index for user activity tracking
CREATE INDEX idx_sessions_team_activity ON sessions(team_id, last_activity DESC) 
  WHERE is_active = TRUE;

-- ============================================================================
-- FUNDS INDEXES (Enhancement)
-- ============================================================================
-- Partial index for only investable funds
CREATE INDEX idx_funds_investable ON funds(fund_code) 
  WHERE is_cash = FALSE;

-- Index for NAV queries
CREATE INDEX idx_funds_nav_update ON funds(last_nav_update DESC);

-- ============================================================================
-- GAME_STATE INDEXES
-- ============================================================================
-- Game state queries are primarily singleton (id = 1), but index for safety
CREATE INDEX idx_game_state_phase ON game_state(current_phase);

-- ============================================================================
-- NEWS_FEED INDEXES (Enhancement)
-- ============================================================================
-- Partial index for active rounds
CREATE INDEX idx_news_round_created ON news_feed(created_at DESC) 
  WHERE round <= 15;

-- ============================================================================
-- SCHEDULES INDEXES (Enhancement)
-- ============================================================================
-- Index for finding active schedules
CREATE INDEX idx_schedules_active ON schedules(created_at DESC) 
  WHERE locked = TRUE;

-- ============================================================================
-- COMPOSITE INDEXES FOR COMMON QUERY PATTERNS
-- ============================================================================

-- Portfolio valuation query: get all funds and cash for a team
-- SELECT p.cash + COALESCE(SUM(h.quantity * f.current_nav), 0) as total_value
-- FROM portfolios p 
-- LEFT JOIN holdings h ON p.team_id = h.team_id
-- LEFT JOIN funds f ON h.fund_id = f.id
-- WHERE p.team_id = ?
CREATE INDEX idx_portfolio_valuation ON holdings(team_id, quantity) 
  WHERE quantity > 0;

-- Leaderboard query: rank all teams by portfolio value
-- This benefits from efficient portfolio lookups
CREATE INDEX idx_leaderboard_query ON portfolios(cash DESC, team_id);

-- Order validation query: check team's current position in a fund
-- SELECT quantity FROM holdings WHERE team_id = ? AND fund_id = ?
-- Already have UNIQUE(team_id, fund_id), but index helps
CREATE INDEX idx_holdings_validation ON holdings(team_id, fund_id) 
  WHERE quantity >= 0;

-- Trading volume query: calculate slippage based on recent order flow
-- SELECT SUM(quantity * effective_nav) FROM executed_orders 
-- WHERE team_id = ? AND round = ? AND order_type = 'buy'
CREATE INDEX idx_order_volume_analysis ON executed_orders(team_id, round, order_type, executed_at DESC);

-- Phase transition query: find all pending orders for batch execution
-- SELECT * FROM pending_orders WHERE round = ?
CREATE INDEX idx_batch_execution ON pending_orders(round, created_at);

-- P2P approval queue: find pending P2P trades for admin
-- SELECT * FROM p2p_trades WHERE status = 'awaiting_approval' ORDER BY created_at
-- Already has specific index, this is redundant but kept for clarity
-- CREATE INDEX idx_admin_queue ON p2p_trades(status, created_at) WHERE status = 'awaiting_approval';

-- ============================================================================
-- ANALYZE TABLE STATISTICS
-- ============================================================================
-- Update statistics for query planner (run after bulk inserts)
-- ANALYZE teams;
-- ANALYZE portfolios;
-- ANALYZE holdings;
-- ANALYZE funds;
-- ANALYZE pending_orders;
-- ANALYZE executed_orders;
-- ANALYZE p2p_trades;
-- ANALYZE audit_log;
-- ANALYZE sessions;
-- ANALYZE game_state;
-- ANALYZE news_feed;
-- ANALYZE schedules;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================
COMMENT ON INDEX idx_teams_team_code IS 'Fast lookup of teams by team_code during login';
COMMENT ON INDEX idx_portfolios_cash IS 'Efficient portfolio sorting for leaderboard queries';
COMMENT ON INDEX idx_holdings_team_fund IS 'Fast lookup of specific fund holdings for validation';
COMMENT ON INDEX idx_pending_orders_round IS 'Batch order lookup during ORDER_LOCK phase';
COMMENT ON INDEX idx_executed_orders_team_round IS 'Efficient order history queries by round';
COMMENT ON INDEX idx_p2p_status_created IS 'Admin queue for pending P2P approvals';
COMMENT ON INDEX idx_audit_team_type IS 'Audit trail retrieval for dispute resolution';
COMMENT ON INDEX idx_sessions_active_expiry IS 'Efficient session cleanup queries';
