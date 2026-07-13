import { authenticateTeamRequest } from '@/services/auth';
import { queryAsTeam } from '@/lib/db';
import { getAuthHeader, handleApiError, jsonResponse } from '@/lib/api';

export async function GET(request: Request) {
  try {
    const teamId = await authenticateTeamRequest(getAuthHeader(request));

    const orders = await queryAsTeam(
      teamId,
      `SELECT round, total_value, executed_at
       FROM executed_orders
       WHERE team_id = $1 AND status = 'completed'
       ORDER BY round ASC, executed_at ASC`,
      [teamId]
    );

    const history: Array<{ round: number; portfolio_value: number; timestamp: string }> = [
      { round: 0, portfolio_value: 100_000_000, timestamp: new Date().toISOString() },
    ];

    let runningCash = 100_000_000;
    const roundMap = new Map<number, number>();

    for (const order of orders) {
      const value = Number(order.total_value);
      if (value > 0) {
        runningCash += value;
      } else {
        runningCash -= Math.abs(value);
      }
      roundMap.set(order.round, runningCash);
    }

    for (const [round, value] of roundMap) {
      history.push({
        round,
        portfolio_value: value,
        timestamp: new Date().toISOString(),
      });
    }

    return jsonResponse(history);
  } catch (error) {
    return handleApiError(error);
  }
}
