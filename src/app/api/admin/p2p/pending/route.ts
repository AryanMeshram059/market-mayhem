export const runtime = 'nodejs';

import { authenticateAdmin } from '@/server/auth';
import { pendingP2P } from '@/server/engine/p2p';
import { authHeader, fail, ok } from '@/server/http';

export async function GET(request: Request) {
  try {
    await authenticateAdmin(authHeader(request));
    return ok(await pendingP2P());
  } catch (error) {
    return fail(error);
  }
}
