export const runtime = 'nodejs';

import { authenticateTeam, signTeamToken, createTeamSession } from '@/server/auth';
import { query } from '@/server/db';
import { authHeader, fail, ok } from '@/server/http';
import type { Team } from '@/domain/types';

export async function POST(request: Request) {
  try {
    const teamId = await authenticateTeam(authHeader(request));
    const teams = await query<Team>(
      `SELECT id, team_code, team_name, starting_capital FROM teams WHERE id = $1`,
      [teamId]
    );
    const token = signTeamToken({ ...teams[0], starting_capital: Number(teams[0].starting_capital) });
    await createTeamSession(teamId, token);
    return ok({ token });
  } catch (error) {
    return fail(error);
  }
}
