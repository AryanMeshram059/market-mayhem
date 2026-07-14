CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  team_code VARCHAR(20) UNIQUE NOT NULL,
  team_name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  starting_capital NUMERIC(15,2) DEFAULT 1000000000,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS funds (
  id SERIAL PRIMARY KEY,
  fund_code VARCHAR(20) UNIQUE NOT NULL,
  fund_name VARCHAR(100) NOT NULL,
  is_cash BOOLEAN DEFAULT FALSE,
  current_nav NUMERIC(15,4) DEFAULT 100,
  last_nav_update TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolios (
  team_id INTEGER PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  cash NUMERIC(15,2) NOT NULL DEFAULT 1000000000 CHECK (cash >= 0),
  last_updated TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS holdings (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  fund_id INTEGER NOT NULL REFERENCES funds(id) ON DELETE RESTRICT,
  quantity NUMERIC(15,4) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  last_updated TIMESTAMP DEFAULT NOW(),
  UNIQUE(team_id, fund_id)
);

CREATE TABLE IF NOT EXISTS game_state (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  current_round INTEGER NOT NULL DEFAULT 1 CHECK (current_round BETWEEN 1 AND 15),
  current_phase VARCHAR(20) NOT NULL DEFAULT 'IDLE'
    CHECK (current_phase IN ('IDLE', 'NEWS_REVEAL', 'TRADING_OPEN', 'ORDER_LOCK', 'RESULTS_DISPLAY')),
  phase_start TIMESTAMP NOT NULL DEFAULT NOW(),
  phase_duration INTEGER NOT NULL DEFAULT 0 CHECK (phase_duration >= 0),
  is_paused BOOLEAN DEFAULT FALSE,
  paused_at TIMESTAMP,
  remaining_time INTEGER
);

CREATE TABLE IF NOT EXISTS pending_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  fund_id INTEGER NOT NULL REFERENCES funds(id) ON DELETE RESTRICT,
  order_type VARCHAR(10) NOT NULL CHECK (order_type IN ('buy', 'sell')),
  quantity NUMERIC(15,4) NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMP DEFAULT NOW(),
  round INTEGER NOT NULL CHECK (round BETWEEN 1 AND 15)
);

CREATE TABLE IF NOT EXISTS executed_orders (
  id UUID PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  fund_id INTEGER NOT NULL REFERENCES funds(id) ON DELETE RESTRICT,
  order_type VARCHAR(10) NOT NULL CHECK (order_type IN ('buy', 'sell')),
  quantity NUMERIC(15,4) NOT NULL CHECK (quantity > 0),
  nav_at_execution NUMERIC(15,4) NOT NULL,
  slippage_applied NUMERIC(15,4) DEFAULT 0,
  effective_nav NUMERIC(15,4) NOT NULL,
  brokerage_fee NUMERIC(15,4) NOT NULL CHECK (brokerage_fee >= 0),
  total_value NUMERIC(15,2) NOT NULL,
  executed_at TIMESTAMP DEFAULT NOW(),
  round INTEGER NOT NULL CHECK (round BETWEEN 1 AND 15),
  status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('completed', 'failed')),
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS p2p_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer_team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  counterparty_team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  fund_id INTEGER NOT NULL REFERENCES funds(id) ON DELETE RESTRICT,
  quantity NUMERIC(15,4) NOT NULL CHECK (quantity > 0),
  agreed_price NUMERIC(15,4) NOT NULL CHECK (agreed_price > 0),
  proposer_direction VARCHAR(10) NOT NULL CHECK (proposer_direction IN ('buy', 'sell')),
  status VARCHAR(20) DEFAULT 'awaiting_approval'
    CHECK (status IN ('awaiting_approval', 'approved', 'rejected', 'completed', 'failed')),
  created_at TIMESTAMP DEFAULT NOW(),
  approved_by VARCHAR(100),
  approved_at TIMESTAMP,
  executed_at TIMESTAMP,
  error_message TEXT,
  CHECK (proposer_team_id <> counterparty_team_id)
);

CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encrypted_data TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  locked BOOLEAN DEFAULT TRUE CHECK (locked = TRUE),
  uploaded_by VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS news_feed (
  id SERIAL PRIMARY KEY,
  round INTEGER UNIQUE NOT NULL CHECK (round BETWEEN 1 AND 15),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  team_id INTEGER REFERENCES teams(id),
  admin_username VARCHAR(100),
  round INTEGER CHECK (round IS NULL OR round BETWEEN 1 AND 15),
  event_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  last_activity TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_holdings_team ON holdings(team_id);
CREATE INDEX IF NOT EXISTS idx_pending_orders_round ON pending_orders(round);
CREATE INDEX IF NOT EXISTS idx_executed_orders_team ON executed_orders(team_id);
CREATE INDEX IF NOT EXISTS idx_p2p_trades_status ON p2p_trades(status);
CREATE INDEX IF NOT EXISTS idx_sessions_active_token ON sessions(token_hash) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

INSERT INTO game_state (id, current_round, current_phase, phase_duration)
VALUES (1, 1, 'IDLE', 0)
ON CONFLICT (id) DO NOTHING;
