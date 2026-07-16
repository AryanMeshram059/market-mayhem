import { registerTeam } from '@/server/auth';
import { fail, ok } from '@/server/http';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const team = await registerTeam({
      teamName: String(body.team_name ?? ''),
      password: String(body.password ?? ''),
      captain: {
        name: String(body.captain?.name ?? ''),
        email: String(body.captain?.email ?? ''),
        rollNumber: String(body.captain?.roll_number ?? ''),
        details: body.captain?.details ?? {},
      },
      players: Array.isArray(body.players)
        ? body.players.map((player: Record<string, unknown>) => ({
            name: String(player.name ?? ''),
            email: String(player.email ?? ''),
            rollNumber: String(player.roll_number ?? ''),
            details: (player.details as Record<string, unknown> | undefined) ?? {},
          }))
        : [],
    });

    return ok(
      {
        team_id: team.id,
        team_code: team.team_code,
        team_name: team.team_name,
      },
      201
    );
  } catch (error) {
    return fail(error);
  }
}
