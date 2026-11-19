"use client";

import { useState, useTransition } from "react";
import { Pin, PinOff, Trash2 } from "lucide-react";
import { Button, Card, CardBody, CardHead, Checkbox, Dialog, EmptyState, Field, FormGrid, IconButton, Input, Select, Textarea, useToast } from "@/components/ui";
import { deleteAnnouncement, postAnnouncement, setAnnouncementPinned } from "../actions";
import { shortDate } from "../logic";
import type { Announcement } from "../types";

type Props = {
  items: Announcement[];
  canPost: boolean;
  /** Poster may target everyone (scope all) or only their own department. */
  canPostAll: boolean;
  myDepartmentId: string | null;
  departments: { id: string; name: string }[];
  meId: string;
  /** Wording, so the same card can serve as "Rules & policies" in General Settings. */
  labels?: Partial<typeof LABELS>;
};

const LABELS = {
  title: "Announcements",
  post: "Post announcement",
  posted: "Announcement posted",
  deleted: "Announcement deleted",
  empty: "No announcements",
  pin: "Pin to the top of Home",
};

export function AnnouncementsCard({ items, canPost, canPostAll, myDepartmentId, departments, meId, labels }: Props) {
  const L = { ...LABELS, ...labels };
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const audienceOptions = canPostAll ? departments : departments.filter((d) => d.id === myDepartmentId);

  function submit(form: HTMLFormElement) {
    const f = new FormData(form);
    const dept = String(f.get("audience") ?? "");
    start(async () => {
      const r = await postAnnouncement({
        title: f.get("title"),
        body: f.get("body") ?? "",
        departmentId: dept || null,
        expiresOn: f.get("expires") || null,
        pinned: f.get("pinned") === "on",
      });
      if (!r.ok) return toast(r.error);
      setOpen(false);
      toast(L.posted);
    });
  }

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    start(async () => {
      const r = await fn();
      toast(r.ok ? done : (r.error ?? "Something went wrong"));
    });
  }

  return (
    <Card>
      <CardHead title={L.title} actions={canPost ? <Button size="sm" onClick={() => setOpen(true)}>{L.post}</Button> : null} />
      <CardBody className="stack">
        {items.length === 0 ? (
          <EmptyState title={L.empty} />
        ) : (
          items.map((a) => {
            const mine = canPostAll || a.author_id === meId;
            return (
              <div key={a.id} className={a.pinned ? "rounded-lg bg-accent-soft p-3" : "rounded-lg bg-surface-2 p-3"}>
                <div className="between row">
                  <strong className="min-w-0 break-words">{a.title}</strong>
                  {canPost && mine ? (
                    <span className="row" style={{ gap: 4 }}>
                      <IconButton
                        size="sm"
                        label={a.pinned ? "Unpin" : "Pin to the top"}
                        disabled={pending}
                        onClick={() => act(() => setAnnouncementPinned({ id: a.id, pinned: !a.pinned }), a.pinned ? "Unpinned" : "Pinned")}
                      >
                        {a.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                      </IconButton>
                      <IconButton size="sm" label="Delete" disabled={pending} onClick={() => act(() => deleteAnnouncement({ id: a.id }), L.deleted)}>
                        <Trash2 size={14} />
                      </IconButton>
                    </span>
                  ) : null}
                </div>
                {a.body ? <div className="small whitespace-pre-line break-words">{a.body}</div> : null}
                <div className="small muted">
                  {[a.author_name, shortDate(a.created_at), a.department_name ?? "Everyone", a.pinned ? "Pinned" : null, a.expires_on ? `Expires ${shortDate(a.expires_on)}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
            );
          })
        )}
      </CardBody>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={L.post}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="pp2-announce" disabled={pending}>{L.post}</Button>
          </>
        }
      >
        <form
          id="pp2-announce"
          onSubmit={(e) => {
            e.preventDefault();
            submit(e.currentTarget);
          }}
        >
          <FormGrid>
            <Field label="Title" htmlFor="pp2-a-title" full>
              <Input id="pp2-a-title" name="title" required maxLength={140} />
            </Field>
            <Field label="Message" htmlFor="pp2-a-body" full>
              <Textarea id="pp2-a-body" name="body" rows={4} maxLength={4000} />
            </Field>
            <Field label="Audience" htmlFor="pp2-a-aud">
              <Select id="pp2-a-aud" name="audience" defaultValue={canPostAll ? "" : (myDepartmentId ?? "")}>
                {canPostAll ? <option value="">Everyone</option> : null}
                {audienceOptions.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Expires" htmlFor="pp2-a-exp">
              <Input id="pp2-a-exp" name="expires" type="date" />
            </Field>
            <Checkbox name="pinned" label={L.pin} />
          </FormGrid>
        </form>
      </Dialog>
    </Card>
  );
}
