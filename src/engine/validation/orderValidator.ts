import { BROKERAGE_RATE } from '@/constants/game';
import { formatCurrency } from '@/lib/format';
import { queryAsGameEngine } from '@/lib/db';
import { calculateSlippageRate } from '@/engine/pricing/slippage';
import type { OrderSubmission, Team, ValidationResult } from '@/types';

interface TeamContext extends Team {
  cash: number;
  holdings: Map<number, number>;
}

export async function getTeamContext(teamId: number): Promise<TeamContext | null> {
  const teams = await queryAsGameEngine(
    `SELECT t.id, t.team_code, t.team_name, t.starting_capital, p.cash
     FROM teams t
     JOIN portfolios p ON p.team_id = t.id
     WHERE t.id = $1`,
    [teamId]
  );

  if (teams.length === 0) return null;

  const holdingsRows = await queryAsGameEngine(
    `SELECT fund_id, quantity FROM holdings WHERE team_id = $1`,
    [teamId]
  );

  const holdings = new Map<number, number>();
  for (const row of holdingsRows) {
    holdings.set(row.fund_id, Number(row.quantity));
  }

  const team = teams[0];
  return {
    id: team.id,
    team_code: team.team_code,
    team_name: team.team_name,
    starting_capital: Number(team.starting_capital),
    cash: Number(team.cash),
    holdings,
  };
}

export async function validateOrder(
  order: OrderSubmission,
  team: TeamContext,
  phase: string
): Promise<ValidationResult> {
  if (phase !== 'TRADING_OPEN') {
    return {
      valid: false,
      error: `Trading closed during ${phase} phase`,
      details: { current_phase: phase, required_phase: 'TRADING_OPEN' },
    };
  }

  const funds = await queryAsGameEngine(
    `SELECT id, fund_code, is_cash, current_nav FROM funds WHERE id = $1`,
    [order.fund_id]
  );

  if (funds.length === 0 || funds[0].is_cash) {
    return {
      valid: false,
      error: `Invalid fund: ${order.fund_id}`,
      details: { fund_id: order.fund_id },
    };
  }

  if (order.quantity <= 0) {
    return { valid: false, error: 'Quantity must be positive' };
  }

  const nav = Number(funds[0].current_nav);

  if (order.type === 'buy') {
    const orderValue = order.quantity * nav;
    const slippageRate = calculateSlippageRate(orderValue, team.starting_capital);
    const effectiveNav = nav * (1 + slippageRate);
    const grossCost = order.quantity * effectiveNav;
    const brokerageFee = grossCost * BROKERAGE_RATE;
    const totalCost = grossCost + brokerageFee;

    const worstCaseCost = order.quantity * nav * (1 + BROKERAGE_RATE) * 1.05;

    if (team.cash < worstCaseCost) {
      return {
        valid: false,
        error: `Insufficient cash: need ${formatCurrency(worstCaseCost)} (with max slippage), available ${formatCurrency(team.cash)}`,
        details: { required: worstCaseCost, available: team.cash, shortfall: worstCaseCost - team.cash },
      };
    }

    if (team.cash < totalCost) {
      return {
        valid: false,
        error: `Insufficient cash: need ${formatCurrency(totalCost)}, available ${formatCurrency(team.cash)}`,
        details: { required: totalCost, available: team.cash },
      };
    }
  } else {
    const holdingQty = team.holdings.get(order.fund_id) ?? 0;
    if (holdingQty < order.quantity) {
      return {
        valid: false,
        error: `Insufficient holdings: need ${order.quantity} units, have ${holdingQty}`,
        details: { required: order.quantity, available: holdingQty },
      };
    }
  }

  return { valid: true };
}
