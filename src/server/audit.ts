import { query, type PoolClient } from './db';

export interface AuditEvent {
  event_type: string;
  team_id?: number | null;
  admin_username?: string | null;
  round?: number | null;
  event_data: Record<string, unknown>;
}

export async function audit(
  event: AuditEvent,
  client?: PoolClient,
): Promise<void> {
  const sql = `
    INSERT INTO audit_log (
      event_type,
      team_id,
      admin_username,
      round,
      event_data,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
  `;

  const params = [
    event.event_type,
    event.team_id ?? null,
    event.admin_username ?? null,
    event.round ?? null,
    JSON.stringify(event.event_data),
  ];

  // IMPORTANT:
  // If we're already inside a transaction, NEVER swallow errors.
  // PostgreSQL marks the transaction as aborted after any SQL error.
  // Catching the error here only hides the real problem.
  if (client) {
    await client.query(sql, params);
    return;
  }

  // Outside a transaction, audit failures are non-critical.
  try {
    await query(sql, params);
  } catch (err) {
    console.warn(
      'audit_log write failed:',
      err instanceof Error ? err.message : err,
    );
  }
}