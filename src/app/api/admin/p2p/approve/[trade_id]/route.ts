import { authenticateAdminRequest } from '@/services/auth';
import { auditLog } from '@/services/auditLog';
import { queryAsAdmin } from '@/lib/db';
import { getAuthHeader, handleApiError, jsonResponse } from '@/lib/api';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ trade_id: string }> }
) {
  try {
    const adminUsername = await authenticateAdminRequest(getAuthHeader(request));
    const { trade_id } = await params;

    const updated = await queryAsAdmin(
      `UPDATE p2p_trades SET status = 'approved', approved_by = $1, approved_at = NOW()
       WHERE id = $2 AND status = 'awaiting_approval'
       RETURNING id`,
      [adminUsername, trade_id]
    );

    if (updated.length === 0) {
      return jsonResponse({ error: { code: 'NOT_FOUND', message: 'Trade not found or already processed' } }, 404);
    }

    await auditLog('p2p_approved', {
      adminUsername,
      details: { trade_id },
    });

    return jsonResponse({ trade_id, status: 'approved' });
  } catch (error) {
    return handleApiError(error);
  }
}
