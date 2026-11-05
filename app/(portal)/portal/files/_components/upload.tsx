"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { safeName } from "@/lib/modules/portal/logic";
import { addUploadedFile } from "../../actions";
import s from "../../portal.module.css";

const MAX = 52_428_800; // 50 MB, the client-files bucket limit

/** Drop zone: uploads to Storage (client-files/<client>/<uuid>-<name>) and registers each file. */
export function Upload({ clientId, folderName, readOnly = false }: { clientId: string; folderName: string; readOnly?: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [pending, start] = useTransition();

  const add = (list: FileList | null) => {
    if (readOnly) return;
    const files = [...(list ?? [])];
    if (!files.length) return;
    start(async () => {
      const sb = createClient();
      let ok = 0;
      for (const f of files) {
        if (f.size > MAX) {
          toast(`${f.name} is over 50 MB`);
          continue;
        }
        const path = `${clientId}/${crypto.randomUUID()}-${safeName(f.name)}`;
        const up = await sb.storage.from("client-files").upload(path, f, { contentType: f.type || undefined });
        if (up.error) {
          toast(`Could not upload ${f.name}`);
          continue;
        }
        const r = await addUploadedFile({ path, name: f.name.slice(0, 200), size: f.size, mime: f.type || undefined });
        if (!r.ok) {
          toast(r.error);
          continue;
        }
        ok++;
      }
      if (ok) {
        toast(`${ok} file${ok > 1 ? "s" : ""} added to ${folderName}`);
        router.refresh();
      }
    });
  };

  return (
    <label
      className={cn(s.drop, over && !readOnly && s.over)}
      aria-disabled={readOnly || undefined}
      onDragEnter={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        add(e.dataTransfer.files);
      }}
    >
      <input
        ref={input}
        type="file"
        multiple
        disabled={pending || readOnly}
        onChange={() => {
          add(input.current?.files ?? null);
          if (input.current) input.current.value = "";
        }}
      />
      <b>{pending ? "Uploading…" : readOnly ? "Uploads are off in this read-only preview" : "Drop files here or click to choose"}</b>
      <span className="small">Files you upload go to {folderName}</span>
    </label>
  );
}
