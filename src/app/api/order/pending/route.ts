import { authenticateTeam } from '@/server/auth';
import { pendingOrders } from '@/server/engine/orders';
import { authHeader, fail, ok } from '@/server/http';

export async function GET(request: Request) {
  try {
    const teamId = await authenticateTeam(authHeader(request));
    return ok(await pendingOrders(teamId));
  } catch (error) {
    return fail(error);
  }
}
