import { authenticateTeamRequest } from '@/services/auth';
import { auditLog } from '@/services/auditLog';
import { getTeamContext, validateOrder } from '@/engine/validation/orderValidator';
import { getGameState } from '@/engine/round/stateMachine';
import { queryAsTeam } from '@/lib/db';
import { getAuthHeader, handleApiError, jsonResponse } from '@/lib/api';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ order_id: string }> }
) {
  try {
    const teamId = await authenticateTeamRequest(getAuthHeader(request));
    const { order_id } = await params;
    const { quantity } = await request.json();

    const gameState = await getGameState();
    if (gameState.phase !== 'TRADING_OPEN') {
      return jsonResponse({ error: { code: 'WRONG_PHASE', message: `Cannot modify orders during ${gameState.phase}` } }, 400);
    }

    const existing = await queryAsTeam(
      teamId,
      `SELECT fund_id, order_type FROM pending_orders WHERE id = $1 AND team_id = $2`,
      [order_id, teamId]
    );

    if (existing.length === 0) {
      return jsonResponse({ error: { code: 'NOT_FOUND', message: 'Order not found' } }, 404);
    }

    const team = await getTeamContext(teamId);
    if (!team) {
      return jsonResponse({ error: { code: 'NOT_FOUND', message: 'Team not found' } }, 404);
    }

    const validation = await validateOrder(
      { fund_id: existing[0].fund_id, type: existing[0].order_type, quantity },
      team,
      gameState.phase
    );

    if (!validation.valid) {
      return jsonResponse({ error: { code: 'VALIDATION_ERROR', message: validation.error! } }, 400);
    }

    await queryAsTeam(
      teamId,
      `UPDATE pending_orders SET quantity = $1 WHERE id = $2 AND team_id = $3`,
      [quantity, order_id, teamId]
    );

    await auditLog('order_modified', {
      teamId,
      round: gameState.round,
      details: { order_id, quantity },
    });

    return jsonResponse({ order_id, quantity });
  } catch (error) {
    return handleApiError(error);
  }
}
