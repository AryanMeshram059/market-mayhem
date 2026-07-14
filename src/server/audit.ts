import { query } from './db';

export async function audit(event: {
  event_type: string;
  team_id?: number | null;
  admin_username?: string | null;
  round?: number | null;
  event_data: Record<string, unknown>;
}): Promise<void> {
  await query(
    `INSERT INTO audit_log
       (event_type, team_id, admin_username, round, event_data, created_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, NOW())`,
    [
      event.event_type,
      event.team_id ?? null,
      event.admin_username ?? null,
      event.round ?? null,
      JSON.stringify(event.event_data),
    ]
  ).catch((error) => {
    console.error('audit_log write failed', error);
  });
}
