import { authenticateAdminRequest } from '@/services/auth';
import { validateSchedule, parseScheduleCsv, storeSchedule } from '@/engine/pricing/scheduleManager';
import { getAuthHeader, handleApiError, jsonResponse } from '@/lib/api';
import { INVESTABLE_FUNDS, TOTAL_ROUNDS } from '@/constants/game';

export async function POST(request: Request) {
  try {
    const adminUsername = await authenticateAdminRequest(getAuthHeader(request));
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return jsonResponse({ error: { code: 'VALIDATION_ERROR', message: 'CSV file required' } }, 400);
    }

    const csv = await file.text();
    const validation = validateSchedule(csv);

    if (!validation.valid) {
      return jsonResponse({ error: { code: 'VALIDATION_ERROR', message: validation.error!, details: validation.details } }, 400);
    }

    const schedule = parseScheduleCsv(csv);
    const scheduleId = await storeSchedule(schedule, adminUsername);

    return jsonResponse({
      schedule_id: scheduleId,
      funds: INVESTABLE_FUNDS,
      rounds: TOTAL_ROUNDS,
      message: `Successfully loaded ${INVESTABLE_FUNDS * TOTAL_ROUNDS} NAV entries`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
