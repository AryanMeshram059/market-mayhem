export const runtime = 'nodejs';

import { authenticateTeam } from '@/server/auth';
import { checkAndTransition } from '@/server/engine/state';
import { acceptP2P } from '@/server/engine/p2p';
import { badRequest } from '@/server/errors';
import { authHeader, fail, ok } from '@/server/http';

export async function POST(request: Request, context: { params: Promise<{ trade_id: string }> }) {
  try {
    const teamId = await authenticateTeam(authHeader(request));
    const state = await checkAndTransition();
    if (state.phase !== 'TRADING_OPEN') {
      badRequest(`P2P trading is closed during ${state.phase}`);
    }
    const { trade_id } = await context.params;
    await acceptP2P(trade_id, teamId);
    return ok({ trade_id, status: 'completed' });
  } catch (error) {
    return fail(error);
  }
}
