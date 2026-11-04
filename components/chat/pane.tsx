"use client";

import { useState } from "react";
import { ChevronLeft, FileText, Image as ImageIcon, X } from "lucide-react";
import { Avatar, Button, Checkbox, IconButton } from "@/components/ui";
import { cn } from "@/lib/utils";
import { dubai, formatSize } from "@/lib/modules/chat/logic";
import type { Person } from "@/lib/modules/chat/types";
import { Composer } from "./composer";
import { useChat } from "./context";
import { downloadFile, MessageItem, RichText } from "./message";
import s from "./chat.module.css";

export type PaneState = null | { mode: "thread"; id: number } | { mode: "pins" } | { mode: "files" };

type Props = {
  pane: Exclude<PaneState, null>;
  label: string;
  mentionPeople: Person[];
  canPost: boolean;
  onClose: () => void;
  onReply: (body: string, files: File[], parentId: number, alsoInChannel: boolean) => void;
};

/** Right-hand panel: a thread, the pinned messages or the files of the open conversation. */
export function Pane({ pane, label, mentionPeople, canPost, onClose, onReply }: Props) {
  const c = useChat();
  const [also, setAlso] = useState(false);

  const head = (title: string) => (
    <div className={s.paneHead}>
      <IconButton label="Back" className={s.paneBack} onClick={onClose}>
        <ChevronLeft size={16} />
      </IconButton>
      <h3>{title}</h3>
      <span className="small muted">{label}</span>
      <IconButton label="Close panel" className={s.paneClose} onClick={onClose}>
        <X size={16} />
      </IconButton>
    </div>
  );
  const nameOf = (id: string | null) => (id ? c.people.get(id)?.name ?? "Someone" : "Someone");

  if (pane.mode === "thread") {
    const parent = c.messages.find((m) => m.id === pane.id);
    const replies = c.messages.filter((m) => m.parentId === pane.id);
    return (
      <>
        {head("Thread")}
        <div className={s.paneBody}>
          {parent ? <MessageItem m={parent} inPane /> : <p className={cn(s.empty, "small muted")}>This message is no longer loaded.</p>}
          <div className={cn(s.paneCount, "small muted")}>
            {replies.length} {replies.length === 1 ? "reply" : "replies"}
          </div>
          {replies.length ? replies.map((r) => <MessageItem key={r.clientKey ?? r.id} m={r} inPane />) : <p className={cn(s.empty, "small muted")}>No replies yet. Start the thread.</p>}
        </div>
        {parent && canPost && !parent.deletedAt ? (
          <Composer
            draftKey={null}
            className={s.paneComp}
            placeholder="Reply in thread"
            label="Reply in thread"
            people={mentionPeople}
            submitLabel="Reply"
            onSend={(body, files) => onReply(body, files, pane.id, also)}
            bar={<Checkbox className="small" label={`Also send to ${label}`} checked={also} onChange={(e) => setAlso(e.target.checked)} />}
          />
        ) : null}
      </>
    );
  }

  if (pane.mode === "pins") {
    const pins = c.messages.filter((m) => m.pinnedAt && !m.deletedAt);
    return (
      <>
        {head("Pinned")}
        <div className={s.paneBody}>
          {pins.length ? (
            pins.map((m) => {
              const d = dubai(m.createdAt);
              return (
                <div key={m.id} className={s.paneItem}>
                  <Avatar name={nameOf(m.authorId)} size={28} />
                  <div>
                    <div className="small">
                      <b>{nameOf(m.authorId)}</b>{" "}
                      <span className="muted num">
                        {d.day.slice(5)} {d.time}
                      </span>
                    </div>
                    <div className={s.paneTxt}>{m.body ? <RichText text={m.body} /> : m.files[0]?.name}</div>
                    <div className="row">
                      <Button size="sm" variant="ghost" onClick={() => c.jumpTo(m.id)}>
                        Jump to message
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => c.togglePin(m)}>
                        Unpin
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className={cn(s.empty, "small muted")}>Nothing pinned yet. Use More on a message to pin it.</p>
          )}
        </div>
      </>
    );
  }

  const files = c.messages.filter((m) => !m.deletedAt && m.id > 0).flatMap((m) => m.files.map((f) => ({ m, f })));
  return (
    <>
      {head("Files")}
      <div className={s.paneBody}>
        {files.length ? (
          files.map(({ m, f }) => (
            <div key={f.path} className={s.paneItem}>
              <span className={s.paneFic}>{f.mime.startsWith("image/") ? <ImageIcon size={20} /> : <FileText size={20} />}</span>
              <div>
                <b className="small">{f.name}</b>
                <div className="small muted">
                  {formatSize(f.size)} · {nameOf(m.authorId)} · {dubai(m.createdAt).time}
                </div>
                <div className="row">
                  <Button size="sm" variant="ghost" onClick={() => c.jumpTo(m.parentId ?? m.id)}>
                    Show in chat
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => downloadFile(f)}>
                    Download
                  </Button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className={cn(s.empty, "small muted")}>No files shared here yet.</p>
        )}
      </div>
    </>
  );
}
