export const runtime = 'nodejs';

import { loginAdmin } from '@/server/auth';
import { fail, ok } from '@/server/http';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = await loginAdmin(String(body.username ?? ''), String(body.password ?? ''));
    return ok({ token, username: body.username });
  } catch (error) {
    return fail(error);
  }
}
