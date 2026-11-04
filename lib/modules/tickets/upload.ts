"use client";
// Browser upload to the private "ticket-files" bucket, then record the file on the ticket.
import { createClient } from "@/lib/supabase/client";
import { addAttachment } from "./actions";
import { fileProblem, storageName } from "./logic";

/** Uploads files one by one. Returns the problems (blocked type, too big, upload error) as plain messages. */
export async function uploadTicketFiles(ticketId: string, files: File[]): Promise<{ added: number; problems: string[] }> {
  const db = createClient();
  const problems: string[] = [];
  let added = 0;
  for (const f of files) {
    const problem = fileProblem(f.name, f.size);
    if (problem) {
      problems.push(problem);
      continue;
    }
    const path = `${ticketId}/${crypto.randomUUID()}-${storageName(f.name)}`;
    const up = await db.storage.from("ticket-files").upload(path, f, { contentType: f.type || undefined, upsert: false });
    if (up.error) {
      problems.push(`${f.name}: ${up.error.message}`);
      continue;
    }
    const r = await addAttachment({ ticketId, path, name: f.name, size: f.size, mime: f.type || null });
    if (r.ok) added++;
    else problems.push(`${f.name}: ${r.error}`);
  }
  return { added, problems };
}
