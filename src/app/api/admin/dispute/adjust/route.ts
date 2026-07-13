import { authenticateAdminRequest } from '@/services/auth';
import { auditLog } from '@/services/auditLog';
import { withTransaction } from '@/lib/db';
import { getAuthHeader, handleApiError, jsonResponse } from '@/lib/api';

export async function POST(request: Request) {
  try {
    const adminUsername = await authenticateAdminRequest(getAuthHeader(request));
    const body = await request.json();
    const { team_id, adjustment_type, fund_id, amount, justification } = body;

    if (!team_id || !adjustment_type || amount === undefined || !justification) {
      return jsonResponse({ error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } }, 400);
    }

    let newBalance = 0;

    await withTransaction(async (client) => {
      if (adjustment_type === 'cash') {
        const result = await client.query(
          `UPDATE portfolios SET cash = cash + $1, last_updated = NOW()
           WHERE team_id = $2 AND cash + $1 >= 0
           RETURNING cash`,
          [amount, team_id]
        );
        if (result.rows.length === 0) {
          throw new Error('Adjustment would create negative cash balance');
        }
        newBalance = Number(result.rows[0].cash);
      } else if (adjustment_type === 'fund' && fund_id) {
        const result = await client.query(
          `UPDATE holdings SET quantity = quantity + $1, last_updated = NOW()
           WHERE team_id = $2 AND fund_id = $3 AND quantity + $1 >= 0
           RETURNING quantity`,
          [amount, team_id, fund_id]
        );
        if (result.rows.length === 0) {
          throw new Error('Adjustment would create negative holdings');
        }
        newBalance = Number(result.rows[0].quantity);
      } else {
        throw new Error('Invalid adjustment type');
      }
    }, { role: 'admin' });

    await auditLog('manual_adjustment', {
      adminUsername,
      teamId: team_id,
      details: { adjustment_type, fund_id, amount, justification },
    });

    return jsonResponse({ success: true, new_balance: newBalance });
  } catch (error) {
    return handleApiError(error);
  }
}
