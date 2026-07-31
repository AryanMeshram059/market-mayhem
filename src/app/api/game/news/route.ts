export const runtime = 'nodejs';

import { checkAndTransition } from '@/server/engine/state';
import { query } from '@/server/db';
import { fail, ok } from '@/server/http';

export async function GET() {
  try {
    const state = await checkAndTransition();
    const rows = await query(
      `SELECT round, content, created_at
       FROM news_feed
       WHERE round = $1`,
      [state.round]
    );
    return ok({ round: state.round, news: rows[0] ?? null });
  } catch (error) {
    return fail(error);
  }
}
