import { authenticateAdminRequest } from '@/services/auth';
import { queryAsAdmin } from '@/lib/db';
import { getAuthHeader, handleApiError, jsonResponse } from '@/lib/api';

export async function GET(request: Request) {
  try {
    await authenticateAdminRequest(getAuthHeader(request));

    const trades = await queryAsAdmin(
      `SELECT pt.id as trade_id,
              tp.team_name as proposer_team,
              tc.team_name as counterparty_team,
              pt.fund_id, f.fund_code,
              pt.quantity, pt.agreed_price as price,
              pt.proposer_direction, pt.created_at
       FROM p2p_trades pt
       JOIN teams tp ON tp.id = pt.proposer_team_id
       JOIN teams tc ON tc.id = pt.counterparty_team_id
       JOIN funds f ON f.id = pt.fund_id
       WHERE pt.status = 'awaiting_approval'
       ORDER BY pt.created_at ASC`
    );

    return jsonResponse(trades);
  } catch (error) {
    return handleApiError(error);
  }
}
