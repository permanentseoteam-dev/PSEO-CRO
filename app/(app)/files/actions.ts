"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getMe, can } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { lines, parseColours } from "@/lib/modules/clientops/logic";
import { searchFiles as search } from "@/lib/modules/clientops/queries";

const BUCKET = "client-files";
const FORM_ERROR = { ok: false as const, error: "Check the form and try again." };
const NO_ACCESS = { ok: false as const, error: "You don't have access to do that." };
const uuid = z.string().uuid();
const fileName = z.string().trim().min(1).max(200).refine((v) => !/[\\/]/.test(v), "File names can't contain slashes.");

async function staff() {
  const me = await getMe();
  return me && me.kind === "staff" && can(me, "clients.view") ? me : null;
}
const refresh = () => revalidatePath("/files");
const dupe = (msg: string) => (msg.includes("duplicate") ? "A file or folder with that name is already there." : msg);

// ---------------------------------------------------------------- search
export async function searchFiles(q: string) {
  if (!(await staff())) return { hits: [], total: 0 };
  return search(String(q ?? "").slice(0, 100));
}

// ---------------------------------------------------------------- folders
const FolderInput = z.object({ clientId: uuid, name: z.string().trim().min(1).max(80), clientVisible: z.boolean() });

export async function createFolder(raw: unknown) {
  const input = FolderInput.safeParse(raw);
  if (!input.success) return FORM_ERROR;
  const me = await staff();
  if (!me) return NO_ACCESS;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_folders")
    .insert({ client_id: input.data.clientId, name: input.data.name, client_visible: input.data.clientVisible, kind: "custom", created_by: me.id })
    .select("id")
    .single();
  if (error || !data) return { ok: false as const, error: dupe(error?.message ?? "Could not create the folder.") };
  refresh();
  return { ok: true as const, id: data.id as string };
}

// ---------------------------------------------------------------- uploads (bytes go straight to Storage from the browser)
const UploadInput = z.object({
  clientId: uuid,
  folderId: uuid,
  name: fileName,
  path: z.string().min(1).max(400),
  size: z.number().int().min(0),
  mime: z.string().max(200).nullable(),
});

/** Records an uploaded object. Same name in the same folder adds a new version. */
export async function recordUpload(raw: unknown) {
  const input = UploadInput.safeParse(raw);
  if (!input.success) return FORM_ERROR;
  const me = await staff();
  if (!me) return NO_ACCESS;
  const v = input.data;
  if (!v.path.startsWith(`${v.clientId}/`)) return FORM_ERROR;
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("client_files")
    .select("id, file_versions(version)")
    .eq("folder_id", v.folderId)
    .ilike("name", v.name.replace(/[%_\\]/g, "\\$&"))
    .maybeSingle();

  let fileId = existing?.id as string | undefined;
  let version = 1;
  if (fileId) {
    version = 1 + Math.max(0, ...((existing?.file_versions as { version: number }[]) ?? []).map((x) => x.version));
    await supabase.from("client_files").update({ updated_at: new Date().toISOString() }).eq("id", fileId);
  } else {
    const { data, error } = await supabase
      .from("client_files")
      .insert({ client_id: v.clientId, folder_id: v.folderId, name: v.name, shared: false, created_by: me.id })
      .select("id")
      .single();
    if (error || !data) return { ok: false as const, error: dupe(error?.message ?? "Could not save the file.") };
    fileId = data.id as string;
  }
  const { error } = await supabase
    .from("file_versions")
    .insert({ file_id: fileId, version, path: v.path, size_bytes: v.size, mime: v.mime, uploaded_by: me.id });
  if (error) return { ok: false as const, error: error.message };
  refresh();
  return { ok: true as const, version };
}

// ---------------------------------------------------------------- file actions
export async function setShared(raw: unknown) {
  const input = z.object({ fileId: uuid, shared: z.boolean() }).safeParse(raw);
  if (!input.success) return FORM_ERROR;
  if (!(await staff())) return NO_ACCESS;
  const supabase = await createClient();
  const { error } = await supabase.from("client_files").update({ shared: input.data.shared }).eq("id", input.data.fileId);
  if (error) return { ok: false as const, error: error.message };
  refresh();
  return { ok: true as const };
}

export async function renameFile(raw: unknown) {
  const input = z.object({ fileId: uuid, name: fileName }).safeParse(raw);
  if (!input.success) return FORM_ERROR;
  if (!(await staff())) return NO_ACCESS;
  const supabase = await createClient();
  const { error } = await supabase.from("client_files").update({ name: input.data.name }).eq("id", input.data.fileId);
  if (error) return { ok: false as const, error: dupe(error.message) };
  refresh();
  return { ok: true as const };
}

/** Moves a file to another folder of the same client (Storage paths are per client). */
export async function moveFile(raw: unknown) {
  const input = z.object({ fileId: uuid, folderId: uuid }).safeParse(raw);
  if (!input.success) return FORM_ERROR;
  if (!(await staff())) return NO_ACCESS;
  const supabase = await createClient();
  const [{ data: file }, { data: folder }] = await Promise.all([
    supabase.from("client_files").select("client_id").eq("id", input.data.fileId).maybeSingle(),
    supabase.from("client_folders").select("client_id").eq("id", input.data.folderId).maybeSingle(),
  ]);
  if (!file || !folder) return { ok: false as const, error: "File or folder not found." };
  if (file.client_id !== folder.client_id) return { ok: false as const, error: "Files can only move between folders of the same client." };
  const { error } = await supabase.from("client_files").update({ folder_id: input.data.folderId }).eq("id", input.data.fileId);
  if (error) return { ok: false as const, error: dupe(error.message) };
  refresh();
  return { ok: true as const };
}

export async function removeFile(raw: unknown) {
  const input = z.object({ fileId: uuid }).safeParse(raw);
  if (!input.success) return FORM_ERROR;
  if (!(await staff())) return NO_ACCESS;
  const supabase = await createClient();
  const { data: versions } = await supabase.from("file_versions").select("path").eq("file_id", input.data.fileId);
  const { error } = await supabase.from("client_files").delete().eq("id", input.data.fileId);
  if (error) return { ok: false as const, error: error.message };
  // Restored versions share a path; remove each object once. Missing objects are ignored.
  const paths = [...new Set((versions ?? []).map((v) => v.path as string))];
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  refresh();
  return { ok: true as const };
}

/** Restore = a new version that points at the old version's object. */
export async function restoreVersion(raw: unknown) {
  const input = z.object({ versionId: uuid }).safeParse(raw);
  if (!input.success) return FORM_ERROR;
  const me = await staff();
  if (!me) return NO_ACCESS;
  const supabase = await createClient();
  const { data: old } = await supabase.from("file_versions").select("file_id, version, path, size_bytes, mime").eq("id", input.data.versionId).maybeSingle();
  if (!old) return { ok: false as const, error: "Version not found." };
  const { data: all } = await supabase.from("file_versions").select("version").eq("file_id", old.file_id);
  const next = 1 + Math.max(0, ...(all ?? []).map((x) => x.version as number));
  const { error } = await supabase
    .from("file_versions")
    .insert({ file_id: old.file_id, version: next, path: old.path, size_bytes: old.size_bytes, mime: old.mime, uploaded_by: me.id });
  if (error) return { ok: false as const, error: error.message };
  refresh();
  return { ok: true as const, version: next, from: old.version as number };
}

export async function downloadUrl(raw: unknown) {
  const input = z.object({ versionId: uuid }).safeParse(raw);
  if (!input.success) return FORM_ERROR;
  if (!(await staff())) return NO_ACCESS;
  const supabase = await createClient();
  const { data: v } = await supabase.from("file_versions").select("path, client_files(name)").eq("id", input.data.versionId).maybeSingle();
  if (!v) return { ok: false as const, error: "File not found." };
  const f = v.client_files as { name: string } | { name: string }[] | null;
  const name = (Array.isArray(f) ? f[0]?.name : f?.name) ?? undefined;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(v.path, 60, { download: name ?? true });
  if (error || !data) return { ok: false as const, error: "File not found in storage." };
  return { ok: true as const, url: data.signedUrl };
}

// ---------------------------------------------------------------- brand kit
const KitInput = z.object({
  clientId: uuid,
  colours: z.string().max(2000),
  fonts: z.string().trim().max(300),
  tone: z.string().trim().max(1000),
  dos: z.string().max(2000),
  donts: z.string().max(2000),
});

export async function saveBrandKit(raw: unknown) {
  const input = KitInput.safeParse(raw);
  if (!input.success) return FORM_ERROR;
  const me = await staff();
  if (!me) return NO_ACCESS;
  const v = input.data;
  const supabase = await createClient();
  const { error } = await supabase.from("brand_kits").upsert({
    client_id: v.clientId,
    colours: parseColours(v.colours),
    fonts: v.fonts || null,
    tone: v.tone || null,
    dos: lines(v.dos),
    donts: lines(v.donts),
    updated_by: me.id,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false as const, error: error.message };
  refresh();
  return { ok: true as const };
}
