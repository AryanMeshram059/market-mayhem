# Market Mayhem Database Migrations - Complete Index

## Overview

This directory contains all PostgreSQL migration scripts and utilities for the Market Mayhem platform. The migrations create a complete, production-ready database schema with row-level security, comprehensive indexes, and initial data.

## 📋 File Inventory

### SQL Migration Scripts

```
migrations/
├── 001_create_core_tables.sql       (3KB)  - Create all 12 core tables
├── 002_create_rls_policies.sql      (4KB)  - Add row-level security policies
├── 003_create_indexes.sql           (4KB)  - Create performance indexes
└── 004_seed_initial_data.sql        (2KB)  - Seed 80 teams + 12 funds
```

### Documentation

```
├── README.md                        (8KB)  - Installation & deployment guide
├── SCHEMA.md                        (12KB) - Complete schema reference
├── DEPLOYMENT_CHECKLIST.md          (6KB)  - Pre/post deployment tasks
└── INDEX.md                         (this file)
```

### Utilities & Tools

```
├── run_migrations.sh                (4KB)  - Bash migration runner
├── migrate.js                       (6KB)  - Node.js migration runner
└── ../src/lib/migrations.ts         (8KB)  - TypeScript migration helpers
```

## 🚀 Quick Start

### Option 1: Using bash (Linux/Mac)
```bash
cd migrations
bash run_migrations.sh localhost postgres market_mayhem postgres
```

### Option 2: Using Node.js
```bash
cd migrations
npm install pg minimist
node migrate.js --host localhost --user postgres --database market_mayhem
```

### Option 3: Using psql directly
```bash
psql -h localhost -U postgres -d market_mayhem < 001_create_core_tables.sql
psql -h localhost -U postgres -d market_mayhem < 002_create_rls_policies.sql
psql -h localhost -U postgres -d market_mayhem < 003_create_indexes.sql
psql -h localhost -U postgres -d market_mayhem < 004_seed_initial_data.sql
```

### Option 4: From TypeScript/Next.js Application
```typescript
import MigrationRunner from './migrations/migrate.js';

const runner = new MigrationRunner({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'market_mayhem'
});

await runner.run();
```

## 📊 What Gets Created

### Tables (12 total)

**Core Business:**
- `teams` - 80 teams max, unique team codes
- `portfolios` - Team cash balances
- `holdings` - Fund positions per team
- `funds` - 11 investable + 1 cash

**Transactions:**
- `pending_orders` - Orders awaiting execution
- `executed_orders` - Immutable order history
- `p2p_trades` - Peer-to-peer trades

**System:**
- `game_state` - Current round/phase (singleton)
- `news_feed` - Round-specific news content
- `schedules` - Encrypted NAV schedule
- `audit_log` - Immutable audit trail
- `sessions` - Authenticated sessions

### Security Features

**Row-Level Security (RLS):**
- 9 tables have RLS enabled
- 20+ RLS policies for fine-grained access control
- Role-based access: team, game_engine, admin, auth
- Team data completely isolated from other teams

**Immutable Tables:**
- `executed_orders` - No updates or deletes
- `audit_log` - Append-only, no modifications
- `schedules` - Locked after encryption

### Indexes (25+ created)

**Performance Indexes:**
- Team lookups during login
- Portfolio valuation queries
- Leaderboard computation
- Order batch processing
- Fund price tracking

**Partial Indexes:**
- Active sessions (where is_active = TRUE)
- Investable funds (where is_cash = FALSE)
- Error tracking
- Admin approval queue

## 📈 Data Seeded

After migrations run:
- **80 Teams**: TEAM_001 through TEAM_080
- **12 Funds**: 11 investable sectors + CASH fund
- **80 Portfolios**: Each initialized with ₹100 Crores
- **1 Game State**: Round 1, NEWS_REVEAL phase
- **Total Capital**: ₹8,000 Crores (8 billion rupees)

## 🔐 Security Model

### Authentication Flow
1. Team submits credentials (team_code + password)
2. Password validated against bcrypt hash
3. JWT token generated with 4-hour expiry
4. Token hash stored in sessions table
5. RLS context set with team_id on each query

### Data Isolation
- `app.current_team_id` context variable restricts team queries
- Teams cannot read/modify other teams' data
- Game engine role required for state changes
- Audit log tracks all modifications

### Tamper-Proofing
- All portfolio modifications go through game engine
- Executed orders are immutable (append-only)
- Audit log is tamper-proof (append-only)
- Brokerage fees and slippage are computed server-side

## 🛠️ Development Tasks

### After Initial Setup
1. Test team login with TEAM_001 / password_1
2. Verify portfolio retrieval works
3. Test order submission during TRADING_OPEN
4. Verify NAV updates during phase transitions
5. Test leaderboard computation

### For Production Deployment
1. Generate real bcrypt password hashes
2. Configure proper SSL/TLS certificates
3. Enable database backups and replication
4. Set up monitoring and alerting
5. Document connection strings securely

## 📚 Schema Documentation

**Complete schema reference:** See `SCHEMA.md`

Quick examples:
```sql
-- Get team portfolio value
SELECT p.cash + COALESCE(SUM(h.quantity * f.current_nav), 0)
FROM portfolios p
LEFT JOIN holdings h ON p.team_id = h.team_id
LEFT JOIN funds f ON h.fund_id = f.id
WHERE p.team_id = 1;

-- Get current game state
SELECT current_round, current_phase, 
  (phase_start + INTERVAL '1 second' * phase_duration) as phase_ends
FROM game_state WHERE id = 1;

-- Get pending orders for execution
SELECT * FROM pending_orders 
WHERE round = (SELECT current_round FROM game_state WHERE id = 1)
ORDER BY created_at;
```

## 🔧 Troubleshooting

### Connection Issues
```bash
# Test connection
psql -h localhost -U postgres -d market_mayhem -c "SELECT 1"

# Check connection from app server
psql -h db.example.com -U postgres -d market_mayhem -c "SELECT 1"
```

### RLS Policy Problems
```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE tablename IN ('teams', 'portfolios', 'holdings')
AND schemaname = 'public';

-- Test RLS enforcement
SET app.role = 'team';
SET app.current_team_id = '1';
SELECT * FROM portfolios;  -- Should only see team 1
RESET app.role;
RESET app.current_team_id;
```

### Performance Issues
```sql
-- Analyze table statistics
ANALYZE;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Identify slow queries (requires logging enabled)
SELECT query, mean_exec_time FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 10;
```

## 📖 Reading Order

**For Developers:**
1. Start with README.md for installation
2. Review SCHEMA.md for data model
3. Check TypeScript utilities in src/lib/migrations.ts

**For DevOps:**
1. Read README.md deployment section
2. Follow DEPLOYMENT_CHECKLIST.md
3. Monitor with provided queries

**For DBAs:**
1. Review all SQL migration files
2. Study RLS policies in 002_create_rls_policies.sql
3. Optimize indexes based on 003_create_indexes.sql

## 🗂️ File Details

### 001_create_core_tables.sql
**Creates:** All 12 core tables with constraints
**Duration:** < 1 second
**Key Features:**
- UNIQUE constraints for data integrity
- CHECK constraints for business logic
- FOREIGN KEY constraints for referential integrity
- Comprehensive column documentation

### 002_create_rls_policies.sql
**Creates:** RLS policies for secure data access
**Duration:** < 1 second
**Key Features:**
- Team isolation via `app.current_team_id`
- Role-based access via `app.role`
- Immutable append-only policies
- 20+ individual policies across 9 tables

### 003_create_indexes.sql
**Creates:** Performance indexes
**Duration:** 2-5 seconds (depends on DB)
**Key Features:**
- 25+ indexes for common query patterns
- Partial indexes for filtered queries
- Composite indexes for complex lookups
- Comprehensive index documentation

### 004_seed_initial_data.sql
**Creates:** Initial game data
**Duration:** < 1 second
**Key Features:**
- 12 funds with correct properties
- 80 teams with unique codes
- 80 portfolios initialized
- Game state ready to start

## 🔄 Migration Rollback

### Full Rollback
```sql
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
DROP EXTENSION IF EXISTS "uuid-ossp";
```

### Partial Rollback (Remove Constraints Only)
```sql
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;
-- Repeat for other tables as needed
```

## 📊 Performance Benchmarks

| Operation | Expected Time | Query |
|-----------|---------------|-------|
| Team login | < 100ms | SELECT FROM teams WHERE team_code = ? |
| Portfolio fetch | < 200ms | SELECT (portfolio value with holdings) |
| Order submission | < 500ms | INSERT INTO pending_orders + validation |
| Leaderboard | < 1s | Compute all 80 teams ranked by value |
| Order execution | < 5s | Execute all pending orders (batch) |

## 🚨 Production Checklist

Before going live:
- [ ] Database backups automated
- [ ] Monitoring configured
- [ ] SSL/TLS enabled
- [ ] Team passwords hash using bcrypt (cost 12)
- [ ] Admin password secured
- [ ] Database user with minimal required permissions
- [ ] Connection pooling configured
- [ ] Slow query logging enabled
- [ ] Audit log retention policy defined
- [ ] Disaster recovery tested

## 📞 Support

For issues:
1. Check README.md troubleshooting section
2. Review schema reference in SCHEMA.md
3. Check deployment checklist in DEPLOYMENT_CHECKLIST.md
4. Review RLS policies in 002_create_rls_policies.sql

## 📝 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024 | Initial schema design |
| - | - | All 12 tables created |
| - | - | RLS policies implemented |
| - | - | 25+ performance indexes |
| - | - | Initial data seeding |

## 🎯 Next Steps

After running migrations:

1. **Application Setup**
   - Configure database connection in app
   - Initialize connection pool
   - Set up TypeScript types from schema

2. **Testing**
   - Test team login with TEAM_001
   - Verify portfolio retrieval
   - Test order submission
   - Verify order execution
   - Test leaderboard computation

3. **Deployment**
   - Follow DEPLOYMENT_CHECKLIST.md
   - Verify all post-migration checks
   - Monitor system for 24 hours
   - Document any issues

4. **Ongoing Maintenance**
   - Weekly: Check database size and backups
   - Monthly: Update statistics, verify performance
   - Quarterly: Full backup test, performance review

---

**Last Updated:** 2024
**Status:** Production Ready
**Compatibility:** PostgreSQL 13+, Supabase, AWS RDS
