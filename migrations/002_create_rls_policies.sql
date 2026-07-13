-- ============================================================================
-- Migration: 002_create_rls_policies.sql
-- Description: Implement Row-Level Security (RLS) policies for team data isolation
-- ============================================================================

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================================
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE executed_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TEAMS TABLE RLS
-- ============================================================================
-- Teams can only read their own team data
CREATE POLICY team_self_read ON teams
  FOR SELECT
  USING (
    id = CAST(current_setting('app.current_team_id', TRUE) AS INTEGER)
    OR current_setting('app.role', TRUE) IN ('admin', 'game_engine')
  );

-- Only game engine can update teams (e.g., for admin adjustments)
CREATE POLICY team_update_by_engine ON teams
  FOR UPDATE
  USING (current_setting('app.role', TRUE) = 'game_engine')
  WITH CHECK (current_setting('app.role', TRUE) = 'game_engine');

-- Only admin can insert teams
CREATE POLICY team_insert_by_admin ON teams
  FOR INSERT
  WITH CHECK (current_setting('app.role', TRUE) = 'admin');

-- ============================================================================
-- PORTFOLIOS TABLE RLS
-- ============================================================================
-- Teams can read their own portfolio
CREATE POLICY portfolio_team_read ON portfolios
  FOR SELECT
  USING (
    team_id = CAST(current_setting('app.current_team_id', TRUE) AS INTEGER)
    OR current_setting('app.role', TRUE) IN ('admin', 'game_engine')
  );

-- Only game engine can update portfolios (cash transactions)
CREATE POLICY portfolio_engine_update ON portfolios
  FOR UPDATE
  USING (current_setting('app.role', TRUE) = 'game_engine')
  WITH CHECK (current_setting('app.role', TRUE) = 'game_engine');

-- Only game engine can insert portfolios (during team initialization)
CREATE POLICY portfolio_engine_insert ON portfolios
  FOR INSERT
  WITH CHECK (current_setting('app.role', TRUE) = 'game_engine');

-- ============================================================================
-- HOLDINGS TABLE RLS
-- ============================================================================
-- Teams can read their own holdings
CREATE POLICY holdings_team_read ON holdings
  FOR SELECT
  USING (
    team_id = CAST(current_setting('app.current_team_id', TRUE) AS INTEGER)
    OR current_setting('app.role', TRUE) IN ('admin', 'game_engine')
  );

-- Only game engine can update holdings (fund transactions)
CREATE POLICY holdings_engine_update ON holdings
  FOR UPDATE
  USING (current_setting('app.role', TRUE) = 'game_engine')
  WITH CHECK (current_setting('app.role', TRUE) = 'game_engine');

-- Only game engine can insert holdings (during order execution)
CREATE POLICY holdings_engine_insert ON holdings
  FOR INSERT
  WITH CHECK (current_setting('app.role', TRUE) = 'game_engine');

-- ============================================================================
-- PENDING_ORDERS TABLE RLS
-- ============================================================================
-- Teams can read their own pending orders
CREATE POLICY pending_orders_team_read ON pending_orders
  FOR SELECT
  USING (
    team_id = CAST(current_setting('app.current_team_id', TRUE) AS INTEGER)
    OR current_setting('app.role', TRUE) IN ('admin', 'game_engine')
  );

-- Teams can insert their own pending orders
CREATE POLICY pending_orders_team_insert ON pending_orders
  FOR INSERT
  WITH CHECK (
    team_id = CAST(current_setting('app.current_team_id', TRUE) AS INTEGER)
    AND current_setting('app.role', TRUE) = 'team'
  );

-- Teams can delete their own pending orders (cancellation)
CREATE POLICY pending_orders_team_delete ON pending_orders
  FOR DELETE
  USING (
    team_id = CAST(current_setting('app.current_team_id', TRUE) AS INTEGER)
    AND current_setting('app.role', TRUE) = 'team'
  );

-- Game engine can delete pending orders (during execution)
CREATE POLICY pending_orders_engine_delete ON pending_orders
  FOR DELETE
  USING (current_setting('app.role', TRUE) = 'game_engine');

-- ============================================================================
-- EXECUTED_ORDERS TABLE RLS
-- ============================================================================
-- Teams can read their own executed orders
CREATE POLICY executed_orders_team_read ON executed_orders
  FOR SELECT
  USING (
    team_id = CAST(current_setting('app.current_team_id', TRUE) AS INTEGER)
    OR current_setting('app.role', TRUE) IN ('admin', 'game_engine')
  );

-- Only game engine can insert executed orders (immutable append-only)
CREATE POLICY executed_orders_engine_insert ON executed_orders
  FOR INSERT
  WITH CHECK (current_setting('app.role', TRUE) = 'game_engine');

-- Prevent all updates and deletes (immutable)
CREATE POLICY executed_orders_immutable ON executed_orders
  FOR UPDATE
  USING (FALSE);

-- ============================================================================
-- P2P_TRADES TABLE RLS
-- ============================================================================
-- Teams can read their own P2P trades (as proposer or counterparty)
CREATE POLICY p2p_trades_team_read ON p2p_trades
  FOR SELECT
  USING (
    proposer_team_id = CAST(current_setting('app.current_team_id', TRUE) AS INTEGER)
    OR counterparty_team_id = CAST(current_setting('app.current_team_id', TRUE) AS INTEGER)
    OR current_setting('app.role', TRUE) IN ('admin', 'game_engine')
  );

-- Teams can insert P2P trade proposals
CREATE POLICY p2p_trades_team_insert ON p2p_trades
  FOR INSERT
  WITH CHECK (
    proposer_team_id = CAST(current_setting('app.current_team_id', TRUE) AS INTEGER)
    AND current_setting('app.role', TRUE) = 'team'
  );

-- Only game engine and admin can update P2P trades
CREATE POLICY p2p_trades_engine_update ON p2p_trades
  FOR UPDATE
  USING (current_setting('app.role', TRUE) IN ('game_engine', 'admin'))
  WITH CHECK (current_setting('app.role', TRUE) IN ('game_engine', 'admin'));

-- ============================================================================
-- AUDIT_LOG TABLE RLS
-- ============================================================================
-- Teams can read their own audit log entries
CREATE POLICY audit_log_team_read ON audit_log
  FOR SELECT
  USING (
    team_id = CAST(current_setting('app.current_team_id', TRUE) AS INTEGER)
    OR team_id IS NULL -- System events visible to everyone
    OR current_setting('app.role', TRUE) IN ('admin', 'game_engine')
  );

-- Only game engine can append to audit log (append-only)
CREATE POLICY audit_log_engine_append ON audit_log
  FOR INSERT
  WITH CHECK (current_setting('app.role', TRUE) IN ('game_engine', 'admin'));

-- Prevent updates and deletes (immutable append-only)
CREATE POLICY audit_log_immutable ON audit_log
  FOR UPDATE
  USING (FALSE);

CREATE POLICY audit_log_no_delete ON audit_log
  FOR DELETE
  USING (FALSE);

-- ============================================================================
-- SESSIONS TABLE RLS
-- ============================================================================
-- Sessions are managed internally; only game engine and auth service
CREATE POLICY sessions_auth_read ON sessions
  FOR SELECT
  USING (current_setting('app.role', TRUE) IN ('auth', 'game_engine', 'admin'));

CREATE POLICY sessions_auth_insert ON sessions
  FOR INSERT
  WITH CHECK (current_setting('app.role', TRUE) = 'auth');

CREATE POLICY sessions_auth_update ON sessions
  FOR UPDATE
  USING (current_setting('app.role', TRUE) = 'auth')
  WITH CHECK (current_setting('app.role', TRUE) = 'auth');

-- ============================================================================
-- FUNDS AND GAME_STATE (Read-only for teams via public policies)
-- ============================================================================
-- Public read access to funds (no team isolation needed)
CREATE POLICY funds_public_read ON funds
  FOR SELECT
  USING (TRUE);

-- Only game engine can update funds
CREATE POLICY funds_engine_update ON funds
  FOR UPDATE
  USING (current_setting('app.role', TRUE) = 'game_engine')
  WITH CHECK (current_setting('app.role', TRUE) = 'game_engine');

-- Only game engine can update game_state
CREATE POLICY game_state_engine_read ON game_state
  FOR SELECT
  USING (TRUE); -- Public read

CREATE POLICY game_state_engine_update ON game_state
  FOR UPDATE
  USING (current_setting('app.role', TRUE) = 'game_engine')
  WITH CHECK (current_setting('app.role', TRUE) = 'game_engine');

-- ============================================================================
-- NEWS_FEED AND SCHEDULES (Public/admin access)
-- ============================================================================
-- Public read access to news feed
CREATE POLICY news_feed_public_read ON news_feed
  FOR SELECT
  USING (TRUE);

-- Only admin/game engine can modify news feed
CREATE POLICY news_feed_engine_insert ON news_feed
  FOR INSERT
  WITH CHECK (current_setting('app.role', TRUE) IN ('game_engine', 'admin'));

-- Public read access to schedules (encrypted data is sealed)
CREATE POLICY schedules_public_read ON schedules
  FOR SELECT
  USING (TRUE);

-- Only admin can insert schedules
CREATE POLICY schedules_admin_insert ON schedules
  FOR INSERT
  WITH CHECK (current_setting('app.role', TRUE) = 'admin');

-- Prevent all updates and deletes (immutable)
CREATE POLICY schedules_immutable ON schedules
  FOR UPDATE
  USING (FALSE);
