import { authenticateTeamRequest } from '@/services/auth';
import { checkRateLimit } from '@/services/rateLimit';
import { calculatePortfolioValue } from '@/engine/scoring/portfolio';
import { getAuthHeader, handleApiError, withETag } from '@/lib/api';

export async function GET(request: Request) {
  try {
    const teamId = await authenticateTeamRequest(getAuthHeader(request));
    await checkRateLimit(teamId);

    const portfolio = await calculatePortfolioValue(teamId);
    return withETag(request, {
      cash: portfolio.cash,
      holdings: portfolio.holdings,
      total_value: portfolio.total_value,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
