export const runtime = 'nodejs';

import { authenticateTeam } from '@/server/auth';
import { query } from '@/server/db';
import { authHeader, fail, ok } from '@/server/http';
import { notFound } from '@/server/errors';

export async function GET(request: Request, context: { params: Promise<{ trade_id: string }> }) {
  try {
    const teamId = await authenticateTeam(authHeader(request));
    const { trade_id } = await context.params;
    const rows = await query(
      `SELECT * FROM p2p_trades
       WHERE id = $1 AND (proposer_team_id = $2 OR counterparty_team_id = $2)`,
      [trade_id, teamId]
    );
    if (!rows[0]) notFound('P2P trade not found');
    return ok(rows[0]);
  } catch (error) {
    return fail(error);
  }
}
