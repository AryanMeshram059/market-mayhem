import { CASH_EROSION_RATE, CASH_EROSION_ROUNDS } from '@/constants/game';
import { queryAsGameEngine } from '@/lib/db';
import type { Holding, Portfolio, TeamId } from '@/types';

export async function getHoldingsForTeam(teamId: TeamId): Promise<Holding[]> {
  const rows = await queryAsGameEngine(
    `SELECT h.fund_id, h.quantity, f.fund_code, f.fund_name, f.current_nav
     FROM holdings h
     JOIN funds f ON f.id = h.fund_id
     WHERE h.team_id = $1 AND h.quantity > 0 AND f.is_cash = FALSE`,
    [teamId]
  );

  return rows.map((row) => {
    const quantity = Number(row.quantity);
    const currentNav = Number(row.current_nav);
    return {
      fund_id: row.fund_id,
      fund_code: row.fund_code,
      fund_name: row.fund_name,
      quantity,
      current_nav: currentNav,
      market_value: quantity * currentNav,
    };
  });
}

export async function calculatePortfolioValue(teamId: TeamId): Promise<Portfolio> {
  const portfolioRows = await queryAsGameEngine(
    `SELECT cash, last_updated FROM portfolios WHERE team_id = $1`,
    [teamId]
  );

  if (portfolioRows.length === 0) {
    throw new Error(`Portfolio not found for team ${teamId}`);
  }

  const cash = Number(portfolioRows[0].cash);
  const holdings = await getHoldingsForTeam(teamId);
  const holdingsValue = holdings.reduce((sum, h) => sum + h.market_value, 0);

  return {
    team_id: teamId,
    cash,
    holdings,
    total_value: cash + holdingsValue,
    last_updated: new Date(portfolioRows[0].last_updated).getTime(),
  };
}

export async function calculateFinalScore(teamId: TeamId): Promise<Portfolio> {
  const portfolio = await calculatePortfolioValue(teamId);
  const erodedCash = portfolio.cash * Math.pow(CASH_EROSION_RATE, CASH_EROSION_ROUNDS);
  const holdingsValue = portfolio.holdings.reduce((sum, h) => sum + h.market_value, 0);

  return {
    ...portfolio,
    cash: erodedCash,
    total_value: erodedCash + holdingsValue,
  };
}
