import { authenticateAdminRequest } from '@/services/auth';
import { computeLeaderboard } from '@/engine/scoring/leaderboard';
import { queryAsAdmin } from '@/lib/db';
import { getAuthHeader, handleApiError, jsonResponse } from '@/lib/api';

export async function GET(request: Request) {
  try {
    await authenticateAdminRequest(getAuthHeader(request));

    const teams = await queryAsAdmin(
      `SELECT t.id as team_id, t.team_name,
              (SELECT COUNT(*) FROM pending_orders po WHERE po.team_id = t.id) as pending_orders
       FROM teams t ORDER BY t.id`
    );

    const leaderboard = await computeLeaderboard();
    const rankMap = new Map(leaderboard.map((e) => [e.team_id, e]));

    const result = teams.map((team) => {
      const entry = rankMap.get(team.team_id);
      return {
        team_id: team.team_id,
        team_name: team.team_name,
        portfolio_value: entry?.portfolio_value ?? 100_000_000,
        rank: entry?.rank ?? 0,
        pending_orders: Number(team.pending_orders),
        error_state: false,
      };
    });

    return jsonResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
