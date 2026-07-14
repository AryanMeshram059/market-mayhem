import { authenticateAdmin } from '@/server/auth';
import { storeSchedule } from '@/server/engine/schedule';
import { authHeader, fail, ok } from '@/server/http';

export async function POST(request: Request) {
  try {
    const admin = await authenticateAdmin(authHeader(request));
    const schedule = await request.json();
    const schedule_id = await storeSchedule(schedule, admin);
    return ok({ schedule_id, locked: true });
  } catch (error) {
    return fail(error);
  }
}
