export const runtime = 'nodejs';

import { authenticateTeam } from '@/server/auth';
import { checkAndTransition } from '@/server/engine/state';
import { submitOrder } from '@/server/engine/orders';
import { authHeader, fail, ok } from '@/server/http';

export async function POST(request: Request) {
  try {
    const teamId = await authenticateTeam(authHeader(request));
    await checkAndTransition();
    const body = await request.json();
    return ok(await submitOrder({
      teamId,
      fundId: Number(body.fund_id),
      type: body.type,
      quantity: Number(body.quantity),
    }));
  } catch (error) {
    return fail(error);
  }
}
