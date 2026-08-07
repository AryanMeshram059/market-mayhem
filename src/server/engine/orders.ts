import { MAX_DISTINCT_FUNDS, MAX_ORDERS_PER_ROUND, STARTING_CAPITAL } from '@/domain/constants';
import type { OrderType } from '@/domain/types';
import { audit } from '../audit';
import { query, transaction, type PoolClient } from '../db';
import { badRequest, notFound } from '../errors';
import { brokerage, buyExecutionTotals, money, quantity } from './math';

interface PendingOrder {
  id: string;
  team_id: number;
  fund_id: number;
  order_type: OrderType;
  quantity: string;
  round: number;
  reserved_cash?: string;
  created_at?: string;
}

async function addHoldingWithCostBasis(
  client: PoolClient,
  input: { teamId: number; fundId: number; qty: number; totalCost: number },
): Promise<void> {
  await client.query(
    `INSERT INTO holdings
       (team_id, fund_id, quantity, avg_buy_price, total_invested, quantity_bought, last_updated)
     VALUES ($1, $2, $3, $4, $5, $3, NOW())
     ON CONFLICT (team_id, fund_id)
     DO UPDATE SET quantity = holdings.quantity + EXCLUDED.quantity,
                   total_invested = holdings.total_invested + EXCLUDED.total_invested,
                   quantity_bought = holdings.quantity_bought + EXCLUDED.quantity_bought,
                   avg_buy_price = CASE
                     WHEN holdings.quantity + EXCLUDED.quantity > 0
                     THEN (holdings.total_invested + EXCLUDED.total_invested)
                          / (holdings.quantity + EXCLUDED.quantity)
                     ELSE 0
                   END,
                   last_updated = NOW()`,
    [
      input.teamId,
      input.fundId,
      quantity(input.qty),
      money(input.totalCost / input.qty),
      money(input.totalCost),
    ],
  );
}

async function subtractHoldingWithCostBasis(
  client: PoolClient,
  input: { teamId: number; fundId: number; qty: number },
): Promise<void> {
  await client.query(
    `UPDATE holdings
     SET quantity = quantity - $1,
         total_invested = CASE
           WHEN quantity - $1 <= 0 THEN 0
           ELSE GREATEST(
             0,
             total_invested - (
               COALESCE(NULLIF(avg_buy_price, 0), total_invested / NULLIF(quantity, 0), 0) * $1
             )
           )
         END,
         avg_buy_price = CASE
           WHEN quantity - $1 <= 0 THEN 0
           ELSE COALESCE(NULLIF(avg_buy_price, 0), total_invested / NULLIF(quantity, 0), 0)
         END,
         last_updated = NOW()
     WHERE team_id = $2 AND fund_id = $3`,
    [quantity(input.qty), input.teamId, input.fundId],
  );
}

async function currentRoundAndPhase(client?: PoolClient): Promise<{ round: number; phase: string }> {
  const row = client
    ? (await client.query(`SELECT current_round, current_phase FROM game_state WHERE id = 1`)).rows[0]
    : (await query<{ current_round: number; current_phase: string }>(`SELECT current_round, current_phase FROM game_state WHERE id = 1`))[0];
  if (!row) {
    throw new Error('game_state row id=1 is missing');
  }
  return { round: Number(row.current_round), phase: row.current_phase };
}

async function assertTradableFund(fundId: number): Promise<{ id: number; nav: number }> {
  const rows = await query<{ id: number; current_nav: string }>(
    `SELECT id, current_nav FROM funds WHERE id = $1 AND is_cash = FALSE`,
    [fundId],
  );
  if (!rows[0]) {
    badRequest('Invalid tradable fund');
  }
  return { id: rows[0].id, nav: Number(rows[0].current_nav) };
}

function orderWindowOpen(phase: string): boolean {
  return phase === 'SETUP_OPEN' || phase === 'TRADING_OPEN';
}

function clipBuyQuantity(input: {
  requestedQuantity: number;
  nav: number;
  startingCapital: number;
  priorExposure: number;
  availableCash: number;
}): number {
  const { requestedQuantity, nav, startingCapital, priorExposure, availableCash } = input;
  const requestedTotals = buyExecutionTotals(nav, requestedQuantity, startingCapital, priorExposure);
  if (requestedTotals.total <= availableCash) {
    return requestedQuantity;
  }

  let low = 0;
  let high = requestedQuantity;
  for (let index = 0; index < 32; index += 1) {
    const mid = (low + high) / 2;
    const totals = buyExecutionTotals(nav, mid, startingCapital, priorExposure);
    if (totals.total <= availableCash) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return Math.floor(low * 10_000) / 10_000;
}

export async function submitOrder(input: {
  teamId: number;
  fundId: number;
  type: OrderType;
  quantity: number;
}): Promise<{
  order_id: string;
  status: 'pending';
  round: number;
  accepted_quantity: number;
  requested_quantity: number;
  clipped: boolean;
}> {
  if (!['buy', 'sell'].includes(input.type) || input.quantity <= 0) {
    badRequest('Order type must be buy/sell and quantity must be positive');
  }

  const fund = await assertTradableFund(input.fundId);
  const state = await currentRoundAndPhase();
  if (!orderWindowOpen(state.phase)) {
    badRequest(`Trading is closed during ${state.phase}`);
  }
  if (state.phase === 'SETUP_OPEN' && input.type !== 'buy') {
    badRequest('Only buy orders are allowed during the setup window');
  }

  const existingOrderCount = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM pending_orders
     WHERE team_id = $1 AND round = $2`,
    [input.teamId, state.round],
  );
  if (Number(existingOrderCount[0]?.count ?? 0) >= MAX_ORDERS_PER_ROUND) {
    badRequest(`Only ${MAX_ORDERS_PER_ROUND} orders are allowed per round`);
  }

  const startingCapitalRows = await query<{ starting_capital: string }>(
    `SELECT starting_capital FROM teams WHERE id = $1`,
    [input.teamId],
  );
  const startingCapital = Number(startingCapitalRows[0]?.starting_capital ?? STARTING_CAPITAL);

  const portfolioRows = await query<{ cash: string }>(
    `SELECT cash FROM portfolios WHERE team_id = $1`,
    [input.teamId],
  );
  const currentCash = Number(portfolioRows[0]?.cash ?? 0);

  const holdingsRows = await query<{ fund_id: number; quantity: string }>(
    `SELECT fund_id, quantity FROM holdings WHERE team_id = $1`,
    [input.teamId],
  );
  const holdingsMap = new Map<number, number>(
    holdingsRows.map((row) => [Number(row.fund_id), Number(row.quantity)]),
  );

  const roundOrders = await query<PendingOrder & { created_at: string }>(
    `SELECT id, team_id, fund_id, order_type, quantity, round, created_at
     FROM pending_orders
     WHERE team_id = $1 AND round = $2
     ORDER BY created_at, id`,
    [input.teamId, state.round],
  );

  const fundIds = [...new Set([input.fundId, ...roundOrders.map((order) => Number(order.fund_id))])];
  const fundNavRows = await query<{ id: number; current_nav: string }>(
    `SELECT id, current_nav FROM funds WHERE id = ANY($1::int[]) AND is_cash = FALSE`,
    [fundIds],
  );
  const navByFundId = new Map<number, number>(
    fundNavRows.map((row) => [Number(row.id), Number(row.current_nav)]),
  );

  const projectedHoldings = new Map<number, number>(holdingsMap);
  const roundBuyExposure = new Map<number, number>();
  let reservedCash = 0;
  for (const order of roundOrders) {
    const quantityValue = Number(order.quantity);
    const currentProjected = projectedHoldings.get(order.fund_id) ?? 0;
    if (order.order_type === 'buy') {
      const priorExposure = roundBuyExposure.get(order.fund_id) ?? 0;
      const nav = navByFundId.get(order.fund_id) ?? fund.nav;
      const totals = buyExecutionTotals(nav, quantityValue, startingCapital, priorExposure);
      reservedCash += totals.total;
      projectedHoldings.set(order.fund_id, currentProjected + quantityValue);
      roundBuyExposure.set(order.fund_id, priorExposure + totals.orderValue);
    } else {
      projectedHoldings.set(order.fund_id, Math.max(0, currentProjected - quantityValue));
    }
  }

  let acceptedQuantity = input.quantity;
  let clipped = false;
  let reservedCashForOrder = 0;
  if (input.type === 'sell') {
    const available = projectedHoldings.get(input.fundId) ?? 0;
    if (available < acceptedQuantity) {
      badRequest('Insufficient holdings');
    }
  } else {
    const availableCash = Math.max(0, currentCash - reservedCash);
    const priorExposure = roundBuyExposure.get(input.fundId) ?? 0;
    acceptedQuantity = clipBuyQuantity({
      requestedQuantity: input.quantity,
      nav: fund.nav,
      startingCapital,
      priorExposure,
      availableCash,
    });
    if (acceptedQuantity <= 0) {
      badRequest('Insufficient cash for even the minimum affordable quantity');
    }
    clipped = acceptedQuantity < input.quantity;
    reservedCashForOrder = buyExecutionTotals(
      fund.nav,
      acceptedQuantity,
      startingCapital,
      priorExposure,
    ).total;
  }

  const nextProjectedHoldings = new Map<number, number>(projectedHoldings);
  const currentProjected = nextProjectedHoldings.get(input.fundId) ?? 0;
  nextProjectedHoldings.set(
    input.fundId,
    input.type === 'buy'
      ? currentProjected + acceptedQuantity
      : Math.max(0, currentProjected - acceptedQuantity),
  );
  const distinctFundCount = [...nextProjectedHoldings.values()].filter((qty) => qty > 0).length;
  if (input.type === 'buy' && distinctFundCount > MAX_DISTINCT_FUNDS) {
    badRequest(`A team can hold at most ${MAX_DISTINCT_FUNDS} distinct funds`);
  }

  const rows = await transaction(async (client) => {
    if (reservedCashForOrder > 0) {
      const updated = await client.query<{ id: number }>(
        `UPDATE portfolios
         SET cash = cash - $1,
             last_updated = NOW()
         WHERE team_id = $2
           AND cash >= $1
         RETURNING team_id AS id`,
        [money(reservedCashForOrder), input.teamId],
      );
      if (!updated.rows[0]) {
        badRequest('Insufficient cash');
      }
    }

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO pending_orders (team_id, fund_id, order_type, quantity, round, reserved_cash)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        input.teamId,
        input.fundId,
        input.type,
        quantity(acceptedQuantity),
        state.round,
        money(reservedCashForOrder),
      ],
    );
    return inserted.rows;
  });

  await audit({
    event_type: 'order_submitted',
    team_id: input.teamId,
    round: state.round,
    event_data: {
      order_id: rows[0].id,
      phase: state.phase,
      ...input,
      accepted_quantity: acceptedQuantity,
      reserved_cash: reservedCashForOrder,
      clipped,
    },
  });

  return {
    order_id: rows[0].id,
    status: 'pending',
    round: state.round,
    accepted_quantity: acceptedQuantity,
    requested_quantity: input.quantity,
    clipped,
  };
}

async function executeOne(
  client: PoolClient,
  order: PendingOrder,
  priorExposure: number,
): Promise<{ success: boolean; buyOrderValue: number; error?: string }> {
  try {
    try {
      const fund = await client.query(
        `SELECT current_nav FROM funds WHERE id = $1 AND is_cash = FALSE FOR SHARE`,
        [order.fund_id],
      );
      if (!fund.rows[0]) {
        return { success: false, buyOrderValue: 0, error: 'Invalid fund' };
      }

      const team = await client.query(`SELECT starting_capital FROM teams WHERE id = $1 FOR SHARE`, [order.team_id]);
      const startingCapital = Number(team.rows[0]?.starting_capital ?? STARTING_CAPITAL);
      const nav = Number(fund.rows[0].current_nav);
      const qty = Number(order.quantity);

      if (order.order_type === 'buy') {
        const totals = buyExecutionTotals(nav, qty, startingCapital, priorExposure);
        const reservedCash = Number(order.reserved_cash ?? totals.total);
        
        await addHoldingWithCostBasis(client, {
          teamId: order.team_id,
          fundId: order.fund_id,
          qty,
          totalCost: reservedCash,
        });
        await recordExecution(
          client,
          order,
          nav,
          totals.effectiveNav,
          totals.slippage,
          totals.fee,
          reservedCash,
          'completed',
        );
        return { success: true, buyOrderValue: totals.orderValue };
      }

      const holding = await client.query(
        `SELECT quantity FROM holdings WHERE team_id = $1 AND fund_id = $2 FOR UPDATE`,
        [order.team_id, order.fund_id],
      );
      const available = Number(holding.rows[0]?.quantity ?? 0);
      if (available < qty) {
        return { success: false, buyOrderValue: 0, error: 'Insufficient holdings' };
      }

      const gross = qty * nav;
      const fee = brokerage(gross);
      const proceeds = gross - fee;
      await subtractHoldingWithCostBasis(client, {
        teamId: order.team_id,
        fundId: order.fund_id,
        qty,
      });
      await client.query(
        `UPDATE portfolios SET cash = cash + $1, last_updated = NOW() WHERE team_id = $2`,
        [money(proceeds), order.team_id],
      );
      await recordExecution(client, order, nav, nav, 0, fee, proceeds, 'completed');
      return { success: true, buyOrderValue: 0 };
    } catch (queryError) {
      // Query failed - could be business logic validation or database error
      const msg = queryError instanceof Error ? queryError.message : String(queryError);
      
      // If it's a transaction abort, propagate it (this is a real error)
      if (msg.includes('transaction is aborted')) {
        throw queryError;
      }
      
      // Otherwise treat as business logic failure
      return { success: false, buyOrderValue: 0, error: msg };
    }
  } catch (error) {
    // Any unexpected errors get re-thrown to abort transaction
    throw error;
  }
}

async function recordExecution(
  client: PoolClient,
  order: PendingOrder,
  nav: number,
  effective: number,
  slippage: number,
  fee: number,
  total: number,
  status: 'completed' | 'failed',
  error?: string,
): Promise<void> {
  await client.query(
    `INSERT INTO executed_orders
       (id, team_id, fund_id, order_type, quantity, nav_at_execution,
        slippage_applied, effective_nav, brokerage_fee, total_value,
        executed_at, round, status, error_message)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12, $13)
     ON CONFLICT (id) DO NOTHING`,
    [
      order.id,
      order.team_id,
      order.fund_id,
      order.order_type,
      order.quantity,
      nav,
      slippage,
      effective,
      fee,
      money(total),
      order.round,
      status,
      error ?? null,
    ],
  );
}

export async function executePendingOrders(client: PoolClient, round: number): Promise<void> {
  try {
    const orders = await client.query<PendingOrder>(
      `SELECT id, team_id, fund_id, order_type, quantity, round, reserved_cash
       FROM pending_orders
       WHERE round = $1
       ORDER BY created_at, id`,
      [round],
    );

    const exposureByTeamFund = new Map<string, number>();
    for (const order of orders.rows) {
      const exposureKey = `${order.team_id}:${order.fund_id}`;
      const priorExposure = exposureByTeamFund.get(exposureKey) ?? 0;
      
      const result = await executeOne(client, order, priorExposure);
      if (result.success) {
        if (order.order_type === 'buy') {
          exposureByTeamFund.set(exposureKey, priorExposure + result.buyOrderValue);
        }
        // Audit success
        await audit(
          { event_type: 'order_executed', team_id: order.team_id, round, event_data: { order_id: order.id } },
          client,
        );
      } else {
        // Order failed, log it but continue
        if (result.error && !result.error.includes('transaction is aborted')) {
          console.warn(`Order ${order.id} failed: ${result.error}`);
        }
        const reservedCash = Number(order.reserved_cash ?? 0);
        if (reservedCash > 0) {
          await client.query(
            `UPDATE portfolios
             SET cash = cash + $1,
                 last_updated = NOW()
             WHERE team_id = $2`,
            [money(reservedCash), order.team_id],
          );
        }
      }
      
      await client.query(
        `DELETE FROM pending_orders WHERE id = $1`,
        [order.id],
      );
    }
  } catch (error) {
    console.error("executePendingOrders failed:", error);
    throw error;
  }
}

export async function pendingOrders(teamId: number): Promise<unknown[]> {
  return query(
    `SELECT po.id AS order_id, po.fund_id, f.fund_code, f.fund_name,
            po.order_type AS type, po.quantity, po.created_at, po.round,
            COALESCE(po.reserved_cash, 0) AS reserved_cash
     FROM pending_orders po
     JOIN funds f ON f.id = po.fund_id
     WHERE po.team_id = $1
     ORDER BY po.created_at DESC`,
    [teamId],
  );
}

export async function cancelOrder(teamId: number, orderId: string): Promise<void> {
  const state = await currentRoundAndPhase();
  if (!orderWindowOpen(state.phase)) {
    badRequest(`Cannot cancel during ${state.phase}`);
  }
  await transaction(async (client) => {
    const deleted = await client.query<{ id: string; reserved_cash: string }>(
      `DELETE FROM pending_orders
       WHERE id = $1 AND team_id = $2
       RETURNING id, COALESCE(reserved_cash, 0) AS reserved_cash`,
      [orderId, teamId],
    );
    if (!deleted.rows[0]) {
      notFound('Order not found');
    }

    const reservedCash = Number(deleted.rows[0].reserved_cash);
    if (reservedCash > 0) {
      await client.query(
        `UPDATE portfolios
         SET cash = cash + $1,
             last_updated = NOW()
         WHERE team_id = $2`,
        [money(reservedCash), teamId],
      );
    }
  });
}

export async function modifyOrder(teamId: number, orderId: string, newQuantity: number): Promise<void> {
  if (newQuantity <= 0) {
    badRequest('Quantity must be positive');
  }
  const state = await currentRoundAndPhase();
  if (!orderWindowOpen(state.phase)) {
    badRequest(`Cannot modify during ${state.phase}`);
  }

  await transaction(async (client) => {
    const orderRows = await client.query<PendingOrder>(
      `SELECT id, team_id, fund_id, order_type, quantity, round, reserved_cash, created_at
       FROM pending_orders
       WHERE id = $1 AND team_id = $2
       FOR UPDATE`,
      [orderId, teamId],
    );
    const order = orderRows.rows[0];
    if (!order) {
      notFound('Order not found');
    }

    let nextReservedCash = 0;
    if (order.order_type === 'buy') {
      const fundRows = await client.query<{ current_nav: string }>(
        `SELECT current_nav FROM funds WHERE id = $1 AND is_cash = FALSE`,
        [order.fund_id],
      );
      const startingCapitalRows = await client.query<{ starting_capital: string }>(
        `SELECT starting_capital FROM teams WHERE id = $1`,
        [teamId],
      );
      const priorOrders = await client.query<PendingOrder>(
        `SELECT fund_id, order_type, quantity
         FROM pending_orders
         WHERE team_id = $1
           AND round = $2
           AND fund_id = $3
           AND order_type = 'buy'
           AND (created_at, id) < ($4, $5)
         ORDER BY created_at, id`,
        [teamId, order.round, order.fund_id, order.created_at, order.id],
      );
      const nav = Number(fundRows.rows[0]?.current_nav ?? 0);
      const startingCapital = Number(startingCapitalRows.rows[0]?.starting_capital ?? STARTING_CAPITAL);
      const priorExposure = priorOrders.rows.reduce((sum, priorOrder) => {
        return sum + Number(priorOrder.quantity) * nav;
      }, 0);
      nextReservedCash = buyExecutionTotals(nav, newQuantity, startingCapital, priorExposure).total;

      const currentReservedCash = Number(order.reserved_cash ?? 0);
      const cashDelta = nextReservedCash - currentReservedCash;
      if (cashDelta > 0) {
        const updated = await client.query<{ team_id: number }>(
          `UPDATE portfolios
           SET cash = cash - $1,
               last_updated = NOW()
           WHERE team_id = $2
             AND cash >= $1
           RETURNING team_id`,
          [money(cashDelta), teamId],
        );
        if (!updated.rows[0]) {
          badRequest('Insufficient cash');
        }
      } else if (cashDelta < 0) {
        await client.query(
          `UPDATE portfolios
           SET cash = cash + $1,
               last_updated = NOW()
           WHERE team_id = $2`,
          [money(Math.abs(cashDelta)), teamId],
        );
      }
    }

    await client.query(
      `UPDATE pending_orders
       SET quantity = $1,
           reserved_cash = $2
       WHERE id = $3 AND team_id = $4`,
      [quantity(newQuantity), money(nextReservedCash), orderId, teamId],
    );
  });
}

export async function executeAllPendingForRound(round: number): Promise<void> {
  await transaction((client) => executePendingOrders(client, round));
}
