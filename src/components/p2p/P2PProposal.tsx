'use client';

import { useState } from 'react';
import { useGameState } from '@/hooks/useGameState';
import { apiFetch } from '@/lib/client';
import { Button } from '@/components/ui/button';

export function P2PProposal() {
  const { gameState } = useGameState();
  const [counterpartyId, setCounterpartyId] = useState('');
  const [fundId, setFundId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [direction, setDirection] = useState<'buy' | 'sell'>('buy');
  const [tradeId, setTradeId] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const isTradingOpen = gameState?.phase === 'TRADING_OPEN';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const result = await apiFetch<{ trade_id: string; status: string }>('/api/p2p/propose', {
        method: 'POST',
        body: JSON.stringify({
          counterparty_team_id: parseInt(counterpartyId),
          fund_id: parseInt(fundId),
          quantity: parseFloat(quantity),
          price_per_unit: parseFloat(price),
          direction,
        }),
      });
      setTradeId(result.trade_id);
      setStatus(result.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Proposal failed');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-4 shadow-sm space-y-3">
      <h3 className="font-semibold">P2P Trade Proposal</h3>

      <div className="flex gap-2">
        <Button type="button" size="sm" variant={direction === 'buy' ? 'default' : 'outline'}
          onClick={() => setDirection('buy')} disabled={!isTradingOpen}>Buy</Button>
        <Button type="button" size="sm" variant={direction === 'sell' ? 'default' : 'outline'}
          onClick={() => setDirection('sell')} disabled={!isTradingOpen}>Sell</Button>
      </div>

      <input type="number" placeholder="Counterparty Team ID" value={counterpartyId}
        onChange={(e) => setCounterpartyId(e.target.value)} disabled={!isTradingOpen}
        className="w-full rounded-md border px-3 py-2 text-sm" />
      <input type="number" placeholder="Fund ID" value={fundId}
        onChange={(e) => setFundId(e.target.value)} disabled={!isTradingOpen}
        className="w-full rounded-md border px-3 py-2 text-sm" />
      <input type="number" placeholder="Quantity" value={quantity}
        onChange={(e) => setQuantity(e.target.value)} disabled={!isTradingOpen}
        className="w-full rounded-md border px-3 py-2 text-sm" />
      <input type="number" placeholder="Price per unit" value={price}
        onChange={(e) => setPrice(e.target.value)} disabled={!isTradingOpen}
        className="w-full rounded-md border px-3 py-2 text-sm" />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {tradeId && <p className="text-sm text-green-600">Trade {tradeId}: {status}</p>}

      <Button type="submit" disabled={!isTradingOpen} className="w-full">Propose Trade</Button>
    </form>
  );
}
