"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, Dialog, Field, FormGrid, Input, Textarea, useToast } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { QaChecklist } from "@/lib/modules/work/types";
import { saveQaChecklist, setQaChecklistActive } from "../actions";

/** "QA checklists" button and its editor: list, switch on/off, add and edit. */
export function QaChecklistsButton({ lists }: { lists: QaChecklist[] }) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<QaChecklist | "new" | null>(null);
  const [pending, start] = useTransition();

  const after = (msg: string) => (r: { ok: boolean; error?: string }) => {
    toast(r.ok ? msg : (r.error ?? "Couldn't save"));
    if (r.ok) {
      setEditing(null);
      router.refresh();
    }
  };

  function toggle(c: QaChecklist) {
    start(async () => after(c.active ? "Checklist switched off" : "Checklist switched on")(await setQaChecklistActive({ id: c.id, active: !c.active })));
  }

  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const s = (k: string) => String(fd.get(k) ?? "");
    start(async () =>
      after("Checklist saved")(
        await saveQaChecklist({ id: editing === "new" ? null : (editing?.id ?? null), name: s("name"), services: s("services"), items: s("items") }),
      ),
    );
  }

  const close = () => {
    setOpen(false);
    setEditing(null);
  };
  const ed = editing === "new" ? null : editing;

  return (
    <>
      <Button onClick={() => setOpen(true)}>QA checklists</Button>
      <Dialog
        open={open}
        onClose={close}
        title={editing ? (ed ? "Edit checklist" : "New checklist") : "QA checklists"}
        footer={
          editing ? (
            <>
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Back
              </Button>
              <Button variant="primary" type="submit" form="qa-form" disabled={pending}>
                Save checklist
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={close}>
                Close
              </Button>
              <Button variant="primary" onClick={() => setEditing("new")}>
                New checklist
              </Button>
            </>
          )
        }
      >
        {editing ? (
          <form id="qa-form" onSubmit={save} key={ed?.id ?? "new"}>
            <FormGrid>
              <Field label="Name" htmlFor="qa-name">
                <Input id="qa-name" name="name" required minLength={2} maxLength={80} defaultValue={ed?.name} />
              </Field>
              <Field label="Services" htmlFor="qa-svc" hint="Separate with commas, like SEO, Content.">
                <Input id="qa-svc" name="services" defaultValue={ed?.services.join(", ")} />
              </Field>
              <Field label="Checks (one per line)" htmlFor="qa-items" full>
                <Textarea id="qa-items" name="items" rows={7} required defaultValue={ed?.items.join("\n")} />
              </Field>
            </FormGrid>
          </form>
        ) : lists.length ? (
          <div className="stack">
            {lists.map((c) => (
              <Card key={c.id} className={cn(!c.active && "opacity-60")}>
                <CardBody className="row between">
                  <div>
                    <b>{c.name}</b>
                    <div className="muted small">
                      {c.services.join(", ") || "Any service"} · {c.items.length} checks
                      {c.active ? "" : " · Switched off"}
                    </div>
                  </div>
                  <div className="row">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>
                      Edit
                    </Button>
                    <Button size="sm" disabled={pending} onClick={() => toggle(c)}>
                      {c.active ? "Switch off" : "Switch on"}
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        ) : (
          <p className="muted m-0">No checklists yet. Add one for each kind of work you review.</p>
        )}
      </Dialog>
    </>
  );
}
