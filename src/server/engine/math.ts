import {
  BROKERAGE_RATE,
  CASH_EROSION_RATE,
  SLIPPAGE_RATE,
  SLIPPAGE_THRESHOLD_RATE,
} from '@/domain/constants';

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

export function effectiveNav(nav: number, orderValue: number, startingCapital: number): {
  nav: number;
  slippage: number;
} {
  const slippage = slippageRate(orderValue, startingCapital);
  return {
    nav: nav * (1 + slippage),
    slippage,
  };
}

export function brokerage(value: number): number {
  return value * BROKERAGE_RATE;
}

export function marginalSlippageValue(
  orderValue: number,
  startingCapital: number,
  priorRoundExposure: number,
): number {
  const threshold = startingCapital * SLIPPAGE_THRESHOLD_RATE;
  const previousOverage = Math.max(0, priorRoundExposure - threshold);
  const nextOverage = Math.max(0, priorRoundExposure + orderValue - threshold);
  return nextOverage - previousOverage;
}

export function buyExecutionTotals(
  nav: number,
  quantityValue: number,
  startingCapital: number,
  priorRoundExposure: number,
): {
  gross: number;
  fee: number;
  total: number;
  effectiveNav: number;
  slippage: number;
  slippageValue: number;
  orderValue: number;
} {
  const orderValue = quantityValue * nav;
  const slippageValue = marginalSlippageValue(orderValue, startingCapital, priorRoundExposure);
  const gross = orderValue + slippageValue * SLIPPAGE_RATE;
  const fee = brokerage(gross);
  return {
    gross,
    fee,
    total: gross + fee,
    effectiveNav: quantityValue > 0 ? gross / quantityValue : nav,
    slippage: orderValue > 0 ? gross / orderValue - 1 : 0,
    slippageValue,
    orderValue,
  };
}

export function erodeCashOnce(cash: number): number {
  return cash * (1 - CASH_EROSION_RATE);
}
