import { extendSession } from '@/services/auth';
import { getAuthHeader, handleApiError, jsonResponse } from '@/lib/api';
import { SESSION_TIMEOUT_SECONDS } from '@/constants/game';

export async function POST(request: Request) {
  try {
    const authHeader = getAuthHeader(request);
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: { code: 'AUTHENTICATION_ERROR', message: 'Missing token' } }, 401);
    }

    const oldToken = authHeader.substring(7);
    const newToken = await extendSession(oldToken);
    const expiresAt = new Date(Date.now() + SESSION_TIMEOUT_SECONDS * 1000).toISOString();

    return jsonResponse({ token: newToken, expires_at: expiresAt });
  } catch (error) {
    return handleApiError(error);
  }
}
