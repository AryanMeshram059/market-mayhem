import { authenticateTeam } from '@/server/auth';
import { cancelOrder } from '@/server/engine/orders';
import { authHeader, fail, ok } from '@/server/http';

export async function DELETE(request: Request, context: { params: Promise<{ order_id: string }> }) {
  try {
    const teamId = await authenticateTeam(authHeader(request));
    const { order_id } = await context.params;
    await cancelOrder(teamId, order_id);
    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}
