import { authenticateAdminRequest } from '@/services/auth';
import { resumeGame } from '@/engine/round/stateMachine';
import { getAuthHeader, handleApiError, jsonResponse } from '@/lib/api';

export async function POST(request: Request) {
  try {
    const adminUsername = await authenticateAdminRequest(getAuthHeader(request));
    const state = await resumeGame(adminUsername);
    return jsonResponse({ paused: state.is_paused });
  } catch (error) {
    return handleApiError(error);
  }
}
