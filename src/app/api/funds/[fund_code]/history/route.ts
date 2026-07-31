export const runtime = 'nodejs';

import { fundNavHistory } from '@/server/engine/history';
import { fail, ok } from '@/server/http';

export async function GET(
  _request: Request,
  context: RouteContext<'/api/funds/[fund_code]/history'>,
) {
  try {
    const { fund_code } = await context.params;
    return ok(await fundNavHistory(fund_code));
  } catch (error) {
    return fail(error);
  }
}
