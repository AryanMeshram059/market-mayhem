'use client';

import { usePortfolio } from '@/hooks/usePortfolio';
import { formatCurrency } from '@/lib/format';

export function PortfolioSummary() {
  const { data: portfolio, isLoading } = usePortfolio();

  if (isLoading || !portfolio) {
    return <div className="rounded-lg border bg-card p-4 animate-pulse h-40" />;
  }

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Portfolio</h3>
        <span className="text-lg font-bold">{formatCurrency(portfolio.total_value)}</span>
      </div>

      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Cash Balance</span>
        <span className="font-medium">{formatCurrency(portfolio.cash)}</span>
      </div>

      {portfolio.holdings.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Holdings</p>
          {portfolio.holdings.map((h) => (
            <div key={h.fund_id} className="flex justify-between text-sm">
              <span>{h.fund_name ?? h.fund_code}</span>
              <span>{h.quantity.toLocaleString()} @ {formatCurrency(h.market_value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
