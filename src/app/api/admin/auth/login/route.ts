import { generateAdminToken, validateAdminCredentials } from '@/services/auth';
import { auditLog } from '@/services/auditLog';
import { handleApiError, jsonResponse } from '@/lib/api';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return jsonResponse({ error: { code: 'VALIDATION_ERROR', message: 'Username and password required' } }, 400);
    }

    const valid = await validateAdminCredentials(username, password);
    if (!valid) {
      return jsonResponse({ error: { code: 'AUTHENTICATION_ERROR', message: 'Invalid admin credentials' } }, 401);
    }

    const token = generateAdminToken(username);
    await auditLog('login', { adminUsername: username, details: { role: 'admin' } });

    return jsonResponse({ token, username });
  } catch (error) {
    return handleApiError(error);
  }
}
