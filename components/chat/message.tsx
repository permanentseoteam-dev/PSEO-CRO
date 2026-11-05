"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, CheckCheck, Clock, FileText, Forward, Image as ImageIcon, Link2, MessageSquare, MoreHorizontal, Pencil, Pin, Plus, Trash2 } from "lucide-react";
import { Avatar, Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { dubai, formatSize, reactionSummary, threadInfo, tokenize } from "@/lib/modules/chat/logic";
import type { FileRef, Message } from "@/lib/modules/chat/types";
import { VoiceNote } from "@/features/chat-p2/components/voice-note";
import { useChat } from "./context";
import s from "./chat.module.css";

export const QUICK = ["👍", "✅", "👀"];

// Signed URLs for the private chat-files bucket, cached per page session.
const urls = new Map<string, Promise<string | null>>();
export function fileUrl(path: string, download?: string) {
  const key = path + (download ? "|dl" : "");
  let p = urls.get(key);
  if (!p) {
    p = createClient()
      .storage.from("chat-files")
      .createSignedUrl(path, 6 * 3600, download ? { download } : undefined)
      .then((r) => r.data?.signedUrl ?? null);
    urls.set(key, p);
  }
  return p;
}

export async function downloadFile(f: FileRef) {
  const url = f.path ? await fileUrl(f.path, f.name) : null;
  if (url) window.open(url, "_blank", "noopener");
  return !!url;
}

/** Message text with markdown basics and @mentions, rendered as React nodes (never raw HTML). */
export function RichText({ text }: { text: string }) {
  const { people, me } = useChat();
  const names = [...people.values()].map((p) => p.name);
  return (
    <>
      {tokenize(text, names, me.name).map((t, i) => {
        if (t.t === "b") return <b key={i}>{t.v}</b>;
        if (t.t === "i") return <i key={i}>{t.v}</i>;
        if (t.t === "code") return <code key={i}>{t.v}</code>;
        if (t.t === "link")
          return (
            <a key={i} href={t.v} target="_blank" rel="noopener noreferrer">
              {t.v}
            </a>
          );
        if (t.t === "mention")
          return (
            <b key={i} className={cn(s.at, t.me && s.me)}>
              @{t.v}
            </b>
          );
        return <span key={i}>{t.v}</span>;
      })}
    </>
  );
}

function useUrl(path: string) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (path) fileUrl(path).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [path]);
  return url;
}

export function FileView({ f }: { f: FileRef }) {
  const isImg = f.mime.startsWith("image/");
  const isAudio = f.mime.startsWith("audio/");
  const url = useUrl(isImg ? f.path : "");
  const [broken, setBroken] = useState(false);

  if (isAudio && f.path) return <VoiceNote file={f} />;
  if (isImg)
    return (
      <a
        className={s.attImg}
        href={url ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          if (!url || broken) e.preventDefault();
        }}
      >
        {url && !broken ? (
          // Signed Storage URL: next/image cannot optimise it.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={f.name} loading="lazy" onError={() => setBroken(true)} />
        ) : (
          <div className={s.attPh}>
            <ImageIcon size={34} aria-hidden />
          </div>
        )}
        <div className={cn(s.attCap, "small")}>
          <b>{f.name}</b>
          <span className="muted">{formatSize(f.size)}</span>
        </div>
      </a>
    );
  return (
    <div className={s.attFile}>
      <FileText size={22} aria-hidden />
      <div className={s.attFn}>
        <b>{f.name}</b>
        <div className="small muted">{formatSize(f.size)}</div>
      </div>
      <Button size="sm" variant="ghost" disabled={!f.path} onClick={() => downloadFile(f)}>
        Download
      </Button>
    </div>
  );
}

function Reactions({ m }: { m: Message }) {
  const { reactions, me, people, react } = useChat();
  const list = reactionSummary(reactions, m.id, me.id);
  if (!list.length) return null;
  return (
    <div className={s.rxs}>
      {list.map((r) => (
        <button
          key={r.emoji}
          type="button"
          className={cn(s.rx, r.mine && s.on)}
          title={r.memberIds.map((id) => people.get(id)?.name ?? "Someone").join(", ")}
          aria-pressed={r.mine}
          onClick={() => react(m, r.emoji)}
        >
          {r.emoji} <span className="num">{r.count}</span>
        </button>
      ))}
    </div>
  );
}

function EditBox({ m }: { m: Message }) {
  const { saveEdit, setEditingId } = useChat();
  const [v, setV] = useState(m.body);
  return (
    <div className={s.edit}>
      <textarea
        rows={2}
        value={v}
        autoFocus
        aria-label="Edit message"
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            saveEdit(m, v);
          }
          if (e.key === "Escape") setEditingId(null);
        }}
      />
      <div className="row">
        <Button size="sm" variant="primary" onClick={() => saveEdit(m, v)}>
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function Menu({ m }: { m: Message }) {
  const c = useChat();
  const { setMenuId } = c;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector("button")?.focus();
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.parentElement?.contains(e.target as Node)) setMenuId(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [setMenuId]);
  const mine = m.authorId === c.me.id;
  const item = (label: string, icon: React.ReactNode, fn: () => void, cls?: string) => (
    <button
      type="button"
      role="menuitem"
      className={cls}
      onClick={() => {
        c.setMenuId(null);
        fn();
      }}
    >
      {icon} {label}
    </button>
  );
  return (
    <div className={s.menu} role="menu" ref={ref}>
      {mine && m.body ? item("Edit message", <Pencil size={14} />, () => c.setEditingId(m.id)) : null}
      {item(m.pinnedAt ? "Unpin" : "Pin to conversation", <Pin size={14} />, () => c.togglePin(m))}
      {item("Create ticket", <Plus size={14} />, () => c.ticket(m))}
      {item("Forward", <Forward size={14} />, () => c.forward(m))}
      {item("Copy link", <Link2 size={14} />, () => c.copyLink(m))}
      {mine || c.canModerate ? item("Delete message", <Trash2 size={14} />, () => c.remove(m), s.del) : null}
    </div>
  );
}

type Props = { m: Message; grouped?: boolean; inPane?: boolean; status?: "seen" | "sent" | null; flash?: boolean };

export function MessageItem({ m, grouped, inPane, status, flash }: Props) {
  const c = useChat();
  const author = m.authorId ? c.people.get(m.authorId) : undefined;
  const name = author?.name ?? "Someone";
  const time = dubai(m.createdAt).time;
  const mentioned = m.authorId !== c.me.id && m.mentions.includes(c.me.id);
  const editing = c.editingId === m.id;
  const menuOpen = c.menuId === m.id;
  const thread = !inPane && m.parentId == null && !m.deletedAt ? threadInfo(c.messages, m.id) : null;

  return (
    <div
      id={`m-${m.id}`}
      className={cn(s.msg, grouped && s.grp, m.pending && s.pending, mentioned && s.mentioned, menuOpen && s.menuOpen, flash && s.flash)}
    >
      <div>{grouped ? <span className={cn(s.msgT, "num")}>{time}</span> : <Avatar name={name} size={34} />}</div>
      <div className={s.msgB}>
        {m.pinnedAt && !m.deletedAt ? (
          <div className={cn(s.pin, "small")}>
            <Pin size={12} aria-hidden /> Pinned
          </div>
        ) : null}
        {grouped ? null : (
          <div className={s.msgH}>
            <b>{name}</b>
            {author?.kind === "client" ? <span className="small muted">Client</span> : null}
            <span className="muted small num">{time}</span>
          </div>
        )}
        {m.deletedAt ? (
          <p className={cn(s.text, "muted")}>
            <i>This message was deleted.</i>
          </p>
        ) : editing ? (
          <EditBox m={m} />
        ) : (
          <>
            {m.body ? (
              <div className={s.text}>
                <RichText text={m.body} />
                {m.editedAt ? <span className="small muted"> (edited)</span> : null}
              </div>
            ) : null}
            {m.forward ? (
              <blockquote className={s.fwd}>
                <div className="small muted">
                  <Forward size={12} aria-hidden /> Forwarded from {m.forward.ch} · {m.forward.by}
                </div>
                <div className={s.text}>
                  <RichText text={m.forward.text} />
                </div>
              </blockquote>
            ) : null}
            {m.files.map((f, i) => (
              <FileView key={f.path || i} f={f} />
            ))}
            {m.ticketKey ? (
              <div className={cn(s.tk, "small")}>
                Ticket <Link href={`/t/${m.ticketKey}`}>{m.ticketKey}</Link> created from this message
              </div>
            ) : null}
            <Reactions m={m} />
          </>
        )}
        {thread && thread.count ? (
          <button type="button" className={s.thr} onClick={() => c.openThread(m.id)}>
            {thread.authors.map((a) => (
              <Avatar key={a} name={c.people.get(a)?.name ?? "?"} size={18} />
            ))}
            <span>
              {thread.count} {thread.count === 1 ? "reply" : "replies"}
            </span>
            <span className="muted small">Last reply {dubai(thread.last!).time}</span>
          </button>
        ) : null}
        {m.pending ? (
          <div className={s.st}>
            <Clock size={12} aria-hidden /> Sending…
          </div>
        ) : m.failed ? (
          <div className={cn(s.st, s.failed)}>
            Not sent.{" "}
            <button type="button" onClick={() => c.retry(m)}>
              Retry
            </button>
          </div>
        ) : status === "seen" ? (
          <div className={cn(s.st, s.seen)}>
            <CheckCheck size={13} aria-hidden /> Seen
          </div>
        ) : status === "sent" ? (
          <div className={s.st}>
            <Check size={13} aria-hidden /> Sent
          </div>
        ) : null}
      </div>
      {m.deletedAt || m.pending || m.failed || editing || m.id < 0 ? null : (
        <div className={s.acts} role="toolbar" aria-label="Message actions">
          {QUICK.map((e) => (
            <button key={e} type="button" aria-label={`React ${e}`} onClick={() => c.react(m, e)}>
              {e}
            </button>
          ))}
          {inPane ? null : (
            <>
              {m.parentId == null ? (
                <button type="button" aria-label="Reply in thread" title="Reply in thread" onClick={() => c.openThread(m.id)}>
                  <MessageSquare size={15} />
                </button>
              ) : null}
              <button
                type="button"
                aria-label="More actions"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                title="More"
                onClick={() => c.setMenuId(menuOpen ? null : m.id)}
              >
                <MoreHorizontal size={15} />
              </button>
              {menuOpen ? <Menu m={m} /> : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}
