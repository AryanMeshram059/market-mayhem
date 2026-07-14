import { authenticateAdmin } from '@/server/auth';
import { getPortfolio } from '@/server/engine/portfolio';
import { query } from '@/server/db';
import { authHeader, fail, ok } from '@/server/http';

export async function GET(request: Request) {
  try {
    await authenticateAdmin(authHeader(request));
    const teams = await query<{ id: number; team_code: string; team_name: string }>(
      `SELECT id, team_code, team_name FROM teams ORDER BY id`
    );
    const data = await Promise.all(
      teams.map(async (team) => ({ ...team, portfolio: await getPortfolio(team.id) }))
    );
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}
