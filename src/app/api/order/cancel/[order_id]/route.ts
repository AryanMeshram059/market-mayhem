import { authenticateTeamRequest } from '@/services/auth';
import { auditLog } from '@/services/auditLog';
import { getGameState } from '@/engine/round/stateMachine';
import { queryAsTeam } from '@/lib/db';
import { getAuthHeader, handleApiError, jsonResponse } from '@/lib/api';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ order_id: string }> }
) {
  try {
    const teamId = await authenticateTeamRequest(getAuthHeader(request));
    const { order_id } = await params;

    const gameState = await getGameState();
    if (gameState.phase !== 'TRADING_OPEN') {
      return jsonResponse({ error: { code: 'WRONG_PHASE', message: `Cannot cancel orders during ${gameState.phase}` } }, 400);
    }

    const deleted = await queryAsTeam(
      teamId,
      `DELETE FROM pending_orders WHERE id = $1 AND team_id = $2 RETURNING id`,
      [order_id, teamId]
    );

    if (deleted.length === 0) {
      return jsonResponse({ error: { code: 'NOT_FOUND', message: 'Order not found' } }, 404);
    }

    await auditLog('order_cancelled', {
      teamId,
      round: gameState.round,
      details: { order_id },
    });

    return jsonResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
