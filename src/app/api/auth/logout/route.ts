import { invalidateSession, authenticateTeamRequest } from '@/services/auth';
import { auditLog } from '@/services/auditLog';
import { getAuthHeader, handleApiError, jsonResponse } from '@/lib/api';

export async function POST(request: Request) {
  try {
    const authHeader = getAuthHeader(request);
    const teamId = await authenticateTeamRequest(authHeader);

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      await invalidateSession(token);
      await auditLog('logout', { teamId, details: {} });
    }

    return jsonResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
