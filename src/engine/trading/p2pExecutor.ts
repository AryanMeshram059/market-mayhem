import { BROKERAGE_RATE } from '@/constants/game';
import { auditLog } from '@/services/auditLog';
import { withTransaction, type PoolClient } from '@/lib/db';

interface DbP2PTrade {
  id: string;
  proposer_team_id: number;
  counterparty_team_id: number;
  fund_id: number;
  quantity: number;
  agreed_price: number;
  proposer_direction: 'buy' | 'sell';
}

function getBuyerSeller(trade: DbP2PTrade): { buyerId: number; sellerId: number } {
  if (trade.proposer_direction === 'buy') {
    return { buyerId: trade.proposer_team_id, sellerId: trade.counterparty_team_id };
  }
  return { buyerId: trade.counterparty_team_id, sellerId: trade.proposer_team_id };
}

export async function executeP2PTrade(
  client: PoolClient,
  trade: DbP2PTrade
): Promise<void> {
  const { buyerId, sellerId } = getBuyerSeller(trade);
  const quantity = Number(trade.quantity);
  const price = Number(trade.agreed_price);
  const tradeValue = quantity * price;
  const brokerageFee = tradeValue * BROKERAGE_RATE;
  const buyerCost = tradeValue + brokerageFee;
  const sellerProceeds = tradeValue - brokerageFee;

  const sellerHolding = await client.query(
    `SELECT quantity FROM holdings WHERE team_id = $1 AND fund_id = $2 FOR UPDATE`,
    [sellerId, trade.fund_id]
  );
  const sellerQty = sellerHolding.rows.length > 0 ? Number(sellerHolding.rows[0].quantity) : 0;
  if (sellerQty < quantity) {
    throw new Error(`Seller insufficient holdings: need ${quantity}, have ${sellerQty}`);
  }

  const buyerCash = await client.query(
    `SELECT cash FROM portfolios WHERE team_id = $1 FOR UPDATE`,
    [buyerId]
  );
  const buyerBalance = Number(buyerCash.rows[0].cash);
  if (buyerBalance < buyerCost) {
    throw new Error(`Buyer insufficient cash: need ${buyerCost}, have ${buyerBalance}`);
  }

  await client.query(
    `UPDATE portfolios SET cash = cash - $1, last_updated = NOW() WHERE team_id = $2`,
    [buyerCost, buyerId]
  );
  await client.query(
    `UPDATE portfolios SET cash = cash + $1, last_updated = NOW() WHERE team_id = $2`,
    [sellerProceeds, sellerId]
  );

  await client.query(
    `UPDATE holdings SET quantity = quantity - $1, last_updated = NOW()
     WHERE team_id = $2 AND fund_id = $3`,
    [quantity, sellerId, trade.fund_id]
  );
  await client.query(
    `INSERT INTO holdings (team_id, fund_id, quantity, last_updated)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (team_id, fund_id)
     DO UPDATE SET quantity = holdings.quantity + $3, last_updated = NOW()`,
    [buyerId, trade.fund_id, quantity]
  );

  await client.query(
    `UPDATE p2p_trades SET status = 'completed', executed_at = NOW() WHERE id = $1`,
    [trade.id]
  );

  await auditLog('p2p_executed', {
    details: {
      trade_id: trade.id,
      buyer_id: buyerId,
      seller_id: sellerId,
      fund_id: trade.fund_id,
      quantity,
      price,
      brokerage_fee: brokerageFee,
    },
  });
}

async function markP2PFailed(
  client: PoolClient,
  trade: DbP2PTrade,
  errorMessage: string
): Promise<void> {
  await client.query(
    `UPDATE p2p_trades SET status = 'failed', error_message = $1 WHERE id = $2`,
    [errorMessage, trade.id]
  );
  await auditLog('p2p_failed', {
    details: { trade_id: trade.id, error: errorMessage },
  });
}

export async function executeApprovedP2PTrades(): Promise<void> {
  await withTransaction(async (client) => {
    const result = await client.query(
      `SELECT id, proposer_team_id, counterparty_team_id, fund_id, quantity,
              agreed_price, proposer_direction
       FROM p2p_trades WHERE status = 'approved'`
    );

    for (const trade of result.rows as DbP2PTrade[]) {
      try {
        await executeP2PTrade(client, trade);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        await markP2PFailed(client, trade, message);
      }
    }
  });
}
