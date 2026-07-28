import { TOTAL_ROUNDS } from './constants';
import type { SchedulePayload } from './types';

export const PREDEFINED_ROUND_NEWS: Record<number, string> = {
  1: 'Central Bank Raises Interest Rates to Curb Inflation',
  2: 'Breakthrough AI Model Sparks Global Tech Rally',
  3: 'Middle East Conflict Disrupts Global Oil Supply',
  4: 'New Virus Strain Triggers Global Health Emergency',
  5: 'Central Bank Cuts Rates, But Markets Sell Off on Growth Fears',
  6: 'Global Chip Shortage Officially Ends',
  7: 'Regional Bank Collapses, Triggering Banking Sector Fears',
  8: 'Weak Monsoon Season Hits Agricultural Output',
  9: 'Government Announces Major Infrastructure Spending Package',
  10: 'Trade War Escalates as New Tariffs Announced',
  11: 'Renewable Energy Breakthrough Announced',
  12: 'Peace Agreement Signed, Ending Regional Conflict',
  13: 'Strong Jobs Report Beats Expectations',
  14: 'Global Economy Shows Broad-Based Recovery',
  15: 'Inflation Data Surges Past Forecasts',
};

export const PREDEFINED_SCHEDULE: SchedulePayload = {
  funds: [
    { fund_code: 'TECH', navValues: [100.00, 94.00, 103.40, 99.26, 107.21, 103.99, 110.23, 106.92, 106.92, 109.06, 113.42, 116.82, 120.33, 116.72, 123.72, 117.54] },
    { fund_code: 'BANKING', navValues: [100.00, 104.00, 106.08, 99.72, 93.73, 89.98, 90.88, 81.79, 80.98, 84.22, 82.53, 83.36, 87.52, 89.27, 93.74, 96.55] },
    { fund_code: 'AUTO', navValues: [100.00, 97.00, 99.91, 91.92, 82.73, 81.07, 85.12, 82.57, 82.57, 85.87, 80.72, 83.95, 88.99, 88.10, 92.50, 89.73] },
    { fund_code: 'FMCG', navValues: [100.00, 99.00, 99.99, 97.99, 100.93, 100.93, 101.94, 100.92, 97.89, 98.87, 97.88, 97.88, 98.86, 98.86, 101.83, 98.77] },
    { fund_code: 'PHARMA', navValues: [100.00, 100.00, 100.00, 100.00, 115.00, 116.15, 116.15, 117.31, 117.31, 117.31, 117.31, 117.31, 117.31, 117.31, 119.66, 119.66] },
    { fund_code: 'ENERGY', navValues: [100.00, 100.00, 100.00, 110.00, 101.20, 100.19, 100.19, 98.18, 98.18, 103.09, 102.06, 108.19, 101.70, 101.70, 104.75, 106.84] },
    { fund_code: 'GOLD', navValues: [100.00, 98.00, 95.06, 104.57, 112.93, 116.32, 116.32, 123.30, 125.76, 123.25, 125.71, 124.46, 114.50, 115.65, 111.02, 117.68] },
    { fund_code: 'OIL', navValues: [100.00, 100.00, 100.00, 115.00, 101.20, 100.19, 100.19, 99.19, 99.19, 100.18, 99.18, 94.22, 84.80, 84.80, 86.49, 89.09] },
    { fund_code: 'AGRI', navValues: [100.00, 100.00, 100.00, 102.00, 99.96, 99.96, 99.96, 99.96, 93.96, 94.90, 91.11, 91.11, 92.02, 92.02, 93.86, 95.73] },
    { fund_code: 'GOVBOND', navValues: [100.00, 95.00, 93.10, 95.89, 100.69, 106.73, 106.73, 113.13, 114.26, 110.84, 113.05, 111.92, 107.45, 104.22, 100.05, 94.05] },
    { fund_code: 'PROPERTY', navValues: [100.00, 94.00, 94.00, 91.18, 85.71, 84.00, 84.00, 78.96, 78.96, 85.27, 84.42, 85.26, 86.97, 85.23, 89.49, 85.91] },
  ],
};

if (Object.keys(PREDEFINED_ROUND_NEWS).length !== TOTAL_ROUNDS) {
  throw new Error('Predefined round news must cover every round');
}
