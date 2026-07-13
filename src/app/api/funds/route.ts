import { queryAsGameEngine } from '@/lib/db';
import { getAuthHeader, handleApiError, jsonResponse } from '@/lib/api';
import { authenticateTeamRequest } from '@/services/auth';

export async function GET(request: Request) {
  try {
    await authenticateTeamRequest(getAuthHeader(request));
    const funds = await queryAsGameEngine(
      `SELECT id, fund_code, fund_name FROM funds WHERE is_cash = FALSE ORDER BY fund_code`
    );
    return jsonResponse(funds);
  } catch (error) {
    return handleApiError(error);
  }
}
