import { Pool, types, type PoolClient, type QueryResultRow } from 'pg';
import '@/lib/env';

let pool: Pool | null = null;

types.setTypeParser(1114, (value) => new Date(`${value}Z`));

function getConnectionString(): string {
  const value =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_CONNECTION_STRING;

  if (!value) {
    throw new Error('DATABASE_URL, POSTGRES_URL, or DATABASE_CONNECTION_STRING is required');
  }

  return value;
}

export function getPool(): Pool {
  if (!pool) {
    const connectionString = getConnectionString();
    pool = new Pool({
      connectionString,
      // Serverless (Vercel): each function instance gets its own pool, and many
      // instances can run concurrently. Keep this small — the real pooling
      // happens on Supabase's side via the Supavisor transaction pooler
      // (make sure DATABASE_URL points at the :6543 pooler endpoint, not :5432).
      max: 3,
      min: 0,
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 10_000,
      query_timeout: 10_000,
      application_name: 'market_mayhem',
      ssl: /supabase|pooler/i.test(connectionString)
        ? { rejectUnauthorized: false }
        : undefined,
    });

    // Log pool errors and remove bad clients
    pool.on('error', (err, client) => {
      console.error('Pool client error:', err);
      // The client will be automatically removed from the pool
    });
    
    // Clean up on connection errors
    pool.on('connect', (client) => {
      client.on('error', (err) => {
        console.error('Client connection error:', err);
      });
    });
  }

  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await getPool().query<T>(sql, params);
  return result.rows;
}

export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  let committed = false;
  let rolledBack = false;

  try {
    await client.query('BEGIN');
    const result = await fn(client);
    
    // Commit the transaction
    await client.query('COMMIT');
    committed = true;
    return result;
  } catch (error) {
    // Only attempt rollback if we haven't committed yet and haven't already rolled back
    if (!committed && !rolledBack) {
      try {
        await client.query('ROLLBACK');
        rolledBack = true;
      } catch (rollbackError) {
        // Log but don't throw - the original error is more important
        const msg = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
        console.error('Transaction rollback failed:', msg);
      }
    }
    
    // Log the original error for debugging
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('transaction is aborted')) {
      console.error('Transaction aborted error - this should not happen with the new implementation:', errorMsg);
    }
    
    throw error;
  } finally {
    // Release connection back to pool
    // No need to ROLLBACK here - we've already committed or rolled back
    client.release();
  }
}

export type { PoolClient };