# Market Mayhem Database Deployment Checklist

Complete this checklist when deploying the Market Mayhem database to any environment.

## Pre-Deployment (Development & Staging)

### Environment Setup
- [ ] PostgreSQL 13+ installed and running
- [ ] Database created (`CREATE DATABASE market_mayhem;`)
- [ ] User account created with appropriate permissions
- [ ] Network connectivity verified (can connect from application server)
- [ ] SSL/TLS certificates configured (if required)
- [ ] Backup system in place

### Credentials & Secrets
- [ ] Database password generated and stored securely
- [ ] Connection string formatted correctly
- [ ] Environment variables configured (.env file)
- [ ] Secrets not committed to version control
- [ ] Access logs enabled for audit trail

### Dependency Check
- [ ] PostgreSQL client (psql) installed
- [ ] Node.js installed (if using Node.js migration runner)
- [ ] pg npm package installed (`npm install pg`)
- [ ] UUID extension available (`CREATE EXTENSION uuid-ossp;`)
- [ ] All migration files present and readable

## Backup & Recovery Preparation

- [ ] Full database backup created (if upgrading existing DB)
- [ ] Backup verified with restore test
- [ ] Point-in-time recovery (PITR) enabled in cloud provider (if applicable)
- [ ] Backup storage location documented
- [ ] Backup retention policy defined
- [ ] Recovery procedures documented and tested

## Migration Execution

### Development Environment

```bash
# Step 1: Connect to database
psql -h localhost -U postgres -d market_mayhem

# Step 2: Run migrations
\i migrations/001_create_core_tables.sql
\i migrations/002_create_rls_policies.sql
\i migrations/003_create_indexes.sql
\i migrations/004_seed_initial_data.sql

# Or use migration runner
node migrations/migrate.js --host localhost --user postgres --database market_mayhem
```

- [ ] Migration 1 completed without errors
- [ ] Migration 2 completed without errors
- [ ] Migration 3 completed without errors
- [ ] Migration 4 completed without errors
- [ ] All tables created successfully
- [ ] All indexes created successfully
- [ ] All RLS policies applied successfully
- [ ] Initial data seeded (80 teams, 12 funds)

### Staging/Production Environment

- [ ] Maintenance window scheduled and announced
- [ ] Database locked for writes (if necessary)
- [ ] Full backup taken before migration
- [ ] Backup integrity verified
- [ ] Migration runner tested in staging first
- [ ] Performance baseline captured before migration

```bash
# Run migrations in controlled manner
bash migrations/run_migrations.sh <host> <user> <database> <password>
```

- [ ] Each migration executed and verified
- [ ] No rollback needed
- [ ] Deployment log captured
- [ ] Deployment duration recorded

## Post-Migration Verification

### Schema Verification
```sql
-- Execute these queries to verify schema
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public';

SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' ORDER BY tablename;

SELECT COUNT(*) FROM teams;
SELECT COUNT(*) FROM portfolios;
SELECT COUNT(*) FROM funds;
SELECT COUNT(*) FROM game_state;
```

- [ ] All 12 tables created
- [ ] RLS enabled on 8+ tables
- [ ] 80 teams seeded
- [ ] 80 portfolios initialized
- [ ] 12 funds configured
- [ ] Game state singleton created

### Data Integrity
```sql
-- Verify data consistency
SELECT SUM(cash) FROM portfolios;
-- Should equal ₹8,000 Crores (80 teams × ₹100 Crore)

SELECT COUNT(*) FROM funds WHERE is_cash = TRUE;
-- Should equal 1

SELECT COUNT(*) FROM funds WHERE is_cash = FALSE;
-- Should equal 11

SELECT DISTINCT(current_round) FROM game_state;
-- Should be 1

SELECT DISTINCT(current_phase) FROM game_state;
-- Should be 'NEWS_REVEAL'
```

- [ ] Total team capital equals ₹8,000 Crores
- [ ] Exactly 1 cash fund exists
- [ ] Exactly 11 investable funds exist
- [ ] Game state initialized to round 1, NEWS_REVEAL phase
- [ ] No NULL values in required columns
- [ ] All constraints are enforced

### Performance Verification
```sql
-- Update statistics
ANALYZE;

-- Check index usage
SELECT schemaname, tablename, indexname 
FROM pg_stat_user_indexes 
ORDER BY tablename;

-- Check table sizes
SELECT 
  schemaname, tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

- [ ] All indexes created successfully
- [ ] Table sizes reasonable (no unexpected bloat)
- [ ] Query performance acceptable
- [ ] No missing critical indexes

### Connection & Security

- [ ] Test connection from application server
- [ ] Verify RLS policies working (connect as 'team' role)
- [ ] Verify game engine role has elevated privileges
- [ ] Verify admin role has elevated privileges
- [ ] Verify audit log is append-only
- [ ] Verify sessions can be created and validated
- [ ] Verify password hashing works correctly

```sql
-- Test RLS policy enforcement
SET app.role = 'team';
SET app.current_team_id = '1';
SELECT * FROM portfolios WHERE team_id = 2;  -- Should return no rows

-- Reset
RESET app.role;
RESET app.current_team_id;
```

### Application Integration

- [ ] Application connects successfully
- [ ] Authentication works (team login)
- [ ] Portfolio retrieval works
- [ ] Order submission accepted
- [ ] Query responses within SLA (< 1 second)
- [ ] No connection pooling errors
- [ ] Transaction handling works correctly

## Post-Deployment Monitoring (First 24 Hours)

### System Monitoring
- [ ] CPU usage normal (< 60%)
- [ ] Memory usage stable
- [ ] Disk space adequate
- [ ] Network connectivity stable
- [ ] No unexpected errors in logs

### Database Monitoring
- [ ] Connection count stable (< 50)
- [ ] Active queries normal
- [ ] No long-running transactions
- [ ] Index usage metrics collected
- [ ] No table bloat issues

### Application Monitoring
- [ ] No authentication failures
- [ ] Order submission working
- [ ] Portfolio updates working
- [ ] Leaderboard queries working
- [ ] No API timeout errors
- [ ] Error rates within expected range (< 0.1%)

### Team Testing
- [ ] Sample team can login
- [ ] Portfolio displays correctly
- [ ] Order submission works
- [ ] Order cancellation works
- [ ] Game state updates work
- [ ] News feed displays correctly

## Documentation & Handoff

### Documentation
- [ ] Schema documentation reviewed and updated
- [ ] Connection strings documented (secure location)
- [ ] Backup procedures documented
- [ ] Recovery procedures tested and documented
- [ ] Rollback procedures documented
- [ ] Known issues documented

### Team Handoff
- [ ] Database credentials shared securely with relevant teams
- [ ] Operations team has access to migration logs
- [ ] Support team briefed on schema and RLS policies
- [ ] Development team has schema documentation
- [ ] Monitoring dashboards configured
- [ ] Alert thresholds configured

### Runbooks Created
- [ ] Database connection troubleshooting
- [ ] Common query examples documented
- [ ] Backup and restore procedures
- [ ] Performance tuning guide
- [ ] Emergency procedures (if needed)

## Rollback Plan (If Needed)

### Decision Point
- [ ] Issue severity assessed
- [ ] Stakeholders consulted
- [ ] Rollback decision made

### Rollback Execution
```bash
# Option 1: Restore from backup
pg_restore -h <host> -U <user> -d <database> <backup_file>

# Option 2: Drop all tables and restore seed data (dev only)
bash migrations/rollback.sh
```

- [ ] Backup location confirmed
- [ ] Rollback command tested
- [ ] Data verified after rollback
- [ ] Application tested with rolled-back DB
- [ ] Post-mortem scheduled

### Issue Analysis
- [ ] Root cause identified
- [ ] Fix developed and tested
- [ ] Hotfix migration created
- [ ] Re-deployment approved
- [ ] Lessons documented

## Long-Term Maintenance

### Weekly Tasks
- [ ] [ ] Check database size and growth rate
- [ ] [ ] Verify backup completion and integrity
- [ ] [ ] Review error logs for patterns
- [ ] [ ] Monitor query performance

### Monthly Tasks
- [ ] [ ] Update table statistics (`ANALYZE`)
- [ ] [ ] Check for missing indexes
- [ ] [ ] Review slow query logs
- [ ] [ ] Validate RLS policies still working
- [ ] [ ] Test backup restoration

### Quarterly Tasks
- [ ] [ ] Full backup integrity test
- [ ] [ ] Performance baseline comparison
- [ ] [ ] Security audit (access logs, RLS)
- [ ] [ ] Disaster recovery drill
- [ ] [ ] Schema review for needed changes

### Annual Tasks
- [ ] [ ] Full system capacity planning
- [ ] [ ] Security review and audit
- [ ] [ ] Performance optimization review
- [ ] [ ] Infrastructure upgrade planning

## Sign-Off

**Deployment Details:**

| Item | Value |
|------|-------|
| Environment | `[ ] Dev  [ ] Staging  [ ] Prod` |
| Date | _______________ |
| Time | _______________ |
| Duration | _______________ |
| Deployed By | _______________ |
| Verified By | _______________ |
| Approved By | _______________ |

**Notes:**
```
_________________________________________________________________

_________________________________________________________________

_________________________________________________________________
```

---

## Quick Reference: Migration Files

| File | Purpose | Tables | Size |
|------|---------|--------|------|
| 001_create_core_tables.sql | Create 12 core tables | teams, portfolios, holdings, funds, game_state, pending_orders, executed_orders, p2p_trades, schedules, news_feed, audit_log, sessions | ~3KB |
| 002_create_rls_policies.sql | Add row-level security | RLS on 9 tables, 20+ policies | ~4KB |
| 003_create_indexes.sql | Create performance indexes | 25+ indexes | ~4KB |
| 004_seed_initial_data.sql | Seed 80 teams + 12 funds | teams, portfolios, funds, game_state | ~2KB |

## Migration Timing

| Step | Estimated Duration |
|------|-------------------|
| Core tables creation | < 1 second |
| RLS policies | < 1 second |
| Indexes | 2-5 seconds (depends on DB speed) |
| Data seeding | < 1 second |
| **Total** | **~5-10 seconds** |

## Environment-Specific Notes

### Supabase
- [ ] Verify SQL editor accessible
- [ ] Confirm authentication method (API key vs password)
- [ ] Check free tier resource limits
- [ ] Enable backups (if available)
- [ ] Configure firewall rules for application IP

### AWS RDS
- [ ] Verify security group configuration
- [ ] Check parameter group settings
- [ ] Enable automated backups
- [ ] Configure enhanced monitoring
- [ ] Set up CloudWatch alarms

### Self-Hosted PostgreSQL
- [ ] Configure postgresql.conf for optimal performance
- [ ] Set up replication (if needed)
- [ ] Configure WAL archiving for PITR
- [ ] Implement monitoring (Prometheus, Grafana)
- [ ] Set up automated backups

## Support Contact List

| Role | Name | Contact | Availability |
|------|------|---------|--------------|
| Database Admin | | | |
| Ops Lead | | | |
| Security Lead | | | |
| DevOps | | | |

---

**Last Updated:** [Date]
**Next Review:** [Date + 3 months]
