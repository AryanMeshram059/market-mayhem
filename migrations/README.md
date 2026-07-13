# Market Mayhem Platform - Database Migrations

This directory contains PostgreSQL migration scripts for the Market Mayhem platform database schema. Migrations are organized into logical phases and should be executed in numerical order.

## Migration Files

### 1. `001_create_core_tables.sql`
Creates all core tables for the Market Mayhem platform:

**Tables Created:**
- `teams` - Team information and credentials
- `funds` - Tradeable financial instruments (11 investable + 1 cash)
- `portfolios` - Team cash balances
- `holdings` - Team fund holdings
- `game_state` - Current round, phase, and game timing
- `pending_orders` - Orders awaiting execution
- `executed_orders` - Completed and failed order history
- `p2p_trades` - Peer-to-peer trades between teams
- `schedules` - Encrypted NAV schedule for all rounds
- `news_feed` - Market news for each round
- `audit_log` - Immutable audit trail of all state changes
- `sessions` - Authenticated user sessions

**Key Features:**
- All PRIMARY KEY constraints
- FOREIGN KEY constraints with appropriate ON DELETE actions
- CHECK constraints for business logic validation
- UNIQUE constraints to prevent duplicate data
- Comprehensive column documentation

**Constraints Applied:**
- `teams`: Unique team_code, starting_capital = ₹100 Crores
- `portfolios`: CHECK (cash >= 0)
- `holdings`: UNIQUE(team_id, fund_id), CHECK (quantity >= 0)
- `game_state`: CHECK (id=1) - singleton table
- `pending_orders`: CHECK (order_type IN ('buy', 'sell'))
- `executed_orders`: Immutable append-only
- `p2p_trades`: Status validation, different teams constraint
- `schedules`: CHECK (locked=TRUE) - immutable
- `audit_log`: Immutable append-only, BIGSERIAL for large datasets

### 2. `002_create_rls_policies.sql`
Implements Row-Level Security (RLS) policies for team data isolation:

**RLS Policies Implemented:**

| Table | Policy | Effect |
|-------|--------|--------|
| `teams` | Team self-read | Teams can only read their own data |
| `portfolios` | Team self-read | Teams can only view their cash balance |
| `portfolios` | Engine-only update | Only game engine can modify cash |
| `holdings` | Team self-read | Teams can only view their fund holdings |
| `holdings` | Engine-only update | Only game engine can modify holdings |
| `pending_orders` | Team CRUD | Teams can create/read/delete their own orders |
| `executed_orders` | Team read-only | Teams can only read, immutable |
| `executed_orders` | Engine append | Only game engine can add records |
| `p2p_trades` | Team read-write | Teams can read/create their trades |
| `p2p_trades` | Admin/engine update | Only admin/engine can approve/execute |
| `audit_log` | Immutable append-only | Only append, no updates/deletes |
| `sessions` | Auth-only | Only auth service manages sessions |
| `funds` | Public read | All roles can read fund data |
| `funds` | Engine update | Only game engine can update NAV |
| `game_state` | Public read | All roles can read current state |
| `news_feed` | Public read | All roles can read news |
| `schedules` | Public read | All roles can read (encrypted) |

**Key Security Features:**
- `app.current_team_id` context variable for team isolation
- `app.role` context variable for role-based access (team, game_engine, admin, auth)
- Immutable audit log prevents tampering
- Game engine has elevated privileges for state modifications

### 3. `003_create_indexes.sql`
Creates performance indexes for efficient query execution:

**Index Categories:**

**Lookup Indexes:**
- `idx_teams_team_code` - Fast team lookup during login
- `idx_holdings_team_fund` - Find specific fund holdings
- `idx_funds_code` - Find fund by code

**Performance Indexes:**
- `idx_portfolios_cash` - Leaderboard computation (sorted by cash)
- `idx_holdings_fund` - Find all teams holding a fund
- `idx_executed_orders_team_recent` - Order history queries

**Batch Operation Indexes:**
- `idx_pending_orders_round` - Batch order processing during ORDER_LOCK
- `idx_p2p_status_created` - Admin approval queue
- `idx_audit_event_type_round` - Audit trail by event type

**Partial Indexes:**
- `idx_sessions_active_expiry` - Active sessions cleanup
- `idx_funds_investable` - Only investable funds
- `idx_audit_errors` - Error tracking
- `idx_p2p_status` - Pending approvals

**Composite Indexes:**
- `idx_executed_orders_fund_status` - Fund price tracking
- `idx_audit_team_type` - Dispute resolution audit trails
- `idx_holdings_team_quantity` - Portfolio valuation

### 4. `004_seed_initial_data.sql`
Seeds initial game data:

**Data Seeded:**
- 12 funds: TECH, PHARMA, ENERGY, BANKING, CONSUMER, AUTO, INFRA, METALS, TELECOM, REALTY, FMCG, CASH
- All funds initialized with NAV = 100.00 (except CASH = 1.00)
- 80 teams with format TEAM_001 through TEAM_080
- Initial team passwords (development only - see security note)
- Portfolios for all 80 teams with ₹100 Crores starting capital
- Game state initialized to Round 1, Phase: NEWS_REVEAL

**Development Passwords:**
Format: `password_N` where N is team number (1-80)
- TEAM_001: password_1
- TEAM_002: password_2
- ... TEAM_080: password_80

**Security Note:** These passwords are MD5 hashes for development. Production deployments must use proper bcrypt hashing.

## Installation Instructions

### Prerequisites
- PostgreSQL 13+ installed and running
- Supabase project or PostgreSQL database access
- psql CLI or PostgreSQL management tool

### Step 1: Connect to Your Database
```bash
# Using psql
psql -h <host> -U <user> -d <database_name>

# Or using environment variables
export PGHOST=<host>
export PGUSER=<user>
export PGDATABASE=<database_name>
psql
```

### Step 2: Execute Migrations in Order
```bash
# Execute migration 1: Create core tables
\i migrations/001_create_core_tables.sql

# Execute migration 2: Create RLS policies
\i migrations/002_create_rls_policies.sql

# Execute migration 3: Create indexes
\i migrations/003_create_indexes.sql

# Execute migration 4: Seed initial data
\i migrations/004_seed_initial_data.sql
```

### Step 3: Verify Installation
```sql
-- Check tables created
\dt

-- Verify RLS enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE rowsecurity = true;

-- Check row counts
SELECT COUNT(*) as teams FROM teams;
SELECT COUNT(*) as funds FROM funds;
SELECT COUNT(*) as portfolios FROM portfolios;
SELECT COUNT(*) as game_states FROM game_state;

-- Check game state
SELECT * FROM game_state WHERE id = 1;
```

### Alternative: Using Migration Runner (Bash Script)
```bash
# Create a migration runner script (see below for script content)
bash run_migrations.sh <DB_HOST> <DB_USER> <DB_NAME>
```

### Alternative: Using Node.js Migration Adapter
```bash
# If using a Node.js-based migration tool
npm run db:migrate
```

## Deployment Strategy

### Development Environment
1. Create fresh database
2. Run all 4 migrations sequentially
3. Verify all tables and policies are in place
4. Test RLS policies with different roles

### Staging Environment
1. Create database backup before migration
2. Run migrations in transaction (if possible)
3. Verify constraints are enforced
4. Test application connectivity

### Production Environment
1. **Create full backup** before running migrations
2. Run migrations during maintenance window
3. Verify all tables and indexes exist
4. Monitor query performance with indexes
5. Test RLS policies with real authentication
6. Have rollback plan ready (database restore)

## Rollback Procedures

### Full Rollback (Drop All)
```sql
-- Execute in reverse order to remove constraints
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS news_feed CASCADE;
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS p2p_trades CASCADE;
DROP TABLE IF EXISTS executed_orders CASCADE;
DROP TABLE IF EXISTS pending_orders CASCADE;
DROP TABLE IF EXISTS game_state CASCADE;
DROP TABLE IF EXISTS holdings CASCADE;
DROP TABLE IF EXISTS portfolios CASCADE;
DROP TABLE IF EXISTS funds CASCADE;
DROP TABLE IF EXISTS teams CASCADE;

-- Drop extension if no longer needed
DROP EXTENSION IF EXISTS "uuid-ossp";
```

### Partial Rollback (Keep Data, Remove Constraints)
```sql
-- Remove RLS policies and re-enable direct updates
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;
-- ... repeat for all tables

-- Drop problematic indexes if needed
DROP INDEX IF EXISTS idx_name;
```

## Performance Tuning

### After Bulk Data Import
```sql
-- Update table statistics for query planner
ANALYZE teams;
ANALYZE portfolios;
ANALYZE holdings;
ANALYZE funds;
ANALYZE pending_orders;
ANALYZE executed_orders;
ANALYZE p2p_trades;
ANALYZE audit_log;
ANALYZE sessions;
ANALYZE game_state;
ANALYZE news_feed;
ANALYZE schedules;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### Identify Slow Queries
```sql
-- Enable slow query logging
ALTER SYSTEM SET log_min_duration_statement = 1000;
SELECT pg_reload_conf();

-- View slow queries (requires log_statement = 'all')
SELECT * FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;
```

## Maintenance Tasks

### Regular Maintenance
```sql
-- Weekly: Update statistics
VACUUM ANALYZE;

-- Monthly: Reindex fragmented indexes
REINDEX INDEX CONCURRENTLY idx_pending_orders_round;
REINDEX INDEX CONCURRENTLY idx_executed_orders_team_time;

-- Monthly: Clean expired sessions
DELETE FROM sessions 
WHERE is_active = FALSE 
AND expires_at < NOW() - INTERVAL '30 days';

-- Quarterly: Full database optimization
VACUUM FULL ANALYZE;
```

### Monitoring

**Monitor table sizes:**
```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Monitor index usage:**
```sql
SELECT 
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

## Troubleshooting

### Common Issues

**Issue: `permission denied for relation`**
```
Solution: Check RLS policies are correctly set with app.role context:
SET app.role = 'game_engine';
```

**Issue: `unique violation` on team_code**
```
Solution: Check if teams already exist:
SELECT COUNT(*) FROM teams;
Use ON CONFLICT DO NOTHING in seed script.
```

**Issue: Slow leaderboard queries**
```
Solution: Add index:
CREATE INDEX idx_leaderboard ON portfolios(cash DESC, team_id);
```

**Issue: RLS policy not applying**
```
Solution: Verify RLS is enabled:
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'teams';
Must return rowsecurity = true
```

## Schema Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    MARKET MAYHEM DATABASE                    │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐
│    teams     │ (80 teams max)
│──────────────┤
│ id (PK)      │
│ team_code    │ (UNIQUE)
│ team_name    │
│ password     │
│ start_cap    │ (₹100 Crore)
└──────────┬───┘
           │
           ├──────────────┬──────────────┬──────────────┐
           │              │              │              │
      ┌────▼────┐    ┌────▼────┐    ┌───▼────┐   ┌────▼─────┐
      │portfolio │    │ holdings │    │session │   │ p2p_trade│
      │(cash)    │    │(funds)   │    │        │   │           │
      └──────────┘    └──────────┘    └────────┘   └───────────┘
           │              │
           └──────────┬───┘
                      │
              ┌───────▼────────┐
              │  funds (12)     │
              │─────────────────┤
              │ TECH, PHARMA,   │
              │ BANKING, CASH.. │
              └─────────────────┘
                      │
           ┌──────────┼──────────┐
           │          │          │
      ┌────▼────┐ ┌──▼────┐ ┌──▼────────┐
      │ pending  │ │executed│ │  p2p      │
      │ orders   │ │ orders │ │  trades   │
      └──────────┘ └────────┘ └───────────┘
           │          │
           └──────────┼──────────┐
                      │          │
              ┌───────▼──────────▼──┐
              │   audit_log         │
              │   (immutable)       │
              └─────────────────────┘
                      │
           ┌──────────┼──────────┐
           │          │          │
      ┌────▼────┐ ┌──▼──────┐ ┌▼────────┐
      │game_state│ │news_feed│ │schedules│
      │(timing)  │ │(content)│ │(sealed) │
      └──────────┘ └─────────┘ └─────────┘
```

## Data Dictionary

### Core Business Logic Tables

| Table | Purpose | Row Count | Key Constraint |
|-------|---------|-----------|---|
| `teams` | Team registration | ~80 | PK: id, UNIQUE: team_code |
| `portfolios` | Cash balances | ~80 (1 per team) | FK: team_id (PK) |
| `holdings` | Fund positions | ~880 (11 funds × 80 teams max) | UNIQUE: (team_id, fund_id) |
| `funds` | Instruments | 12 | PK: id, UNIQUE: fund_code |

### Transaction Tables

| Table | Purpose | Retention | Ordering |
|-------|---------|-----------|----------|
| `pending_orders` | Active orders | ~1 round | Created during TRADING_OPEN, cleared during ORDER_LOCK |
| `executed_orders` | Order history | Game lifetime | Immutable after creation |
| `p2p_trades` | P2P history | Game lifetime | Status: awaiting → approved/rejected → completed/failed |

### State Management Tables

| Table | Purpose | Rows | Update Frequency |
|-------|---------|------|------------------|
| `game_state` | Round/phase timing | 1 | Every phase transition (~9 min) |
| `news_feed` | Round news | ≤15 | Once per round at NEWS_REVEAL |
| `schedules` | NAV data | 1 | Once during admin setup |

### Audit & Session Tables

| Table | Purpose | Growth | Retention |
|-------|---------|--------|-----------|
| `audit_log` | Full audit trail | ~1000s per game | Game lifetime |
| `sessions` | Login sessions | ~400 concurrent | Session timeout (4 hours) |

## References

- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/sql-createpolicy.html)
- [UUID Extension](https://www.postgresql.org/docs/current/uuid-ossp.html)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)

## Notes

- All timestamps use `TIMESTAMP DEFAULT NOW()` (database server time)
- Prices stored as NUMERIC(15,4) for financial precision
- Large monetary values stored as NUMERIC(15,2) (rupees with 2 decimals)
- Team IDs and fund IDs are immutable after creation
- Audit log is append-only and tamper-proof
- RLS policies use `current_setting('app.role')` for role-based access
