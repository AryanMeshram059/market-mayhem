#!/usr/bin/env node

/**
 * Seed Data Script for Market Mayhem Platform
 * 
 * Creates initial game data:
 * - 11 investable funds + 1 cash fund with fund_codes and initial NAVs
 * - 80 teams (TEAM_001 through TEAM_080) with hashed passwords
 * - Portfolios initialized with ₹100 Crore starting capital for each team
 * 
 * Requirements: 2.1, 2.2, 3.1, 3.2, 3.3
 * 
 * Usage:
 *   npm run seed
 *   npm run seed -- --reset (to clear existing data first)
 */

import { Pool, PoolClient } from 'pg';
import * as crypto from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

function loadEnvFile(): void {
  const envPath = join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

function pgCount(value: unknown): number {
  return Number(value);
}

// ============================================================================
// Configuration and Constants
// ============================================================================

const STARTING_CAPITAL = 100_000_000; // ₹100 Crores in rupees

const FUNDS = [
  { code: 'TECH', name: 'Technology Fund', is_cash: false, initial_nav: 100 },
  { code: 'PHARMA', name: 'Pharmaceutical Fund', is_cash: false, initial_nav: 100 },
  { code: 'ENERGY', name: 'Energy Fund', is_cash: false, initial_nav: 100 },
  { code: 'BANKING', name: 'Banking Fund', is_cash: false, initial_nav: 100 },
  { code: 'CONSUMER', name: 'Consumer Goods Fund', is_cash: false, initial_nav: 100 },
  { code: 'AUTO', name: 'Automobile Fund', is_cash: false, initial_nav: 100 },
  { code: 'INFRA', name: 'Infrastructure Fund', is_cash: false, initial_nav: 100 },
  { code: 'METALS', name: 'Metals & Mining Fund', is_cash: false, initial_nav: 100 },
  { code: 'TELECOM', name: 'Telecommunications Fund', is_cash: false, initial_nav: 100 },
  { code: 'REALTY', name: 'Real Estate Fund', is_cash: false, initial_nav: 100 },
  { code: 'FMCG', name: 'FMCG Fund', is_cash: false, initial_nav: 100 },
  { code: 'CASH', name: 'Cash Fund', is_cash: true, initial_nav: 1 },
];

const TOTAL_TEAMS = 80;
const TEAM_CODE_PREFIX = 'TEAM_';
const TEAM_CODE_LENGTH = 3; // Results in TEAM_001 through TEAM_080

const HASH_COST_FACTOR = 12; // bcrypt cost factor for password hashing

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Hash a password using bcrypt-like hashing
 * For compatibility, we use a simple PBKDF2 approach that matches common password hashing
 * In production, use 'bcrypt' or 'argon2' npm packages
 * 
 * @param password - The plain text password to hash
 * @returns Hashed password string with salt included
 */
function hashPassword(password: string): string {
  // Generate a random salt
  const salt = crypto.randomBytes(16).toString('hex');

  // Use PBKDF2 with SHA-256
  const hash = crypto
    .pbkdf2Sync(password, salt, 10000 + HASH_COST_FACTOR * 1000, 64, 'sha256')
    .toString('hex');

  // Return combined salt:hash for verification
  return `${salt}:${hash}`;
}

/**
 * Format a team code with zero-padding
 * Example: formatTeamCode(1) => "TEAM_001"
 * 
 * @param number - Team number (1-80)
 * @returns Formatted team code
 */
function formatTeamCode(number: number): string {
  const paddedNumber = String(number).padStart(TEAM_CODE_LENGTH, '0');
  return `${TEAM_CODE_PREFIX}${paddedNumber}`;
}

/**
 * Format a currency value as a human-readable string
 * 
 * @param amount - Amount in rupees
 * @returns Formatted string like "₹100 Cr" or "₹100.5M"
 */
function formatCurrency(amount: number): string {
  if (amount >= 10_000_000) {
    return `₹${(amount / 10_000_000).toFixed(1)} Cr`;
  } else if (amount >= 100_000) {
    return `₹${(amount / 100_000).toFixed(1)} L`;
  } else {
    return `₹${amount.toLocaleString()}`;
  }
}

/**
 * Create database connection pool
 * 
 * @returns PostgreSQL connection pool
 */
function createPool(): Pool {
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_CONNECTION_STRING;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL, POSTGRES_URL, or DATABASE_CONNECTION_STRING must be set in environment variables'
    );
  }

  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: connectionString.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  });
}

// ============================================================================
// Seed Functions
// ============================================================================

/**
 * Seed the funds table with 11 investable funds + 1 cash fund
 * Uses ON CONFLICT DO NOTHING to gracefully handle already-seeded data
 * 
 * Requirements: 3.1, 3.2, 3.3
 * 
 * @param client - Database connection
 * @returns Number of funds inserted
 */
async function seedFunds(client: PoolClient): Promise<number> {
  console.log('\n📊 Seeding funds table...');

  // Insert funds with ON CONFLICT DO NOTHING for idempotency
  const insertQuery = `
    INSERT INTO funds (fund_code, fund_name, is_cash, current_nav, last_nav_update)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (fund_code) DO NOTHING
    RETURNING id;
  `;

  let insertedCount = 0;

  for (const fund of FUNDS) {
    const result = await client.query(insertQuery, [
      fund.code,
      fund.name,
      fund.is_cash,
      fund.initial_nav,
    ]);

    if (result.rowCount && result.rowCount > 0) {
      insertedCount++;
      console.log(`  ✓ ${fund.code.padEnd(10)} - ${fund.name}`);
    } else {
      console.log(`  ~ ${fund.code.padEnd(10)} - Already exists`);
    }
  }

  console.log(`  Inserted ${insertedCount} new funds`);

  // Verify total funds
  const countResult = await client.query('SELECT COUNT(*) as count FROM funds');
  const totalFunds = pgCount(countResult.rows[0].count);
  console.log(`  Total funds in database: ${totalFunds}`);

  if (totalFunds !== FUNDS.length) {
    throw new Error(
      `Expected ${FUNDS.length} funds but found ${totalFunds}. Database may be in inconsistent state.`
    );
  }

  return insertedCount;
}

/**
 * Seed the teams table with 80 teams (TEAM_001 through TEAM_080)
 * Each team gets a hashed password
 * Uses ON CONFLICT DO NOTHING for idempotency
 * 
 * Requirements: 1.1, 2.1, 2.2
 * 
 * @param client - Database connection
 * @returns Number of teams inserted
 */
async function seedTeams(client: PoolClient): Promise<number> {
  console.log('\n👥 Seeding teams table...');

  const upsertQuery = `
    INSERT INTO teams (team_code, team_name, password_hash, starting_capital)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (team_code) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      team_name = EXCLUDED.team_name
    RETURNING id, (xmax = 0) AS inserted;
  `;

  let insertedCount = 0;

  for (let i = 1; i <= TOTAL_TEAMS; i++) {
    const teamCode = formatTeamCode(i);
    const teamName = `${teamCode} Squad`; // Example: "TEAM_001 Squad"
    const password = `${teamCode.toLowerCase()}123`; // Simple password: team_001123
    const passwordHash = hashPassword(password);

    const result = await client.query(upsertQuery, [
      teamCode,
      teamName,
      passwordHash,
      STARTING_CAPITAL,
    ]);

    if (result.rows[0]?.inserted) {
      insertedCount++;
      if (i % 10 === 0 || i === 1) {
        console.log(`  ✓ ${teamCode} - ${teamName}`);
      }
    }
  }

  console.log(`  Upserted ${insertedCount} new teams (passwords refreshed for all 80)`);

  // Verify total teams
  const countResult = await client.query('SELECT COUNT(*) as count FROM teams');
  const totalTeams = pgCount(countResult.rows[0].count);
  console.log(`  Total teams in database: ${totalTeams}`);

  if (totalTeams !== TOTAL_TEAMS) {
    throw new Error(
      `Expected ${TOTAL_TEAMS} teams but found ${totalTeams}. Database may be in inconsistent state.`
    );
  }

  return insertedCount;
}

/**
 * Initialize portfolios for all teams with ₹100 Crore starting capital
 * Creates one portfolio entry per team in the portfolios table
 * Uses ON CONFLICT DO NOTHING for idempotency
 * 
 * Requirements: 2.1, 2.2, 2.3, 3.1, 3.2
 * 
 * @param client - Database connection
 * @returns Number of portfolios created
 */
async function seedPortfolios(client: PoolClient): Promise<number> {
  console.log('\n💰 Initializing portfolios with starting capital...');

  // Fetch all team IDs
  const teamsResult = await client.query('SELECT id, team_code FROM teams ORDER BY id');
  const teams = teamsResult.rows;

  if (teams.length !== TOTAL_TEAMS) {
    throw new Error(
      `Expected ${TOTAL_TEAMS} teams but found ${teams.length}. Run seedTeams first.`
    );
  }

  const insertQuery = `
    INSERT INTO portfolios (team_id, cash, last_updated)
    VALUES ($1, $2, NOW())
    ON CONFLICT (team_id) DO NOTHING
    RETURNING team_id;
  `;

  let insertedCount = 0;

  for (const team of teams) {
    const result = await client.query(insertQuery, [team.id, STARTING_CAPITAL]);

    if (result.rowCount && result.rowCount > 0) {
      insertedCount++;
      if (team.id % 10 === 0 || team.id === 1) {
        console.log(`  ✓ ${team.team_code} - ${formatCurrency(STARTING_CAPITAL)}`);
      }
    }
  }

  console.log(`  Initialized ${insertedCount} new portfolios`);

  // Verify total portfolios
  const countResult = await client.query('SELECT COUNT(*) as count FROM portfolios');
  const totalPortfolios = pgCount(countResult.rows[0].count);
  console.log(`  Total portfolios in database: ${totalPortfolios}`);

  if (totalPortfolios !== TOTAL_TEAMS) {
    throw new Error(
      `Expected ${TOTAL_TEAMS} portfolios but found ${totalPortfolios}. Database may be in inconsistent state.`
    );
  }

  // Verify total capital allocation
  const capitalResult = await client.query(
    'SELECT SUM(cash) as total_capital FROM portfolios'
  );
  const totalCapital = Number(capitalResult.rows[0].total_capital);
  const expectedTotalCapital = STARTING_CAPITAL * TOTAL_TEAMS;

  console.log(`  Total capital allocated: ${formatCurrency(totalCapital)}`);
  console.log(`  Expected total capital: ${formatCurrency(expectedTotalCapital)}`);

  if (Math.abs(totalCapital - expectedTotalCapital) > 0.01) {
    throw new Error(
      `Capital allocation mismatch: expected ${expectedTotalCapital}, got ${totalCapital}`
    );
  }

  return insertedCount;
}

/**
 * Initialize holdings table with zero holdings for all team-fund pairs
 * This pre-populates the holdings table so queries don't need to handle missing rows
 * Uses ON CONFLICT DO NOTHING for idempotency
 * 
 * Requirements: 3.1, 3.2
 * 
 * @param client - Database connection
 * @returns Number of holdings records created
 */
async function seedHoldings(client: PoolClient): Promise<number> {
  console.log('\n📈 Initializing fund holdings (zero quantities)...');

  // Fetch all team and fund IDs
  const teamsResult = await client.query('SELECT id FROM teams ORDER BY id');
  const teams = teamsResult.rows;

  const fundsResult = await client.query('SELECT id FROM funds WHERE is_cash = false ORDER BY id');
  const funds = fundsResult.rows;

  if (teams.length !== TOTAL_TEAMS) {
    throw new Error(`Expected ${TOTAL_TEAMS} teams but found ${teams.length}`);
  }

  if (funds.length !== FUNDS.length - 1) {
    // -1 because we exclude the CASH fund
    throw new Error(
      `Expected ${FUNDS.length - 1} investable funds but found ${funds.length}`
    );
  }

  const insertQuery = `
    INSERT INTO holdings (team_id, fund_id, quantity, last_updated)
    VALUES ($1, $2, 0, NOW())
    ON CONFLICT (team_id, fund_id) DO NOTHING
    RETURNING id;
  `;

  let insertedCount = 0;
  const totalExpected = teams.length * funds.length;

  for (const team of teams) {
    for (const fund of funds) {
      const result = await client.query(insertQuery, [team.id, fund.id]);

      if (result.rowCount && result.rowCount > 0) {
        insertedCount++;
      }
    }
  }

  console.log(`  Initialized ${insertedCount} holdings records`);
  console.log(`  Expected: ${totalExpected} records (${TOTAL_TEAMS} teams × ${funds.length} funds)`);

  // Verify total holdings
  const countResult = await client.query('SELECT COUNT(*) as count FROM holdings');
  const totalHoldings = pgCount(countResult.rows[0].count);
  console.log(`  Total holdings in database: ${totalHoldings}`);

  if (totalHoldings !== totalExpected) {
    throw new Error(
      `Expected ${totalExpected} holdings but found ${totalHoldings}. Database may be in inconsistent state.`
    );
  }

  return insertedCount;
}

/**
 * Clear all seed data from the database
 * Useful for re-running seed script from scratch
 * 
 * @param client - Database connection
 */
async function clearSeedData(client: PoolClient): Promise<void> {
  console.log('\n🗑️  Clearing existing seed data...');

  // Order of deletion is important due to foreign key constraints
  const tables = [
    'holdings',
    'pending_orders',
    'executed_orders',
    'p2p_trades',
    'portfolios',
    'teams',
    'funds',
  ];

  for (const table of tables) {
    try {
      await client.query(`DELETE FROM ${table}`);
      const countResult = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`  ✓ Cleared ${table} (${countResult.rows[0].count} rows remaining)`);
    } catch (error) {
      // Table may not exist, which is fine
      console.log(`  ~ ${table} - skipped`);
    }
  }
}

/**
 * Log audit event for seed data initialization
 * Records that the game was initialized with seed data
 * 
 * Requirements: 2.3
 * 
 * @param client - Database connection
 */
async function logSeedAuditEvent(client: PoolClient): Promise<void> {
  try {
    await client.query(
      `
      INSERT INTO audit_log 
      (event_type, admin_username, event_data, created_at) 
      VALUES ($1, $2, $3, NOW())
      `,
      [
        'seed_data_initialized',
        'system',
        JSON.stringify({
          timestamp: new Date().toISOString(),
          total_teams: TOTAL_TEAMS,
          starting_capital: STARTING_CAPITAL,
          total_funds: FUNDS.length,
          total_allocated_capital: STARTING_CAPITAL * TOTAL_TEAMS,
        }),
      ]
    );
    console.log('\n📝 Logged seed event to audit log');
  } catch (error) {
    console.error('Warning: Could not log audit event:', error);
  }
}

// ============================================================================
// Main Execution
// ============================================================================

/**
 * Main function to orchestrate seed data creation
 */
async function main(): Promise<void> {
  const pool = createPool();
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    console.log('🌱 Market Mayhem Seed Data Script');
    console.log('==================================\n');

    // Parse command line arguments
    const args = process.argv.slice(2);
    const shouldReset = args.includes('--reset');

    if (shouldReset) {
      await clearSeedData(client);
    }

    // Execute seed functions
    console.log('Starting seed data initialization...\n');

    const fundsInserted = await seedFunds(client);
    const teamsInserted = await seedTeams(client);
    const portfoliosInserted = await seedPortfolios(client);
    const holdingsInserted = await seedHoldings(client);

    // Log audit event
    await logSeedAuditEvent(client);

    // Summary report
    console.log('\n✅ Seed Data Initialization Complete');
    console.log('====================================');
    console.log(`Funds inserted:       ${fundsInserted}/${FUNDS.length}`);
    console.log(`Teams inserted:       ${teamsInserted}/${TOTAL_TEAMS}`);
    console.log(`Portfolios created:   ${portfoliosInserted}/${TOTAL_TEAMS}`);
    console.log(`Holdings initialized: ${holdingsInserted}/${TOTAL_TEAMS * (FUNDS.length - 1)}`);
    console.log(
      `Total capital allocated: ${formatCurrency(STARTING_CAPITAL * TOTAL_TEAMS)}`
    );
    console.log('\nDatabase is ready for game simulation.');
  } catch (error) {
    console.error('\n❌ Seed Data Initialization Failed');
    console.error('==================================');
    console.error('Error:', error instanceof Error ? error.message : error);

    // Print stack trace in verbose mode
    if (process.env.DEBUG === 'true' && error instanceof Error) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// ============================================================================
// Export Functions for Integration Tests
// ============================================================================

/**
 * Export seed functions for use in integration tests
 * Allows tests to set up specific test data scenarios
 */
export {
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
};

// ============================================================================
// Script Entry Point
// ============================================================================

// Run when executed as a script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
