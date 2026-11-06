"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, CardHead, Textarea, useToast } from "@/components/ui";
import { updateTicket } from "@/lib/modules/tickets/actions";
import s from "./ticket.module.css";

export function Description({ id, description, canEdit }: { id: string; description: string | null; doneWhen: string | null; canEdit: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await updateTicket({
        id,
        patch: { description: String(fd.get("description") ?? "") || null },
      });
      if (!r.ok) return toast(r.error);
      setEditing(false);
      toast("Description saved");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHead title="Description" actions={canEdit && !editing ? <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit</Button> : null} />
      <CardBody>
        {editing ? (
          <form className="stack" onSubmit={save}>
            <Textarea name="description" rows={5} maxLength={10000} defaultValue={description ?? ""} aria-label="Description" autoFocus />
            <div className="row">
              <Button size="sm" variant="primary" type="submit" disabled={pending}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </form>
        ) : (
          <div className="stack">
            {description ? <p className={s.pre}>{description}</p> : <p className="muted" style={{ margin: 0 }}>No description yet.</p>}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
