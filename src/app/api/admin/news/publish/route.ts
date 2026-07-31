export const runtime = 'nodejs';

import { authenticateAdmin } from '@/server/auth';
import { publishNews } from '@/server/engine/news';
import { authHeader, fail, ok } from '@/server/http';

export async function POST(request: Request) {
  try {
    const admin = await authenticateAdmin(authHeader(request));
    return ok(await publishNews(admin));
  } catch (error) {
    return fail(error);
  }
}
