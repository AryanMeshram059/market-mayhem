import { logoutToken } from '@/server/auth';
import { authHeader, fail, ok } from '@/server/http';

export async function POST(request: Request) {
  try {
    const header = authHeader(request);
    if (header?.startsWith('Bearer ')) {
      await logoutToken(header.slice('Bearer '.length));
    }
    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}
