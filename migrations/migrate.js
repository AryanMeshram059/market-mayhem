#!/usr/bin/env node

/**
 * ============================================================================
 * Market Mayhem Database Migration Runner (Node.js)
 * ============================================================================
 * Usage:
 *   node migrate.js                           # Uses environment variables
 *   node migrate.js --host localhost --user postgres --database market_mayhem
 *   npm run db:migrate                        # Using npm script
 * 
 * Environment Variables:
 *   DATABASE_URL or SUPABASE_URL
 *   Or individual: PGHOST, PGUSER, PGDATABASE, PGPASSWORD, PGPORT
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// ============================================================================
// Configuration
// ============================================================================

const args = require('minimist')(process.argv.slice(2), {
  string: ['host', 'user', 'database', 'password', 'port'],
  alias: {
    h: 'host',
    u: 'user',
    d: 'database',
    p: 'password',
  },
});

// Parse connection string from environment or command line
function getConnectionConfig() {
  // Try DATABASE_URL first (common convention)
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // For Supabase
    };
  }

  // Try SUPABASE_URL (Supabase convention)
  if (process.env.SUPABASE_URL) {
    // Extract connection parameters from Supabase URL
    const url = new URL(process.env.SUPABASE_URL.replace('postgresql://', 'postgres://'));
    return {
      host: url.hostname,
      port: url.port || 5432,
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1),
      ssl: { rejectUnauthorized: false },
    };
  }

  // Use individual environment variables or command line args
  return {
    host: args.host || process.env.PGHOST || 'localhost',
    port: parseInt(args.port || process.env.PGPORT || '5432'),
    user: args.user || process.env.PGUSER || 'postgres',
    password: args.password || process.env.PGPASSWORD || '',
    database: args.database || process.env.PGDATABASE || 'market_mayhem',
  };
}

// ============================================================================
// Colors for console output
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(color, symbol, message) {
  console.log(`${color}${symbol} ${message}${colors.reset}`);
}

const print = {
  header: (msg) => {
    console.log(`\n${colors.blue}${'='.repeat(50)}${colors.reset}`);
    console.log(`${colors.blue}${colors.bright}${msg}${colors.reset}`);
    console.log(`${colors.blue}${'='.repeat(50)}${colors.reset}\n`);
  },
  success: (msg) => log(colors.green, '✓', msg),
  error: (msg) => log(colors.red, '✗', msg),
  warning: (msg) => log(colors.yellow, '⚠', msg),
  info: (msg) => log(colors.blue, 'ℹ', msg),
  section: (msg) => console.log(`\n${colors.bright}${msg}${colors.reset}`),
};

// ============================================================================
// Migration Runner
// ============================================================================

class MigrationRunner {
  constructor(config) {
    this.config = config;
    this.pool = null;
    this.migrations = [
      '001_create_core_tables.sql',
      '002_create_rls_policies.sql',
      '003_create_indexes.sql',
      '004_seed_initial_data.sql',
    ];
    this.migrationsDir = path.join(__dirname);
  }

  async connect() {
    try {
      this.pool = new Pool(this.config);
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      print.success('Database connection successful');
    } catch (error) {
      print.error(`Failed to connect to database: ${error.message}`);
      throw error;
    }
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
    }
  }

  async checkPrerequisites() {
    print.section('Pre-Migration Checks');

    try {
      const result = await this.pool.query(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"
      );
      const tableCount = parseInt(result.rows[0].count);

      if (tableCount > 0) {
        print.warning(`Database already contains ${tableCount} table(s)`);
        // In non-interactive mode, continue anyway
        print.info('Continuing with migration...');
      } else {
        print.success('Database is empty, ready for migration');
      }
    } catch (error) {
      print.warning(`Could not check existing tables: ${error.message}`);
    }
  }

  async executeMigration(migrationFile, index, total) {
    const migrationPath = path.join(this.migrationsDir, migrationFile);

    // Verify file exists
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationFile}`);
    }

    // Read migration file
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    print.section(`[${index}/${total}] Executing: ${migrationFile}`);

    try {
      const client = await this.pool.connect();
      try {
        // Execute entire migration as a transaction
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');

        print.success(`Migration completed: ${migrationFile}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      throw new Error(`Migration ${migrationFile} failed: ${error.message}`);
    }
  }

  async verifyMigrations() {
    print.section('Post-Migration Verification');

    try {
      // Check tables
      const tablesResult = await this.pool.query(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"
      );
      const tableCount = parseInt(tablesResult.rows[0].count);
      print.info(`Total tables created: ${tableCount}`);

      if (tableCount >= 12) {
        print.success('All expected tables created');
      } else {
        print.warning(`Expected 12 tables, found ${tableCount}`);
      }

      // Check RLS
      const rlsResult = await this.pool.query(
        "SELECT COUNT(*) FROM pg_tables WHERE rowsecurity = true AND schemaname = 'public'"
      );
      const rlsCount = parseInt(rlsResult.rows[0].count);
      print.info(`Tables with RLS enabled: ${rlsCount}`);

      if (rlsCount >= 8) {
        print.success('RLS policies applied successfully');
      } else {
        print.warning(`Expected RLS on 8+ tables, found ${rlsCount}`);
      }

      // Check initial data
      console.log();
      const teamResult = await this.pool.query('SELECT COUNT(*) FROM teams');
      const teamCount = parseInt(teamResult.rows[0].count);
      print.info(`Teams seeded: ${teamCount} (expected: 80)`);

      const fundResult = await this.pool.query('SELECT COUNT(*) FROM funds');
      const fundCount = parseInt(fundResult.rows[0].count);
      print.info(`Funds seeded: ${fundCount} (expected: 12)`);

      const portfolioResult = await this.pool.query('SELECT COUNT(*) FROM portfolios');
      const portfolioCount = parseInt(portfolioResult.rows[0].count);
      print.info(`Portfolios initialized: ${portfolioCount} (expected: 80)`);

      if (teamCount === 80 && fundCount === 12 && portfolioCount === 80) {
        print.success('All initial data seeded successfully');
      } else {
        print.warning('Some data may not have been seeded correctly');
      }

      // Check game state
      const gameStateResult = await this.pool.query(
        'SELECT current_round, current_phase FROM game_state WHERE id = 1'
      );
      if (gameStateResult.rows.length > 0) {
        const { current_round, current_phase } = gameStateResult.rows[0];
        print.success(`Game state initialized: Round ${current_round}, Phase ${current_phase}`);
      } else {
        print.warning('Game state may not be initialized');
      }
    } catch (error) {
      print.error(`Verification failed: ${error.message}`);
    }
  }

  async run() {
    let failed = 0;

    try {
      print.header('Market Mayhem Database Migration Runner');

      // Display configuration
      print.section('Database Configuration');
      print.info(`Host: ${this.config.host || 'connection string'}`);
      print.info(`Port: ${this.config.port || '5432'}`);
      print.info(`User: ${this.config.user || 'default'}`);
      print.info(`Database: ${this.config.database || 'default'}`);

      // Connect
      await this.connect();

      // Pre-flight checks
      await this.checkPrerequisites();

      // Execute migrations
      print.header('Executing Migrations');

      for (let i = 0; i < this.migrations.length; i++) {
        try {
          await this.executeMigration(this.migrations[i], i + 1, this.migrations.length);
        } catch (error) {
          print.error(error.message);
          failed++;
        }
      }

      // Verify
      await this.verifyMigrations();

      // Summary
      print.header('Migration Summary');

      if (failed === 0) {
        print.success('All migrations completed successfully!');
        console.log('\nNext steps:');
        console.log('  1. Verify application connectivity to the database');
        console.log('  2. Test authentication with a sample team');
        console.log('  3. Test order submission and execution');
        console.log('  4. Monitor performance with sample data\n');
        return 0;
      } else {
        print.error(`${failed} migration(s) failed`);
        print.info('Check the error messages above for details\n');
        return 1;
      }
    } catch (error) {
      print.error(`Fatal error: ${error.message}`);
      return 1;
    } finally {
      await this.disconnect();
    }
  }
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  const config = getConnectionConfig();
  const runner = new MigrationRunner(config);
  const exitCode = await runner.run();
  process.exit(exitCode);
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error(`Uncaught error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = MigrationRunner;
