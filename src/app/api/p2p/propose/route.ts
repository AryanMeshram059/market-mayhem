export const runtime = 'nodejs';

import { authenticateTeam } from '@/server/auth';
import { checkAndTransition } from '@/server/engine/state';
import { proposeP2P } from '@/server/engine/p2p';
import { badRequest } from '@/server/errors';
import { authHeader, fail, ok } from '@/server/http';

export async function POST(request: Request) {
  try {
    const proposerTeamId = await authenticateTeam(authHeader(request));
    const state = await checkAndTransition();
    if (state.phase !== 'TRADING_OPEN') {
      badRequest(`P2P trading is closed during ${state.phase}`);
    }
    const body = await request.json();
    return ok(await proposeP2P({
      proposerTeamId,
      counterpartyTeamId: Number(body.counterparty_team_id),
      fundId: Number(body.fund_id),
      quantity: Number(body.quantity),
      price: Number(body.price_per_unit ?? body.agreed_price),
      direction: body.direction,
      round: state.round,
    }));
  } catch (error) {
    return fail(error);
  }
}
