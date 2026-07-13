import { authenticateAdminRequest } from '@/services/auth';
import { pauseGame } from '@/engine/round/stateMachine';
import { getAuthHeader, handleApiError, jsonResponse } from '@/lib/api';

export async function POST(request: Request) {
  try {
    const adminUsername = await authenticateAdminRequest(getAuthHeader(request));
    const state = await pauseGame(adminUsername);
    return jsonResponse({ paused: state.is_paused, remaining_time: state.time_remaining });
  } catch (error) {
    return handleApiError(error);
  }
}
