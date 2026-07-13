import { authenticateTeamRequest } from '@/services/auth';
import { queryAsGameEngine } from '@/lib/db';
import { getAuthHeader, handleApiError, jsonResponse } from '@/lib/api';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ trade_id: string }> }
) {
  try {
    const teamId = await authenticateTeamRequest(getAuthHeader(request));
    const { trade_id } = await params;

    const rows = await queryAsGameEngine(
      `SELECT id as trade_id, status, approved_by, approved_at, proposer_team_id, counterparty_team_id
       FROM p2p_trades
       WHERE id = $1 AND (proposer_team_id = $2 OR counterparty_team_id = $2)`,
      [trade_id, teamId]
    );

    if (rows.length === 0) {
      return jsonResponse({ error: { code: 'NOT_FOUND', message: 'Trade not found' } }, 404);
    }

    return jsonResponse(rows[0]);
  } catch (error) {
    return handleApiError(error);
  }
}
