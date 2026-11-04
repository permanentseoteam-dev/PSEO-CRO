import { NextResponse } from "next/server";
import { getMe } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";

/** GET /portal/files/download/:versionId -> short-lived signed Storage URL. RLS decides who may read the version. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getMe();
  if (!me) return new Response("Sign in first.", { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("File not found.", { status: 404 });

  const supabase = await createClient();
  const { data: v } = await supabase.from("file_versions").select("path, file:client_files(name)").eq("id", id).maybeSingle();
  if (!v) return new Response("File not found.", { status: 404 });
  const file = Array.isArray(v.file) ? v.file[0] : v.file;
  const name = (file as { name?: string } | null)?.name ?? "file";

  const { data, error } = await supabase.storage.from("client-files").createSignedUrl(v.path as string, 60, { download: name });
  if (error || !data) return new Response("File not found.", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
