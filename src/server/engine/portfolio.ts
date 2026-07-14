import type { PortfolioView } from '@/domain/types';
import { query } from '../db';

export async function getPortfolio(teamId: number): Promise<PortfolioView> {
  const portfolios = await query<{ cash: string; last_updated: string | null }>(
    `SELECT cash, last_updated FROM portfolios WHERE team_id = $1`,
    [teamId]
  );

  if (portfolios.length === 0) {
    throw new Error(`Portfolio missing for team ${teamId}`);
  }

  const holdings = await query<{
    fund_id: number;
    fund_code: string;
    fund_name: string;
    quantity: string;
    current_nav: string;
  }>(
    `SELECT h.fund_id, f.fund_code, f.fund_name, h.quantity, f.current_nav
     FROM holdings h
     JOIN funds f ON f.id = h.fund_id
     WHERE h.team_id = $1 AND h.quantity > 0 AND f.is_cash = FALSE
     ORDER BY f.fund_code`,
    [teamId]
  );

  const mapped = holdings.map((row) => {
    const qty = Number(row.quantity);
    const nav = Number(row.current_nav);
    return {
      fund_id: row.fund_id,
      fund_code: row.fund_code,
      fund_name: row.fund_name,
      quantity: qty,
      current_nav: nav,
      market_value: qty * nav,
    };
  });

  const cash = Number(portfolios[0].cash);
  return {
    team_id: teamId,
    cash,
    holdings: mapped,
    total_value: cash + mapped.reduce((sum, holding) => sum + holding.market_value, 0),
    last_updated: portfolios[0].last_updated,
  };
}

export async function leaderboard(): Promise<Array<{
  rank: number;
  team_id: number;
  team_name: string;
  portfolio_value: number;
}>> {
  const teams = await query<{ id: number; team_name: string }>(
    `SELECT id, team_name FROM teams ORDER BY id`
  );

  const entries = await Promise.all(
    teams.map(async (team) => {
      const portfolio = await getPortfolio(team.id);
      return {
        rank: 0,
        team_id: team.id,
        team_name: team.team_name,
        portfolio_value: portfolio.total_value,
      };
    })
  );

  entries.sort((a, b) => b.portfolio_value - a.portfolio_value || a.team_id - b.team_id);
  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });
  return entries;
}
