import { authenticateTeam } from '@/server/auth';
import { getPortfolio } from '@/server/engine/portfolio';
import { authHeader, fail, ok } from '@/server/http';

export async function GET(request: Request) {
  try {
    const teamId = await authenticateTeam(authHeader(request));
    return ok(await getPortfolio(teamId));
  } catch (error) {
    return fail(error);
  }
}
