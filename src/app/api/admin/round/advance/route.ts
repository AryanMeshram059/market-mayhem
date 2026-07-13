import { authenticateAdminRequest } from '@/services/auth';
import { forceAdvancePhase } from '@/engine/round/stateMachine';
import { getAuthHeader, handleApiError, jsonResponse } from '@/lib/api';

export async function POST(request: Request) {
  try {
    const adminUsername = await authenticateAdminRequest(getAuthHeader(request));
    const state = await forceAdvancePhase(adminUsername);
    return jsonResponse({ round: state.round, phase: state.phase });
  } catch (error) {
    return handleApiError(error);
  }
}
