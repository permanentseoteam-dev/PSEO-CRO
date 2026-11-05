import { runCronJob } from "@/features/jobs/run";

// Scheduled app jobs, called by pg_cron through pg_net with "Authorization: Bearer $CRON_SECRET".
// The job list and schedules: features/jobs/logic.ts (JOBS) and supabase/migrations/0210_scheduled_jobs.sql.
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ job: string }> }) {
  return runCronJob(req, (await params).job);
}
