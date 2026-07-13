export function formatCurrency(amount: number): string {
  const crores = amount / 10_000_000;
  if (Math.abs(crores) >= 1) {
    return `₹${crores.toFixed(2)} Cr`;
  }
  const lakhs = amount / 100_000;
  if (Math.abs(lakhs) >= 1) {
    return `₹${lakhs.toFixed(2)} L`;
  }
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function formatTimeRemaining(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function phaseDisplayName(phase: string): string {
  const names: Record<string, string> = {
    NEWS_REVEAL: 'News Reveal',
    TRADING_OPEN: 'Trading Open',
    ORDER_LOCK: 'Order Lock',
    RESULTS_DISPLAY: 'Results',
  };
  return names[phase] ?? phase;
}
