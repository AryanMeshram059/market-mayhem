# Design Document: Market Mayhem Platform

## Overview

Market Mayhem is a distributed real-time trading simulation platform architected for high concurrency (400 simultaneous users), zero operational cost during idle periods, and deterministic game mechanics. The system employs a lazy state machine pattern for round management, HTTP polling for client synchronization, and server-side computation for tamper-proof gameplay.

### Design Philosophy

The platform prioritizes three core principles:

1. **Zero-Cost Architecture**: Operates within Vercel Hobby and Supabase Free tier limits through intelligent polling, response caching, and request batching
2. **Tamper-Proof Security**: All game-critical computations (NAV updates, order execution, portfolio valuation) execute server-side with row-level security and immutable audit logs
3. **Lazy Computation**: Round transitions trigger on participant activity rather than cron jobs, eliminating background worker costs

### Key Technical Decisions

- **HTTP Polling over WebSockets**: Avoids Vercel's serverless function timeout constraints while staying within free tier bandwidth limits
- **Lazy State Machine**: Participant poll requests trigger phase transitions when timers expire, eliminating scheduled jobs
- **Optimistic UI Updates**: Client immediately reflects order submissions while awaiting server confirmation to maintain perceived responsiveness
- **Encrypted Schedule Storage**: Pre-uploaded NAV pricing data remains sealed until each round begins, preventing information leakage

## Architecture

### System Components

```mermaid
graph TB
    subgraph "Client Layer"
        TTA[Team Trading App<br/>Next.js + React]
        AC[Admin Console<br/>Next.js + React]
    end
    
    subgraph "API Layer - Vercel Edge"
        AUTH[/auth API<br/>Session Management]
        GAME[/game API<br/>State & Polling]
        ORDER[/order API<br/>Submission & Validation]
        P2P[/p2p API<br/>Trade Proposals]
        ADMIN[/admin API<br/>Management & Control]
    end
    
    subgraph "Game Engine - Server Functions"
        SM[State Machine<br/>Round Transitions]
        OE[Order Executor<br/>Batch Processing]
        NAV[NAV Manager<br/>Schedule & Pricing]
        VAL[Validator<br/>Funds & Cash Checks]
    end
    
    subgraph "Data Layer - Supabase"
        DB[(PostgreSQL<br/>Row-Level Security)]
        AUDIT[(Audit Log<br/>Immutable Append-Only)]
    end
    
    TTA -->|Poll every 2-3s| GAME
    TTA -->|Submit Orders| ORDER
    TTA -->|Propose P2P| P2P
    TTA -->|Authenticate| AUTH
    
    AC -->|Poll Summary| GAME
    AC -->|Control Rounds| ADMIN
    AC -->|Approve P2P| ADMIN
    AC -->|Resolve Disputes| ADMIN
    
    GAME --> SM
    ORDER --> VAL
    ORDER --> OE
    P2P --> VAL
    ADMIN --> SM
    ADMIN --> OE
    
    SM --> NAV
    OE --> VAL
    
    AUTH --> DB
    SM --> DB
    OE --> DB
    NAV --> DB
    VAL --> DB
    
    OE --> AUDIT
    ADMIN --> AUDIT
    SM --> AUDIT
```

### Deployment Architecture

```mermaid
graph LR
    subgraph "Vercel (Hobby Tier)"
        EDGE[Edge Functions<br/>Auth, Polling APIs]
        SERVER[Serverless Functions<br/>Game Engine]
        STATIC[CDN<br/>Static Assets]
    end
    
    subgraph "Supabase (Free Tier)"
        PG[PostgreSQL<br/>500MB Storage]
        RLS[Row-Level Security]
        REALTIME[Database Triggers<br/>Audit Log Only]
    end
    
    CLIENT[400 Concurrent Clients] -->|HTTPS| EDGE
    EDGE -->|Lightweight| CLIENT
    EDGE --> SERVER
    SERVER -->|SQL| PG
    PG --> RLS
    PG --> REALTIME
    CLIENT -->|Cached| STATIC
```

### Request Flow Patterns

#### Order Submission Flow
1. Client validates order locally (instant feedback)
2. POST `/api/order/submit` with team_id, fund_id, quantity, type
3. API validates session token and extracts team_id
4. Validator checks current holdings and cash balance
5. If TRADING_OPEN: accept order, add to pending queue, return confirmation
6. If not TRADING_OPEN: reject with phase error
7. Client polls `/api/game/state` every 2-3s to detect phase changes
8. When ORDER_LOCK begins: Order Executor processes all pending orders in transaction
9. Next poll returns updated portfolio

#### Lazy State Transition Flow
1. Any client polls `/api/game/state`
2. API reads current phase start timestamp and duration
3. Compute: `now() > phase_start + duration`
4. If expired: acquire row lock, transition phase, execute batch operations, release lock
5. Return new phase to client
6. Subsequent polls from other clients see new phase (no redundant transitions)

## Components and Interfaces

### Client Components

#### Team Trading App (Next.js App Router)

**Pages**:
- `/login` - Team authentication
- `/dashboard` - Portfolio overview, news feed, game clock
- `/trade` - Order entry form with fund selector
- `/portfolio` - Detailed holdings breakdown
- `/leaderboard` - Team rankings
- `/p2p` - Peer-to-peer trade proposals

**Key React Components**:
- `<GameClock />` - Displays current round, phase, countdown timer
- `<NewsFeed />` - Shows round-specific market news
- `<PortfolioSummary />` - Cash + fund holdings + total NAV
- `<OrderForm />` - Buy/sell interface with validation
- `<LeaderboardTable />` - Sortable team rankings
- `<P2PProposal />` - Trade proposal creation form

**State Management**:
- React Context for global game state (round, phase, timer)
- TanStack Query for server state (portfolio, orders, leaderboard)
- Optimistic updates for order submissions

**Polling Strategy**:
```typescript
// Game state: poll every 2-3s with jitter to avoid thundering herd
useInterval(() => fetchGameState(), 2000 + Math.random() * 1000)

// Portfolio: poll every 2-3s during TRADING_OPEN only
useInterval(() => {
  if (phase === 'TRADING_OPEN') fetchPortfolio()
}, 2000 + Math.random() * 1000)

// Leaderboard: poll every 5s
useInterval(() => fetchLeaderboard(), 5000)
```

#### Admin Console (Next.js App Router)

**Pages**:
- `/admin/login` - Administrator authentication
- `/admin/dashboard` - Live game monitoring (all 80 teams)
- `/admin/control` - Round progression controls
- `/admin/schedule` - NAV schedule upload and validation
- `/admin/p2p` - P2P trade approval queue
- `/admin/disputes` - Manual portfolio adjustments
- `/admin/audit` - Audit log viewer

**Key React Components**:
- `<TeamGrid />` - 80-team summary with health indicators
- `<RoundControls />` - Pause/resume/advance buttons
- `<ScheduleUploader />` - CSV validation and encryption
- `<P2PQueue />` - Pending trades with approve/reject actions
- `<DisputeForm />` - Manual cash/fund adjustments with justification
- `<AuditViewer />` - Filterable, exportable event log

### API Routes (Next.js App Router)

#### Authentication APIs

**POST `/api/auth/login`**
- Input: `{ team_code: string, password: string }`
- Validates credentials against database
- Creates session token (JWT with 4-hour expiry)
- Returns: `{ token: string, team_id: number, team_name: string }`

**POST `/api/auth/extend`**
- Input: `{ token: string }`
- Validates existing token
- Issues new token with extended expiry
- Returns: `{ token: string, expires_at: timestamp }`

**POST `/api/auth/logout`**
- Input: `{ token: string }`
- Invalidates session in database
- Returns: `{ success: boolean }`

#### Game State APIs

**GET `/api/game/state`**
- Headers: `Authorization: Bearer <token>`
- Triggers lazy state machine check
- Returns: `{ round: number, phase: string, phase_start: timestamp, phase_duration: number, time_remaining: number }`
- Implements ETag caching: returns 304 if state unchanged

**GET `/api/game/news`**
- Headers: `Authorization: Bearer <token>`
- Query: `?round=<number>`
- Returns: `{ round: number, content: string }`
- CDN cached (immutable per round)

**GET `/api/game/leaderboard`**
- Headers: `Authorization: Bearer <token>`
- Returns: `[{ rank: number, team_id: number, team_name: string, portfolio_value: number }]`
- Sorted descending by portfolio_value
- Computed on-demand during polls

#### Order APIs

**POST `/api/order/submit`**
- Headers: `Authorization: Bearer <token>`
- Input: `{ fund_id: number, type: 'buy' | 'sell', quantity: number }`
- Validates phase = TRADING_OPEN
- Validates cash/holdings sufficiency
- Adds to pending_orders table
- Returns: `{ order_id: string, status: 'pending', estimated_cost: number }` or error

**GET `/api/order/pending`**
- Headers: `Authorization: Bearer <token>`
- Returns: `[{ order_id: string, fund_id: number, type: string, quantity: number, created_at: timestamp }]`

**DELETE `/api/order/cancel/:order_id`**
- Headers: `Authorization: Bearer <token>`
- Validates ownership
- Validates phase = TRADING_OPEN
- Removes from pending_orders
- Returns: `{ success: boolean }`

**PATCH `/api/order/modify/:order_id`**
- Headers: `Authorization: Bearer <token>`
- Input: `{ quantity: number }`
- Validates ownership and phase
- Revalidates with new quantity
- Updates pending_orders
- Returns: `{ order_id: string, quantity: number }` or error

#### Portfolio APIs

**GET `/api/portfolio`**
- Headers: `Authorization: Bearer <token>`
- Returns: `{ cash: number, holdings: [{ fund_id: number, quantity: number, current_nav: number, market_value: number }], total_value: number }`
- Implements ETag caching

**GET `/api/portfolio/history`**
- Headers: `Authorization: Bearer <token>`
- Returns: `[{ round: number, portfolio_value: number, timestamp: timestamp }]`
- Used for charting performance over time

#### P2P Trading APIs

**POST `/api/p2p/propose`**
- Headers: `Authorization: Bearer <token>`
- Input: `{ counterparty_team_id: number, fund_id: number, quantity: number, price_per_unit: number, direction: 'buy' | 'sell' }`
- Validates phase = TRADING_OPEN
- Validates holdings/cash
- Creates p2p_trades record with status = 'awaiting_approval'
- Returns: `{ trade_id: string, status: 'awaiting_approval' }`

**GET `/api/p2p/status/:trade_id`**
- Headers: `Authorization: Bearer <token>`
- Returns: `{ trade_id: string, status: string, approved_by: string?, approved_at: timestamp? }`

#### Admin APIs

**GET `/api/admin/teams`**
- Headers: `Authorization: Bearer <admin_token>`
- Returns: `[{ team_id: number, team_name: string, portfolio_value: number, rank: number, pending_orders: number, error_state: boolean }]`

**POST `/api/admin/round/advance`**
- Headers: `Authorization: Bearer <admin_token>`
- Forces immediate phase transition
- Records action in audit_log
- Returns: `{ round: number, phase: string }`

**POST `/api/admin/round/pause`**
- Headers: `Authorization: Bearer <admin_token>`
- Freezes timer
- Returns: `{ paused: boolean, remaining_time: number }`

**POST `/api/admin/round/resume`**
- Headers: `Authorization: Bearer <admin_token>`
- Unfreezes timer
- Returns: `{ paused: boolean }`

**POST `/api/admin/schedule/upload`**
- Headers: `Authorization: Bearer <admin_token>`
- Input: CSV file (multipart/form-data)
- Validates 11 funds × 15 rounds = 165 NAV values
- Validates ±60% cumulative change constraint
- Encrypts and stores in schedules table
- Returns: `{ schedule_id: string, funds: number, rounds: number }` or validation errors

**GET `/api/admin/p2p/pending`**
- Headers: `Authorization: Bearer <admin_token>`
- Returns: `[{ trade_id: string, proposer_team: string, counterparty_team: string, fund_id: number, quantity: number, price: number, created_at: timestamp }]`

**POST `/api/admin/p2p/approve/:trade_id`**
- Headers: `Authorization: Bearer <admin_token>`
- Updates status to 'approved'
- Records admin action in audit_log
- Returns: `{ trade_id: string, status: 'approved' }`

**POST `/api/admin/p2p/reject/:trade_id`**
- Headers: `Authorization: Bearer <admin_token>`
- Updates status to 'rejected'
- Records admin action in audit_log
- Returns: `{ trade_id: string, status: 'rejected' }`

**POST `/api/admin/dispute/adjust`**
- Headers: `Authorization: Bearer <admin_token>`
- Input: `{ team_id: number, adjustment_type: 'cash' | 'fund', fund_id: number?, amount: number, justification: string }`
- Validates no negative balances
- Applies adjustment
- Records in audit_log with admin identifier
- Returns: `{ success: boolean, new_balance: number }`

**GET `/api/admin/audit`**
- Headers: `Authorization: Bearer <admin_token>`
- Query: `?team_id=<number>&from=<timestamp>&to=<timestamp>&event_type=<string>`
- Returns: `[{ event_id: string, timestamp: timestamp, event_type: string, team_id: number?, admin_id: string?, details: object }]`
- Paginated (100 events per page)

### Game Engine Services

#### State Machine Service

**Responsibilities**:
- Detect phase timer expiration
- Transition between phases atomically
- Trigger batch operations during transitions
- Maintain game clock state

**Key Functions**:

```typescript
function checkAndTransition(): GameState {
  const current = getGameState()
  const now = Date.now()
  const expiresAt = current.phase_start + current.phase_duration
  
  if (now < expiresAt) return current // No transition needed
  
  return db.transaction(() => {
    // Acquire row lock
    const locked = lockGameState()
    
    // Re-check after lock acquired (prevent race)
    if (locked.phase_start + locked.phase_duration > now) {
      return locked
    }
    
    const nextPhase = getNextPhase(locked.phase, locked.round)
    
    // Execute phase transition logic
    if (nextPhase.phase === 'ORDER_LOCK') {
      executeAllPendingOrders()
    }
    
    if (nextPhase.phase === 'RESULTS_DISPLAY') {
      updateLeaderboard()
    }
    
    // Update state
    updateGameState({
      round: nextPhase.round,
      phase: nextPhase.phase,
      phase_start: now,
      phase_duration: PHASE_DURATIONS[nextPhase.phase]
    })
    
    auditLog('phase_transition', { from: locked, to: nextPhase })
    
    return getGameState()
  })
}

function getNextPhase(currentPhase: string, currentRound: number) {
  const transitions = {
    NEWS_REVEAL: { phase: 'TRADING_OPEN', round: currentRound },
    TRADING_OPEN: { phase: 'ORDER_LOCK', round: currentRound },
    ORDER_LOCK: { phase: 'RESULTS_DISPLAY', round: currentRound },
    RESULTS_DISPLAY: { 
      phase: 'NEWS_REVEAL', 
      round: currentRound < 15 ? currentRound + 1 : 15 
    }
  }
  return transitions[currentPhase]
}
```

#### Order Executor Service

**Responsibilities**:
- Process all pending orders during ORDER_LOCK phase
- Apply slippage and brokerage fees
- Update team portfolios
- Execute approved P2P trades
- Record all transactions in audit log

**Key Functions**:

```typescript
function executeAllPendingOrders() {
  const orders = getPendingOrders()
  const p2pTrades = getApprovedP2PTrades()
  
  db.transaction(() => {
    // Process standard orders
    for (const order of orders) {
      try {
        if (order.type === 'buy') executeBuyOrder(order)
        else executeSellOrder(order)
        
        markOrderComplete(order.id)
        auditLog('order_executed', order)
      } catch (error) {
        markOrderFailed(order.id, error.message)
        auditLog('order_failed', { order, error })
      }
    }
    
    // Process P2P trades
    for (const trade of p2pTrades) {
      try {
        executeP2PTrade(trade)
        markP2PComplete(trade.id)
        auditLog('p2p_executed', trade)
      } catch (error) {
        markP2PFailed(trade.id, error.message)
        auditLog('p2p_failed', { trade, error })
      }
    }
  })
}

function executeBuyOrder(order: Order) {
  const nav = getCurrentNAV(order.fund_id)
  const team = getTeam(order.team_id)
  
  // Calculate costs with slippage
  const orderValue = order.quantity * nav
  const slippage = calculateSlippage(orderValue, team.starting_capital, 'buy')
  const effectiveNav = nav * (1 + slippage)
  const grossCost = order.quantity * effectiveNav
  const brokerageFee = grossCost * 0.002
  const totalCost = grossCost + brokerageFee
  
  // Revalidate (portfolio may have changed since submission)
  if (team.cash < totalCost) {
    throw new Error(`Insufficient cash: need ${totalCost}, have ${team.cash}`)
  }
  
  // Execute
  updateTeam(order.team_id, {
    cash: team.cash - totalCost,
    holdings: incrementHolding(team.holdings, order.fund_id, order.quantity)
  })
}

function executeSellOrder(order: Order) {
  const nav = getCurrentNAV(order.fund_id)
  const team = getTeam(order.team_id)
  
  // Calculate proceeds with slippage
  const orderValue = order.quantity * nav
  const slippage = calculateSlippage(orderValue, team.starting_capital, 'sell')
  const effectiveNav = nav * (1 - slippage)
  const grossProceeds = order.quantity * effectiveNav
  const brokerageFee = grossProceeds * 0.002
  const netProceeds = grossProceeds - brokerageFee
  
  // Revalidate
  const holding = team.holdings.find(h => h.fund_id === order.fund_id)
  if (!holding || holding.quantity < order.quantity) {
    throw new Error(`Insufficient holdings: need ${order.quantity}, have ${holding?.quantity || 0}`)
  }
  
  // Execute
  updateTeam(order.team_id, {
    cash: team.cash + netProceeds,
    holdings: decrementHolding(team.holdings, order.fund_id, order.quantity)
  })
}

function calculateSlippage(orderValue: number, startingCapital: number, direction: 'buy' | 'sell'): number {
  const threshold = startingCapital * 0.25
  if (orderValue <= threshold) return 0
  
  const excess = orderValue - threshold
  const slippageRate = 0.05
  return (excess / orderValue) * slippageRate * (direction === 'buy' ? 1 : -1)
}
```

#### NAV Manager Service

**Responsibilities**:
- Decrypt and load schedule data
- Update fund NAVs at round transitions
- Validate schedule uploads
- Enforce ±60% cumulative change constraint

**Key Functions**:

```typescript
function validateSchedule(csv: string): ValidationResult {
  const rows = parseCSV(csv)
  
  // Check dimensions
  if (rows.length !== 11) {
    return { valid: false, error: `Expected 11 funds, got ${rows.length}` }
  }
  
  for (const row of rows) {
    if (row.navValues.length !== 15) {
      return { valid: false, error: `Fund ${row.fundId}: expected 15 rounds, got ${row.navValues.length}` }
    }
    
    // Validate NAV values and change constraints
    const initialNav = row.navValues[0]
    for (let i = 0; i < row.navValues.length; i++) {
      const nav = row.navValues[i]
      
      if (nav <= 0) {
        return { valid: false, error: `Fund ${row.fundId}, Round ${i+1}: NAV must be positive, got ${nav}` }
      }
      
      const cumulativeChange = (nav - initialNav) / initialNav
      if (Math.abs(cumulativeChange) > 0.6) {
        return { valid: false, error: `Fund ${row.fundId}, Round ${i+1}: cumulative change ${(cumulativeChange*100).toFixed(1)}% exceeds ±60% limit` }
      }
    }
  }
  
  return { valid: true }
}

function encryptAndStoreSchedule(schedule: Schedule): string {
  const json = JSON.stringify(schedule)
  const encrypted = aes256.encrypt(process.env.SCHEDULE_KEY, json)
  const scheduleId = generateUUID()
  
  db.insert('schedules', {
    id: scheduleId,
    encrypted_data: encrypted,
    created_at: now(),
    locked: true
  })
  
  return scheduleId
}

function updateNAVsForRound(round: number) {
  const schedule = getDecryptedSchedule()
  
  for (const fund of schedule.funds) {
    const newNav = fund.navValues[round - 1] // 0-indexed
    updateFundNAV(fund.id, newNav)
  }
  
  auditLog('nav_update', { round, nav_count: schedule.funds.length })
}
```

#### Validator Service

**Responsibilities**:
- Check sufficient cash for buy orders
- Check sufficient holdings for sell orders
- Validate order parameters
- Validate P2P trade feasibility

**Key Functions**:

```typescript
function validateOrder(order: OrderSubmission, team: Team): ValidationResult {
  // Phase check
  const gameState = getGameState()
  if (gameState.phase !== 'TRADING_OPEN') {
    return { valid: false, error: `Trading closed during ${gameState.phase} phase` }
  }
  
  // Fund exists and is tradeable
  const fund = getFund(order.fund_id)
  if (!fund || fund.is_cash) {
    return { valid: false, error: `Invalid fund: ${order.fund_id}` }
  }
  
  // Quantity positive
  if (order.quantity <= 0) {
    return { valid: false, error: 'Quantity must be positive' }
  }
  
  if (order.type === 'buy') {
    const nav = getCurrentNAV(order.fund_id)
    const estimatedCost = order.quantity * nav * 1.002 // Include brokerage
    const withSlippage = estimatedCost * 1.05 // Worst-case slippage
    
    if (team.cash < withSlippage) {
      return { 
        valid: false, 
        error: `Insufficient cash: need ${formatCurrency(withSlippage)} (with max slippage), available ${formatCurrency(team.cash)}` 
      }
    }
  } else {
    const holding = team.holdings.find(h => h.fund_id === order.fund_id)
    if (!holding || holding.quantity < order.quantity) {
      return { 
        valid: false, 
        error: `Insufficient holdings: need ${order.quantity} units, have ${holding?.quantity || 0}` 
      }
    }
  }
  
  return { valid: true }
}
```

## Data Models

### Database Schema (PostgreSQL with Row-Level Security)

#### teams table
```sql
CREATE TABLE teams (
  id SERIAL PRIMARY KEY,
  team_code VARCHAR(20) UNIQUE NOT NULL,
  team_name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  starting_capital NUMERIC(15,2) DEFAULT 100000000, -- ₹100 Crores
  created_at TIMESTAMP DEFAULT NOW()
);

-- RLS Policy: teams can only read their own data
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_isolation ON teams
  FOR SELECT
  USING (id = current_setting('app.current_team_id')::int);
```

#### portfolios table
```sql
CREATE TABLE portfolios (
  team_id INTEGER PRIMARY KEY REFERENCES teams(id),
  cash NUMERIC(15,2) NOT NULL DEFAULT 100000000,
  last_updated TIMESTAMP DEFAULT NOW(),
  CONSTRAINT positive_cash CHECK (cash >= 0)
);

-- RLS Policy: teams can only modify their own portfolio through Game Engine
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
CREATE POLICY portfolio_read ON portfolios
  FOR SELECT
  USING (team_id = current_setting('app.current_team_id')::int);
CREATE POLICY portfolio_write ON portfolios
  FOR UPDATE
  USING (current_setting('app.role')::text = 'game_engine');
```

#### holdings table
```sql
CREATE TABLE holdings (
  id SERIAL PRIMARY KEY,
  team_id INTEGER REFERENCES teams(id),
  fund_id INTEGER REFERENCES funds(id),
  quantity NUMERIC(15,4) NOT NULL DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  CONSTRAINT positive_quantity CHECK (quantity >= 0),
  UNIQUE(team_id, fund_id)
);

-- RLS Policy: same as portfolios
ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY holdings_read ON holdings
  FOR SELECT
  USING (team_id = current_setting('app.current_team_id')::int);
CREATE POLICY holdings_write ON holdings
  FOR UPDATE
  USING (current_setting('app.role')::text = 'game_engine');
```

#### funds table
```sql
CREATE TABLE funds (
  id SERIAL PRIMARY KEY,
  fund_code VARCHAR(20) UNIQUE NOT NULL,
  fund_name VARCHAR(100) NOT NULL,
  is_cash BOOLEAN DEFAULT FALSE,
  current_nav NUMERIC(15,4),
  last_nav_update TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed data: 11 investable funds + 1 cash
-- Example: TECH, PHARMA, ENERGY, BANKING, CONSUMER, AUTO, INFRA, METALS, TELECOM, REALTY, FMCG, CASH
```

#### game_state table
```sql
CREATE TABLE game_state (
  id INTEGER PRIMARY KEY DEFAULT 1,
  current_round INTEGER NOT NULL DEFAULT 1,
  current_phase VARCHAR(20) NOT NULL DEFAULT 'NEWS_REVEAL',
  phase_start TIMESTAMP NOT NULL DEFAULT NOW(),
  phase_duration INTEGER NOT NULL, -- seconds
  is_paused BOOLEAN DEFAULT FALSE,
  paused_at TIMESTAMP,
  remaining_time INTEGER, -- seconds remaining when paused
  CONSTRAINT single_row CHECK (id = 1)
);

-- Only one row ever exists
INSERT INTO game_state (id, phase_duration) VALUES (1, 60);
```

#### pending_orders table
```sql
CREATE TABLE pending_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id INTEGER REFERENCES teams(id),
  fund_id INTEGER REFERENCES funds(id),
  order_type VARCHAR(10) NOT NULL, -- 'buy' or 'sell'
  quantity NUMERIC(15,4) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  round INTEGER NOT NULL,
  CONSTRAINT valid_type CHECK (order_type IN ('buy', 'sell'))
);

-- Cleared after each ORDER_LOCK phase execution
CREATE INDEX idx_pending_orders_round ON pending_orders(round);
```

#### executed_orders table
```sql
CREATE TABLE executed_orders (
  id UUID PRIMARY KEY,
  team_id INTEGER REFERENCES teams(id),
  fund_id INTEGER REFERENCES funds(id),
  order_type VARCHAR(10) NOT NULL,
  quantity NUMERIC(15,4) NOT NULL,
  nav_at_execution NUMERIC(15,4) NOT NULL,
  slippage_applied NUMERIC(15,4) DEFAULT 0,
  effective_nav NUMERIC(15,4) NOT NULL,
  brokerage_fee NUMERIC(15,4) NOT NULL,
  total_value NUMERIC(15,2) NOT NULL, -- cash deducted or added
  executed_at TIMESTAMP DEFAULT NOW(),
  round INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'completed', -- 'completed' or 'failed'
  error_message TEXT
);

CREATE INDEX idx_executed_orders_team ON executed_orders(team_id, executed_at);
```

#### p2p_trades table
```sql
CREATE TABLE p2p_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer_team_id INTEGER REFERENCES teams(id),
  counterparty_team_id INTEGER REFERENCES teams(id),
  fund_id INTEGER REFERENCES funds(id),
  quantity NUMERIC(15,4) NOT NULL,
  agreed_price NUMERIC(15,4) NOT NULL,
  proposer_direction VARCHAR(10) NOT NULL, -- 'buy' or 'sell'
  status VARCHAR(20) DEFAULT 'awaiting_approval',
  created_at TIMESTAMP DEFAULT NOW(),
  approved_by VARCHAR(100), -- admin username
  approved_at TIMESTAMP,
  executed_at TIMESTAMP,
  error_message TEXT,
  CONSTRAINT valid_direction CHECK (proposer_direction IN ('buy', 'sell')),
  CONSTRAINT valid_status CHECK (status IN ('awaiting_approval', 'approved', 'rejected', 'completed', 'failed'))
);

CREATE INDEX idx_p2p_status ON p2p_trades(status) WHERE status = 'awaiting_approval';
```

#### schedules table
```sql
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encrypted_data TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  locked BOOLEAN DEFAULT TRUE,
  uploaded_by VARCHAR(100), -- admin username
  CONSTRAINT immutable_schedule CHECK (locked = TRUE)
);
```

#### news_feed table
```sql
CREATE TABLE news_feed (
  id SERIAL PRIMARY KEY,
  round INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(round)
);

CREATE INDEX idx_news_round ON news_feed(round);
```

#### audit_log table (immutable append-only)
```sql
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  team_id INTEGER REFERENCES teams(id),
  admin_username VARCHAR(100),
  round INTEGER,
  event_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- RLS: No updates or deletes ever allowed
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_append_only ON audit_log
  FOR INSERT
  WITH CHECK (TRUE);
CREATE POLICY audit_read_all ON audit_log
  FOR SELECT
  USING (current_setting('app.role')::text IN ('game_engine', 'admin'));

-- Prevent updates and deletes at database level
REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC;

CREATE INDEX idx_audit_team ON audit_log(team_id, created_at);
CREATE INDEX idx_audit_type ON audit_log(event_type, created_at);
```

#### sessions table
```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id INTEGER REFERENCES teams(id),
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  last_activity TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_sessions_token ON sessions(token_hash) WHERE is_active = TRUE;
CREATE INDEX idx_sessions_expiry ON sessions(expires_at) WHERE is_active = TRUE;
```

### TypeScript Type Definitions

```typescript
// Core domain types
type TeamId = number
type FundId = number
type OrderId = string
type TradeId = string

type RoundNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15
type Phase = 'NEWS_REVEAL' | 'TRADING_OPEN' | 'ORDER_LOCK' | 'RESULTS_DISPLAY'
type OrderType = 'buy' | 'sell'
type P2PStatus = 'awaiting_approval' | 'approved' | 'rejected' | 'completed' | 'failed'

interface GameState {
  round: RoundNumber
  phase: Phase
  phase_start: number // timestamp
  phase_duration: number // seconds
  time_remaining: number // computed
  is_paused: boolean
}

interface Team {
  id: TeamId
  team_code: string
  team_name: string
  starting_capital: number
}

interface Portfolio {
  team_id: TeamId
  cash: number
  holdings: Holding[]
  total_value: number // computed
  last_updated: number
}

interface Holding {
  fund_id: FundId
  quantity: number
  current_nav: number
  market_value: number // quantity * current_nav
}

interface Fund {
  id: FundId
  fund_code: string
  fund_name: string
  is_cash: boolean
  current_nav: number
  last_nav_update: number
}

interface Order {
  id: OrderId
  team_id: TeamId
  fund_id: FundId
  order_type: OrderType
  quantity: number
  created_at: number
  round: RoundNumber
}

interface ExecutedOrder extends Order {
  nav_at_execution: number
  slippage_applied: number
  effective_nav: number
  brokerage_fee: number
  total_value: number
  executed_at: number
  status: 'completed' | 'failed'
  error_message?: string
}

interface P2PTrade {
  id: TradeId
  proposer_team_id: TeamId
  counterparty_team_id: TeamId
  fund_id: FundId
  quantity: number
  agreed_price: number
  proposer_direction: OrderType
  status: P2PStatus
  created_at: number
  approved_by?: string
  approved_at?: number
  executed_at?: number
  error_message?: string
}

interface LeaderboardEntry {
  rank: number
  team_id: TeamId
  team_name: string
  portfolio_value: number
  change_from_start: number // percentage
}

interface AuditLogEntry {
  id: bigint
  event_type: string
  team_id?: TeamId
  admin_username?: string
  round?: RoundNumber
  event_data: Record<string, unknown>
  created_at: number
}

interface Schedule {
  funds: {
    id: FundId
    navValues: number[] // length 15, one per round
  }[]
}

// API request/response types
interface LoginRequest {
  team_code: string
  password: string
}

interface LoginResponse {
  token: string
  team_id: TeamId
  team_name: string
}

interface OrderSubmission {
  fund_id: FundId
  type: OrderType
  quantity: number
}

interface OrderResponse {
  order_id: OrderId
  status: 'pending'
  estimated_cost: number
}

interface P2PProposal {
  counterparty_team_id: TeamId
  fund_id: FundId
  quantity: number
  price_per_unit: number
  direction: OrderType
}

interface ValidationResult {
  valid: boolean
  error?: string
}
```

## Security Implementation

### Row-Level Security (RLS)

**Goal**: Prevent teams from reading or modifying other teams' data, even if client is compromised.

**Implementation**:
1. All portfolio, holdings, and order tables have RLS enabled
2. Database connection sets `app.current_team_id` session variable from JWT
3. Policies enforce: `team_id = current_setting('app.current_team_id')::int`
4. Game Engine uses elevated `app.role = 'game_engine'` for batch operations
5. Admin Console uses `app.role = 'admin'` for monitoring and disputes

**SQL Connection Setup**:
```typescript
async function getTeamConnection(teamId: TeamId) {
  const conn = await pool.connect()
  await conn.query('SET app.current_team_id = $1', [teamId])
  await conn.query("SET app.role = 'team'")
  return conn
}

async function getGameEngineConnection() {
  const conn = await pool.connect()
  await conn.query("SET app.role = 'game_engine'")
  return conn
}
```

### JWT Authentication

**Token Structure**:
```typescript
interface JWTPayload {
  team_id: TeamId
  team_code: string
  iat: number // issued at
  exp: number // expires at (iat + 4 hours)
}
```

**Token Generation**:
```typescript
function generateToken(team: Team): string {
  const payload: JWTPayload = {
    team_id: team.id,
    team_code: team.team_code,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 14400 // 4 hours
  }
  return jwt.sign(payload, process.env.JWT_SECRET)
}
```

**Token Validation Middleware**:
```typescript
async function authenticateRequest(req: Request): Promise<TeamId> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing token')
  }
  
  const token = authHeader.substring(7)
  
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET) as JWTPayload
    
    // Check session still active in database
    const session = await db.query(
      'SELECT is_active, expires_at FROM sessions WHERE token_hash = $1',
      [hashToken(token)]
    )
    
    if (!session || !session.is_active || session.expires_at < Date.now()) {
      throw new UnauthorizedError('Session expired')
    }
    
    // Update last activity
    await db.query(
      'UPDATE sessions SET last_activity = NOW() WHERE token_hash = $1',
      [hashToken(token)]
    )
    
    return payload.team_id
  } catch (error) {
    throw new UnauthorizedError('Invalid token')
  }
}
```

### Schedule Encryption

**Encryption Method**: AES-256-CBC

**Key Storage**: Environment variable `SCHEDULE_KEY` (not in codebase)

**Encryption**:
```typescript
import crypto from 'crypto'

function encryptSchedule(schedule: Schedule): string {
  const json = JSON.stringify(schedule)
  const key = Buffer.from(process.env.SCHEDULE_KEY, 'hex')
  const iv = crypto.randomBytes(16)
  
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  let encrypted = cipher.update(json, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  // Prepend IV to encrypted data
  return iv.toString('hex') + ':' + encrypted
}

function decryptSchedule(encrypted: string): Schedule {
  const [ivHex, encryptedData] = encrypted.split(':')
  const key = Buffer.from(process.env.SCHEDULE_KEY, 'hex')
  const iv = Buffer.from(ivHex, 'hex')
  
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return JSON.parse(decrypted)
}
```

### Rate Limiting

**Implementation**: Token bucket algorithm per team

**Limits**:
- 100 requests per minute per team
- 10 order submissions per minute per team
- 5 P2P proposals per minute per team

**Middleware**:
```typescript
const rateLimitStore = new Map<TeamId, { tokens: number, lastRefill: number }>()

async function checkRateLimit(teamId: TeamId, cost: number = 1): Promise<void> {
  const now = Date.now()
  const bucket = rateLimitStore.get(teamId) || { tokens: 100, lastRefill: now }
  
  // Refill tokens based on time elapsed
  const elapsed = (now - bucket.lastRefill) / 1000 // seconds
  const refillAmount = Math.floor(elapsed * (100 / 60)) // 100 tokens per 60 seconds
  bucket.tokens = Math.min(100, bucket.tokens + refillAmount)
  bucket.lastRefill = now
  
  if (bucket.tokens < cost) {
    throw new TooManyRequestsError('Rate limit exceeded. Try again in a few seconds.')
  }
  
  bucket.tokens -= cost
  rateLimitStore.set(teamId, bucket)
}
```

### Audit Logging

**Events Logged**:
- `phase_transition` - Round/phase changes
- `order_submitted` - Order entry
- `order_executed` - Order completion
- `order_failed` - Order execution failure
- `p2p_proposed` - P2P trade creation
- `p2p_approved` - Admin approval
- `p2p_rejected` - Admin rejection
- `p2p_executed` - P2P completion
- `manual_adjustment` - Admin portfolio edit
- `admin_action` - Any admin control action
- `nav_update` - Schedule-based price changes
- `login` - Session creation
- `logout` - Session termination

**Logging Function**:
```typescript
async function auditLog(
  eventType: string,
  data: {
    teamId?: TeamId
    adminUsername?: string
    round?: RoundNumber
    details: Record<string, unknown>
  }
) {
  await db.query(
    `INSERT INTO audit_log (event_type, team_id, admin_username, round, event_data, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [eventType, data.teamId, data.adminUsername, data.round, JSON.stringify(data.details)]
  )
}
```

## Error Handling

### Error Categories

1. **Validation Errors** (HTTP 400)
   - Insufficient cash/holdings
   - Invalid fund ID
   - Negative quantities
   - Wrong phase for action

2. **Authentication Errors** (HTTP 401)
   - Missing token
   - Expired session
   - Invalid credentials

3. **Authorization Errors** (HTTP 403)
   - Attempting to access other team's data
   - Non-admin accessing admin endpoints

4. **Rate Limit Errors** (HTTP 429)
   - Exceeded request quota

5. **Server Errors** (HTTP 500)
   - Database connection failures
   - Unexpected exceptions

### Error Response Format

```typescript
interface ErrorResponse {
  error: {
    code: string // machine-readable
    message: string // human-readable
    details?: Record<string, unknown>
  }
}
```

**Examples**:
```json
{
  "error": {
    "code": "INSUFFICIENT_CASH",
    "message": "Insufficient cash: need ₹5.2 Cr (with max slippage), available ₹3.1 Cr",
    "details": {
      "required": 52000000,
      "available": 31000000,
      "shortfall": 21000000
    }
  }
}
```

```json
{
  "error": {
    "code": "WRONG_PHASE",
    "message": "Trading closed during ORDER_LOCK phase",
    "details": {
      "current_phase": "ORDER_LOCK",
      "required_phase": "TRADING_OPEN"
    }
  }
}
```

### Client Error Handling

```typescript
async function submitOrder(order: OrderSubmission) {
  try {
    const response = await fetch('/api/order/submit', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(order)
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new APIError(errorData.error.code, errorData.error.message, errorData.error.details)
    }
    
    return await response.json()
  } catch (error) {
    if (error instanceof APIError) {
      // Display to user
      toast.error(error.message)
      
      // Log for debugging
      console.error('Order submission failed:', error.code, error.details)
    } else {
      // Network error - retry
      toast.error('Connection lost - retrying...')
      await sleep(1000)
      return submitOrder(order) // recursive retry
    }
  }
}
```

## Testing Strategy

### Unit Tests

**Coverage Areas**:
- Order validation logic (cash checks, holdings checks)
- Slippage calculation (threshold detection, percentage application)
- Brokerage fee calculation
- NAV schedule validation (dimensions, change constraints)
- Phase transition logic (timer expiry, next phase determination)
- Cash erosion formula (0.995^15 calculation)
- Leaderboard ranking (sorting, tie-breaking)

**Example Test**:
```typescript
describe('calculateSlippage', () => {
  it('returns 0 when order under 25% threshold', () => {
    const orderValue = 20_000_000 // ₹20 Cr
    const startingCapital = 100_000_000 // ₹100 Cr
    expect(calculateSlippage(orderValue, startingCapital, 'buy')).toBe(0)
  })
  
  it('applies 5% penalty to excess for buy orders', () => {
    const orderValue = 30_000_000 // ₹30 Cr
    const startingCapital = 100_000_000 // ₹100 Cr
    const threshold = 25_000_000 // ₹25 Cr
    const excess = 5_000_000 // ₹5 Cr
    const expectedSlippage = (excess / orderValue) * 0.05 // ~0.0083
    expect(calculateSlippage(orderValue, startingCapital, 'buy')).toBeCloseTo(expectedSlippage, 4)
  })
})
```

### Integration Tests

**Scenarios**:
1. Full order lifecycle: submit → execute → portfolio update → audit log
2. P2P trade flow: propose → admin approve → execute → both portfolios update
3. Round transition: phase expiry → state machine trigger → NAV update → order execution
4. Concurrent order submission: 80 teams submitting simultaneously
5. Session management: login → extend → timeout → logout

**Example Test**:
```typescript
describe('Order Execution Integration', () => {
  it('executes buy order and updates portfolio correctly', async () => {
    // Setup
    const team = await createTestTeam({ cash: 50_000_000 })
    const fund = await createTestFund({ nav: 100 })
    await setGameState({ phase: 'TRADING_OPEN' })
    
    // Submit order
    const order = await submitOrder({
      team_id: team.id,
      fund_id: fund.id,
      type: 'buy',
      quantity: 1000
    })
    
    expect(order.status).toBe('pending')
    
    // Trigger phase transition to ORDER_LOCK
    await transitionToOrderLock()
    
    // Verify execution
    const executedOrder = await getExecutedOrder(order.id)
    expect(executedOrder.status).toBe('completed')
    expect(executedOrder.effective_nav).toBe(100)
    expect(executedOrder.brokerage_fee).toBeCloseTo(200, 2) // 0.2% of 100k
    
    // Verify portfolio
    const portfolio = await getPortfolio(team.id)
    expect(portfolio.cash).toBeCloseTo(49_899_800, 2) // 50M - 100k - 200
    
    const holding = portfolio.holdings.find(h => h.fund_id === fund.id)
    expect(holding.quantity).toBe(1000)
    
    // Verify audit log
    const auditEntries = await getAuditLog({ team_id: team.id, event_type: 'order_executed' })
    expect(auditEntries).toHaveLength(1)
    expect(auditEntries[0].event_data.order_id).toBe(order.id)
  })
})
```

### Load Tests

**Tools**: k6, Apache Bench

**Scenarios**:
1. **Polling Load**: 400 clients polling game state every 2-3s for 15 minutes
2. **Order Burst**: 80 teams each submitting 5 orders within 10 seconds
3. **Phase Transition**: State machine handling 400 concurrent polls during phase expiry
4. **Leaderboard Computation**: 400 clients requesting leaderboard after NAV update

**Target Metrics**:
- P95 order confirmation latency < 1 second
- P95 poll response time < 500ms
- Order execution batch < 30 seconds for 80 teams
- Zero failed requests under normal load

**Example k6 Script**:
```javascript
import http from 'k6/http'
import { check, sleep } from 'k6'

export let options = {
  vus: 400, // 400 concurrent users
  duration: '15m'
}

export default function() {
  const token = __ENV.TEST_TOKEN
  
  // Poll game state
  let res = http.get('https://market-mayhem.vercel.app/api/game/state', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500
  })
  
  sleep(2 + Math.random()) // 2-3s jitter
}
```

### End-to-End Tests

**Tools**: Playwright

**User Flows**:
1. Team login → view portfolio → submit buy order → wait for execution → verify portfolio updated
2. Admin login → upload schedule → start game → advance phases manually → verify team states
3. Team proposes P2P trade → admin approves → verify both portfolios updated
4. Multiple teams trading simultaneously → verify leaderboard updates correctly

**Example Playwright Test**:
```typescript
test('complete trading cycle', async ({ page }) => {
  // Login
  await page.goto('/login')
  await page.fill('[name=team_code]', 'TEAM01')
  await page.fill('[name=password]', 'test123')
  await page.click('[type=submit]')
  
  // Wait for dashboard
  await expect(page.locator('.portfolio-value')).toBeVisible()
  const initialCash = await page.locator('.cash-balance').textContent()
  
  // Submit buy order
  await page.click('[href="/trade"]')
  await page.selectOption('[name=fund_id]', 'TECH')
  await page.fill('[name=quantity]', '500')
  await page.click('button:has-text("Buy")')
  
  // Wait for confirmation
  await expect(page.locator('.toast-success')).toBeVisible()
  
  // Wait for order execution (ORDER_LOCK phase)
  await page.waitForTimeout(300000) // 5 minutes
  
  // Verify portfolio updated
  await page.goto('/portfolio')
  const finalCash = await page.locator('.cash-balance').textContent()
  expect(parseFloat(finalCash)).toBeLessThan(parseFloat(initialCash))
  
  const techHolding = await page.locator('[data-fund="TECH"] .quantity').textContent()
  expect(parseFloat(techHolding)).toBe(500)
})
```

## Deployment Strategy

### Environment Configuration

**Environment Variables**:
```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/marketmayhem
DATABASE_POOL_SIZE=20

# Authentication
JWT_SECRET=<256-bit-secret>
SESSION_TIMEOUT_HOURS=4

# Encryption
SCHEDULE_KEY=<256-bit-hex-key>

# Rate Limiting
RATE_LIMIT_REQUESTS_PER_MINUTE=100
RATE_LIMIT_ORDERS_PER_MINUTE=10

# Monitoring
SENTRY_DSN=<sentry-project-url>
LOG_LEVEL=info
```

### Vercel Configuration

**vercel.json**:
```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "framework": "nextjs",
  "regions": ["bom1"],
  "functions": {
    "api/**/*.ts": {
      "maxDuration": 10,
      "memory": 1024
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-store, must-revalidate"
        }
      ]
    }
  ]
}
```

### Supabase Configuration

**Database Initialization**:
```sql
-- Run migrations in order
\i migrations/001_create_tables.sql
\i migrations/002_enable_rls.sql
\i migrations/003_create_indexes.sql
\i migrations/004_seed_funds.sql
\i migrations/005_create_teams.sql
```

**Connection Pooling**:
- Use Supabase's built-in PgBouncer
- Transaction mode for write operations
- Session mode for read operations
- Max connections: 20 (within free tier limit)

### Deployment Steps

1. **Pre-Deployment**:
   - Run unit tests: `npm test`
   - Run integration tests: `npm run test:integration`
   - Build locally: `npm run build`
   - Check bundle size: `npm run analyze`

2. **Database Migration**:
   - Apply migrations to production database
   - Verify RLS policies active
   - Seed initial data (teams, funds)

3. **Vercel Deployment**:
   - Push to `main` branch (triggers auto-deploy)
   - Verify environment variables set
   - Run smoke tests against production

4. **Post-Deployment Verification**:
   - Test login flow
   - Test order submission
   - Test admin console
   - Verify polling works
   - Check error tracking active

### Monitoring and Observability

**Metrics to Track**:
- Order submission latency (P50, P95, P99)
- Poll response times
- Order execution batch duration
- Database query performance
- API error rates by endpoint
- Concurrent sessions count
- Cache hit rates

**Alerting**:
- P95 latency > 2 seconds
- Error rate > 1%
- Database connection pool exhaustion
- Rate limit violations > 100/minute

**Logging**:
```typescript
import * as Sentry from '@sentry/nextjs'

// Error tracking
Sentry.captureException(error, {
  tags: { team_id, endpoint },
  extra: { request_body, response_status }
})

// Performance monitoring
const transaction = Sentry.startTransaction({ name: 'order_execution' })
// ... execute orders ...
transaction.finish()
```

### Rollback Procedure

1. Identify issue in monitoring dashboard
2. Roll back Vercel deployment to previous version
3. If database migration caused issue:
   - Run down migration
   - Restore from backup if needed
4. Notify teams of rollback and expected resolution time

### Backup Strategy

- **Database**: Automated daily backups via Supabase (7-day retention)
- **Manual Snapshots**: Before each game session starts
- **Audit Log Export**: Weekly CSV exports to S3-compatible storage
- **Schedule Files**: Keep encrypted originals in secure storage

---

This design document provides the technical foundation for implementing Market Mayhem within the zero-cost constraints while maintaining security, performance, and correctness requirements. The next phase will break this design into specific implementation tasks with property-based testing specifications.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified the following testable properties. Many criteria test the same underlying behavior from different angles, so I've consolidated related properties:

**Redundancies Eliminated**:
- Requirements 7.2 and 9.2 both test cash deduction on buy orders → Combined into Property 5 (buy order execution)
- Requirements 7.4 and 9.3 both test cash increase on sell orders → Combined into Property 6 (sell order execution)
- Requirements 8.2, 8.3, and 8.5 all test slippage calculation → Combined into Property 7 (slippage formula)
- Requirements 9.1, 9.4, and 9.5 all test brokerage fee → Integrated into Properties 5 and 6
- Requirements 11.4 and 11.5 both test portfolio valuation → Combined into Property 10 (portfolio valuation formula)
- Requirements 14.1 and 14.2 both test P2P transfer mechanics → Combined into Property 16 (P2P execution)
- Requirements 15.1 and 15.5 both test leaderboard sorting → Combined into Property 18 (leaderboard ordering)

### Property 1: Authentication with Valid Credentials

*For any* valid team credentials (team_code, password_hash), authentication SHALL succeed and return a valid session token containing the team_id.

**Validates: Requirements 1.3, 1.8**

### Property 2: Concurrent Session Consistency

*For any* team with multiple active sessions, all sessions SHALL return identical portfolio state (cash, holdings, total_value) when queried at the same logical time.

**Validates: Requirements 1.5, 1.6**

### Property 3: Unique Credential Enforcement

*For any* participant credentials, attempting to create a duplicate participant with the same credentials SHALL fail with a uniqueness constraint violation.

**Validates: Requirements 1.7**

### Property 4: Capital Allocation Invariant

*For any* game state, the sum of all team cash balances plus the total market value of all holdings SHALL equal ₹8,000 Crores (initial capital allocation), accounting for brokerage fees deducted.

**Validates: Requirements 2.4**

### Property 5: Buy Order Execution Formula

*For any* valid buy order (fund_id, quantity, team_id) executed at NAV N with starting capital C:
- effective_NAV = N × (1 + slippage_rate) where slippage_rate = max(0, 0.05 × (order_value - 0.25×C) / order_value)
- gross_cost = quantity × effective_NAV
- brokerage_fee = gross_cost × 0.002
- total_cost = gross_cost + brokerage_fee
- team.cash SHALL decrease by exactly total_cost
- team.holdings[fund_id] SHALL increase by exactly quantity

**Validates: Requirements 7.2, 7.3, 8.2, 8.5, 9.1, 9.2, 9.5**

### Property 6: Sell Order Execution Formula

*For any* valid sell order (fund_id, quantity, team_id) executed at NAV N with starting capital C:
- effective_NAV = N × (1 - slippage_rate) where slippage_rate = max(0, 0.05 × (order_value - 0.25×C) / order_value)
- gross_proceeds = quantity × effective_NAV
- brokerage_fee = gross_proceeds × 0.002
- net_proceeds = gross_proceeds - brokerage_fee
- team.cash SHALL increase by exactly net_proceeds
- team.holdings[fund_id] SHALL decrease by exactly quantity

**Validates: Requirements 7.4, 7.5, 8.3, 8.5, 9.1, 9.3, 9.5**

### Property 7: Slippage Threshold Classification

*For any* order with value V and team starting capital C:
- IF V ≤ 0.25 × C THEN slippage = 0
- IF V > 0.25 × C THEN slippage > 0 AND slippage = 0.05 × (V - 0.25×C) / V

**Validates: Requirements 8.1, 8.5**

### Property 8: Order Validation - Sufficient Cash

*For any* buy order submission (fund_id, quantity) by a team:
- LET estimated_cost = quantity × current_NAV × 1.002 × 1.05 (worst-case with max slippage)
- IF team.cash < estimated_cost THEN validation SHALL fail with "Insufficient cash" error
- IF team.cash ≥ estimated_cost THEN validation SHALL succeed (subject to other checks)

**Validates: Requirements 6.4**

### Property 9: Order Validation - Sufficient Holdings

*For any* sell order submission (fund_id, quantity) by a team:
- IF team.holdings[fund_id] < quantity THEN validation SHALL fail with "Insufficient holdings" error
- IF team.holdings[fund_id] ≥ quantity THEN validation SHALL succeed (subject to other checks)

**Validates: Requirements 6.5**

### Property 10: Portfolio Valuation Formula

*For any* portfolio state at time T:
- market_value(holding) = holding.quantity × fund.current_NAV
- total_portfolio_value = team.cash + Σ(market_value(holding) for all holdings)

**Validates: Requirements 11.4, 11.5**

### Property 11: Phase Transition Determinism

*For any* current game state (round R, phase P, phase_start T):
- IF now() > T + duration(P) THEN next_state SHALL be:
  - NEWS_REVEAL → (R, TRADING_OPEN, now(), 300)
  - TRADING_OPEN → (R, ORDER_LOCK, now(), 120)
  - ORDER_LOCK → (R, RESULTS_DISPLAY, now(), 60)
  - RESULTS_DISPLAY → (R+1, NEWS_REVEAL, now(), 60) if R < 15
  - RESULTS_DISPLAY → (15, RESULTS_DISPLAY, T, duration) if R = 15 (game complete)

**Validates: Requirements 4.3, 4.4, 4.5, 4.6, 4.7**

### Property 12: Order Execution Completeness

*For any* set of pending orders at transition to ORDER_LOCK phase:
- ALL orders SHALL be either executed (status='completed') OR failed (status='failed') by end of ORDER_LOCK phase
- NO order SHALL remain in pending state after ORDER_LOCK completes

**Validates: Requirements 7.1, 7.8**

### Property 13: NAV Schedule Validation

*For any* schedule file with funds F and rounds R:
- File SHALL contain exactly |F| × |R| = 11 × 15 = 165 NAV entries
- *For any* fund f and round r: NAV(f, r) > 0
- *For any* fund f and round r: |(NAV(f, r) - NAV(f, 1)) / NAV(f, 1)| ≤ 0.60

**Validates: Requirements 10.2, 10.3**

### Property 14: NAV Constancy Within Round

*For any* fund f during round R (from NEWS_REVEAL start until RESULTS_DISPLAY end):
- fund.current_NAV SHALL remain constant
- NAV SHALL only change at transition from RESULTS_DISPLAY(R) to NEWS_REVEAL(R+1)

**Validates: Requirements 10.7, 10.8**

### Property 15: Schedule Immutability

*For any* schedule that has been encrypted and stored (locked=true):
- Attempts to modify schedule data SHALL fail
- Schedule SHALL remain bit-for-bit identical until game completion

**Validates: Requirements 10.6**

### Property 16: P2P Trade Execution Transfer

*For any* approved P2P trade (proposer_team P, counterparty_team C, fund F, quantity Q, agreed_price A) where proposer direction is 'buy':
- P.holdings[F] SHALL increase by Q
- C.holdings[F] SHALL decrease by Q
- P.cash SHALL decrease by (Q × A × 1.002) [including brokerage]
- C.cash SHALL increase by (Q × A × 0.998) [net of brokerage]
- NO slippage SHALL be applied regardless of trade size

(Inverse transfers apply when proposer direction is 'sell')

**Validates: Requirements 14.1, 14.2, 14.3, 14.7**

### Property 17: P2P Re-validation at Execution

*For any* approved P2P trade at execution time:
- IF proposer selling: proposer.holdings[fund] < quantity THEN status='failed'
- IF proposer buying: proposer.cash < (quantity × price × 1.002) THEN status='failed'
- IF counterparty selling: counterparty.holdings[fund] < quantity THEN status='failed'
- IF counterparty buying: counterparty.cash < (quantity × price × 1.002) THEN status='failed'
- Otherwise: execution proceeds and status='completed'

**Validates: Requirements 14.4, 14.5**

### Property 18: Leaderboard Ordering

*For any* leaderboard computation at time T:
- Teams SHALL be ordered descending by portfolio_value
- IF team_A.portfolio_value = team_B.portfolio_value THEN order by reached_value_timestamp ascending (earliest first)
- Rank(team) = 1 + count(teams with portfolio_value > team.portfolio_value)

**Validates: Requirements 15.1, 15.4, 15.5, 15.6**

### Property 19: Final Score Cash Erosion

*For any* team at game completion (after round 15):
- eroded_cash = team.cash × (0.995^15)
- final_portfolio_value = eroded_cash + Σ(holding.quantity × holding.current_NAV)
- final_rank = position in descending sort by final_portfolio_value (with timestamp tie-breaking)

**Validates: Requirements 16.2, 16.3, 16.4, 16.5, 16.6**

### Property 20: Audit Log Immutability

*For any* audit log entry once written:
- Entry SHALL NOT be modifiable (UPDATE operations SHALL fail)
- Entry SHALL NOT be deletable (DELETE operations SHALL fail)
- Entry timestamp SHALL be monotonically increasing
- Entry id SHALL be unique and auto-incrementing

**Validates: Requirements 7.7, 13.7, 14.6, 16.7**

### Property 21: Order Error Messages

*For any* invalid order submission:
- Validation failure SHALL return a non-empty error message
- Error message SHALL contain specific reason (e.g., "Insufficient cash: need X, have Y")
- Error message SHALL be human-readable

**Validates: Requirements 6.6, 30.1, 30.2**

### Property 22: P2P Approval Authorization

*For any* P2P trade in state 'awaiting_approval':
- Trade SHALL NOT transition to 'completed' status without first being 'approved'
- Only admin role SHALL be able to transition from 'awaiting_approval' to 'approved' or 'rejected'

**Validates: Requirements 12.6, 13.3, 13.4**

### Property 23: NAV History Persistence

*For any* fund F and round R where R has completed:
- Historical NAV(F, R) SHALL be retrievable from database
- NAV history SHALL span all completed rounds [1..R]

**Validates: Requirements 3.6**

