export const runtime = 'nodejs';

import { authenticateAdmin } from '@/server/auth';
import { query } from '@/server/db';
import { authHeader, fail, ok } from '@/server/http';

export async function GET(request: Request) {
  try {
    await authenticateAdmin(authHeader(request));
    const rows = await query(
      `SELECT id, event_type, team_id, admin_username, round, event_data, created_at
       FROM audit_log
       ORDER BY created_at DESC
       LIMIT 250`
    );
    return ok(rows);
  } catch (error) {
    return fail(error);
  }
}
