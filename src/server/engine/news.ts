import { audit } from '../audit';
import { query } from '../db';
import { badRequest } from '../errors';
import { getState } from './state';

export async function publishNews(adminUsername: string, content: string): Promise<{ round: number; content: string }> {
  const trimmed = content.trim();
  if (!trimmed) {
    badRequest('News content is required');
  }

  const state = await getState();
  if (state.phase === 'IDLE') {
    badRequest('Start the game before publishing news');
  }

  const rows = await query<{ round: number; content: string }>(
    `INSERT INTO news_feed (round, content)
     VALUES ($1, $2)
     ON CONFLICT (round)
     DO UPDATE SET content = EXCLUDED.content, created_at = NOW()
     RETURNING round, content`,
    [state.round, trimmed],
  );

  await audit({
    event_type: 'news_published',
    admin_username: adminUsername,
    round: state.round,
    event_data: { round: state.round, content: trimmed },
  });

  return rows[0];
}
