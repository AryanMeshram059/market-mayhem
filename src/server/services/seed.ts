import { STARTING_CAPITAL, TOTAL_TEAMS } from '@/domain/constants';
import { hashPassword } from '@/server/auth';
import { query } from '@/server/db';

export async function seedTeams(defaultPasswordSuffix = '123'): Promise<void> {
  for (let i = 1; i <= TOTAL_TEAMS; i += 1) {
    const code = `TEAM_${String(i).padStart(3, '0')}`;
    const password = `${code.toLowerCase()}${defaultPasswordSuffix}`;
    const rows = await query<{ id: number }>(
      `INSERT INTO teams (team_code, team_name, password_hash, starting_capital)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (team_code)
       DO UPDATE SET team_name = EXCLUDED.team_name
       RETURNING id`,
      [code, `${code} Squad`, hashPassword(password), STARTING_CAPITAL]
    );
    await query(
      `INSERT INTO portfolios (team_id, cash)
       VALUES ($1, $2)
       ON CONFLICT (team_id) DO NOTHING`,
      [rows[0].id, STARTING_CAPITAL]
    );
  }
}
