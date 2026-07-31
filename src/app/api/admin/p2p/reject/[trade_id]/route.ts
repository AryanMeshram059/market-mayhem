export const runtime = 'nodejs';

import { authenticateAdmin } from '@/server/auth';
import { setP2PApproval } from '@/server/engine/p2p';
import { authHeader, fail, ok } from '@/server/http';

export async function POST(request: Request, context: { params: Promise<{ trade_id: string }> }) {
  try {
    const admin = await authenticateAdmin(authHeader(request));
    const { trade_id } = await context.params;
    await setP2PApproval(trade_id, admin, false);
    return ok({ trade_id, status: 'rejected' });
  } catch (error) {
    return fail(error);
  }
}
