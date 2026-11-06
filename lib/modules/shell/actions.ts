"use server";
import { z } from "zod";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMe, can } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { MAX_PINS, timerMinutes } from "./logic";
import { newTicketAssignee } from "@/lib/modules/tickets/assignment";
import type { PaletteItem, TicketOptions } from "./types";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const BAD = { ok: false as const, error: "Check the form and try again." };
const NO = { ok: false as const, error: "You don't have access to do that." };
const refresh = () => revalidatePath("/", "layout");

// ---------------------------------------------------------------- status, sidebar, theme

const Presence = z.enum(["available", "meeting", "focus", "away", "sick"]);
export async function setPresence(raw: unknown): Promise<Result> {
  const p = Presence.safeParse(raw);
  if (!p.success) return BAD;
  const me = await getMe();
  if (!me) return NO;
  const supabase = await createClient();
  const { error } = await supabase.from("members").update({ presence: p.data }).eq("id", me.id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

const Sidebar = z.object({ collapsed: z.boolean(), folded: z.array(z.string().max(40)).max(20) });
export async function saveSidebar(raw: unknown): Promise<Result> {
  const s = Sidebar.safeParse(raw);
  if (!s.success) return BAD;
  const me = await getMe();
  if (!me) return NO;
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_settings")
    .upsert({ member_id: me.id, sidebar_collapsed: s.data.collapsed, folded_groups: s.data.folded });
  return error ? { ok: false, error: error.message } : { ok: true };
}

const ThemeIn = z.enum(["system", "light", "dark"]);
export async function setTheme(raw: unknown): Promise<Result> {
  const t = ThemeIn.safeParse(raw);
  if (!t.success) return BAD;
  const me = await getMe();
  if (!me) return NO;
  const jar = await cookies();
  if (t.data === "system") jar.delete("theme");
  else jar.set("theme", t.data, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const supabase = await createClient();
  await supabase.from("user_settings").upsert({ member_id: me.id, theme: t.data });
  return { ok: true };
}

// ---------------------------------------------------------------- pins

const PinIn = z.object({ href: z.string().startsWith("/").max(300), title: z.string().min(1).max(80) });
export async function togglePin(raw: unknown): Promise<Result<{ pinned: boolean }>> {
  const p = PinIn.safeParse(raw);
  if (!p.success) return BAD;
  const me = await getMe();
  if (!me) return NO;
  const supabase = await createClient();
  const { data: rows } = await supabase.from("pins").select("href, position").eq("member_id", me.id);
  const list = (rows ?? []) as { href: string; position: number }[];
  if (list.some((r) => r.href === p.data.href)) {
    const { error } = await supabase.from("pins").delete().eq("member_id", me.id).eq("href", p.data.href);
    if (error) return { ok: false, error: error.message };
    refresh();
    return { ok: true, data: { pinned: false } };
  }
  if (list.length >= MAX_PINS) return { ok: false, error: `You can pin up to ${MAX_PINS} pages` };
  const position = list.reduce((m, r) => Math.max(m, r.position + 1), 0);
  const { error } = await supabase.from("pins").insert({ member_id: me.id, href: p.data.href, title: p.data.title, position });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, data: { pinned: true } };
}

// ---------------------------------------------------------------- notifications

export async function markRead(raw: unknown): Promise<Result> {
  const id = z.string().uuid().safeParse(raw);
  if (!id.success) return BAD;
  const me = await getMe();
  if (!me) return NO;
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id.data)
    .eq("member_id", me.id)
    .is("read_at", null);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function markAllRead(): Promise<Result> {
  const me = await getMe();
  if (!me) return NO;
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("member_id", me.id)
    .is("read_at", null);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- clock and timer (Personal module tables)

export async function toggleClock(): Promise<Result<{ clockedIn: boolean }>> {
  const me = await getMe();
  if (!me || me.kind !== "staff") return NO;
  const supabase = await createClient();
  const { data: open, error: readErr } = await supabase
    .from("attendance")
    .select("id")
    .eq("member_id", me.id)
    .is("clock_out", null)
    .limit(1)
    .maybeSingle();
  if (readErr) return { ok: false, error: "Clock-in isn't available yet." };
  const now = new Date().toISOString();
  const { error } = open
    ? await supabase.from("attendance").update({ clock_out: now }).eq("id", (open as { id: string }).id)
    : await supabase.from("attendance").insert({ member_id: me.id, clock_in: now });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, data: { clockedIn: !open } };
}

export async function heartbeat(raw: unknown): Promise<Result> {
  const id = z.string().uuid().safeParse(raw);
  if (!id.success) return BAD;
  const me = await getMe();
  if (!me) return NO;
  const supabase = await createClient();
  const { error } = await supabase.from("timers").update({ heartbeat_at: new Date().toISOString() }).eq("id", id.data).eq("member_id", me.id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Stops the running timer and logs whole minutes to the ticket. Under 1 minute logs nothing. */
export async function stopTimer(raw: unknown): Promise<Result<{ minutes: number }>> {
  const id = z.string().uuid().safeParse(raw);
  if (!id.success) return BAD;
  const me = await getMe();
  if (!me || me.kind !== "staff") return NO;
  const supabase = await createClient();
  const { data: t, error: readErr } = await supabase
    .from("timers")
    .select("id, ticket_id, started_at")
    .eq("id", id.data)
    .eq("member_id", me.id)
    .maybeSingle();
  if (readErr || !t) return { ok: false, error: "That timer has already stopped." };
  const timer = t as { id: string; ticket_id: string | null; started_at: string };
  const now = new Date();
  const minutes = timerMinutes(timer.started_at, now);
  if (minutes > 0 && timer.ticket_id) {
    const { error } = await supabase.from("time_entries").insert({
      member_id: me.id,
      ticket_id: timer.ticket_id,
      minutes,
      date: now.toISOString().slice(0, 10),
    });
    if (error) return { ok: false, error: error.message };
  }
  const { error } = await supabase.from("timers").delete().eq("id", timer.id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, data: { minutes } };
}

// ---------------------------------------------------------------- search palette

export async function paletteData(): Promise<PaletteItem[]> {
  const me = await getMe();
  if (!me || me.kind !== "staff") return [];
  const supabase = await createClient();
  const [tickets, clients] = await Promise.all([
    supabase.from("tickets").select("key, title").order("created_at", { ascending: false }).limit(300),
    can(me, "clients.view")
      ? supabase.from("clients").select("id, name").order("name").limit(300)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const t = tickets.error ? [] : ((tickets.data ?? []) as { key: string; title: string }[]);
  const c = clients.error ? [] : ((clients.data ?? []) as { id: string; name: string }[]);
  return [
    ...t.map((x): PaletteItem => ({ section: "Task", label: `${x.key} ${x.title}`, href: `/t/${x.key}`, meta: "", icon: "Ticket" })),
    ...c.map((x): PaletteItem => ({ section: "Clients", label: x.name, href: `/clients/${x.id}`, meta: "", icon: "Building2" })),
  ];
}

// ---------------------------------------------------------------- new ticket

export async function newTicketOptions(): Promise<TicketOptions> {
  const me = await getMe();
  if (!me || me.kind !== "staff") return { projects: [], people: [], templates: [] };
  const supabase = await createClient();
  const [projects, people, templates] = await Promise.all([
    supabase.from("projects").select("*").order("key"),
    supabase.from("members").select("id, name").eq("kind", "staff").eq("status", "active").order("name"),
    supabase.from("templates").select("*").limit(100),
  ]);
  type Tpl = { id: string; title?: string; name?: string; priority?: string | null; due_in_days?: number | null; active?: boolean };
  return {
    projects: projects.error ? [] : (projects.data ?? []).map((project) => ({ id: project.id, key: project.key, name: project.name, createdBy: project.created_by ?? null })),
    people: (people.data ?? []) as TicketOptions["people"],
    templates: templates.error
      ? []
      : ((templates.data ?? []) as Tpl[])
          .filter((x) => x.active !== false)
          .map((x) => ({ id: x.id, title: x.title ?? x.name ?? "Template", priority: x.priority ?? null, dueInDays: x.due_in_days ?? null })),
  };
}

const NewTicket = z.object({
  title: z.string().trim().min(2).max(200),
  projectId: z.string().uuid(),
  assigneeId: z.string().uuid().nullable().optional(),
  priority: z.enum(["urgent", "high", "normal", "low"]),
  due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  description: z.string().max(10000),
  doneWhen: z.string().max(500),
  tags: z.array(z.string().max(40)).max(20),
});

/** Minimal ticket insert. The Tickets module owns the full create flow (checklists, files, watchers). */
export async function createTicket(raw: unknown): Promise<Result<{ key: string }>> {
  const input = NewTicket.safeParse(raw);
  if (!input.success) return BAD;
  const me = await getMe();
  if (!me || me.kind !== "staff") return NO;
  const d = input.data;
  const supabase = await createClient();
  const assigneeId = await newTicketAssignee(supabase, d.projectId, d.assigneeId);
  const { data, error } = await supabase
    .from("tickets")
    .insert({
      project_id: d.projectId,
      title: d.title,
      description: d.description || null,
      done_when: d.doneWhen || null,
      priority: d.priority,
      status: "todo",
      assignee_id: assigneeId,
      reporter_id: me.id,
      due_date: d.due,
      tags: d.tags,
    })
    .select("key")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tickets");
  return { ok: true, data: { key: (data as { key: string }).key } };
}

// ---------------------------------------------------------------- sign out

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
