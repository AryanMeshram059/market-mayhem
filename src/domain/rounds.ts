import { TOTAL_ROUNDS } from './constants';
import type { SchedulePayload } from './types';

export const PREDEFINED_ROUND_NEWS: Record<number, string> = {
  1: 'news1',
  2: 'news2',
  3: 'news3',
  4: 'news4',
  5: 'news5',
  6: 'news6',
  7: 'news7',
  8: 'news8',
  9: 'news9',
  10: 'news10',
};

export const PREDEFINED_SCHEDULE: SchedulePayload = {
  funds: [
    { fund_code: 'TECH', navValues: [100, 112, 96, 118, 105, 127, 111, 134, 122, 141] },
    { fund_code: 'PHARMA', navValues: [100, 94, 108, 116, 101, 119, 131, 124, 138, 129] },
    { fund_code: 'ENERGY', navValues: [100, 117, 109, 128, 121, 136, 114, 143, 132, 150] },
    { fund_code: 'BANKING', navValues: [100, 106, 119, 111, 126, 137, 123, 145, 134, 152] },
    { fund_code: 'CONSUMER', navValues: [100, 98, 104, 113, 107, 121, 116, 128, 139, 131] },
    { fund_code: 'AUTO', navValues: [100, 91, 107, 102, 120, 115, 133, 126, 144, 136] },
    { fund_code: 'INFRA', navValues: [100, 115, 123, 117, 132, 140, 129, 148, 155, 142] },
    { fund_code: 'METALS', navValues: [100, 89, 111, 124, 106, 135, 119, 147, 130, 158] },
    { fund_code: 'TELECOM', navValues: [100, 103, 97, 112, 118, 109, 125, 137, 121, 146] },
    { fund_code: 'REALTY', navValues: [100, 93, 101, 114, 129, 120, 138, 127, 151, 140] },
    { fund_code: 'FMCG', navValues: [100, 105, 102, 110, 117, 113, 126, 122, 135, 143] },
  ],
};

if (Object.keys(PREDEFINED_ROUND_NEWS).length !== TOTAL_ROUNDS) {
  throw new Error('Predefined round news must cover every round');
}
