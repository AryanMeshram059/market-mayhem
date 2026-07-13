# Seed Data Script - Market Mayhem Platform

This document describes the seed data script that initializes the Market Mayhem platform database with required game data.

## Overview

The seed data script creates the minimum required data to run a Market Mayhem game:

1. **12 Funds**: 11 investable funds + 1 cash fund (NAV = 100 except CASH = 1)
2. **80 Teams**: TEAM_001 through TEAM_080 with hashed passwords
3. **80 Portfolios**: Each team initialized with ₹100 Crore starting capital
4. **Holdings**: Pre-populated for all team-fund combinations (zero quantities)

## Requirements Met

This script fulfills the following requirements:

- **Requirement 2.1**: ₹100 Crore starting capital for each team
- **Requirement 2.2**: Total allocated capital = ₹8,000 Crores (80 teams × ₹100 Cr)
- **Requirement 3.1**: Support exactly 12 Funds (11 investable + 1 cash)
- **Requirement 3.2**: Designate exactly 11 Funds as investable
- **Requirement 3.3**: Designate exactly 1 Fund as Cash (non-investable)

## Fund List

The following 12 funds are created:

| Code      | Name                      | Investable | Initial NAV |
|-----------|---------------------------|------------|-------------|
| TECH      | Technology Fund           | Yes        | 100         |
| PHARMA    | Pharmaceutical Fund       | Yes        | 100         |
| ENERGY    | Energy Fund               | Yes        | 100         |
| BANKING   | Banking Fund              | Yes        | 100         |
| CONSUMER  | Consumer Goods Fund       | Yes        | 100         |
| AUTO      | Automobile Fund           | Yes        | 100         |
| INFRA     | Infrastructure Fund       | Yes        | 100         |
| METALS    | Metals & Mining Fund      | Yes        | 100         |
| TELECOM   | Telecommunications Fund   | Yes        | 100         |
| REALTY    | Real Estate Fund          | Yes        | 100         |
| FMCG      | FMCG Fund                 | Yes        | 100         |
| CASH      | Cash Fund                 | No         | 1           |

## Team Credentials

Teams are created with simple default credentials:

- **Team Code**: TEAM_001 through TEAM_080
- **Team Name**: {Team Code} Squad (e.g., "TEAM_001 Squad")
- **Default Password**: {team_code_lowercase}123 (e.g., "team_001123")
- **Password Hashing**: PBKDF2-SHA256 with 10,000 + (cost_factor × 1000) iterations

Example:
- Team Code: `TEAM_001`
- Default Password: `team_001123`
- Team Name: `TEAM_001 Squad`

## Usage

### Prerequisites

1. **Environment Variables**: Set up database connection
   ```bash
   export DATABASE_URL="postgresql://user:pass@host:port/database"
   # OR
   export POSTGRES_URL="postgresql://..."
   # OR
   export DATABASE_CONNECTION_STRING="postgresql://..."
   ```

2. **Dependencies**: Install required packages
   ```bash
   npm install
   ```

3. **Database**: Ensure migrations have been run
   ```bash
   npm run migrate  # Or your migration command
   ```

### Running the Seed Script

#### Standard Execution (Idempotent)

Run the script to create seed data. Existing data is left untouched (uses `ON CONFLICT DO NOTHING`):

```bash
npm run seed
```

This will:
1. Create 12 funds (skips if already exist)
2. Create 80 teams (skips if already exist)
3. Initialize portfolios with ₹100 Crore each (skips if already exist)
4. Pre-populate holdings table (skips if already exist)
5. Log seed event to audit log
6. Verify all data and report results

#### Reset and Reseed

To clear existing seed data and start fresh:

```bash
npm run seed -- --reset
```

This will:
1. Delete all holdings records
2. Delete all pending orders (if any)
3. Delete all executed orders (if any)
4. Delete all P2P trades (if any)
5. Delete all portfolios
6. Delete all teams
7. Delete all funds
8. Re-create all seed data from scratch

### Output Example

```
🌱 Market Mayhem Seed Data Script
==================================

Starting seed data initialization...

📊 Seeding funds table...
  ✓ TECH       - Technology Fund
  ✓ PHARMA     - Pharmaceutical Fund
  ✓ ENERGY     - Energy Fund
  ✓ BANKING    - Banking Fund
  ✓ CONSUMER   - Consumer Goods Fund
  ✓ AUTO       - Automobile Fund
  ✓ INFRA      - Infrastructure Fund
  ✓ METALS     - Metals & Mining Fund
  ✓ TELECOM    - Telecommunications Fund
  ✓ REALTY     - Real Estate Fund
  ✓ FMCG       - FMCG Fund
  ✓ CASH       - Cash Fund
  Inserted 12 new funds
  Total funds in database: 12

👥 Seeding teams table...
  ✓ TEAM_001 - TEAM_001 Squad
  ✓ TEAM_010 - TEAM_010 Squad
  ✓ TEAM_020 - TEAM_020 Squad
  ...
  ✓ TEAM_080 - TEAM_080 Squad
  Inserted 80 new teams
  Total teams in database: 80

💰 Initializing portfolios with starting capital...
  ✓ TEAM_001 - ₹100 Cr
  ✓ TEAM_010 - ₹100 Cr
  ✓ TEAM_020 - ₹100 Cr
  ...
  ✓ TEAM_080 - ₹100 Cr
  Initialized 80 new portfolios
  Total portfolios in database: 80
  Total capital allocated: ₹8000 Cr
  Expected total capital: ₹8000 Cr

📈 Initializing fund holdings (zero quantities)...
  Initialized 880 holdings records
  Expected: 880 records (80 teams × 11 funds)
  Total holdings in database: 880

📝 Logged seed event to audit log

✅ Seed Data Initialization Complete
====================================
Funds inserted:       12/12
Teams inserted:       80/80
Portfolios created:   80/80
Holdings initialized: 880/880
Total capital allocated: ₹8000 Cr

Database is ready for game simulation.
```

## Verification

The script automatically verifies:

1. **Fund Count**: Exactly 12 funds exist (11 investable + 1 cash)
2. **Team Count**: Exactly 80 teams exist (TEAM_001 through TEAM_080)
3. **Portfolio Count**: 80 portfolios, one per team
4. **Capital Allocation**: Total cash = ₹8,000 Crores (within ±0.01 rupees)
5. **Holdings Count**: 880 holdings (80 teams × 11 investable funds)

If any verification fails, the script exits with an error and detailed message.

## Using in Integration Tests

The seed functions are exported for use in integration tests:

```typescript
import {
  seedFunds,
  seedTeams,
  seedPortfolios,
  seedHoldings,
  clearSeedData,
  hashPassword,
  formatTeamCode,
  TOTAL_TEAMS,
  STARTING_CAPITAL,
  FUNDS,
} from '../src/scripts/seed-data';

describe('Market Mayhem Integration Tests', () => {
  beforeEach(async () => {
    // Set up fresh seed data for each test
    const client = await getConnection();
    await clearSeedData(client);
    await seedFunds(client);
    await seedTeams(client);
    await seedPortfolios(client);
    await seedHoldings(client);
    client.release();
  });

  test('trading with 80 teams', async () => {
    // Test code here
  });
});
```

## Troubleshooting

### Database Connection Error

```
DATABASE_URL, POSTGRES_URL, or DATABASE_CONNECTION_STRING must be set
```

**Solution**: Set one of the required environment variables:
```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/market_mayhem"
npm run seed
```

### Migration Not Run

```
Table "funds" does not exist
```

**Solution**: Run database migrations first:
```bash
npm run migrate
# or manually:
psql -f migrations/001_create_core_tables.sql
```

### Data Already Exists

If re-running the script and seed data already exists, the script will skip already-seeded records:

```
~ TEAM_001 - Already exists
~ TEAM_002 - Already exists
...
```

Use `npm run seed -- --reset` to clear and reseed if needed.

### Verification Failure

```
Expected 80 teams but found 50. Database may be in inconsistent state.
```

**Solution**: Use `--reset` flag to clear and reseed:
```bash
npm run seed -- --reset
```

## Performance Characteristics

- **Funds Seeding**: ~100ms (12 inserts)
- **Teams Seeding**: ~500ms (80 inserts + password hashing)
- **Portfolios Seeding**: ~300ms (80 inserts)
- **Holdings Seeding**: ~2s (880 inserts)
- **Total Time**: ~3-4 seconds

## Database Storage Impact

After seeding:
- **funds**: 12 rows (~1 KB)
- **teams**: 80 rows (~20 KB)
- **portfolios**: 80 rows (~5 KB)
- **holdings**: 880 rows (~15 KB)
- **audit_log**: 1 row (~500 B)

**Total**: ~41 KB (well within Supabase Free tier 500 MB limit)

## Security Notes

1. **Default Passwords**: The default passwords (team_001123, etc.) are extremely weak and only suitable for development/testing
2. **Password Hashing**: Uses PBKDF2-SHA256 with adequate iterations
3. **Production**: Before production use:
   - Generate strong random passwords per team
   - Use bcrypt or argon2 npm packages instead of PBKDF2
   - Store passwords securely (hashed only, never plaintext)
   - Provide teams with unique, strong initial passwords

## Extending the Script

To add more seed data (news, round schedules, etc.):

```typescript
async function seedNewsContent(client: PoolClient): Promise<void> {
  for (let round = 1; round <= 15; round++) {
    await client.query(
      'INSERT INTO news_feed (round, content) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [round, `News for round ${round}`]
    );
  }
}

// Add to main() function
await seedNewsContent(client);
```

## Related Documentation

- [Database Schema](../../migrations/001_create_core_tables.sql)
- [Design Document - Data Models](../../.kiro/specs/market-mayhem-platform/design.md#data-models)
- [Requirements - Starting Capital](../../.kiro/specs/market-mayhem-platform/requirements.md#requirement-2-starting-capital-allocation)
- [Requirements - Fund Structure](../../.kiro/specs/market-mayhem-platform/requirements.md#requirement-3-fund-structure-and-tradeable-instruments)

## Version History

- **v1.0** (2024-12-XX): Initial implementation
  - 12 funds (11 investable + 1 cash)
  - 80 teams with default credentials
  - ₹100 Crore starting capital per team
  - Holdings pre-population
  - Idempotent operations with ON CONFLICT DO NOTHING
  - Comprehensive verification
  - Exported functions for integration tests
