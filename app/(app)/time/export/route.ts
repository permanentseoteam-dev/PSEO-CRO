import { getMe, can } from "@/lib/auth/can";
import { addDays, inScope, today, weekStart } from "@/lib/modules/personal/logic";
import { getEntries, listStaff } from "@/lib/modules/personal/queries";

/** CSV of the team's time entries for one week (?week=YYYY-MM-DD). */
export async function GET(req: Request) {
  const me = await getMe();
  if (!me || me.kind !== "staff" || !can(me, "time.view", "team")) return new Response("You don't have access to this.", { status: 403 });
  const q = new URL(req.url).searchParams.get("week") ?? "";
  const start = weekStart(/^\d{4}-\d{2}-\d{2}$/.test(q) ? q : today());
  const people = (await listStaff()).filter((p) => inScope(p, me, me.perms["time.view"] ?? "none"));
  const names = new Map(people.map((p) => [p.id, p.name]));
  const entries = await getEntries([...names.keys()], start, addDays(start, 6));
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : s;
  };
  const lines = [
    ["Person", "Date", "Ticket", "Title", "Minutes", "Billable"],
    ...entries.map((e) => [names.get(e.memberId) ?? "", e.date, e.ticketKey ?? "", e.ticketTitle ?? "No ticket", e.minutes, e.billable ? "Yes" : "No"]),
  ];
  return new Response(lines.map((l) => l.map(cell).join(",")).join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="timesheets-${start}.csv"`,
      "cache-control": "no-store",
    },
  });
}
