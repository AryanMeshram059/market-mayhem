import { leaderboard } from '@/server/engine/portfolio';
import { fail, ok } from '@/server/http';

export async function GET() {
  try {
    return ok(await leaderboard());
  } catch (error) {
    return fail(error);
  }
}
