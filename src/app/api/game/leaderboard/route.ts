import { authenticateTeamRequest } from '@/services/auth';
import { checkRateLimit } from '@/services/rateLimit';
import { computeLeaderboard } from '@/engine/scoring/leaderboard';
import { getAuthHeader, handleApiError, jsonResponse } from '@/lib/api';

export async function GET(request: Request) {
  try {
    const teamId = await authenticateTeamRequest(getAuthHeader(request));
    await checkRateLimit(teamId);

    const leaderboard = await computeLeaderboard();
    return jsonResponse(leaderboard);
  } catch (error) {
    return handleApiError(error);
  }
}
