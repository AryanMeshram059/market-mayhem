import { BROKERAGE_RATE, P2P_MAX_TRADE_VALUE } from '@/domain/constants';
import type { OrderType } from '@/domain/types';
import { audit } from '../audit';
import { query, type PoolClient } from '../db';
import { badRequest, notFound } from '../errors';
import { money, quantity } from './math';

interface P2PTrade {
  id: string;
  proposer_team_id: number;
  counterparty_team_id: number;
  fund_id: number;
  quantity: string;
  agreed_price: string;
  proposer_direction: OrderType;
}

function buyerSeller(trade: P2PTrade): { buyerId: number; sellerId: number } {
  return trade.proposer_direction === 'buy'
    ? { buyerId: trade.proposer_team_id, sellerId: trade.counterparty_team_id }
    : { buyerId: trade.counterparty_team_id, sellerId: trade.proposer_team_id };
}

export async function proposeP2P(input: {
  proposerTeamId: number;
  counterpartyTeamId: number;
  fundId: number;
  quantity: number;
  price: number;
  direction: OrderType;
  round: number;
}): Promise<{ trade_id: string; status: 'awaiting_approval' }> {
  if (input.proposerTeamId === input.counterpartyTeamId) {
    badRequest('Counterparty must be a different team');
  }
  if (input.quantity <= 0 || input.price <= 0) {
    badRequest('Quantity and price must be positive');
  }
  if (input.quantity * input.price > P2P_MAX_TRADE_VALUE) {
    badRequest('P2P trade value cannot exceed Rs 10 Cr');
  }

  const exists = await query(
    `SELECT 1 FROM teams WHERE id = $1
     UNION ALL
     SELECT 1 FROM teams WHERE id = $2`,
    [input.proposerTeamId, input.counterpartyTeamId]
  );
  if (exists.length !== 2) {
    badRequest('Invalid P2P team');
  }

  const fund = await query(`SELECT 1 FROM funds WHERE id = $1 AND is_cash = FALSE`, [
    input.fundId,
  ]);
  if (fund.length === 0) {
    badRequest('Invalid tradable fund');
  }

  const rows = await query<{ id: string }>(
    `INSERT INTO p2p_trades
       (proposer_team_id, counterparty_team_id, fund_id, quantity,
        agreed_price, proposer_direction, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'awaiting_approval')
     RETURNING id`,
    [
      input.proposerTeamId,
      input.counterpartyTeamId,
      input.fundId,
      quantity(input.quantity),
      input.price,
      input.direction,
    ]
  );

  await audit({
    event_type: 'p2p_proposed',
    team_id: input.proposerTeamId,
    round: input.round,
    event_data: { trade_id: rows[0].id, ...input },
  });

  return { trade_id: rows[0].id, status: 'awaiting_approval' };
}

export async function setP2PApproval(
  tradeId: string,
  adminUsername: string,
  approve: boolean
): Promise<void> {
  const rows = await query(
    `UPDATE p2p_trades
     SET status = $1, approved_by = $2, approved_at = NOW()
     WHERE id = $3 AND status = 'awaiting_approval'
     RETURNING id`,
    [approve ? 'approved' : 'rejected', adminUsername, tradeId]
  );
  if (rows.length === 0) {
    notFound('P2P trade not found or already processed');
  }

  await audit({
    event_type: approve ? 'p2p_approved' : 'p2p_rejected',
    admin_username: adminUsername,
    event_data: { trade_id: tradeId },
  });
}

async function executeOneP2P(client: PoolClient, trade: P2PTrade): Promise<void> {
  const { buyerId, sellerId } = buyerSeller(trade);
  const qty = Number(trade.quantity);
  const price = Number(trade.agreed_price);
  const value = qty * price;
  if (value > P2P_MAX_TRADE_VALUE) {
    throw new Error('P2P trade exceeds cap');
  }

  const orderedTeams = [buyerId, sellerId].sort((a, b) => a - b);
  const portfolios = await client.query(
    `SELECT team_id, cash FROM portfolios
     WHERE team_id = ANY($1::int[])
     ORDER BY team_id
     FOR UPDATE`,
    [orderedTeams]
  );
  const buyerCash = Number(
    portfolios.rows.find((row) => Number(row.team_id) === buyerId)?.cash ?? 0
  );

  const sellerHolding = await client.query(
    `SELECT quantity FROM holdings
     WHERE team_id = $1 AND fund_id = $2
     FOR UPDATE`,
    [sellerId, trade.fund_id]
  );
  const sellerQty = Number(sellerHolding.rows[0]?.quantity ?? 0);
  const fee = value * BROKERAGE_RATE;
  const buyerCost = value + fee;
  const sellerProceeds = value - fee;

  if (buyerCash < buyerCost) {
    throw new Error('Buyer has insufficient cash');
  }
  if (sellerQty < qty) {
    throw new Error('Seller has insufficient holdings');
  }

  await client.query(`UPDATE portfolios SET cash = cash - $1, last_updated = NOW() WHERE team_id = $2`, [
    money(buyerCost),
    buyerId,
  ]);
  await client.query(`UPDATE portfolios SET cash = cash + $1, last_updated = NOW() WHERE team_id = $2`, [
    money(sellerProceeds),
    sellerId,
  ]);
  await client.query(
    `UPDATE holdings SET quantity = quantity - $1, last_updated = NOW()
     WHERE team_id = $2 AND fund_id = $3`,
    [quantity(qty), sellerId, trade.fund_id]
  );
  await client.query(
    `INSERT INTO holdings (team_id, fund_id, quantity, last_updated)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (team_id, fund_id)
     DO UPDATE SET quantity = holdings.quantity + EXCLUDED.quantity,
                   last_updated = NOW()`,
    [buyerId, trade.fund_id, quantity(qty)]
  );
  await client.query(
    `UPDATE p2p_trades SET status = 'completed', executed_at = NOW(), error_message = NULL
     WHERE id = $1`,
    [trade.id]
  );
}

export async function executeApprovedP2P(client: PoolClient): Promise<void> {
  const trades = await client.query<P2PTrade>(
    `SELECT id, proposer_team_id, counterparty_team_id, fund_id, quantity,
            agreed_price, proposer_direction
     FROM p2p_trades
     WHERE status = 'approved'
     ORDER BY approved_at NULLS LAST, created_at
     FOR UPDATE`
  );

  for (const trade of trades.rows) {
    try {
      await executeOneP2P(client, trade);
      await audit({ event_type: 'p2p_executed', event_data: { trade_id: trade.id } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'P2P execution failed';
      await client.query(
        `UPDATE p2p_trades SET status = 'failed', error_message = $1 WHERE id = $2`,
        [message, trade.id]
      );
      await audit({ event_type: 'p2p_failed', event_data: { trade_id: trade.id, error: message } });
    }
  }
}

export async function pendingP2P(): Promise<unknown[]> {
  return query(
    `SELECT p.*, pt.team_name AS proposer_team_name, ct.team_name AS counterparty_team_name,
            f.fund_code, f.fund_name
     FROM p2p_trades p
     JOIN teams pt ON pt.id = p.proposer_team_id
     JOIN teams ct ON ct.id = p.counterparty_team_id
     JOIN funds f ON f.id = p.fund_id
     WHERE p.status IN ('awaiting_approval', 'approved')
     ORDER BY p.created_at`
  );
}
