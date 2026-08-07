export const runtime = 'nodejs';

import { authenticateAdmin } from '@/server/auth';
import { STARTING_CAPITAL } from '@/domain/constants';
import { query, transaction } from '@/server/db';
import { authHeader, fail, ok } from '@/server/http';

export async function POST(request: Request) {
  try {
    const adminUsername = await authenticateAdmin(authHeader(request));
    
    const result = await transaction(async (client) => {
      // Reset game state to initial values
      await client.query(
        `UPDATE game_state
         SET current_round = 1,
             current_phase = 'IDLE',
             is_paused = FALSE,
             paused_at = NULL,
             remaining_time = NULL
         WHERE id = 1`
      );
      
      // Reset all team portfolios to starting capital
      await client.query(
        `UPDATE portfolios
         SET cash = $1,
             last_updated = NOW()`,
        [STARTING_CAPITAL],
      );
      
      // Clear all holdings
      await client.query(`DELETE FROM holdings`);
      
      // Clear all pending orders
      await client.query(`DELETE FROM pending_orders`);
      
      // Clear news feed
      await client.query(`DELETE FROM news_feed`);

      // Reset fund prices to the sealed game starting NAV
      await client.query(
        `UPDATE funds
         SET current_nav = CASE WHEN is_cash THEN 1 ELSE 100 END,
             last_nav_update = NOW()`
      );
      
      // Get the updated game state
      const rows = await client.query(
        `SELECT current_round, current_phase, phase_start, phase_duration, is_paused, remaining_time
         FROM game_state WHERE id = 1`
      );
      
      return rows.rows[0];
    });
    
    return ok({ success: true, message: 'Game reset successfully', state: result });
  } catch (error) {
    return fail(error);
  }
}
