import {
  BROKERAGE_RATE,
  CASH_EROSION_RATE,
  SLIPPAGE_RATE,
  SLIPPAGE_THRESHOLD_RATE,
} from '@/domain/constants';
import type { OrderType } from '@/domain/types';

export function money(value: number): string {
  return value.toFixed(2);
}

export function quantity(value: number): string {
  return value.toFixed(4);
}

export function slippageRate(orderValue: number, startingCapital: number): number {
  const threshold = startingCapital * SLIPPAGE_THRESHOLD_RATE;
  return orderValue > threshold ? SLIPPAGE_RATE : 0;
}

export function effectiveNav(nav: number, orderValue: number, startingCapital: number, side: OrderType): {
  nav: number;
  slippage: number;
} {
  const slippage = slippageRate(orderValue, startingCapital);
  return {
    nav: side === 'buy' ? nav * (1 + slippage) : nav * (1 - slippage),
    slippage,
  };
}

export function brokerage(value: number): number {
  return value * BROKERAGE_RATE;
}

export function erodeCash(cash: number, rounds = 15): number {
  return cash * Math.pow(1 - CASH_EROSION_RATE, rounds);
}
