import { authenticateTeamRequest } from '@/services/auth';
import { checkRateLimit } from '@/services/rateLimit';
import { auditLog } from '@/services/auditLog';
import { getTeamContext, validateOrder } from '@/engine/validation/orderValidator';
import { getGameState } from '@/engine/round/stateMachine';
import { queryAsGameEngine } from '@/lib/db';
import { getAuthHeader, handleApiError, jsonResponse } from '@/lib/api';
import type { OrderSubmission } from '@/types';

export async function POST(request: Request) {
  try {
    const teamId = await authenticateTeamRequest(getAuthHeader(request));
    await checkRateLimit(teamId, 1, 'order');

    const body: OrderSubmission = await request.json();
    const team = await getTeamContext(teamId);
    if (!team) {
      return jsonResponse({ error: { code: 'NOT_FOUND', message: 'Team not found' } }, 404);
    }

    const gameState = await getGameState();
    const validation = await validateOrder(body, team, gameState.phase);

    if (!validation.valid) {
      return jsonResponse({ error: { code: 'VALIDATION_ERROR', message: validation.error!, details: validation.details } }, 400);
    }

    const result = await queryAsGameEngine(
      `INSERT INTO pending_orders (team_id, fund_id, order_type, quantity, round)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [teamId, body.fund_id, body.type, body.quantity, gameState.round]
    );

    const orderId = result[0].id;
    const funds = await queryAsGameEngine(`SELECT current_nav FROM funds WHERE id = $1`, [body.fund_id]);
    const estimatedCost = body.type === 'buy'
      ? body.quantity * Number(funds[0].current_nav) * 1.002 * 1.05
      : 0;

    await auditLog('order_submitted', {
      teamId,
      round: gameState.round,
      details: { order_id: orderId, ...body },
    });

    return jsonResponse({ order_id: orderId, status: 'pending', estimated_cost: estimatedCost });
  } catch (error) {
    return handleApiError(error);
  }
}
