import { query } from '@/server/db';
import { fail, ok } from '@/server/http';

export async function GET() {
  try {
    const funds = await query(
      `SELECT id, fund_code, fund_name, is_cash, current_nav, last_nav_update
       FROM funds
       ORDER BY is_cash ASC, fund_code ASC`
    );
    return ok(funds);
  } catch (error) {
    return fail(error);
  }
}
