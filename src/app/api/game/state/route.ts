export const runtime = 'nodejs';

import { checkAndTransition } from '@/server/engine/state';
import { fail, ok } from '@/server/http';

export async function GET() {
  try {
    return ok(await checkAndTransition());
  } catch (error) {
    return fail(error);
  }
}
