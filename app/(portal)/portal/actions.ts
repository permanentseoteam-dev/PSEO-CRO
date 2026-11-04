"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getMe, can } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { PREVIEW_COOKIE } from "@/lib/modules/portal/queries";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const NO_ACCESS = "You don't have access to do that.";
const CHECK = "Check the form and try again.";

async function clientMe() {
  const me = await getMe();
  return me && me.kind === "client" && me.clientId ? me : null;
}

const Decide = z.object({
  id: z.string().uuid(),
  decision: z.enum(["approved", "changes"]),
  note: z.string().trim().max(2000).optional(),
});

/** Approve, or ask for changes with a note. */
export async function decideApproval(raw: unknown): Promise<Result> {
  const p = Decide.safeParse(raw);
  if (!p.success) return { ok: false, error: CHECK };
  if (p.data.decision === "changes" && !p.data.note) return { ok: false, error: "Say what we should change." };
  const me = await clientMe();
  if (!me || !can(me, "portal.approve")) return { ok: false, error: NO_ACCESS };
  const supabase = await createClient();
  const { error } = await supabase.rpc("portal_decide", { p_approval: p.data.id, p_decision: p.data.decision, p_note: p.data.note ?? null });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/portal", "layout");
  return { ok: true };
}

const Request = z.object({
  what: z.string().trim().min(3, "Tell us what you need.").max(4000),
  due: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

async function sendRequest(what: string, due: string | undefined): Promise<Result<{ key: string }>> {
  const me = await clientMe();
  if (!me) return { ok: false, error: NO_ACCESS };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_request_work", { p_what: what, p_due: due ?? null });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/portal", "layout");
  return { ok: true, data: { key: String(data ?? "") } };
}

/** Request new work: opens a ticket for the team and starts the reply clock. */
export async function requestWork(raw: unknown): Promise<Result<{ key: string }>> {
  const p = Request.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? CHECK };
  return sendRequest(p.data.what, p.data.due);
}

const Book = z.object({
  topic: z.string().trim().min(3, "Add a topic.").max(200),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a day."),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  attendees: z.array(z.string().trim().min(1).max(120)).max(20),
  note: z.string().trim().max(2000).optional(),
});

/** Book a meeting: sent to the team as a request, so it gets a reply clock like any other request. */
export async function bookMeeting(raw: unknown): Promise<Result<{ key: string }>> {
  const p = Book.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? CHECK };
  const { topic, day, time, attendees, note } = p.data;
  const what = [
    `Meeting request: ${topic}`,
    `Preferred: ${day} at ${time} (Dubai time)`,
    attendees.length ? `Attendees: ${attendees.join(", ")}` : "",
    note ? `Note: ${note}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return sendRequest(what, day);
}

const Todo = z.object({ id: z.string().uuid(), done: z.boolean() });

/** Tick a meeting to-do done or not done. */
export async function setTodo(raw: unknown): Promise<Result> {
  const p = Todo.safeParse(raw);
  if (!p.success) return { ok: false, error: CHECK };
  const me = await clientMe();
  if (!me) return { ok: false, error: NO_ACCESS };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meeting_actions")
    .update({ done: p.data.done, done_at: p.data.done ? new Date().toISOString() : null })
    .eq("id", p.data.id)
    .eq("outcome", "todo")
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: NO_ACCESS };
  revalidatePath("/portal/meetings");
  return { ok: true };
}

const Uploaded = z.object({
  path: z.string().min(40).max(400),
  name: z.string().trim().min(1).max(200),
  size: z.number().int().min(0).max(52_428_800),
  mime: z.string().max(200).optional(),
});

/** Register a file the client just uploaded to Storage: it lands in their "From the client" folder. */
export async function addUploadedFile(raw: unknown): Promise<Result> {
  const p = Uploaded.safeParse(raw);
  if (!p.success) return { ok: false, error: CHECK };
  const me = await clientMe();
  if (!me) return { ok: false, error: NO_ACCESS };
  if (!p.data.path.startsWith(`${me.clientId}/`)) return { ok: false, error: NO_ACCESS };

  const supabase = await createClient();
  const { data: folder } = await supabase
    .from("client_folders")
    .select("id")
    .eq("client_id", me.clientId!)
    .eq("kind", "from_client")
    .eq("client_visible", true)
    .order("position")
    .limit(1)
    .maybeSingle();
  if (!folder) return { ok: false, error: "There is no folder for your uploads yet. Ask your team to add one." };

  const { data: file, error } = await supabase
    .from("client_files")
    .insert({ client_id: me.clientId, folder_id: folder.id, name: p.data.name, shared: true, created_by: me.id })
    .select("id")
    .single();
  if (error || !file) return { ok: false, error: error?.message ?? "Upload failed." };

  const { error: vErr } = await supabase.from("file_versions").insert({
    file_id: file.id,
    version: 1,
    path: p.data.path,
    size_bytes: p.data.size,
    mime: p.data.mime || null,
    uploaded_by: me.id,
  });
  if (vErr) return { ok: false, error: vErr.message };

  await supabase.rpc("portal_file_added", { p_file: file.id });
  revalidatePath("/portal", "layout");
  return { ok: true };
}

/** Staff only: pick which client the portal preview shows. */
export async function setPreviewClient(raw: unknown): Promise<Result> {
  const p = z.string().uuid().safeParse(raw);
  if (!p.success) return { ok: false, error: CHECK };
  const me = await getMe();
  if (!me || me.kind !== "staff" || !can(me, "clients.view")) return { ok: false, error: NO_ACCESS };
  (await cookies()).set(PREVIEW_COOKIE, p.data, { path: "/portal", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  revalidatePath("/portal", "layout");
  return { ok: true };
}
