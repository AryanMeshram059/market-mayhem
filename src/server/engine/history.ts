import { CASH_EROSION_RATE, TOTAL_ROUNDS } from '@/domain/constants';
import { PREDEFINED_SCHEDULE } from '@/domain/rounds';
import type { GamePhase } from '@/domain/types';
import { query } from '../db';
import { getPortfolio } from './portfolio';

type GameStateRow = {
  current_round: number;
  current_phase: GamePhase;
};

type FundRow = {
  id: number;
  fund_code: string;
  current_nav: string;
};

export type HistoryPoint = {
  round: number;
  nav: number;
};

export type PortfolioHistoryPoint = {
  round: number;
  value: number;
};

async function visibleNavIndex(): Promise<number> {
  const rows = await query<GameStateRow>(
    `SELECT current_round, current_phase
     FROM game_state
     WHERE id = 1`,
  );
  const state = rows[0];
  if (!state) return 0;

  const currentRound = Number(state.current_round);
  const completedRounds =
    state.current_phase === 'ORDER_LOCK' || state.current_phase === 'RESULTS_DISPLAY'
      ? currentRound
      : currentRound - 1;

  return Math.max(0, Math.min(TOTAL_ROUNDS, completedRounds));
}

export async function fundNavHistory(fundCode: string): Promise<HistoryPoint[]> {
  const fundRows = await query<FundRow>(
    `SELECT id, fund_code, current_nav
     FROM funds
     WHERE upper(fund_code) = upper($1)
       AND is_cash = FALSE
     LIMIT 1`,
    [fundCode],
  );
  const fund = fundRows[0];
  if (!fund) return [];

  const schedule = PREDEFINED_SCHEDULE.funds.find((item) => item.fund_code === fund.fund_code);
  if (!schedule) return [];

  const visibleIndex = await visibleNavIndex();
  return schedule.navValues.slice(0, visibleIndex + 1).map((nav, index) => ({
    round: index,
    nav,
  }));
}

export async function portfolioValueHistory(teamId: number): Promise<PortfolioHistoryPoint[]> {
  const visibleIndex = await visibleNavIndex();
  const teamRows = await query<{ starting_capital: string }>(
    `SELECT starting_capital
     FROM teams
     WHERE id = $1`,
    [teamId],
  );
  const startingCapital = Number(teamRows[0]?.starting_capital ?? 0);

  const fundRows = await query<{ id: number; fund_code: string }>(
    `SELECT id, fund_code
     FROM funds
     WHERE is_cash = FALSE`,
  );
  const fundCodeById = new Map(fundRows.map((fund) => [Number(fund.id), fund.fund_code]));
  const navByFundRound = new Map(
    PREDEFINED_SCHEDULE.funds.map((fund) => [fund.fund_code, fund.navValues]),
  );

  const orders = await query<{
    fund_id: number;
    order_type: 'buy' | 'sell';
    quantity: string;
    total_value: string;
    round: number;
  }>(
    `SELECT fund_id, order_type, quantity, total_value, round
     FROM executed_orders
     WHERE team_id = $1
       AND status = 'completed'
     ORDER BY round, executed_at, id`,
    [teamId],
  );

  const ordersByRound = new Map<number, typeof orders>();
  for (const order of orders) {
    const round = Number(order.round);
    const existing = ordersByRound.get(round) ?? [];
    existing.push(order);
    ordersByRound.set(round, existing);
  }

  let cash = startingCapital;
  const holdings = new Map<number, number>();
  const points: PortfolioHistoryPoint[] = [{ round: 0, value: startingCapital }];

  for (let round = 1; round <= visibleIndex; round += 1) {
    for (const order of ordersByRound.get(round) ?? []) {
      const fundId = Number(order.fund_id);
      const quantity = Number(order.quantity);
      const totalValue = Number(order.total_value);
      const currentQuantity = holdings.get(fundId) ?? 0;

      if (order.order_type === 'buy') {
        cash -= totalValue;
        holdings.set(fundId, currentQuantity + quantity);
      } else {
        cash += totalValue;
        holdings.set(fundId, Math.max(0, currentQuantity - quantity));
      }
    }

    cash *= 1 - CASH_EROSION_RATE;

    let holdingsValue = 0;
    for (const [fundId, quantity] of holdings.entries()) {
      const fundCode = fundCodeById.get(fundId);
      if (!fundCode) continue;
      holdingsValue += quantity * (navByFundRound.get(fundCode)?.[round] ?? 0);
    }

    points.push({ round, value: cash + holdingsValue });
  }

  if (points.length === 1) {
    const current = await getPortfolio(teamId);
    points[0] = { round: 0, value: current.total_value };
  }

  return points;
}
