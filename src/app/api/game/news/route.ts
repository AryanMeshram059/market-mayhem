import { authenticateTeamRequest } from '@/services/auth';
import { checkRateLimit } from '@/services/rateLimit';
import { queryAsGameEngine } from '@/lib/db';
import { getAuthHeader, handleApiError, jsonResponse } from '@/lib/api';

export async function GET(request: Request) {
  try {
    const teamId = await authenticateTeamRequest(getAuthHeader(request));
    await checkRateLimit(teamId);

    const { searchParams } = new URL(request.url);
    const round = parseInt(searchParams.get('round') ?? '1', 10);

    const rows = await queryAsGameEngine(
      `SELECT round, content FROM news_feed WHERE round = $1`,
      [round]
    );

    if (rows.length === 0) {
      return jsonResponse({
        round,
        content: `No news available for round ${round}. Market conditions remain uncertain.`,
      });
    }

    return jsonResponse(
      { round: rows[0].round, content: rows[0].content },
      200,
      { 'Cache-Control': 'public, max-age=3600, immutable' }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
