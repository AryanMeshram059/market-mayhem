import { authenticateTeam } from '@/server/auth';
import { query } from '@/server/db';
import { authHeader, fail, ok } from '@/server/http';

export async function GET(request: Request) {
  try {
    const teamId = await authenticateTeam(authHeader(request));
    const rows = await query(
      `SELECT id, fund_id, order_type, quantity, nav_at_execution, effective_nav,
              brokerage_fee, total_value, executed_at, round, status, error_message
       FROM executed_orders
       WHERE team_id = $1
       ORDER BY executed_at DESC`,
      [teamId]
    );
    return ok(rows);
  } catch (error) {
    return fail(error);
  }
}
