import { BROKERAGE_RATE } from '@/constants/game';
import { calculateEffectiveNav } from '@/engine/pricing/slippage';
import { getTeamContext } from '@/engine/validation/orderValidator';
import { auditLog } from '@/services/auditLog';
import { withTransaction, type PoolClient } from '@/lib/db';
import type { Order } from '@/types';

interface DbOrder {
  id: string;
  team_id: number;
  fund_id: number;
  order_type: 'buy' | 'sell';
  quantity: number;
  round: number;
}

async function getFundNav(client: PoolClient, fundId: number): Promise<number> {
  const result = await client.query(
    `SELECT current_nav FROM funds WHERE id = $1 AND is_cash = FALSE`,
    [fundId]
  );
  if (result.rows.length === 0) {
    throw new Error(`Fund ${fundId} not found`);
  }
  return Number(result.rows[0].current_nav);
}

async function getTeamStartingCapital(client: PoolClient, teamId: number): Promise<number> {
  const result = await client.query(
    `SELECT starting_capital FROM teams WHERE id = $1`,
    [teamId]
  );
  return Number(result.rows[0].starting_capital);
}

export async function executeBuyOrder(
  client: PoolClient,
  order: DbOrder
): Promise<void> {
  const nav = await getFundNav(client, order.fund_id);
  const startingCapital = await getTeamStartingCapital(client, order.team_id);
  const orderValue = Number(order.quantity) * nav;
  const { effectiveNav, slippageRate } = calculateEffectiveNav(
    nav,
    orderValue,
    startingCapital,
    'buy'
  );

  const grossCost = Number(order.quantity) * effectiveNav;
  const brokerageFee = grossCost * BROKERAGE_RATE;
  const totalCost = grossCost + brokerageFee;

  const cashResult = await client.query(
    `SELECT cash FROM portfolios WHERE team_id = $1 FOR UPDATE`,
    [order.team_id]
  );
  const cash = Number(cashResult.rows[0].cash);

  if (cash < totalCost) {
    throw new Error(`Insufficient cash: need ${totalCost}, have ${cash}`);
  }

  await client.query(
    `UPDATE portfolios SET cash = cash - $1, last_updated = NOW() WHERE team_id = $2`,
    [totalCost, order.team_id]
  );

  await client.query(
    `INSERT INTO holdings (team_id, fund_id, quantity, last_updated)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (team_id, fund_id)
     DO UPDATE SET quantity = holdings.quantity + $3, last_updated = NOW()`,
    [order.team_id, order.fund_id, order.quantity]
  );

  await client.query(
    `INSERT INTO executed_orders
     (id, team_id, fund_id, order_type, quantity, nav_at_execution, slippage_applied,
      effective_nav, brokerage_fee, total_value, round, status)
     VALUES ($1, $2, $3, 'buy', $4, $5, $6, $7, $8, $9, $10, 'completed')`,
    [
      order.id,
      order.team_id,
      order.fund_id,
      order.quantity,
      nav,
      slippageRate,
      effectiveNav,
      brokerageFee,
      totalCost,
      order.round,
    ]
  );

  await auditLog('order_executed', {
    teamId: order.team_id,
    round: order.round,
    details: {
      order_id: order.id,
      type: 'buy',
      fund_id: order.fund_id,
      quantity: Number(order.quantity),
      nav,
      effective_nav: effectiveNav,
      slippage: slippageRate,
      brokerage_fee: brokerageFee,
      total_cost: totalCost,
    },
  });
}

export async function executeSellOrder(
  client: PoolClient,
  order: DbOrder
): Promise<void> {
  const nav = await getFundNav(client, order.fund_id);
  const startingCapital = await getTeamStartingCapital(client, order.team_id);
  const orderValue = Number(order.quantity) * nav;
  const { effectiveNav, slippageRate } = calculateEffectiveNav(
    nav,
    orderValue,
    startingCapital,
    'sell'
  );

  const grossProceeds = Number(order.quantity) * effectiveNav;
  const brokerageFee = grossProceeds * BROKERAGE_RATE;
  const netProceeds = grossProceeds - brokerageFee;

  const holdingResult = await client.query(
    `SELECT quantity FROM holdings WHERE team_id = $1 AND fund_id = $2 FOR UPDATE`,
    [order.team_id, order.fund_id]
  );

  const holdingQty = holdingResult.rows.length > 0 ? Number(holdingResult.rows[0].quantity) : 0;
  if (holdingQty < Number(order.quantity)) {
    throw new Error(`Insufficient holdings: need ${order.quantity}, have ${holdingQty}`);
  }

  await client.query(
    `UPDATE portfolios SET cash = cash + $1, last_updated = NOW() WHERE team_id = $2`,
    [netProceeds, order.team_id]
  );

  await client.query(
    `UPDATE holdings SET quantity = quantity - $1, last_updated = NOW()
     WHERE team_id = $2 AND fund_id = $3`,
    [order.quantity, order.team_id, order.fund_id]
  );

  await client.query(
    `INSERT INTO executed_orders
     (id, team_id, fund_id, order_type, quantity, nav_at_execution, slippage_applied,
      effective_nav, brokerage_fee, total_value, round, status)
     VALUES ($1, $2, $3, 'sell', $4, $5, $6, $7, $8, $9, $10, 'completed')`,
    [
      order.id,
      order.team_id,
      order.fund_id,
      order.quantity,
      nav,
      slippageRate,
      effectiveNav,
      brokerageFee,
      netProceeds,
      order.round,
    ]
  );

  await auditLog('order_executed', {
    teamId: order.team_id,
    round: order.round,
    details: {
      order_id: order.id,
      type: 'sell',
      fund_id: order.fund_id,
      quantity: Number(order.quantity),
      nav,
      effective_nav: effectiveNav,
      slippage: slippageRate,
      brokerage_fee: brokerageFee,
      net_proceeds: netProceeds,
    },
  });
}

async function markOrderFailed(
  client: PoolClient,
  order: DbOrder,
  errorMessage: string
): Promise<void> {
  const nav = await getFundNav(client, order.fund_id).catch(() => 0);

  await client.query(
    `INSERT INTO executed_orders
     (id, team_id, fund_id, order_type, quantity, nav_at_execution, effective_nav,
      brokerage_fee, total_value, round, status, error_message)
     VALUES ($1, $2, $3, $4, $5, $6, $6, 0, 0, $7, 'failed', $8)`,
    [order.id, order.team_id, order.fund_id, order.order_type, order.quantity, nav, order.round, errorMessage]
  );

  await auditLog('order_failed', {
    teamId: order.team_id,
    round: order.round,
    details: { order_id: order.id, error: errorMessage },
  });
}

export async function executeAllPendingOrders(round: number): Promise<void> {
  await withTransaction(async (client) => {
    const result = await client.query(
      `SELECT id, team_id, fund_id, order_type, quantity, round
       FROM pending_orders WHERE round = $1
       ORDER BY created_at ASC`,
      [round]
    );

    const orders: DbOrder[] = result.rows;

    for (const order of orders) {
      try {
        if (order.order_type === 'buy') {
          await executeBuyOrder(client, order);
        } else {
          await executeSellOrder(client, order);
        }
        await client.query(`DELETE FROM pending_orders WHERE id = $1`, [order.id]);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        await markOrderFailed(client, order, message);
        await client.query(`DELETE FROM pending_orders WHERE id = $1`, [order.id]);
      }
    }
  });
}
