import { authenticateTeamRequest } from '@/services/auth';
import { queryAsTeam } from '@/lib/db';
import { getAuthHeader, handleApiError, jsonResponse } from '@/lib/api';

export async function GET(request: Request) {
  try {
    const teamId = await authenticateTeamRequest(getAuthHeader(request));

    const orders = await queryAsTeam(
      teamId,
      `SELECT po.id as order_id, po.fund_id, f.fund_code, f.fund_name,
              po.order_type as type, po.quantity, po.created_at, po.round
       FROM pending_orders po
       JOIN funds f ON f.id = po.fund_id
       WHERE po.team_id = $1
       ORDER BY po.created_at DESC`,
      [teamId]
    );

    return jsonResponse(orders);
  } catch (error) {
    return handleApiError(error);
  }
}
