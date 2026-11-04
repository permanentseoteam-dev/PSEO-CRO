"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { Avatar, Button, Card, CardBody, CardHead, Checkbox, Tabs, Textarea, useToast } from "@/components/ui";
import { deleteComment, editComment, postComment } from "@/lib/modules/tickets/actions";
import { historyText } from "@/lib/modules/tickets/logic";
import type { Comment, HistoryItem } from "@/lib/modules/tickets/types";
import s from "./ticket.module.css";

type Props = { ticketId: string; comments: Comment[]; history: HistoryItem[]; names: Record<string, string>; meId: string; canModerate: boolean };

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" });

export function Activity({ ticketId, comments, history, names, meId, canModerate }: Props) {
  const toast = useToast();
  const router = useRouter();
  const [tab, setTab] = useState("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const name = (id: string | null) => (id ? names[id] ?? "someone" : "nobody");

  function post(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const r = await postComment({
        ticketId,
        body: String(fd.get("body") ?? ""),
        isUpdate: fd.get("isUpdate") === "on",
        toClient: fd.get("toClient") === "on",
      });
      if (!r.ok) return toast(r.error);
      form.reset();
      toast("Posted");
      router.refresh();
    });
  }

  function saveEdit(id: string, body: string) {
    start(async () => {
      const r = await editComment({ id, body });
      if (!r.ok) return toast(r.error);
      setEditing(null);
      router.refresh();
    });
  }

  function remove(id: string) {
    start(async () => {
      const r = await deleteComment(id);
      toast(r.ok ? "Comment deleted" : r.error);
      router.refresh();
    });
  }

  const commentEl = (c: Comment) => {
    const kind = c.toClient ? " · to client" : c.fromClient ? " · from client" : c.isUpdate ? " · progress update" : "";
    const mine = c.authorId === meId;
    return (
      <div key={`c-${c.id}`} className={s.cmt}>
        <Avatar name={c.author} size={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="small">
            <b>{c.author}</b> <span className="muted">{when(c.createdAt)}{kind}{c.editedAt ? " · edited" : ""}</span>
          </div>
          {editing === c.id ? (
            <form
              className="stack"
              style={{ marginTop: 6 }}
              onSubmit={(e) => {
                e.preventDefault();
                saveEdit(c.id, String(new FormData(e.currentTarget).get("body") ?? ""));
              }}
            >
              <Textarea name="body" rows={3} defaultValue={c.body} required maxLength={10000} aria-label="Edit comment" autoFocus />
              <div className="row">
                <Button size="sm" variant="primary" type="submit" disabled={pending}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              </div>
            </form>
          ) : (
            <p>{c.body}</p>
          )}
          <div className="row between" style={{ marginTop: 4 }}>
            {c.seenBy ? (
              <span className={s.seen}>
                <CheckCheck size={14} aria-hidden="true" style={{ verticalAlign: "-2px" }} /> Seen by {c.seenBy}
              </span>
            ) : <span />}
            {editing !== c.id && (mine || canModerate) ? (
              <span className={s.cmtActions}>
                {mine ? <button type="button" onClick={() => setEditing(c.id)}>Edit</button> : null}
                <button type="button" onClick={() => remove(c.id)} disabled={pending}>Delete</button>
              </span>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const histEl = (h: HistoryItem) => (
    <div key={`h-${h.id}`} className={s.hist}>
      {historyText(h, name)} · <span className="muted">{when(h.createdAt)}</span>
    </div>
  );

  const merged = [
    ...comments.map((c) => ({ at: c.createdAt, el: commentEl(c) })),
    ...history.map((h) => ({ at: h.createdAt, el: histEl(h) })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <Card>
      <CardHead title="Activity" />
      <CardBody className="stack">
        <Tabs
          label="Activity"
          value={tab}
          onChange={setTab}
          items={[
            { value: "all", label: "All" },
            { value: "cmt", label: "Updates & comments", count: comments.length },
            { value: "hist", label: "History" },
          ]}
        />
        <form className="stack" onSubmit={post}>
          <Textarea name="body" rows={2} required maxLength={10000} placeholder="Write an update or comment" aria-label="Comment" />
          <div className="row between">
            <span className="row">
              <Checkbox name="isUpdate" label="Progress update" />
              <Checkbox name="toClient" label="Reply to the client" />
            </span>
            <Button size="sm" variant="primary" type="submit" disabled={pending}>Post</Button>
          </div>
        </form>
        <div>
          {tab === "all" ? merged.map((m) => m.el) : null}
          {tab === "cmt" ? (comments.length ? comments.map(commentEl) : <p className="muted">No comments yet.</p>) : null}
          {tab === "hist" ? history.map(histEl) : null}
        </div>
      </CardBody>
    </Card>
  );
}
