import { logAuditEvent } from '@/lib/db';
import type { RoundNumber, TeamId } from '@/types';

export type AuditEventType =
  | 'phase_transition'
  | 'order_submitted'
  | 'order_executed'
  | 'order_failed'
  | 'order_cancelled'
  | 'order_modified'
  | 'p2p_proposed'
  | 'p2p_approved'
  | 'p2p_rejected'
  | 'p2p_executed'
  | 'p2p_failed'
  | 'manual_adjustment'
  | 'admin_action'
  | 'nav_update'
  | 'login'
  | 'logout'
  | 'final_scores';

export async function auditLog(
  eventType: AuditEventType,
  data: {
    teamId?: TeamId;
    adminUsername?: string;
    round?: RoundNumber | number;
    details: Record<string, unknown>;
  }
): Promise<void> {
  await logAuditEvent({
    eventType,
    teamId: data.teamId,
    adminUsername: data.adminUsername,
    round: data.round,
    details: data.details,
  });
}
