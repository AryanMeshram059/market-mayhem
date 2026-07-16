import { authenticateTeam } from '@/server/auth';
import { openP2POffers } from '@/server/engine/p2p';
import { authHeader, fail, ok } from '@/server/http';

export async function GET(request: Request) {
  try {
    const teamId = await authenticateTeam(authHeader(request));
    return ok(await openP2POffers(teamId));
  } catch (error) {
    return fail(error);
  }
}
