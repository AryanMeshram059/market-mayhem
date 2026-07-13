import { authenticateTeamRequest } from '@/services/auth';
import { checkRateLimit } from '@/services/rateLimit';
import { checkAndTransition } from '@/engine/round/stateMachine';
import { getAuthHeader, handleApiError, withETag } from '@/lib/api';

export async function GET(request: Request) {
  try {
    const teamId = await authenticateTeamRequest(getAuthHeader(request));
    await checkRateLimit(teamId);

    const state = await checkAndTransition();
    return withETag(request, state);
  } catch (error) {
    return handleApiError(error);
  }
}
