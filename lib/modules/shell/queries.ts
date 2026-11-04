import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ClockSession, Notif, RunningTimer, ShellData } from "./types";

// Tables owned by other modules that the shell reads. Kept here so a column rename is a one-line fix.
//   attendance (0113_personal): member_id, clock_in timestamptz, clock_out timestamptz null
//   timers     (0113_personal): id, member_id, ticket_id, started_at timestamptz
//   tickets    (0106_tickets):  id, key
// If a table is missing (module not applied yet) the widget is simply hidden.

type NotifRow = {
  id: string;
  action: string;
  subject: string | null;
  detail: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
  actor: { name: string } | { name: string }[] | null;
};

export async function getShellData(memberId: string, opts: { staff: boolean }): Promise<ShellData> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 36 * 3600 * 1000).toISOString();

  const [settings, pins, notifs, unread, clock, timer] = await Promise.all([
    supabase.from("user_settings").select("sidebar_collapsed, folded_groups").eq("member_id", memberId).maybeSingle(),
    supabase.from("pins").select("href, title").eq("member_id", memberId).order("position").order("created_at"),
    supabase
      .from("notifications")
      .select("id, action, subject, detail, href, read_at, created_at, actor:members!notifications_actor_id_fkey(name)")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("member_id", memberId).is("read_at", null),
    opts.staff
      ? supabase
          .from("attendance")
          .select("clock_in, clock_out")
          .eq("member_id", memberId)
          .or(`clock_in.gte."${since}",clock_out.is.null`)
          .order("clock_in")
      : Promise.resolve({ data: null, error: null }),
    opts.staff
      ? supabase.from("timers").select("id, ticket_id, started_at").eq("member_id", memberId).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  let running: RunningTimer | null = null;
  if (!timer.error && timer.data) {
    const t = timer.data as { id: string; ticket_id: string | null; started_at: string };
    let ticketKey: string | null = null;
    if (t.ticket_id) {
      const { data } = await supabase.from("tickets").select("key").eq("id", t.ticket_id).maybeSingle();
      ticketKey = (data as { key: string } | null)?.key ?? null;
    }
    running = { id: t.id, ticketKey, startedAt: t.started_at };
  }

  return {
    settings: {
      collapsed: Boolean(settings.data?.sidebar_collapsed),
      folded: (settings.data?.folded_groups as string[] | undefined) ?? [],
    },
    pins: (pins.data ?? []) as { href: string; title: string }[],
    notifications: ((notifs.data ?? []) as NotifRow[]).map(
      (n): Notif => ({
        id: n.id,
        actor: (Array.isArray(n.actor) ? n.actor[0]?.name : n.actor?.name) ?? null,
        action: n.action,
        subject: n.subject,
        detail: n.detail,
        href: n.href,
        read: n.read_at != null,
        createdAt: n.created_at,
      }),
    ),
    unread: unread.count ?? 0,
    clock: clock.error
      ? null
      : ((clock.data ?? []) as { clock_in: string; clock_out: string | null }[]).map(
          (r): ClockSession => ({ clockIn: r.clock_in, clockOut: r.clock_out }),
        ),
    timer: running,
  };
}
