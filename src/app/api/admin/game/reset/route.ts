import { authenticateAdmin } from '@/server/auth';
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
         SET cash = 1000000000,
             last_updated = NOW()`
      );
      
      // Clear all holdings
      await client.query(`DELETE FROM holdings`);
      
      // Clear all pending orders
      await client.query(`DELETE FROM pending_orders`);
      
      // Clear news feed
      await client.query(`DELETE FROM news_feed`);
      
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
