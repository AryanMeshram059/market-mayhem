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
    avg_buy_price?: string;
    total_invested?: string;
  }>(
    `SELECT h.fund_id, f.fund_code, f.fund_name, h.quantity, f.current_nav, 
            COALESCE(h.avg_buy_price, 0) as avg_buy_price,
            COALESCE(h.total_invested, 0) as total_invested
     FROM holdings h
     JOIN funds f ON f.id = h.fund_id
     WHERE h.team_id = $1 AND h.quantity > 0 AND f.is_cash = FALSE
     ORDER BY f.fund_code`,
    [teamId]
  ).catch(async () => {
    // Fallback if columns don't exist yet
    return query<{
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
  });

  const mapped = holdings.map((row: any) => {
    const qty = Number(row.quantity);
    const nav = Number(row.current_nav);
    const avgBuyPrice = row.avg_buy_price ? Number(row.avg_buy_price) : 0;
    const totalInvested = row.total_invested ? Number(row.total_invested) : 0;
    const marketValue = qty * nav;
    const totalReturn = totalInvested > 0 ? marketValue - totalInvested : 0;
    const returnPercentage = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;
    
    return {
      fund_id: row.fund_id,
      fund_code: row.fund_code,
      fund_name: row.fund_name,
      quantity: qty,
      current_nav: nav,
      market_value: marketValue,
      avg_buy_price: avgBuyPrice,
      total_invested: totalInvested,
      total_return: totalReturn,
      return_percentage: returnPercentage,
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
  // Get all portfolios and their holdings in parallel
  const portfolios = await query<{ 
    team_id: number; 
    team_name: string; 
    cash: string;
  }>(
    `SELECT t.id as team_id, t.team_name, p.cash
     FROM teams t
     LEFT JOIN portfolios p ON p.team_id = t.id
     ORDER BY t.id`
  );

  const holdingsByTeam = await query<{
    team_id: number;
    market_value: string;
  }>(
    `SELECT h.team_id, SUM(h.quantity * f.current_nav) as market_value
     FROM holdings h
     JOIN funds f ON f.id = h.fund_id
     WHERE f.is_cash = FALSE AND h.quantity > 0
     GROUP BY h.team_id`
  );

  const holdingsMap = new Map(holdingsByTeam.map(row => [row.team_id, Number(row.market_value)]));

  const entries = portfolios.map((team, index) => {
    const cash = Number(team.cash || 0);
    const holdings = holdingsMap.get(team.team_id) || 0;
    return {
      rank: index + 1,
      team_id: team.team_id,
      team_name: team.team_name,
      portfolio_value: cash + holdings,
    };
  });

  entries.sort((a, b) => b.portfolio_value - a.portfolio_value || a.team_id - b.team_id);
  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });
  return entries;
}
