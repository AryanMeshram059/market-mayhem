'use client';

import { AuthGuard } from '@/components/shared/AuthGuard';
import { AppNav } from '@/components/shared/AppNav';
import { PortfolioSummary } from '@/components/shared/PortfolioSummary';
import { usePortfolio } from '@/hooks/usePortfolio';
import { formatCurrency } from '@/lib/format';

export default function PortfolioPage() {
  const { data: portfolio } = usePortfolio();

  return (
    <AuthGuard>
      <AppNav />
      <main className="container mx-auto px-4 py-6 space-y-6 max-w-2xl">
        <PortfolioSummary />
        {portfolio && portfolio.holdings.length > 0 && (
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <h3 className="font-semibold mb-3">Holdings Detail</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left py-1">Fund</th>
                  <th className="text-right py-1">Qty</th>
                  <th className="text-right py-1">NAV</th>
                  <th className="text-right py-1">Value</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.holdings.map((h) => (
                  <tr key={h.fund_id} className="border-t">
                    <td className="py-2">{h.fund_name}</td>
                    <td className="text-right py-2">{h.quantity.toLocaleString()}</td>
                    <td className="text-right py-2">₹{h.current_nav.toFixed(2)}</td>
                    <td className="text-right py-2">{formatCurrency(h.market_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </AuthGuard>
  );
}
