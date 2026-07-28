import { query } from '@/server/db';
import { fail, ok } from '@/server/http';

export async function GET() {
  try {
    const funds = await query(
      `SELECT id, fund_code, fund_name, is_cash, current_nav, last_nav_update
       FROM funds
       ORDER BY is_cash ASC,
         CASE fund_code
           WHEN 'TECH' THEN 1
           WHEN 'BANKING' THEN 2
           WHEN 'AUTO' THEN 3
           WHEN 'FMCG' THEN 4
           WHEN 'PHARMA' THEN 5
           WHEN 'ENERGY' THEN 6
           WHEN 'GOLD' THEN 7
           WHEN 'OIL' THEN 8
           WHEN 'AGRI' THEN 9
           WHEN 'GOVBOND' THEN 10
           WHEN 'PROPERTY' THEN 11
           WHEN 'CASH' THEN 12
           ELSE 99
         END`
    );
    return ok(funds);
  } catch (error) {
    return fail(error);
  }
}
