import { BROKERAGE_RATE, P2P_MAX_TRADE_VALUE, TOTAL_ROUNDS } from '@/domain/constants';
import type { OrderType } from '@/domain/types';
import { audit } from '../audit';
import { query, transaction, type PoolClient } from '../db';
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
  round: number;
}

function buyerSeller(trade: P2PTrade): { buyerId: number; sellerId: number } {
  return trade.proposer_direction === 'buy'
    ? { buyerId: trade.proposer_team_id, sellerId: trade.counterparty_team_id }
    : { buyerId: trade.counterparty_team_id, sellerId: trade.proposer_team_id };
}

async function currentNavForFund(fundId: number): Promise<number> {
  const rows = await query<{ current_nav: string }>(
    `SELECT current_nav FROM funds WHERE id = $1 AND is_cash = FALSE`,
    [fundId],
  );
  if (!rows[0]) {
    badRequest('Invalid tradable fund');
  }
  return Number(rows[0].current_nav);
}

function feeForTradeValue(value: number): number {
  return value * BROKERAGE_RATE;
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
  input: { teamId: number; fundId: number; qty: number; reduceQuantity: boolean },
): Promise<void> {
  await client.query(
    `UPDATE holdings
     SET quantity = CASE WHEN $4 THEN quantity - $1 ELSE quantity END,
         total_invested = CASE
           WHEN (CASE WHEN $4 THEN quantity - $1 ELSE quantity END) <= 0 THEN 0
           ELSE GREATEST(
             0,
             total_invested - (
               COALESCE(NULLIF(avg_buy_price, 0), total_invested / NULLIF(quantity + CASE WHEN $4 THEN 0 ELSE $1 END, 0), 0) * $1
             )
           )
         END,
         avg_buy_price = CASE
           WHEN (CASE WHEN $4 THEN quantity - $1 ELSE quantity END) <= 0 THEN 0
           ELSE COALESCE(NULLIF(avg_buy_price, 0), total_invested / NULLIF(quantity + CASE WHEN $4 THEN 0 ELSE $1 END, 0), 0)
         END,
         last_updated = NOW()
     WHERE team_id = $2 AND fund_id = $3`,
    [quantity(input.qty), input.teamId, input.fundId, input.reduceQuantity],
  );
}

async function reserveBuyCash(client: PoolClient, teamId: number, reserveAmount: number): Promise<void> {
  const rows = await client.query<{ cash: string }>(
    `SELECT cash FROM portfolios WHERE team_id = $1 FOR UPDATE`,
    [teamId],
  );
  const availableCash = Number(rows.rows[0]?.cash ?? 0);
  if (availableCash < reserveAmount) {
    badRequest('Insufficient cash to post this buy offer');
  }
  await client.query(
    `UPDATE portfolios SET cash = cash - $1, last_updated = NOW() WHERE team_id = $2`,
    [money(reserveAmount), teamId],
  );
}

async function reserveSellUnits(client: PoolClient, teamId: number, fundId: number, qty: number): Promise<void> {
  const rows = await client.query<{ quantity: string }>(
    `SELECT quantity FROM holdings WHERE team_id = $1 AND fund_id = $2 FOR UPDATE`,
    [teamId, fundId],
  );
  const available = Number(rows.rows[0]?.quantity ?? 0);
  if (available < qty) {
    badRequest('Insufficient holdings to post this sell offer');
  }
  await client.query(
    `UPDATE holdings SET quantity = quantity - $1, last_updated = NOW() WHERE team_id = $2 AND fund_id = $3`,
    [quantity(qty), teamId, fundId],
  );
}

async function releaseLockedOffer(client: PoolClient, trade: P2PTrade): Promise<void> {
  const qty = Number(trade.quantity);
  const price = Number(trade.agreed_price);
  const value = qty * price;
  const fee = feeForTradeValue(value);

  if (trade.proposer_direction === 'buy') {
    await client.query(
      `UPDATE portfolios SET cash = cash + $1, last_updated = NOW() WHERE team_id = $2`,
      [money(value + fee), trade.proposer_team_id],
    );
    return;
  }

  await client.query(
    `INSERT INTO holdings (team_id, fund_id, quantity, last_updated)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (team_id, fund_id)
     DO UPDATE SET quantity = holdings.quantity + EXCLUDED.quantity,
                   last_updated = NOW()`,
    [trade.proposer_team_id, trade.fund_id, quantity(qty)],
  );
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
  if (input.round < 1 || input.round > TOTAL_ROUNDS) {
    badRequest('Invalid round');
  }

  const value = input.quantity * input.price;
  if (value > P2P_MAX_TRADE_VALUE) {
    badRequest('P2P trade value cannot exceed Rs 10 Cr');
  }

  const exists = await query(
    `SELECT 1 FROM teams WHERE id = $1
     UNION ALL
     SELECT 1 FROM teams WHERE id = $2`,
    [input.proposerTeamId, input.counterpartyTeamId],
  );
  if (exists.length !== 2) {
    badRequest('Invalid P2P team');
  }

  const nav = await currentNavForFund(input.fundId);
  const deviation = Math.abs(input.price - nav) / nav;
  if (deviation > 0.03) {
    badRequest('P2P offer price must stay within +/-3% of current NAV');
  }

  return transaction(async (client) => {
    if (input.direction === 'buy') {
      await reserveBuyCash(client, input.proposerTeamId, value + feeForTradeValue(value));
    } else {
      await reserveSellUnits(client, input.proposerTeamId, input.fundId, input.quantity);
    }

    const rows = await client.query<{ id: string }>(
      `INSERT INTO p2p_trades
         (proposer_team_id, counterparty_team_id, fund_id, quantity,
          agreed_price, proposer_direction, status, round)
       VALUES ($1, $2, $3, $4, $5, $6, 'awaiting_approval', $7)
       RETURNING id`,
      [
        input.proposerTeamId,
        input.counterpartyTeamId,
        input.fundId,
        quantity(input.quantity),
        input.price,
        input.direction,
        input.round,
      ],
    );

    await audit({
      event_type: 'p2p_proposed',
      team_id: input.proposerTeamId,
      round: input.round,
      event_data: { trade_id: rows.rows[0].id, ...input },
    }, client);

    return { trade_id: rows.rows[0].id, status: 'awaiting_approval' as const };
  });
}

export async function acceptP2P(tradeId: string, teamId: number): Promise<void> {
  await transaction(async (client) => {
    const tradeRows = await client.query<P2PTrade>(
      `SELECT id, proposer_team_id, counterparty_team_id, fund_id, quantity, agreed_price, proposer_direction, round
       FROM p2p_trades
       WHERE id = $1
       FOR UPDATE`,
      [tradeId],
    );
    const trade = tradeRows.rows[0];
    if (!trade) {
      notFound('P2P trade not found');
    }
    if (trade.counterparty_team_id !== teamId) {
      badRequest('Only the designated counterparty can accept this offer');
    }

    const statusRows = await client.query<{ status: string }>(
      `SELECT status FROM p2p_trades WHERE id = $1 FOR UPDATE`,
      [tradeId],
    );
    const status = statusRows.rows[0]?.status;
    if (status !== 'awaiting_approval') {
      badRequest('This offer has already been processed');
    }

    const { buyerId, sellerId } = buyerSeller(trade);
    const qty = Number(trade.quantity);
    const price = Number(trade.agreed_price);
    const value = qty * price;
    const fee = feeForTradeValue(value);
    const buyerCost = value + fee;
    const sellerProceeds = value - fee;

    if (trade.proposer_direction === 'sell') {
      const buyerPortfolio = await client.query<{ cash: string }>(
        `SELECT cash FROM portfolios WHERE team_id = $1 FOR UPDATE`,
        [buyerId],
      );
      const buyerCash = Number(buyerPortfolio.rows[0]?.cash ?? 0);
      if (buyerCash < buyerCost) {
        badRequest('Buyer has insufficient cash');
      }
      await client.query(
        `UPDATE portfolios SET cash = cash - $1, last_updated = NOW() WHERE team_id = $2`,
        [money(buyerCost), buyerId],
      );
    } else {
      const sellerHolding = await client.query<{ quantity: string }>(
        `SELECT quantity FROM holdings WHERE team_id = $1 AND fund_id = $2 FOR UPDATE`,
        [sellerId, trade.fund_id],
      );
      const available = Number(sellerHolding.rows[0]?.quantity ?? 0);
      if (available < qty) {
        badRequest('Seller has insufficient holdings');
      }
      await subtractHoldingWithCostBasis(client, {
        teamId: sellerId,
        fundId: trade.fund_id,
        qty,
        reduceQuantity: true,
      });
    }

    await client.query(
      `UPDATE portfolios SET cash = cash + $1, last_updated = NOW() WHERE team_id = $2`,
      [money(sellerProceeds), sellerId],
    );
    if (trade.proposer_direction === 'sell') {
      await subtractHoldingWithCostBasis(client, {
        teamId: sellerId,
        fundId: trade.fund_id,
        qty,
        reduceQuantity: false,
      });
    }

    await addHoldingWithCostBasis(client, {
      teamId: buyerId,
      fundId: trade.fund_id,
      qty,
      totalCost: buyerCost,
    });
    await client.query(
      `UPDATE p2p_trades
       SET status = 'completed', executed_at = NOW(), error_message = NULL, accepted_by_team_id = $1
       WHERE id = $2`,
      [teamId, trade.id],
    );

    await audit({
      event_type: 'p2p_executed',
      round: trade.round,
      event_data: { trade_id: trade.id, buyer_id: buyerId, seller_id: sellerId },
    }, client);
  });
}

export async function setP2PApproval(tradeId: string, adminUsername: string, approve: boolean): Promise<void> {
  if (approve) {
    badRequest('Teams must accept offers directly from the trade window');
  }

  await transaction(async (client) => {
    const tradeRows = await client.query<P2PTrade>(
      `SELECT id, proposer_team_id, counterparty_team_id, fund_id, quantity, agreed_price, proposer_direction, round
       FROM p2p_trades
       WHERE id = $1 AND status = 'awaiting_approval'
       FOR UPDATE`,
      [tradeId],
    );
    const trade = tradeRows.rows[0];
    if (!trade) {
      notFound('P2P trade not found or already processed');
    }

    await releaseLockedOffer(client, trade);
    await client.query(
      `UPDATE p2p_trades
       SET status = 'rejected', approved_by = $1, approved_at = NOW(), error_message = NULL
       WHERE id = $2`,
      [adminUsername, tradeId],
    );

    await audit({
      event_type: 'p2p_rejected',
      admin_username: adminUsername,
      round: trade.round,
      event_data: { trade_id: tradeId },
    }, client);
  });
}

export async function expireOpenP2P(client: PoolClient, round: number): Promise<void> {
  const trades = await client.query<P2PTrade>(
    `SELECT id, proposer_team_id, counterparty_team_id, fund_id, quantity, agreed_price, proposer_direction, round
     FROM p2p_trades
     WHERE round = $1 AND status = 'awaiting_approval'
     FOR UPDATE`,
    [round],
  );

  for (const trade of trades.rows) {
    await releaseLockedOffer(client, trade);
    await client.query(
      `UPDATE p2p_trades
       SET status = 'expired', error_message = 'Offer expired at round close'
       WHERE id = $1`,
      [trade.id],
    );
    await audit({
      event_type: 'p2p_expired',
      round,
      event_data: { trade_id: trade.id },
    }, client);
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
     WHERE p.status = 'awaiting_approval'
     ORDER BY p.created_at`,
  );
}

export async function openP2POffers(teamId: number): Promise<unknown[]> {
  return query(
    `SELECT p.id, p.proposer_team_id, p.counterparty_team_id, p.quantity, p.agreed_price,
            p.proposer_direction, p.status, p.created_at, p.round,
            pt.team_name AS proposer_team_name,
            ct.team_name AS counterparty_team_name,
            f.fund_code, f.fund_name
     FROM p2p_trades p
     JOIN teams pt ON pt.id = p.proposer_team_id
     JOIN teams ct ON ct.id = p.counterparty_team_id
     JOIN funds f ON f.id = p.fund_id
     WHERE p.status = 'awaiting_approval'
       AND p.counterparty_team_id = $1
     ORDER BY p.created_at DESC`,
    [teamId],
  );
}
