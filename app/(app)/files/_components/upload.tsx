"use client";

import { useRef, useState, useTransition } from "react";
import { Button, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { storageName } from "@/lib/modules/clientops/logic";
import { recordUpload } from "../actions";
import s from "./files.module.css";

const MAX = 50 * 1024 * 1024;

/** Uploads to Storage, then records each file (same name = new version). Returns a status message. */
async function uploadAll(files: File[], clientId: string, folderId: string): Promise<string> {
  const supabase = createClient();
  let done = 0;
  for (const f of files) {
    if (f.size > MAX) return `${f.name} is over 50 MB`;
    const path = `${clientId}/${crypto.randomUUID()}-${storageName(f.name)}`;
    const { error } = await supabase.storage.from("client-files").upload(path, f, { contentType: f.type || undefined });
    if (error) return `${f.name}: ${error.message}`;
    const res = await recordUpload({ clientId, folderId, name: f.name, path, size: f.size, mime: f.type || null });
    if (!res.ok) {
      await supabase.storage.from("client-files").remove([path]);
      return `${f.name}: ${res.error}`;
    }
    done++;
  }
  return `${done} file${done === 1 ? "" : "s"} uploaded`;
}

function useUpload(clientId: string, folderId: string | null) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const run = (list: FileList | null) => {
    const files = list ? [...list] : [];
    if (!files.length) return;
    if (!folderId) return toast("Create a folder first");
    start(async () => toast(await uploadAll(files, clientId, folderId)));
  };
  return { pending, run };
}

export function UploadButton({ clientId, folderId }: { clientId: string; folderId: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const { pending, run } = useUpload(clientId, folderId);
  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          run(e.target.files);
          e.target.value = "";
        }}
      />
      <Button variant="primary" onClick={() => input.current?.click()} disabled={pending || !folderId}>
        {pending ? "Uploading…" : "Upload files"}
      </Button>
    </>
  );
}

export function DropZone({ clientId, folderId }: { clientId: string; folderId: string }) {
  const [over, setOver] = useState(false);
  const { pending, run } = useUpload(clientId, folderId);
  return (
    <div
      className={`${s.drop} ${over ? s.over : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        run(e.dataTransfer.files);
      }}
    >
      {pending ? "Uploading…" : "Drop files here to upload. Uploading a file with the same name adds a new version."}
    </div>
  );
}
