import { audit } from '../audit';
import { query } from '../db';
import { badRequest } from '../errors';
import { getState } from './state';
import { PREDEFINED_ROUND_NEWS } from '@/domain/rounds';

export async function publishNews(adminUsername: string): Promise<{ round: number; content: string }> {
  const state = await getState();
  if (state.phase === 'IDLE') {
    badRequest('Start the game before publishing news');
  }

  const content = PREDEFINED_ROUND_NEWS[state.round];
  if (!content) {
    badRequest(`No predefined news configured for round ${state.round}`);
  }

  const rows = await query<{ round: number; content: string }>(
    `INSERT INTO news_feed (round, content)
     VALUES ($1, $2)
     ON CONFLICT (round)
     DO UPDATE SET content = EXCLUDED.content, created_at = NOW()
     RETURNING round, content`,
    [state.round, content],
  );

  await audit({
    event_type: 'news_published',
    admin_username: adminUsername,
    round: state.round,
    event_data: { round: state.round, source: 'predefined' },
  });

  return rows[0];
}
