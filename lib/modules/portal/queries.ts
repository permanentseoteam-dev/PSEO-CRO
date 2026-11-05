import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/auth/can";
import type { Me } from "@/lib/auth/perms";
import type {
  Activity,
  Approval,
  ApprovalFile,
  BrandKit,
  ClientTicket,
  Folder,
  PastMeeting,
  PayChannel,
  PortalClient,
  PortalFile,
  PortalInvoice,
  PortalReceipt,
  TeamMember,
  UpcomingMeeting,
} from "./types";
import type { TicketStatus } from "./logic";

// Reads other modules' tables under RLS (a client login only gets its own client's rows):
//   clients, client_team (0108) · tickets, projects (0106/0107) · events, event_attendees (0104)
//   meetings, meeting_actions, client_folders, client_files, file_versions, brand_kits (0109)
//   invoices, invoice_lines, channels_pay (0110) · receipts, receipt_allocations (0111)
// A missing table or a denied read gives an empty list, so pages still render.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const rows = (res: { data: unknown; error: unknown }): Row[] => (res.error || !res.data ? [] : (res.data as Row[]));
const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const num = (v: unknown) => Number(v ?? 0);

/** Cookie a staff member uses to pick which client the portal preview shows. */
export const PREVIEW_COOKIE = "portal_client";

/** The client this portal view is for: a client login's own client; for staff, the picked or first client they can see. */
export async function getPortalClient(me: Me): Promise<PortalClient | null> {
  const supabase = await createClient();
  const map = (r: Row | null): PortalClient | null => (r ? { id: r.id, name: r.name, welcome: r.portal_welcome ?? null } : null);
  if (me.kind === "client") {
    if (!me.clientId) return null;
    const { data } = await supabase.from("clients").select("id, name, portal_welcome").eq("id", me.clientId).maybeSingle();
    return map(data);
  }
  const picked = (await cookies()).get(PREVIEW_COOKIE)?.value;
  if (picked && /^[0-9a-f-]{36}$/i.test(picked)) {
    const { data } = await supabase.from("clients").select("id, name, portal_welcome").eq("id", picked).maybeSingle();
    if (data) return map(data);
  }
  const { data } = await supabase.from("clients").select("id, name, portal_welcome").neq("status", "internal").order("name").limit(1);
  return map(one(data as Row[] | null));
}

/** Clients a staff member can preview. */
export async function listPreviewClients(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const res = await supabase.from("clients").select("id, name").neq("status", "internal").order("name");
  return rows(res).map((r) => ({ id: r.id, name: r.name }));
}

// ---------------------------------------------------------------- approvals and work

export async function listApprovals(clientId: string, opts: { decidedWithinDays?: number } = {}): Promise<Approval[]> {
  const supabase = await createClient();
  let q = supabase
    .from("approvals")
    .select(
      "id, title, body, files, status, sent_at, decided_at, change_note, sender:members!approvals_sent_by_fkey(name), decider:members!approvals_decided_by_fkey(name)",
    )
    .eq("client_id", clientId)
    .order("sent_at", { ascending: false });
  if (opts.decidedWithinDays != null) {
    const since = new Date(Date.now() - opts.decidedWithinDays * 86_400_000).toISOString();
    q = q.or(`status.eq.waiting,decided_at.gte.${since}`);
  }
  return rows(await q).map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    files: (Array.isArray(r.files) ? r.files : []) as ApprovalFile[],
    status: r.status,
    sentBy: one<Row>(r.sender)?.name ?? "Your team",
    sentAt: r.sent_at,
    decidedBy: one<Row>(r.decider)?.name ?? null,
    decidedAt: r.decided_at,
    changeNote: r.change_note,
  }));
}

export async function countWaitingApprovals(clientId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("approvals")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("status", "waiting");
  return error ? 0 : (count ?? 0);
}

/** Client-visible tickets. `done` picks finished ones (newest first), else open ones by due date. */
export async function listClientTickets(clientId: string, done: boolean, limit = 50): Promise<ClientTicket[]> {
  const supabase = await createClient();
  let q = supabase
    .from("tickets")
    .select("id, title, client_title, client_details, client_needs_approval, status, due_date, completed_at, assignee:members!tickets_assignee_id_fkey(name)")
    .eq("client_id", clientId)
    .eq("client_visible", true)
    .is("parent_id", null)
    .limit(limit);
  q = done
    ? q.eq("status", "done").order("completed_at", { ascending: false })
    : q.neq("status", "done").order("due_date", { ascending: true, nullsFirst: false });
  return rows(await q).map((r) => ({
    id: r.id,
    title: r.client_title || r.title,
    status: r.status as TicketStatus,
    dueDate: r.due_date,
    completedAt: r.completed_at,
    assignee: one<Row>(r.assignee)?.name ?? null,
    details: r.client_details ?? null,
    needsApproval: Boolean(r.client_needs_approval),
  }));
}

// ---------------------------------------------------------------- home

export async function listActivity(clientId: string, limit = 5): Promise<Activity[]> {
  const supabase = await createClient();
  const res = await supabase
    .from("shared_activity")
    .select("id, actor_name, action, href, happened_at")
    .eq("client_id", clientId)
    .eq("visibility", "shared")
    .order("happened_at", { ascending: false })
    .limit(limit);
  return rows(res).map((r) => ({ id: r.id, actorName: r.actor_name, action: r.action, href: r.href, happenedAt: r.happened_at }));
}

const ROLE_ORDER = ["account_executive", "delivery_lead", "delivery", "backup"];
const ROLE_LABEL: Record<string, string> = {
  account_executive: "Account executive",
  delivery_lead: "Lead specialist",
  delivery: "Specialist",
  backup: "Backup",
};

export async function listTeam(clientId: string): Promise<TeamMember[]> {
  const supabase = await createClient();
  const res = await supabase.from("client_team").select("role, member:members(id, name, title)").eq("client_id", clientId);
  return rows(res)
    .filter((r) => one<Row>(r.member))
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
    .map((r) => {
      const m = one<Row>(r.member)!;
      return { id: m.id, name: m.name, title: m.title ?? ROLE_LABEL[r.role] ?? null, role: r.role };
    });
}

/** Newest shared file with "report" in its name: the latest report. */
export async function latestReport(clientId: string): Promise<PortalFile | null> {
  const files = await listFiles(clientId, { nameLike: "%report%", limit: 1 });
  return files[0] ?? null;
}

// ---------------------------------------------------------------- meetings

export async function listUpcomingMeetings(clientId: string, fromIso: string, limit = 5): Promise<UpcomingMeeting[]> {
  const supabase = await createClient();
  const res = await supabase
    .from("events")
    .select("id, title, starts_at, minutes, meet_link")
    .eq("client_id", clientId)
    .eq("visibility", "client")
    .gte("starts_at", fromIso)
    .order("starts_at")
    .limit(limit);
  const evs = rows(res);
  if (!evs.length) return [];
  const att = rows(
    await supabase.from("event_attendees").select("event_id, member:members(name)").in("event_id", evs.map((e) => e.id)),
  );
  return evs.map((e) => ({
    id: e.id,
    title: e.title,
    startsAt: e.starts_at,
    minutes: e.minutes,
    meetLink: e.meet_link,
    with: att.filter((a) => a.event_id === e.id).map((a) => one<Row>(a.member)?.name).filter(Boolean) as string[],
  }));
}

export async function listPastMeetings(clientId: string, limit = 10): Promise<PastMeeting[]> {
  const supabase = await createClient();
  const ms = rows(
    await supabase
      .from("meetings")
      .select("id, title, held_at, our_people, summary, decisions")
      .eq("client_id", clientId)
      .eq("status", "reviewed")
      .order("held_at", { ascending: false })
      .limit(limit),
  );
  if (!ms.length) return [];
  const ids = [...new Set(ms.flatMap((m) => (m.our_people ?? []) as string[]))];
  const [people, todos] = await Promise.all([
    ids.length ? supabase.from("members").select("id, name").in("id", ids) : Promise.resolve({ data: [], error: null }),
    supabase
      .from("meeting_actions")
      .select("id, meeting_id, title, done, position")
      .in("meeting_id", ms.map((m) => m.id))
      .eq("outcome", "todo")
      .order("position"),
  ]);
  const names = new Map(rows(people).map((p) => [p.id as string, p.name as string]));
  const td = rows(todos);
  return ms.map((m) => ({
    id: m.id,
    title: m.title,
    heldAt: m.held_at,
    people: ((m.our_people ?? []) as string[]).map((id) => names.get(id)).filter(Boolean) as string[],
    summary: m.summary,
    decisions: m.decisions ?? [],
    todos: td.filter((t) => t.meeting_id === m.id).map((t) => ({ id: t.id, title: t.title, done: t.done })),
  }));
}

// ---------------------------------------------------------------- files

export async function listFolders(clientId: string): Promise<Folder[]> {
  const supabase = await createClient();
  const [folders, files] = await Promise.all([
    supabase.from("client_folders").select("id, name, kind, position").eq("client_id", clientId).eq("client_visible", true).order("position").order("name"),
    supabase.from("client_files").select("folder_id").eq("client_id", clientId).eq("shared", true),
  ]);
  const counts = new Map<string, number>();
  for (const f of rows(files)) counts.set(f.folder_id, (counts.get(f.folder_id) ?? 0) + 1);
  return rows(folders).map((f) => ({ id: f.id, name: f.name, kind: f.kind, count: counts.get(f.id) ?? 0 }));
}

export async function listFiles(clientId: string, opts: { folderId?: string; nameLike?: string; limit?: number } = {}): Promise<PortalFile[]> {
  const supabase = await createClient();
  let q = supabase
    .from("client_files")
    .select("id, name, folder_id, updated_at, folder:client_folders(name, client_visible)")
    .eq("client_id", clientId)
    .eq("shared", true)
    .order("updated_at", { ascending: false })
    .limit(opts.limit ?? 200);
  if (opts.folderId) q = q.eq("folder_id", opts.folderId);
  if (opts.nameLike) q = q.ilike("name", opts.nameLike);
  const files = rows(await q).filter((f) => one<Row>(f.folder)?.client_visible !== false);
  if (!files.length) return [];
  const vers = rows(
    await supabase
      .from("file_versions")
      .select("id, file_id, version, size_bytes, uploader_name, created_at, uploader:members(name)")
      .in("file_id", files.map((f) => f.id))
      .order("version", { ascending: false }),
  );
  const latest = new Map<string, Row>();
  for (const v of vers) if (!latest.has(v.file_id)) latest.set(v.file_id, v);
  return files.map((f) => {
    const v = latest.get(f.id);
    return {
      id: f.id,
      name: f.name,
      folderId: f.folder_id,
      folderName: one<Row>(f.folder)?.name ?? "",
      addedBy: (v && (one<Row>(v.uploader)?.name ?? v.uploader_name)) || "Your team",
      date: v?.created_at ?? f.updated_at,
      size: num(v?.size_bytes),
      versionId: v?.id ?? null,
    };
  });
}

export async function getBrandKit(clientId: string): Promise<BrandKit | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("brand_kits").select("colours, fonts, tone, dos, donts").eq("client_id", clientId).maybeSingle();
  if (error || !data) return null;
  const r = data as Row;
  return {
    colours: Array.isArray(r.colours) ? r.colours : [],
    fonts: r.fonts,
    tone: r.tone,
    dos: r.dos ?? [],
    donts: r.donts ?? [],
  };
}

// ---------------------------------------------------------------- invoices

export async function listInvoices(clientId: string): Promise<{ invoices: PortalInvoice[]; channels: PayChannel[]; receipts: PortalReceipt[] }> {
  const supabase = await createClient();
  const inv = rows(
    await supabase
      .from("invoices")
      .select("id, number, title, status, currency, issued_on, due_on, subtotal, discount, tax_total, total, amount_paid, written_off_amount, pay_link, channel_id")
      .eq("client_id", clientId)
      .neq("status", "draft")
      .order("issued_on", { ascending: false }),
  );
  const ids = inv.map((i) => i.id as string);
  const chIds = [...new Set(inv.map((i) => i.channel_id).filter(Boolean))] as string[];
  const [lines, channels, receipts] = await Promise.all([
    ids.length
      ? supabase.from("invoice_lines").select("invoice_id, description, amount, position").in("invoice_id", ids).order("position")
      : Promise.resolve({ data: [], error: null }),
    chIds.length ? supabase.from("channels_pay").select("id, name, account, details").in("id", chIds) : Promise.resolve({ data: [], error: null }),
    supabase
      .from("receipts")
      .select("id, receipt_no, received_on, amount, currency, receipt_allocations(invoice_id)")
      .eq("client_id", clientId)
      .eq("status", "recorded")
      .order("received_on", { ascending: false })
      .limit(20),
  ]);
  const ln = rows(lines);
  const numbers = new Map(inv.map((i) => [i.id as string, i.number as string]));
  return {
    invoices: inv.map((i) => ({
      id: i.id,
      number: i.number ?? "",
      title: i.title ?? "",
      status: i.status,
      currency: i.currency,
      issuedOn: i.issued_on,
      dueOn: i.due_on,
      subtotal: num(i.subtotal),
      discount: num(i.discount),
      taxTotal: num(i.tax_total),
      total: num(i.total),
      amountPaid: num(i.amount_paid),
      writtenOff: num(i.written_off_amount),
      payLink: i.pay_link,
      channelId: i.channel_id,
      lines: ln.filter((l) => l.invoice_id === i.id).map((l) => ({ description: l.description, amount: num(l.amount) })),
    })),
    channels: rows(channels).map((c) => ({ id: c.id, name: c.name, account: c.account, details: c.details })),
    receipts: rows(receipts).map((r) => ({
      id: r.id,
      no: r.receipt_no,
      receivedOn: r.received_on,
      amount: num(r.amount),
      currency: r.currency,
      invoiceNumbers: ((r.receipt_allocations ?? []) as Row[]).map((a) => numbers.get(a.invoice_id)).filter(Boolean) as string[],
    })),
  };
}

/** Signed-in member and the client this portal page shows (null when there is none). */
export async function portalContext(): Promise<{ me: Me; client: PortalClient | null }> {
  const me = await requireMe();
  return { me, client: await getPortalClient(me) };
}
