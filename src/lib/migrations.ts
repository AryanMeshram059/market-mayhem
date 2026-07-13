/**
 * ============================================================================
 * Database Migration Utilities
 * ============================================================================
 * Provides helper functions for managing database connections with RLS context
 * and utility functions for working with the Market Mayhem schema.
 * 
 * Usage:
 *   import { getTeamConnection, getGameEngineConnection } from '@/lib/migrations';
 *   
 *   // For team queries (with RLS)
 *   const result = await getTeamConnection(teamId).query(
 *     'SELECT * FROM portfolios WHERE team_id = $1',
 *     [teamId]
 *   );
 *   
 *   // For system operations (game engine role)
 *   const result = await getGameEngineConnection().query(
 *     'UPDATE portfolios SET cash = cash - $1 WHERE team_id = $2',
 *     [amount, teamId]
 *   );
 */

import { Pool, Client, PoolClient, QueryResult } from 'pg';

// ============================================================================
// Types
// ============================================================================

export type Role = 'team' | 'game_engine' | 'admin' | 'auth';

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: boolean;
}

export interface MigrationResult {
  success: boolean;
  message: string;
  error?: Error;
}

// ============================================================================
// Global Connection Pool
// ============================================================================

let globalPool: Pool | null = null;

/**
 * Initialize the global database connection pool
 * Should be called once at application startup
 */
export function initializePool(config: DatabaseConfig): Pool {
  if (globalPool) {
    return globalPool;
  }

  globalPool = new Pool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    ssl: config.ssl !== false, // Default to SSL for security
    max: 20, // Maximum pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  globalPool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });

  return globalPool;
}

/**
 * Get the global database connection pool
 * Ensures pool is initialized before returning
 */
export function getPool(): Pool {
  if (!globalPool) {
    throw new Error(
      'Database pool not initialized. Call initializePool() at application startup.'
    );
  }
  return globalPool;
}

/**
 * Close the global database connection pool
 * Should be called at application shutdown
 */
export async function closePool(): Promise<void> {
  if (globalPool) {
    await globalPool.end();
    globalPool = null;
  }
}

// ============================================================================
// RLS Context Management
// ============================================================================

/**
 * Set RLS context variables on a database connection
 * These variables control what data can be accessed and modified
 */
async function setRLSContext(
  client: PoolClient,
  role: Role,
  teamId?: number
): Promise<void> {
  // Set the app.role context variable
  await client.query("SELECT set_config('app.role', $1, false)", [role]);

  // Set the app.current_team_id context variable if provided
  if (teamId !== undefined) {
    await client.query("SELECT set_config('app.current_team_id', $1, false)", [
      teamId.toString(),
    ]);
  }
}

// ============================================================================
// Connection Helpers
// ============================================================================

/**
 * Get a database connection with team context
 * Enables RLS policies to restrict data to the team
 * Use for normal team queries
 *
 * @param teamId The team ID to set in the RLS context
 * @returns A pooled client with team context configured
 */
export async function getTeamConnection(teamId: number): Promise<PoolClient> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await setRLSContext(client, 'team', teamId);
    return client;
  } catch (error) {
    client.release();
    throw error;
  }
}

/**
 * Get a database connection with game engine role
 * Elevates privileges for order execution, state transitions, etc.
 * Use for system operations only
 *
 * @returns A pooled client with game_engine role
 */
export async function getGameEngineConnection(): Promise<PoolClient> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await setRLSContext(client, 'game_engine');
    return client;
  } catch (error) {
    client.release();
    throw error;
  }
}

/**
 * Get a database connection with admin role
 * Use for administrative operations: manual adjustments, dispute resolution, etc.
 *
 * @returns A pooled client with admin role
 */
export async function getAdminConnection(): Promise<PoolClient> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await setRLSContext(client, 'admin');
    return client;
  } catch (error) {
    client.release();
    throw error;
  }
}

/**
 * Get a database connection with auth role
 * Use for session management operations
 *
 * @returns A pooled client with auth role
 */
export async function getAuthConnection(): Promise<PoolClient> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await setRLSContext(client, 'auth');
    return client;
  } catch (error) {
    client.release();
    throw error;
  }
}

// ============================================================================
// Query Helpers with RLS Context
// ============================================================================

/**
 * Execute a query with team context
 * Automatically manages connection and RLS
 *
 * @param teamId The team ID
 * @param query The SQL query
 * @param values Query parameters
 * @returns Query result
 */
export async function queryAsTeam(
  teamId: number,
  query: string,
  values?: any[]
): Promise<QueryResult> {
  const client = await getTeamConnection(teamId);
  try {
    return await client.query(query, values);
  } finally {
    client.release();
  }
}

/**
 * Execute a query as the game engine
 * Automatically manages connection and RLS
 *
 * @param query The SQL query
 * @param values Query parameters
 * @returns Query result
 */
export async function queryAsGameEngine(
  query: string,
  values?: any[]
): Promise<QueryResult> {
  const client = await getGameEngineConnection();
  try {
    return await client.query(query, values);
  } finally {
    client.release();
  }
}

/**
 * Execute a query as an admin
 * Automatically manages connection and RLS
 *
 * @param query The SQL query
 * @param values Query parameters
 * @returns Query result
 */
export async function queryAsAdmin(
  query: string,
  values?: any[]
): Promise<QueryResult> {
  const client = await getAdminConnection();
  try {
    return await client.query(query, values);
  } finally {
    client.release();
  }
}

// ============================================================================
// Transaction Management
// ============================================================================

/**
 * Execute a transaction with game engine role
 * Useful for multi-step operations that must succeed or fail together
 *
 * @param callback Function that receives the client and executes queries
 * @returns The result of the callback function
 */
export async function withGameEngineTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getGameEngineConnection();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Execute a transaction with team role
 * Useful for team-initiated multi-step operations
 *
 * @param teamId The team ID
 * @param callback Function that receives the client and executes queries
 * @returns The result of the callback function
 */
export async function withTeamTransaction<T>(
  teamId: number,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getTeamConnection(teamId);
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Execute a transaction with admin role
 * Useful for administrative operations that must be atomic
 *
 * @param callback Function that receives the client and executes queries
 * @returns The result of the callback function
 */
export async function withAdminTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getAdminConnection();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Execute multiple queries as a transaction with game engine role
 * More convenient than withGameEngineTransaction for simple cases
 *
 * @param queries Array of query objects with sql and values
 * @returns Array of results
 */
export async function batchGameEngineQueries(
  queries: Array<{ sql: string; values?: any[] }>
): Promise<QueryResult[]> {
  return withGameEngineTransaction(async (client) => {
    const results: QueryResult[] = [];
    for (const query of queries) {
      results.push(await client.query(query.sql, query.values));
    }
    return results;
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Test database connectivity
 * Useful for health checks and startup verification
 */
export async function testConnection(): Promise<boolean> {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      return true;
    } finally {
      client.release();
    }
  } catch {
    return false;
  }
}

/**
 * Get database connection info
 * Useful for logging and debugging
 */
export function getConnectionInfo(): {
  host: string;
  port: number;
  user: string;
  database: string;
} {
  const pool = getPool();
  const config = pool.options as any;
  return {
    host: config.host,
    port: config.port,
    user: config.user,
    database: config.database,
  };
}

// ============================================================================
// Schema Validation
// ============================================================================

/**
 * Verify that all required tables exist
 * Returns list of missing tables or empty array if all present
 */
export async function verifySchema(): Promise<string[]> {
  const client = await getAdminConnection();
  try {
    const requiredTables = [
      'teams',
      'portfolios',
      'holdings',
      'funds',
      'game_state',
      'pending_orders',
      'executed_orders',
      'p2p_trades',
      'schedules',
      'news_feed',
      'audit_log',
      'sessions',
    ];

    const result = await client.query(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = 'public' AND table_name = ANY($1)`,
      [requiredTables]
    );

    const existingTables = result.rows.map((row) => row.table_name);
    const missingTables = requiredTables.filter((t) => !existingTables.includes(t));

    return missingTables;
  } finally {
    client.release();
  }
}

// ============================================================================
// Audit Log Helpers
// ============================================================================

/**
 * Log an event to the audit log
 * Automatically uses game engine role
 *
 * @param eventType The type of event (e.g., 'order_executed', 'manual_adjustment')
 * @param eventData The event data as JSON object
 * @param teamId Optional team ID if related to a team
 * @param adminUsername Optional admin username if performed by admin
 * @param round Optional round number
 */
export async function logAuditEvent(
  eventType: string,
  eventData: Record<string, any>,
  options?: {
    teamId?: number;
    adminUsername?: string;
    round?: number;
  }
): Promise<void> {
  await queryAsGameEngine(
    `INSERT INTO audit_log (event_type, team_id, admin_username, round, event_data, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [
      eventType,
      options?.teamId ?? null,
      options?.adminUsername ?? null,
      options?.round ?? null,
      JSON.stringify(eventData),
    ]
  );
}

export default {
  initializePool,
  getPool,
  closePool,
  getTeamConnection,
  getGameEngineConnection,
  getAdminConnection,
  getAuthConnection,
  queryAsTeam,
  queryAsGameEngine,
  queryAsAdmin,
  withGameEngineTransaction,
  withTeamTransaction,
  withAdminTransaction,
  batchGameEngineQueries,
  testConnection,
  getConnectionInfo,
  verifySchema,
  logAuditEvent,
};
