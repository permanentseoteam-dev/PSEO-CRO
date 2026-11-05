import { StatusDot, Table, Td, Th } from "@/components/ui";
import { can, getMe } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { agoLabel, STATUS_LABEL, withLastRuns, type JobRunRow } from "../logic";

/**
 * Settings -> Scheduled jobs (admins only, read-only). Each job with its schedule (Dubai time) and its last run.
 * Reads the job_last_runs view under the admin's RLS. Renders only the table: Settings wraps it in its own card and title.
 */
export async function ScheduledJobsSection() {
  const me = await getMe();
  if (!me || me.kind !== "staff" || !can(me, "admin.access.manage", "all")) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("job_last_runs").select("job, started_at, finished_at, status, detail");
  const rows = withLastRuns((data ?? []) as JobRunRow[]);
  const now = new Date();

  return (
    <Table>
      <thead>
        <tr>
          <Th>Job</Th>
          <Th hideSm>Schedule (Dubai)</Th>
          <Th>Last run</Th>
          <Th>Result</Th>
          <Th hideSm>Detail</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ job, last }) => (
          <tr key={job.name}>
            <Td>{job.label}</Td>
            <Td hideSm className="whitespace-nowrap">{job.schedule}</Td>
            <Td className="num whitespace-nowrap">
              {last ? <time dateTime={last.started_at} title={last.started_at}>{agoLabel(last.started_at, now)}</time> : "Never"}
            </Td>
            <Td>{last ? <StatusDot tone={STATUS_LABEL[last.status].tone}>{STATUS_LABEL[last.status].label}</StatusDot> : null}</Td>
            <Td hideSm>{last?.detail ?? ""}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
