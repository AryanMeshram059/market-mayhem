import { STARTING_CAPITAL } from '@/constants/game';
import { calculatePortfolioValue } from '@/engine/scoring/portfolio';
import { queryAsGameEngine } from '@/lib/db';
import type { LeaderboardEntry } from '@/types';

export async function computeLeaderboard(): Promise<LeaderboardEntry[]> {
  const teams = await queryAsGameEngine(
    `SELECT t.id, t.team_name, p.cash, p.last_updated
     FROM teams t
     JOIN portfolios p ON p.team_id = t.id
     ORDER BY t.id`
  );

  const entries: Array<LeaderboardEntry & { reached_at: number }> = [];

  for (const team of teams) {
    const portfolio = await calculatePortfolioValue(team.id);
    entries.push({
      rank: 0,
      team_id: team.id,
      team_name: team.team_name,
      portfolio_value: portfolio.total_value,
      change_from_start: ((portfolio.total_value - STARTING_CAPITAL) / STARTING_CAPITAL) * 100,
      reached_at: new Date(team.last_updated).getTime(),
    });
  }

  entries.sort((a, b) => {
    if (b.portfolio_value !== a.portfolio_value) {
      return b.portfolio_value - a.portfolio_value;
    }
    return a.reached_at - b.reached_at;
  });

  let currentRank = 1;
  for (let i = 0; i < entries.length; i++) {
    if (i > 0 && entries[i].portfolio_value < entries[i - 1].portfolio_value) {
      currentRank = i + 1;
    }
    entries[i].rank = currentRank;
  }

  return entries.map(({ reached_at: _, ...entry }) => entry);
}
