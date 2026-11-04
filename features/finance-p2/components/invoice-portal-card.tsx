"use client";

import { useRef, useTransition } from "react";
import { Upload } from "lucide-react";
import { Button, Card, CardBody, CardHead, Checkbox, StatusDot, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { setOriginalDocument, setPortalVisible } from "../actions";
import { fmtMoney } from "../logic";

type Props = {
  invoiceId: string;
  clientId: string;
  isDraft: boolean;
  visible: boolean;
  isPast: boolean;
  paidBeforePortal: number;
  currency: string;
  docName: string | null;
  docUrl: string | null;
  canEdit: boolean;
};

/** Invoice page side card: client-portal visibility and the original document. */
export function InvoicePortalCard(p: Props) {
  const [busy, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  function toggle(visible: boolean) {
    start(async () => {
      const r = await setPortalVisible({ invoiceId: p.invoiceId, visible });
      toast(r.ok ? (visible ? "Shown in the client portal" : "Hidden from the client portal") : r.error);
    });
  }

  function upload(file: File) {
    start(async () => {
      const safe = file.name.replace(/[^\w.-]+/g, "-").slice(-80);
      const path = `${p.clientId}/${p.invoiceId}/${Date.now()}-${safe}`;
      const { error } = await createClient().storage.from("invoice-originals").upload(path, file, { upsert: false });
      if (error) return toast(error.message);
      const r = await setOriginalDocument({ invoiceId: p.invoiceId, path, name: file.name });
      toast(r.ok ? "Original document saved" : r.error);
    });
  }

  return (
    <Card>
      <CardHead title="Client portal" />
      <CardBody className="stack">
        {p.isDraft ? (
          <StatusDot tone="muted">Drafts are never shown to the client</StatusDot>
        ) : p.canEdit ? (
          <Checkbox checked={p.visible} disabled={busy} onChange={(e) => toggle(e.target.checked)} label="Show this invoice in the client portal" />
        ) : (
          <StatusDot tone={p.visible ? "ok" : "muted"}>{p.visible ? "Shown in the client portal" : "Hidden from the client portal"}</StatusDot>
        )}
        {p.isPast ? (
          <span className="small muted">
            Recorded after the fact{p.paidBeforePortal ? `, ${fmtMoney(p.paidBeforePortal, p.currency)} paid before the portal` : ""}.
          </span>
        ) : null}
        <div className="between">
          {p.docUrl ? (
            <a className="small" href={p.docUrl} target="_blank" rel="noreferrer">
              Original document ({p.docName ?? "file"})
            </a>
          ) : (
            <span className="small muted">No original document</span>
          )}
          {p.canEdit ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
                  e.target.value = "";
                }}
              />
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => fileRef.current?.click()}>
                <Upload size={14} aria-hidden="true" /> {p.docUrl ? "Replace" : "Upload"}
              </Button>
            </>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
