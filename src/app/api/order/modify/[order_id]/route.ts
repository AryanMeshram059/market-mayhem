import { authenticateTeam } from '@/server/auth';
import { modifyOrder } from '@/server/engine/orders';
import { authHeader, fail, ok } from '@/server/http';

export async function PATCH(request: Request, context: { params: Promise<{ order_id: string }> }) {
  try {
    const teamId = await authenticateTeam(authHeader(request));
    const { order_id } = await context.params;
    const body = await request.json();
    await modifyOrder(teamId, order_id, Number(body.quantity));
    return ok({ order_id, quantity: Number(body.quantity) });
  } catch (error) {
    return fail(error);
  }
}
