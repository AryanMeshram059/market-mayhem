export const runtime = 'nodejs';

import { loginTeam } from '@/server/auth';
import { fail, ok } from '@/server/http';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await loginTeam(String(body.team_identity ?? body.team_code ?? body.team_name ?? ''), String(body.password ?? ''));
    return ok({
      token: result.token,
      team_id: result.team.id,
      team_code: result.team.team_code,
      team_name: result.team.team_name,
    });
  } catch (error) {
    return fail(error);
  }
}
