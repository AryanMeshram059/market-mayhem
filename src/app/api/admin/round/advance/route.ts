import { authenticateAdmin } from '@/server/auth';
import { forceAdvance } from '@/server/engine/state';
import { authHeader, fail, ok } from '@/server/http';

export async function POST(request: Request) {
  try {
    const admin = await authenticateAdmin(authHeader(request));
    return ok(await forceAdvance(admin));
  } catch (error) {
    return fail(error);
  }
}
