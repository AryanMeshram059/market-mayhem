import { Pool, PoolClient, QueryResult } from 'pg';

/**
 * PostgreSQL connection pool configuration
 * Requirements: 20.4, 20.5
 */

/**
 * Global connection pool instance (singleton)
 * Configured with max 20 connections for Supabase Free tier compatibility
 */
let pool: Pool | null = null;

/**
 * Get or create the global connection pool
 * Uses environment variables for connection string:
 * - DATABASE_URL: Direct connection string to PostgreSQL
 * - POSTGRES_URL: Supabase direct connection string
 */
function getPool(): Pool {
  if (!pool) {
    const connectionString =
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.DATABASE_CONNECTION_STRING;

    if (!connectionString) {
      throw new Error(
        'DATABASE_URL, POSTGRES_URL, or DATABASE_CONNECTION_STRING must be set'
      );
    }

    pool = new Pool({
      connectionString,
      max: 20, // Maximum connections in pool for Supabase Free tier
      idleTimeoutMillis: 30000, // Close idle connections after 30s
      connectionTimeoutMillis: 5000, // Timeout attempting to connect
      statement_timeout: 30000, // 30s query timeout
      query_timeout: 30000, // 30s query timeout
      // Uncomment for production debugging
      // log: (msg: string, params?: any[]) => console.log(msg, params),
    });

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client in pool', err);
      process.exit(-1);
    });
  }

  return pool;
}

/**
 * Release the global connection pool
 * Used for cleanup in tests or graceful shutdown
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Interface for database connection options
 */
interface ConnectionOptions {
  teamId?: number;
  role?: 'team' | 'game_engine' | 'admin' | 'auth';
}

/**
 * Set RLS context variables on the connection
 * These variables are used by PostgreSQL RLS policies to enforce row-level security
 *
 * Example RLS Policy:
 * ```sql
 * CREATE POLICY team_isolation ON teams
 *   FOR SELECT
 *   USING (id = current_setting('app.current_team_id')::int);
 * ```
 *
 * @param client - The database client to configure
 * @param options - Configuration options (teamId, role)
 */
async function setRLSContext(
  client: PoolClient,
  options: ConnectionOptions
): Promise<void> {
  const statements: string[] = [];

  // Set team context if provided
  if (options.teamId !== undefined) {
    statements.push(`SET app.current_team_id = '${options.teamId}'`);
  }

  // Set role-based authorization level
  const role = options.role || 'team';
  statements.push(`SET app.role = '${role}'`);

  // Execute all SET statements in a single batch
  if (statements.length > 0) {
    await client.query(statements.join('; '));
  }
}

/**
 * Get a database connection for team-level operations
 * Sets app.current_team_id context variable to enforce RLS policies
 *
 * Usage:
 * ```typescript
 * const conn = await getTeamConnection(teamId);
 * try {
 *   const result = await conn.query('SELECT * FROM portfolios WHERE team_id = $1', [teamId]);
 *   // RLS policy automatically filters to this team only
 * } finally {
 *   conn.release();
 * }
 * ```
 *
 * Requirements: 20.4 - Row-level security context for team isolation
 *
 * @param teamId - The team identifier to set in RLS context
 * @returns A pooled database client with team context applied
 */
export async function getTeamConnection(teamId: number): Promise<PoolClient> {
  const client = await getPool().connect();

  try {
    await setRLSContext(client, { teamId, role: 'team' });
  } catch (error) {
    client.release();
    throw error;
  }

  return client;
}

/**
 * Get a database connection for game engine operations
 * Sets elevated app.role = 'game_engine' to bypass some RLS restrictions
 * Game engine can write to all team portfolios during order execution
 *
 * Usage:
 * ```typescript
 * const conn = await getGameEngineConnection();
 * try {
 *   await conn.query('BEGIN');
 *   await executeOrdersInTransaction(conn);
 *   await conn.query('COMMIT');
 * } catch (error) {
 *   await conn.query('ROLLBACK');
 *   throw error;
 * } finally {
 *   conn.release();
 * }
 * ```
 *
 * Requirements: 20.4 - Elevated permissions for critical computations
 * Used by: Order execution, P2P trade execution, NAV updates, state transitions
 *
 * @returns A pooled database client with game_engine role
 */
export async function getGameEngineConnection(): Promise<PoolClient> {
  const client = await getPool().connect();

  try {
    await setRLSContext(client, { role: 'game_engine' });
  } catch (error) {
    client.release();
    throw error;
  }

  return client;
}

/**
 * Get a database connection for authentication/session operations.
 * Sessions are managed via the dedicated auth role so RLS policies can be enforced.
 */
export async function getAuthConnection(): Promise<PoolClient> {
  const client = await getPool().connect();

  try {
    await setRLSContext(client, { role: 'auth' });
  } catch (error) {
    client.release();
    throw error;
  }

  return client;
}

/**
 * Get a database connection for admin operations
 * Sets app.role = 'admin' for administrative functions
 * Admins can read all data, write disputes, and modify game state
 *
 * Usage:
 * ```typescript
 * const conn = await getAdminConnection();
 * try {
 *   // Read all teams across all RLS boundaries
 *   const teams = await conn.query('SELECT * FROM teams');
 *   // Modify disputes with audit trail
 *   await conn.query(
 *     'UPDATE portfolios SET cash = cash + $1 WHERE team_id = $2',
 *     [amount, teamId]
 *   );
 * } finally {
 *   conn.release();
 * }
 * ```
 *
 * Requirements: 20.4 - Admin access with full auditability
 * Used by: Admin console, dispute resolution, manual adjustments
 *
 * @returns A pooled database client with admin role
 */
export async function getAdminConnection(): Promise<PoolClient> {
  const client = await getPool().connect();

  try {
    await setRLSContext(client, { role: 'admin' });
  } catch (error) {
    client.release();
    throw error;
  }

  return client;
}

/**
 * Execute a function within a database transaction with automatic ROLLBACK on error
 * Useful for multi-step operations that must succeed together (order execution, P2P trades)
 *
 * Usage:
 * ```typescript
 * const result = await withTransaction(async (client) => {
 *   // All queries within this function use the same transaction
 *   const cash = await getCashBalance(client, teamId);
 *   if (cash < cost) throw new Error('Insufficient funds');
 *   await deductCash(client, teamId, cost);
 *   await addHolding(client, teamId, fundId, quantity);
 *   return { success: true };
 * });
 * ```
 *
 * Requirements: 22.6, 22.7 - Atomic transactions for state transitions
 * Requirements: 7.1, 7.8 - Order execution in transactions
 * Requirements: 14.2, 14.3 - P2P trade execution in transactions
 *
 * @param callback - Async function receiving the transaction client
 * @param role - Database role to use ('team', 'game_engine', or 'admin')
 * @param teamId - Optional team ID to set in RLS context
 * @returns Result from the callback function
 * @throws Will ROLLBACK and re-throw any error from callback
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
  options: ConnectionOptions = {}
): Promise<T> {
  let client: PoolClient | null = null;

  try {
    // Get connection with appropriate role
    const role = options.role || 'game_engine';
    if (role === 'team' && options.teamId !== undefined) {
      client = await getTeamConnection(options.teamId);
    } else if (role === 'admin') {
      client = await getAdminConnection();
    } else {
      client = await getGameEngineConnection();
    }

    // Begin transaction
    await client.query('BEGIN');

    // Execute callback
    const result = await callback(client);

    // Commit if callback succeeded
    await client.query('COMMIT');

    return result;
  } catch (error) {
    // Rollback on error
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Error during ROLLBACK:', rollbackError);
      }
    }
    throw error;
  } finally {
    // Always release the connection
    if (client) {
      client.release();
    }
  }
}

/**
 * Execute a read-only query with team-level isolation
 * Automatically releases the connection after query completes
 *
 * Usage:
 * ```typescript
 * const portfolio = await queryAsTeam(
 *   teamId,
 *   'SELECT cash FROM portfolios WHERE team_id = $1',
 *   [teamId]
 * );
 * ```
 *
 * Requirements: 20.4 - RLS context enforcement for reads
 *
 * @param teamId - The team to query as
 * @param sql - SQL query string
 * @param values - Query parameters
 * @returns Query result rows
 * @throws Database errors or query errors
 */
export async function queryAsTeam(
  teamId: number,
  sql: string,
  values?: any[]
): Promise<QueryResult['rows']> {
  const client = await getTeamConnection(teamId);

  try {
    const result = await client.query(sql, values);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Execute a query with game engine permissions
 * Automatically releases the connection after query completes
 *
 * Usage:
 * ```typescript
 * const teams = await queryAsGameEngine(
 *   'SELECT id, starting_capital FROM teams'
 * );
 * ```
 *
 * Requirements: 20.4 - Elevated permissions for critical computations
 *
 * @param sql - SQL query string
 * @param values - Query parameters
 * @returns Query result rows
 * @throws Database errors or query errors
 */
export async function queryAsGameEngine(
  sql: string,
  values?: any[]
): Promise<QueryResult['rows']> {
  const client = await getGameEngineConnection();

  try {
    const result = await client.query(sql, values);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Execute a query with auth/session permissions.
 */
export async function queryAsAuth(
  sql: string,
  values?: any[]
): Promise<QueryResult['rows']> {
  const client = await getAuthConnection();

  try {
    const result = await client.query(sql, values);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Execute a query with admin permissions
 * Automatically releases the connection after query completes
 *
 * Usage:
 * ```typescript
 * const allTeams = await queryAsAdmin(
 *   'SELECT * FROM teams'
 * );
 * ```
 *
 * Requirements: 20.4 - Admin access to all data
 *
 * @param sql - SQL query string
 * @param values - Query parameters
 * @returns Query result rows
 * @throws Database errors or query errors
 */
export async function queryAsAdmin(
  sql: string,
  values?: any[]
): Promise<QueryResult['rows']> {
  const client = await getAdminConnection();

  try {
    const result = await client.query(sql, values);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Execute multiple queries in a batch within a transaction
 * Useful for optimizing multiple related operations
 *
 * Usage:
 * ```typescript
 * const results = await batchQuery(
 *   [
 *     { sql: 'UPDATE portfolios SET cash = cash - $1 WHERE team_id = $2', values: [cost, teamId] },
 *     { sql: 'INSERT INTO executed_orders (...) VALUES (...)', values: [data] },
 *     { sql: 'SELECT * FROM portfolios WHERE team_id = $1', values: [teamId] }
 *   ],
 *   { role: 'game_engine' }
 * );
 * ```
 *
 * Requirements: 23.3 - Request batching to minimize database queries
 * Requirements: 25.4 - Multi-record updates in transactions
 *
 * @param queries - Array of {sql, values} objects
 * @param options - Connection options
 * @returns Array of QueryResult objects
 * @throws Database errors (entire batch rolled back)
 */
export async function batchQuery(
  queries: Array<{ sql: string; values?: any[] }>,
  options: ConnectionOptions = {}
): Promise<QueryResult[]> {
  return withTransaction(
    async (client) => {
      const results: QueryResult[] = [];

      for (const query of queries) {
        const result = await client.query(query.sql, query.values);
        results.push(result);
      }

      return results;
    },
    options
  );
}

/**
 * Log an audit event to the immutable audit_log table
 * Ensures all state changes are recorded for compliance and dispute resolution
 *
 * Usage:
 * ```typescript
 * await logAuditEvent({
 *   eventType: 'order_executed',
 *   teamId: 5,
 *   round: 1,
 *   adminUsername: undefined,
 *   details: {
 *     orderId: 'uuid-123',
 *     fundId: 2,
 *     quantity: 100,
 *     nav: 1234.56,
 *     effectiveNav: 1245.23,
 *     slippage: 10.67,
 *     brokerage: 2.49,
 *     totalCost: 124525.23
 *   }
 * });
 * ```
 *
 * Requirements: 2.3 - Initial capital allocation recorded in audit log
 * Requirements: 7.7 - Order execution recorded in audit log
 * Requirements: 13.7 - Admin actions recorded in audit log
 * Requirements: 16.7 - Final scores recorded in audit log
 * Requirements: 17.8 - Admin round control recorded in audit log
 * Requirements: 20.5 - All state changes append to audit log
 *
 * @param event - Audit event details
 * @throws Database or permission errors
 */
export async function logAuditEvent({
  eventType,
  teamId,
  adminUsername,
  round,
  details,
}: {
  eventType: string;
  teamId?: number;
  adminUsername?: string;
  round?: number;
  details: Record<string, any>;
}): Promise<void> {
  try {
    await queryAsGameEngine(
      `INSERT INTO audit_log 
       (event_type, team_id, admin_username, round, event_data, created_at) 
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [eventType, teamId || null, adminUsername || null, round || null, JSON.stringify(details)]
    );
  } catch (error) {
    console.error('Failed to write audit log:', error);
    // Don't throw - audit logging failures should not block operations
    // but must be logged for operational visibility
  }
}

/**
 * Health check for database connectivity
 * Useful for monitoring and liveness probes
 *
 * @returns true if database is reachable, false otherwise
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const client = await getPool().connect();
    try {
      await client.query('SELECT 1');
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

/**
 * Export the Pool class for type checking in other modules
 */
export type { PoolClient, QueryResult };
export { Pool };
