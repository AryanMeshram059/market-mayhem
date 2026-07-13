# Market Mayhem Database Schema Reference

## Quick Navigation

- [Teams & Authentication](#teams--authentication)
- [Portfolios & Holdings](#portfolios--holdings)
- [Trading & Orders](#trading--orders)
- [P2P Trading](#p2p-trading)
- [Game State & Timing](#game-state--timing)
- [News & Schedules](#news--schedules)
- [Audit & Sessions](#audit--sessions)

---

## Teams & Authentication

### `teams`
Represents a team participating in the game. Each team has up to 5 members sharing this account.

```sql
CREATE TABLE teams (
  id SERIAL PRIMARY KEY,
  team_code VARCHAR(20) UNIQUE NOT NULL,      -- TEAM_001 to TEAM_080
  team_name VARCHAR(100) NOT NULL,             -- Display name
  password_hash VARCHAR(255) NOT NULL,         -- bcrypt hash
  starting_capital NUMERIC(15,2) DEFAULT 100000000, -- ₹100 Crore
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Usage:**
```sql
-- Find a team by code
SELECT * FROM teams WHERE team_code = 'TEAM_001';

-- Get all teams
SELECT id, team_name, starting_capital FROM teams ORDER BY id;

-- Update team info (admin only)
UPDATE teams SET team_name = 'New Name' WHERE id = 1;
```

### `sessions`
Tracks authenticated user sessions for team members.

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL,    -- SHA-256 of JWT
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,               -- 4 hours from creation
  last_activity TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);
```

**Usage:**
```sql
-- Find active session by token hash
SELECT * FROM sessions 
WHERE token_hash = $1 AND is_active = TRUE AND expires_at > NOW();

-- Invalidate a session (logout)
UPDATE sessions SET is_active = FALSE WHERE id = $1;

-- Clean expired sessions
DELETE FROM sessions WHERE expires_at < NOW() - INTERVAL '30 days';

-- Get active team members
SELECT COUNT(*) FROM sessions 
WHERE team_id = 1 AND is_active = TRUE;
```

---

## Portfolios & Holdings

### `portfolios`
Represents a team's cash balance. Stores current liquid capital.

```sql
CREATE TABLE portfolios (
  team_id INTEGER PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  cash NUMERIC(15,2) NOT NULL DEFAULT 100000000, -- ₹100 Crore
  last_updated TIMESTAMP DEFAULT NOW(),
  CONSTRAINT positive_cash CHECK (cash >= 0)
);
```

**Usage:**
```sql
-- Get a team's cash balance
SELECT cash FROM portfolios WHERE team_id = 1;

-- Update cash after buy order (deduct cost + fee)
UPDATE portfolios SET cash = cash - $1, last_updated = NOW() 
WHERE team_id = $2;

-- Update cash after sell order (add proceeds - fee)
UPDATE portfolios SET cash = cash + $1, last_updated = NOW() 
WHERE team_id = $2;

-- Get team's portfolio value (with fund holdings)
SELECT p.cash, COALESCE(SUM(h.quantity * f.current_nav), 0) as fund_value
FROM portfolios p
LEFT JOIN holdings h ON p.team_id = h.team_id
LEFT JOIN funds f ON h.fund_id = f.id
WHERE p.team_id = $1
GROUP BY p.cash;
```

### `holdings`
Represents a team's fund holdings. One row per team-fund pair.

```sql
CREATE TABLE holdings (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  fund_id INTEGER NOT NULL REFERENCES funds(id) ON DELETE RESTRICT,
  quantity NUMERIC(15,4) NOT NULL DEFAULT 0,  -- Units held
  last_updated TIMESTAMP DEFAULT NOW(),
  CONSTRAINT positive_quantity CHECK (quantity >= 0),
  CONSTRAINT unique_team_fund UNIQUE(team_id, fund_id)
);
```

**Usage:**
```sql
-- Get all holdings for a team
SELECT h.*, f.fund_code, f.current_nav, (h.quantity * f.current_nav) as market_value
FROM holdings h
JOIN funds f ON h.fund_id = f.id
WHERE h.team_id = 1 AND h.quantity > 0;

-- Get a specific fund holding
SELECT quantity FROM holdings 
WHERE team_id = 1 AND fund_id = 3;

-- Update fund quantity (increase for buy)
UPDATE holdings SET quantity = quantity + $1, last_updated = NOW()
WHERE team_id = $2 AND fund_id = $3;

-- Update fund quantity (decrease for sell)
UPDATE holdings SET quantity = quantity - $1, last_updated = NOW()
WHERE team_id = $2 AND fund_id = $3;

-- Get funds held by any team
SELECT team_id, fund_id, quantity FROM holdings 
WHERE quantity > 0 ORDER BY team_id;

-- Get team's total portfolio value
SELECT SUM(h.quantity * f.current_nav) + p.cash as total_value
FROM holdings h
JOIN funds f ON h.fund_id = f.id
JOIN portfolios p ON h.team_id = p.team_id
WHERE h.team_id = 1;
```

### `funds`
Represents tradeable financial instruments: 11 investable funds + 1 cash.

```sql
CREATE TABLE funds (
  id SERIAL PRIMARY KEY,
  fund_code VARCHAR(20) UNIQUE NOT NULL,      -- TECH, PHARMA, etc.
  fund_name VARCHAR(100) NOT NULL,
  is_cash BOOLEAN DEFAULT FALSE,               -- TRUE only for cash fund
  current_nav NUMERIC(15,4),                   -- Net Asset Value
  last_nav_update TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Seeded Funds:**
- TECH: Technology Fund
- PHARMA: Pharma & Healthcare Fund
- ENERGY: Energy & Power Fund
- BANKING: Banking & Finance Fund
- CONSUMER: Consumer & Retail Fund
- AUTO: Automobiles & Components Fund
- INFRA: Infrastructure & Construction Fund
- METALS: Metals & Mining Fund
- TELECOM: Telecommunications Fund
- REALTY: Real Estate & REIT Fund
- FMCG: FMCG & Consumer Staples Fund
- CASH: Cash (non-investable)

**Usage:**
```sql
-- Get all investable funds
SELECT * FROM funds WHERE is_cash = FALSE ORDER BY fund_code;

-- Get cash fund
SELECT * FROM funds WHERE is_cash = TRUE;

-- Update NAV for a fund (done during round transition)
UPDATE funds SET current_nav = $1, last_nav_update = NOW()
WHERE id = $2;

-- Get NAV history (if stored in separate table)
SELECT fund_code, current_nav FROM funds WHERE is_cash = FALSE;
```

---

## Trading & Orders

### `pending_orders`
Orders submitted during TRADING_OPEN phase, waiting for execution.

```sql
CREATE TABLE pending_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  fund_id INTEGER NOT NULL REFERENCES funds(id) ON DELETE RESTRICT,
  order_type VARCHAR(10) NOT NULL,             -- 'buy' or 'sell'
  quantity NUMERIC(15,4) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  round INTEGER NOT NULL,
  CONSTRAINT valid_type CHECK (order_type IN ('buy', 'sell')),
  CONSTRAINT positive_quantity CHECK (quantity > 0)
);
```

**Usage:**
```sql
-- Team submits a buy order
INSERT INTO pending_orders (team_id, fund_id, order_type, quantity, round)
VALUES (1, 3, 'buy', 100, 1)
RETURNING id, order_type, quantity;

-- Get pending orders for a team
SELECT * FROM pending_orders WHERE team_id = 1 AND round = 1;

-- Get all pending orders for batch execution
SELECT * FROM pending_orders WHERE round = 1 ORDER BY created_at;

-- Cancel an order
DELETE FROM pending_orders WHERE id = $1 AND team_id = $2;

-- Modify an order quantity
UPDATE pending_orders SET quantity = $1 WHERE id = $2 AND team_id = $3;

-- Clear all executed orders
DELETE FROM pending_orders WHERE round = 1;
```

### `executed_orders`
Immutable record of all executed and failed orders.

```sql
CREATE TABLE executed_orders (
  id UUID PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  fund_id INTEGER NOT NULL REFERENCES funds(id) ON DELETE RESTRICT,
  order_type VARCHAR(10) NOT NULL,
  quantity NUMERIC(15,4) NOT NULL,
  nav_at_execution NUMERIC(15,4) NOT NULL,    -- NAV when executed
  slippage_applied NUMERIC(15,4) DEFAULT 0,   -- Slippage percentage
  effective_nav NUMERIC(15,4) NOT NULL,       -- NAV after slippage
  brokerage_fee NUMERIC(15,4) NOT NULL,       -- 0.2% of transaction
  total_value NUMERIC(15,2) NOT NULL,         -- Cash deducted/added
  executed_at TIMESTAMP DEFAULT NOW(),
  round INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'completed',     -- 'completed' or 'failed'
  error_message TEXT                          -- If failed
);
```

**Usage:**
```sql
-- Record a successful buy order execution
INSERT INTO executed_orders 
  (id, team_id, fund_id, order_type, quantity, nav_at_execution, 
   slippage_applied, effective_nav, brokerage_fee, total_value, round, status)
VALUES 
  (uuid, 1, 3, 'buy', 100, 105.5, 0.02, 105.61, 21.12, 10563, 1, 'completed');

-- Record a failed order
INSERT INTO executed_orders 
  (id, team_id, fund_id, order_type, quantity, nav_at_execution,
   effective_nav, brokerage_fee, total_value, round, status, error_message)
VALUES 
  (uuid, 2, 5, 'sell', 50, 95.25, 95.25, 4.76, 4761, 1, 'failed', 
   'Insufficient holdings');

-- Get order history for a team
SELECT * FROM executed_orders 
WHERE team_id = 1 ORDER BY executed_at DESC;

-- Get orders from a specific round
SELECT * FROM executed_orders WHERE round = 1 ORDER BY executed_at;

-- Calculate total trading volume
SELECT SUM(total_value) FROM executed_orders 
WHERE team_id = 1 AND round = 1;

-- Find failed orders
SELECT * FROM executed_orders 
WHERE status = 'failed' AND round = 1;
```

---

## P2P Trading

### `p2p_trades`
Peer-to-peer trades between teams. Requires admin approval.

```sql
CREATE TABLE p2p_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer_team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  counterparty_team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  fund_id INTEGER NOT NULL REFERENCES funds(id) ON DELETE RESTRICT,
  quantity NUMERIC(15,4) NOT NULL,
  agreed_price NUMERIC(15,4) NOT NULL,
  proposer_direction VARCHAR(10) NOT NULL,    -- 'buy' or 'sell'
  status VARCHAR(20) DEFAULT 'awaiting_approval',
  created_at TIMESTAMP DEFAULT NOW(),
  approved_by VARCHAR(100),                   -- Admin username
  approved_at TIMESTAMP,
  executed_at TIMESTAMP,
  error_message TEXT,
  CONSTRAINT valid_direction CHECK (proposer_direction IN ('buy', 'sell')),
  CONSTRAINT valid_status CHECK (status IN 
    ('awaiting_approval', 'approved', 'rejected', 'completed', 'failed')),
  CONSTRAINT different_teams CHECK (proposer_team_id != counterparty_team_id)
);
```

**Usage:**
```sql
-- Team proposes P2P trade
INSERT INTO p2p_trades 
  (proposer_team_id, counterparty_team_id, fund_id, quantity, agreed_price, proposer_direction)
VALUES (1, 2, 3, 50, 110.5, 'buy')
RETURNING id;

-- Get pending P2P trades for admin approval
SELECT * FROM p2p_trades 
WHERE status = 'awaiting_approval' ORDER BY created_at;

-- Admin approves a P2P trade
UPDATE p2p_trades 
SET status = 'approved', approved_by = $1, approved_at = NOW()
WHERE id = $2;

-- Admin rejects a P2P trade
UPDATE p2p_trades 
SET status = 'rejected'
WHERE id = $1;

-- Mark P2P trade as executed
UPDATE p2p_trades 
SET status = 'completed', executed_at = NOW()
WHERE id = $1;

-- Record P2P execution failure
UPDATE p2p_trades 
SET status = 'failed', error_message = $1, executed_at = NOW()
WHERE id = $2;

-- Get P2P trades involving a team
SELECT * FROM p2p_trades 
WHERE (proposer_team_id = 1 OR counterparty_team_id = 1)
ORDER BY created_at DESC;
```

---

## Game State & Timing

### `game_state`
Singleton table containing current round, phase, and timing information.

```sql
CREATE TABLE game_state (
  id INTEGER PRIMARY KEY DEFAULT 1,
  current_round INTEGER NOT NULL DEFAULT 1,   -- 1-15
  current_phase VARCHAR(20) NOT NULL DEFAULT 'NEWS_REVEAL',
  phase_start TIMESTAMP NOT NULL DEFAULT NOW(),
  phase_duration INTEGER NOT NULL,             -- seconds
  is_paused BOOLEAN DEFAULT FALSE,
  paused_at TIMESTAMP,
  remaining_time INTEGER,                      -- seconds remaining when paused
  CONSTRAINT single_row CHECK (id = 1),
  CONSTRAINT valid_round CHECK (current_round >= 1 AND current_round <= 15),
  CONSTRAINT valid_phase CHECK (current_phase IN 
    ('NEWS_REVEAL', 'TRADING_OPEN', 'ORDER_LOCK', 'RESULTS_DISPLAY')),
  CONSTRAINT valid_duration CHECK (phase_duration > 0)
);
```

**Phase Timing:**
- NEWS_REVEAL: 60 seconds (reveal market news)
- TRADING_OPEN: 300 seconds (teams submit orders)
- ORDER_LOCK: 120 seconds (orders execute)
- RESULTS_DISPLAY: 60 seconds (show round results)

**Usage:**
```sql
-- Get current game state
SELECT current_round, current_phase, phase_start, phase_duration
FROM game_state WHERE id = 1;

-- Calculate remaining time
SELECT 
  current_phase,
  phase_duration - EXTRACT(EPOCH FROM (NOW() - phase_start))::INT as remaining_seconds
FROM game_state WHERE id = 1;

-- Advance to next phase (admin)
UPDATE game_state 
SET current_phase = 'TRADING_OPEN', phase_start = NOW(), phase_duration = 300
WHERE id = 1;

-- Pause game timer
UPDATE game_state 
SET is_paused = TRUE, paused_at = NOW(), 
    remaining_time = phase_duration - EXTRACT(EPOCH FROM (NOW() - phase_start))::INT
WHERE id = 1;

-- Resume game timer
UPDATE game_state 
SET is_paused = FALSE, phase_start = NOW() - INTERVAL '1 second' * (phase_duration - remaining_time)
WHERE id = 1;

-- Check if phase expired (for lazy state machine)
SELECT (phase_start + INTERVAL '1 second' * phase_duration < NOW()) as expired
FROM game_state WHERE id = 1;
```

---

## News & Schedules

### `news_feed`
Market news content for each round. One entry per round.

```sql
CREATE TABLE news_feed (
  id SERIAL PRIMARY KEY,
  round INTEGER NOT NULL UNIQUE,               -- 1-15
  content TEXT NOT NULL,                       -- News markdown
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_round CHECK (round >= 1 AND round <= 15)
);
```

**Usage:**
```sql
-- Add news for a round
INSERT INTO news_feed (round, content)
VALUES (1, '# Market News\n\nTechnology sector shows strong growth...');

-- Get news for current round
SELECT content FROM news_feed WHERE round = $1;

-- Update news for a round
UPDATE news_feed SET content = $1 WHERE round = $2;

-- Get all news
SELECT round, content FROM news_feed ORDER BY round;
```

### `schedules`
Encrypted NAV schedule for all 11 funds across 15 rounds. Immutable.

```sql
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encrypted_data TEXT NOT NULL,                -- AES-256 encrypted JSON
  created_at TIMESTAMP DEFAULT NOW(),
  locked BOOLEAN DEFAULT TRUE,
  uploaded_by VARCHAR(100),                   -- Admin username
  CONSTRAINT immutable_schedule CHECK (locked = TRUE)
);
```

**Usage:**
```sql
-- Admin uploads encrypted schedule
INSERT INTO schedules (encrypted_data, uploaded_by)
VALUES ($1, 'admin1')
RETURNING id;

-- Retrieve encrypted schedule (for decryption)
SELECT encrypted_data FROM schedules ORDER BY created_at DESC LIMIT 1;

-- Verify schedule is sealed
SELECT locked FROM schedules WHERE id = $1;

-- List all schedules (for audit)
SELECT id, created_at, uploaded_by FROM schedules ORDER BY created_at DESC;
```

---

## Audit & Sessions

### `audit_log`
Immutable append-only log of all state changes and transactions.

```sql
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,             -- order_executed, p2p_executed, etc.
  team_id INTEGER REFERENCES teams(id),        -- Nullable for system events
  admin_username VARCHAR(100),                 -- Nullable for team-initiated events
  round INTEGER CHECK (round IS NULL OR (round >= 1 AND round <= 15)),
  event_data JSONB NOT NULL,                   -- Detailed event information
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Common Event Types:**
- `order_executed` - Order successfully executed
- `order_failed` - Order execution failed
- `p2p_executed` - P2P trade executed
- `p2p_failed` - P2P trade failed
- `p2p_approved` - Admin approved P2P trade
- `manual_adjustment` - Admin manually adjusted portfolio
- `phase_transition` - Round phase changed
- `nav_update` - Fund NAV updated
- `schedule_uploaded` - NAV schedule uploaded

**Usage:**
```sql
-- Log an order execution
INSERT INTO audit_log (event_type, team_id, round, event_data)
VALUES ('order_executed', 1, 1, 
  '{"order_id":"uuid","fund_id":3,"quantity":100,"nav":105.5,"fee":21.12}');

-- Log an admin action
INSERT INTO audit_log (event_type, admin_username, round, event_data)
VALUES ('manual_adjustment', 'admin1', 1,
  '{"team_id":2,"adjustment_type":"cash","amount":10000,"justification":"..."}');

-- Get audit trail for a team
SELECT event_type, event_data, created_at FROM audit_log
WHERE team_id = 1 ORDER BY created_at DESC;

-- Get admin actions
SELECT admin_username, event_type, event_data, created_at FROM audit_log
WHERE admin_username IS NOT NULL ORDER BY created_at DESC;

-- Get events from a specific round
SELECT event_type, team_id, event_data FROM audit_log
WHERE round = 1 ORDER BY created_at;

-- Search audit log by event type
SELECT * FROM audit_log WHERE event_type = 'order_failed'
ORDER BY created_at DESC;

-- Get dispute resolution trail
SELECT * FROM audit_log 
WHERE event_type IN ('order_failed', 'manual_adjustment', 'p2p_failed')
ORDER BY created_at DESC;
```

---

## Calculated Fields & Queries

### Portfolio Total Value
```sql
SELECT 
  p.cash + COALESCE(SUM(h.quantity * f.current_nav), 0) as total_value
FROM portfolios p
LEFT JOIN holdings h ON p.team_id = h.team_id
LEFT JOIN funds f ON h.fund_id = f.id
WHERE p.team_id = $1
GROUP BY p.team_id, p.cash;
```

### Leaderboard
```sql
SELECT 
  ROW_NUMBER() OVER (ORDER BY total_value DESC) as rank,
  t.id,
  t.team_name,
  (p.cash + COALESCE(SUM(h.quantity * f.current_nav), 0))::NUMERIC(15,2) as total_value
FROM teams t
JOIN portfolios p ON t.id = p.team_id
LEFT JOIN holdings h ON t.id = h.team_id
LEFT JOIN funds f ON h.fund_id = f.id
GROUP BY t.id, t.team_name, p.cash
ORDER BY total_value DESC;
```

### Fund Price History (if tracking table existed)
```sql
-- Monitor NAV changes across rounds
SELECT 
  f.fund_code,
  f.current_nav as latest_nav,
  (f.current_nav - 100) / 100 * 100 as percent_change
FROM funds f
WHERE f.is_cash = FALSE;
```

### Team Trade Activity
```sql
SELECT 
  COUNT(*) as total_orders,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
  SUM(total_value) FILTER (WHERE status = 'completed') as total_volume
FROM executed_orders
WHERE team_id = $1;
```

---

## Connection Strings & Examples

### PostgreSQL Connection
```bash
# Standard PostgreSQL
psql "postgresql://user:password@localhost:5432/market_mayhem"

# Supabase
psql "postgresql://postgres:password@db.supabase.co:5432/postgres"
```

### Node.js Connection Pool
```javascript
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'password',
  database: 'market_mayhem',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### Setting RLS Context
```sql
-- Set team context
SET app.role = 'team';
SET app.current_team_id = '1';

-- Set game engine context
SET app.role = 'game_engine';

-- Set admin context
SET app.role = 'admin';
```
