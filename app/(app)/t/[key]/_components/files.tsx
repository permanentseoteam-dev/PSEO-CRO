"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { Button, Card, CardBody, CardHead, Dialog, useToast } from "@/components/ui";
import { deleteAttachment } from "@/lib/modules/tickets/actions";
import { isImage } from "@/lib/modules/tickets/logic";
import { uploadTicketFiles } from "@/lib/modules/tickets/upload";
import type { Attachment } from "@/lib/modules/tickets/types";
import s from "./ticket.module.css";

const size = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Files (2 MB each, risky types blocked) with an image viewer. */
export function Files({ ticketId, files, canDelete }: { ticketId: string; files: Attachment[]; canDelete: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [at, setAt] = useState<number | null>(null);
  const cur = at == null ? null : files[at];

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const list = [...(e.target.files ?? [])];
    e.target.value = "";
    if (!list.length) return;
    start(async () => {
      const r = await uploadTicketFiles(ticketId, list);
      toast(r.problems.length ? r.problems[0] : `Uploaded ${r.added} ${r.added === 1 ? "file" : "files"}`);
      router.refresh();
    });
  }

  function remove(f: Attachment) {
    start(async () => {
      const r = await deleteAttachment(f.id);
      toast(r.ok ? `Removed ${f.name}` : r.error);
      if (r.ok) setAt(null);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHead
        title="Files"
        actions={
          <>
            <input ref={input} type="file" multiple hidden onChange={onPick} />
            <Button size="sm" variant="ghost" onClick={() => input.current?.click()} disabled={pending}>{pending ? "Uploading…" : "Upload"}</Button>
          </>
        }
      />
      <CardBody>
        {files.length ? (
          <div className={s.thumbs}>
            {files.map((f, i) => (
              <button key={f.id} type="button" className={s.thumb} onClick={() => setAt(i)} title={f.name}>
                <span className={s.pic}>
                  {f.url && isImage(f.mime, f.name) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.url} alt="" loading="lazy" />
                  ) : (
                    <FileText size={28} aria-hidden="true" />
                  )}
                </span>
                <span>{f.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>No files yet. Up to 2 MB each.</p>
        )}
      </CardBody>

      <Dialog
        open={cur != null}
        onClose={() => setAt(null)}
        title={cur?.name ?? ""}
        wide
        footer={
          cur ? (
            <>
              <span className="muted small" style={{ marginRight: "auto" }}>{(at ?? 0) + 1} of {files.length} · {size(cur.size)}</span>
              {files.length > 1 ? (
                <>
                  <Button onClick={() => setAt(((at ?? 0) + files.length - 1) % files.length)}>Previous</Button>
                  <Button onClick={() => setAt(((at ?? 0) + 1) % files.length)}>Next</Button>
                </>
              ) : null}
              {canDelete ? <Button variant="danger" onClick={() => remove(cur)} disabled={pending}>Delete</Button> : null}
              {cur.url ? <a className="btn primary" href={cur.url} download={cur.name} target="_blank" rel="noreferrer">Download</a> : null}
            </>
          ) : null
        }
      >
        {cur ? (
          <div className={s.viewer}>
            {cur.url && isImage(cur.mime, cur.name) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cur.url} alt={cur.name} />
            ) : (
              <div className="stack" style={{ justifyItems: "center", padding: 24, textAlign: "center" }}>
                <FileText size={40} aria-hidden="true" />
                <span className="muted">No preview for this file type.</span>
              </div>
            )}
          </div>
        ) : null}
      </Dialog>
    </Card>
  );
}
