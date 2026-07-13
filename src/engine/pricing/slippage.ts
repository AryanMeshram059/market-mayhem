import { SLIPPAGE_RATE, SLIPPAGE_THRESHOLD } from '@/constants/game';

export function calculateSlippageRate(
  orderValue: number,
  startingCapital: number
): number {
  const threshold = startingCapital * SLIPPAGE_THRESHOLD;
  if (orderValue <= threshold) {
    return 0;
  }

  const excess = orderValue - threshold;
  return (excess / orderValue) * SLIPPAGE_RATE;
}

export function calculateEffectiveNav(
  nav: number,
  orderValue: number,
  startingCapital: number,
  direction: 'buy' | 'sell'
): { effectiveNav: number; slippageRate: number } {
  const slippageRate = calculateSlippageRate(orderValue, startingCapital);
  const effectiveNav =
    direction === 'buy' ? nav * (1 + slippageRate) : nav * (1 - slippageRate);
  return { effectiveNav, slippageRate };
}
