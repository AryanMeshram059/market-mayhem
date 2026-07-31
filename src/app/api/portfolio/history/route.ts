export const runtime = 'nodejs';

import { authenticateTeam } from '@/server/auth';
import { portfolioValueHistory } from '@/server/engine/history';
import { authHeader, fail, ok } from '@/server/http';

export async function GET(request: Request) {
  try {
    const teamId = await authenticateTeam(authHeader(request));
    return ok(await portfolioValueHistory(teamId));
  } catch (error) {
    return fail(error);
  }
}
