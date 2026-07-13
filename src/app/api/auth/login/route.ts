import { authenticateTeamRequest, createSession, generateTeamToken, validateTeamCredentials } from '@/services/auth';
import { auditLog } from '@/services/auditLog';
import { getAuthHeader, handleApiError, jsonResponse } from '@/lib/api';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { team_code, password } = body;

    if (!team_code || !password) {
      return jsonResponse({ error: { code: 'VALIDATION_ERROR', message: 'Team code and password required' } }, 400);
    }

    const team = await validateTeamCredentials(team_code, password);
    if (!team) {
      return jsonResponse({ error: { code: 'AUTHENTICATION_ERROR', message: 'Invalid credentials' } }, 401);
    }

    const token = generateTeamToken(team);
    await createSession(team.id, token);
    await auditLog('login', { teamId: team.id, details: { team_code: team.team_code } });

    return jsonResponse({ token, team_id: team.id, team_name: team.team_name });
  } catch (error) {
    return handleApiError(error);
  }
}
