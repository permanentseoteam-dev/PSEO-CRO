import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { APP_JOBS } from "./handlers";
import { bearerOk, isAppJob, type JobOutcome } from "./logic";

/**
 * Shared body of every app/api/cron/* route: checks "Authorization: Bearer $CRON_SECRET", runs the job with the
 * service client and writes one job_runs row. Called by pg_cron through pg_net (see 0210_scheduled_jobs.sql).
 */
export async function runCronJob(req: Request, job: string): Promise<Response> {
  if (!bearerOk(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAppJob(job)) return Response.json({ error: "Unknown job" }, { status: 404 });

  const db = createAdminClient();
  const started = new Date();
  let out: JobOutcome;
  try {
    out = await APP_JOBS[job]({ db, now: started });
  } catch (e) {
    out = { status: "error", detail: e instanceof Error ? e.message : String(e) };
  }
  const { error } = await db.from("job_runs").insert({
    job,
    started_at: started.toISOString(),
    finished_at: new Date().toISOString(),
    status: out.status,
    detail: out.detail.slice(0, 2000),
  });
  if (error) console.error(`job_runs insert failed for ${job}: ${error.message}`);
  return Response.json({ job, ...out }, { status: out.status === "error" ? 500 : 200 });
}
