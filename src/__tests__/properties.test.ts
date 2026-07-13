import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateSlippageRate } from '@/engine/pricing/slippage';
import { STARTING_CAPITAL, BROKERAGE_RATE } from '@/constants/game';

const THRESHOLD = Math.fround(STARTING_CAPITAL * 0.25);

describe('Property 7: Slippage Threshold Classification', () => {
  it('returns zero slippage when order value is at or below 25% threshold', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: THRESHOLD, noNaN: true }),
        (orderValue) => {
          expect(calculateSlippageRate(orderValue, STARTING_CAPITAL)).toBe(0);
        }
      )
    );
  });

  it('returns positive slippage when order value exceeds 25% threshold', () => {
    fc.assert(
      fc.property(
        fc.double({ min: THRESHOLD + 1, max: STARTING_CAPITAL, noNaN: true }),
        (orderValue) => {
          const slippage = calculateSlippageRate(orderValue, STARTING_CAPITAL);
          expect(slippage).toBeGreaterThan(0);
          const expected = 0.05 * (orderValue - THRESHOLD) / orderValue;
          expect(slippage).toBeCloseTo(expected, 5);
        }
      )
    );
  });
});

describe('Property 5 & 6: Order execution formulas (unit)', () => {
  it('buy order formula components are consistent', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 10000, noNaN: true }),
        fc.float({ min: 10, max: 500, noNaN: true }),
        (quantity, nav) => {
          const orderValue = quantity * nav;
          const slippageRate = calculateSlippageRate(orderValue, STARTING_CAPITAL);
          const effectiveNav = nav * (1 + slippageRate);
          const grossCost = quantity * effectiveNav;
          const brokerageFee = grossCost * BROKERAGE_RATE;
          const totalCost = grossCost + brokerageFee;
          expect(totalCost).toBeGreaterThan(0);
          expect(brokerageFee).toBeCloseTo(grossCost * 0.002, 2);
        }
      )
    );
  });
});
