import { authenticateAdminRequest } from '@/services/auth';
import { queryAsAdmin } from '@/lib/db';
import { getAuthHeader, handleApiError, jsonResponse } from '@/lib/api';

export async function GET(request: Request) {
  try {
    await authenticateAdminRequest(getAuthHeader(request));

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('team_id');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const eventType = searchParams.get('event_type');
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = 100;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (teamId) {
      conditions.push(`team_id = $${paramIdx++}`);
      values.push(parseInt(teamId, 10));
    }
    if (from) {
      conditions.push(`created_at >= $${paramIdx++}`);
      values.push(from);
    }
    if (to) {
      conditions.push(`created_at <= $${paramIdx++}`);
      values.push(to);
    }
    if (eventType) {
      conditions.push(`event_type = $${paramIdx++}`);
      values.push(eventType);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    values.push(limit, offset);
    const entries = await queryAsAdmin(
      `SELECT id as event_id, created_at as timestamp, event_type,
              team_id, admin_username as admin_id, event_data as details, round
       FROM audit_log ${where}
       ORDER BY created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      values
    );

    return jsonResponse({ entries, page, limit });
  } catch (error) {
    return handleApiError(error);
  }
}
