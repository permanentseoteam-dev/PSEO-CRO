import { NextResponse } from "next/server";
import { getMe } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readPreviewCookie } from "@/lib/modules/portal/viewer";
import { resolvePortalScope } from "@/lib/modules/portal/preview";

/**
 * GET /portal/files/download/:versionId -> short-lived signed Storage URL. RLS decides who may read the version.
 * During a staff "See as client" preview the file must be shared, in a client-visible folder of the previewed client.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getMe();
  if (!me) return new Response("Sign in first.", { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("File not found.", { status: 404 });

  const scope = me.kind === "staff" ? resolvePortalScope(me, await readPreviewCookie()) : null;
  const supabase = scope?.mode === "preview" ? createAdminClient() : await createClient();
  const { data: v } = await supabase
    .from("file_versions")
    .select("path, file:client_files(name, client_id, shared, folder:client_folders(client_visible))")
    .eq("id", id)
    .maybeSingle();
  if (!v) return new Response("File not found.", { status: 404 });
  const file = (Array.isArray(v.file) ? v.file[0] : v.file) as
    | { name?: string; client_id?: string; shared?: boolean; folder?: { client_visible?: boolean } | { client_visible?: boolean }[] | null }
    | null;
  if (scope?.mode === "preview") {
    const folder = Array.isArray(file?.folder) ? file?.folder[0] : file?.folder;
    if (!file || file.client_id !== scope.clientId || !file.shared || !folder?.client_visible) return new Response("File not found.", { status: 404 });
  }
  const name = file?.name ?? "file";

  const { data, error } = await supabase.storage.from("client-files").createSignedUrl(v.path as string, 60, { download: name });
  if (error || !data) return new Response("File not found.", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
