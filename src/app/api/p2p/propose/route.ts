import { authenticateTeamRequest } from '@/services/auth';
import { checkRateLimit } from '@/services/rateLimit';
import { auditLog } from '@/services/auditLog';
import { getTeamContext } from '@/engine/validation/orderValidator';
import { getGameState } from '@/engine/round/stateMachine';
import { queryAsGameEngine } from '@/lib/db';
import { getAuthHeader, handleApiError, jsonResponse } from '@/lib/api';
import type { P2PProposal } from '@/types';

export async function POST(request: Request) {
  try {
    const teamId = await authenticateTeamRequest(getAuthHeader(request));
    await checkRateLimit(teamId, 1, 'p2p');

    const body: P2PProposal = await request.json();
    const gameState = await getGameState();

    if (gameState.phase !== 'TRADING_OPEN') {
      return jsonResponse({ error: { code: 'WRONG_PHASE', message: `P2P trading closed during ${gameState.phase}` } }, 400);
    }

    const team = await getTeamContext(teamId);
    if (!team) {
      return jsonResponse({ error: { code: 'NOT_FOUND', message: 'Team not found' } }, 404);
    }

    const tradeValue = body.quantity * body.price_per_unit;

    if (body.direction === 'sell') {
      const holding = team.holdings.get(body.fund_id) ?? 0;
      if (holding < body.quantity) {
        return jsonResponse({ error: { code: 'VALIDATION_ERROR', message: `Insufficient holdings: need ${body.quantity}, have ${holding}` } }, 400);
      }
    } else {
      const cost = tradeValue * 1.002;
      if (team.cash < cost) {
        return jsonResponse({ error: { code: 'VALIDATION_ERROR', message: `Insufficient cash for P2P buy` } }, 400);
      }
    }

    const result = await queryAsGameEngine(
      `INSERT INTO p2p_trades
       (proposer_team_id, counterparty_team_id, fund_id, quantity, agreed_price, proposer_direction, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'awaiting_approval')
       RETURNING id`,
      [teamId, body.counterparty_team_id, body.fund_id, body.quantity, body.price_per_unit, body.direction]
    );

    const tradeId = result[0].id;
    await auditLog('p2p_proposed', {
      teamId,
      round: gameState.round,
      details: { trade_id: tradeId, ...body },
    });

    return jsonResponse({ trade_id: tradeId, status: 'awaiting_approval' });
  } catch (error) {
    return handleApiError(error);
  }
}
