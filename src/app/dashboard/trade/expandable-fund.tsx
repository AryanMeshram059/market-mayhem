'use client';

import { ChevronDown, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Fund, HoldingView } from '@/domain/types';
import { money, units } from '@/components/team-dashboard';
import { FundChart } from './fund-chart';

type ExpandableFundProps = {
  fund: Fund;
  holding: HoldingView | null;
  portfolio: any;
  gameState: any;
  tradableNow: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onBuySell: (fund: Fund, orderType: 'buy' | 'sell', quantity: number) => Promise<void>;
  submitting: boolean;
  round: number;
};

export function ExpandableFund({
  fund,
  holding,
  portfolio,
  gameState,
  tradableNow,
  isExpanded,
  onToggle,
  onBuySell,
  submitting,
  round,
}: ExpandableFundProps) {
  const [quantity, setQuantity] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const estimatedValue = Number(quantity) > 0 ? Number(quantity) * fund.current_nav : 0;
  const requestedQuantity = Number(quantity);
  const canSubmit = tradableNow && !isSubmitting && !submitting && requestedQuantity > 0;
  const canSell = canSubmit && Boolean(holding) && requestedQuantity <= (holding?.quantity ?? 0);

  const handleSubmit = async (type: 'buy' | 'sell') => {
    if (!quantity || Number(quantity) <= 0) return;
    if (type === 'sell' && holding && Number(quantity) > holding.quantity) return;
    
    setIsSubmitting(true);
    try {
      await onBuySell(fund, type, Number(quantity));
      setQuantity('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-border/70 bg-background/45 overflow-hidden">
      {/* Header */}
      <div 
        onClick={onToggle}
        className="flex cursor-pointer items-center justify-between gap-4 p-4 hover:bg-background/60 transition-colors"
      >
        <div className="flex flex-1 items-center gap-4">
          <div className="flex size-11 items-center justify-center rounded-full border border-primary/30 bg-primary/10 font-mono text-xs text-primary">
            {fund.fund_code.slice(0, 3)}
          </div>
          <div className="flex-1">
            <p className="font-medium text-white">{fund.fund_name}</p>
            <p className="font-mono text-xs text-muted-foreground">{fund.fund_code}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Current NAV</p>
            <p className="font-mono font-semibold text-emerald-400">{money(fund.current_nav)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Your Units</p>
            <p className="font-mono font-semibold text-white">{holding ? units(holding.quantity) : '0'}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Your Value</p>
            <p className="font-mono font-semibold text-blue-400">{holding ? money(holding.market_value) : money(0)}</p>
          </div>
          <ChevronDown 
            className={`size-5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <>
          <Separator />
          <div className="p-6 space-y-6">
            {/* Chart */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Price History</h3>
              <FundChart fund={fund} round={round} />
            </div>

            {/* Holding Details */}
            {holding && (
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Your Position</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border/70 bg-background/50 p-3">
                    <p className="text-xs text-muted-foreground">Buy Price</p>
                    <p className="mt-1 font-mono text-sm text-cyan-400">{money(holding.avg_buy_price)}</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/50 p-3">
                    <p className="text-xs text-muted-foreground">Current Price</p>
                    <p className="mt-1 font-mono text-sm text-emerald-400">{money(holding.current_nav)}</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/50 p-3">
                    <p className="text-xs text-muted-foreground">Total Invested</p>
                    <p className="mt-1 font-mono text-sm text-white">{money(holding.total_invested)}</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/50 p-3">
                    <p className="text-xs text-muted-foreground">Total Return</p>
                    <p className={`mt-1 font-mono text-sm ${holding.total_return >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {money(holding.total_return)} ({holding.return_percentage.toFixed(2)}%)
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Trade Section */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Place Order</h3>
              <div className="space-y-4 rounded-lg border border-border/70 bg-background/50 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5 text-sm font-medium">
                    <span className="text-muted-foreground">Quantity</span>
                    <Input 
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      type="number"
                      min="0"
                      step="0.0001"
                      placeholder="0.0000"
                      disabled={!tradableNow}
                    />
                  </label>
                  <label className="space-y-1.5 text-sm font-medium">
                    <span className="text-muted-foreground">Est. Value</span>
                    <div className="flex items-center justify-center rounded-md border border-border/70 bg-background/50 px-3 py-2 font-mono text-sm">
                      {money(estimatedValue)}
                    </div>
                  </label>
                </div>

                {holding && (
                  <p className="text-xs text-muted-foreground">
                    Available to sell: {units(holding.quantity)} units
                  </p>
                )}

                <div className="flex gap-2">
                  <Button
                    className="flex-1 border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 hover:text-emerald-200"
                    disabled={!canSubmit}
                    onClick={() => void handleSubmit('buy')}
                  >
                    <ArrowDownLeft className="size-4" />
                    Buy
                  </Button>
                  <Button
                    className="flex-1 border-rose-500/40 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 hover:text-rose-200"
                    disabled={!canSell}
                    onClick={() => void handleSubmit('sell')}
                  >
                    <ArrowUpRight className="size-4" />
                    Sell
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
