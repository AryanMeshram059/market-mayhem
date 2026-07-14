import { authenticateAdmin } from '@/server/auth';
import { resume } from '@/server/engine/state';
import { authHeader, fail, ok } from '@/server/http';

export async function POST(request: Request) {
  try {
    const admin = await authenticateAdmin(authHeader(request));
    return ok(await resume(admin));
  } catch (error) {
    return fail(error);
  }
}
