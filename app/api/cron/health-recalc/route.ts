import { runCronJob } from "@/features/jobs/run";

// Nightly client health recalculation (01:30 Dubai, before the 02:00 client-health-snapshot job).
// Same handler as app/api/cron/[job]; kept as its own route so the path is explicit.
export const maxDuration = 60;

export async function POST(req: Request) {
  return runCronJob(req, "health-recalc");
}
