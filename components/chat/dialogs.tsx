"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Button, Checkbox, Dialog, Field, FormGrid, Input, PhaseTwo, Seg, Select, Textarea, useToast } from "@/components/ui";
import { cn } from "@/lib/utils";
import { convLabel, dubai, slugChannel } from "@/lib/modules/chat/logic";
import type { BrowseRow, ClientOption, Conversation, Message, Notify, Person } from "@/lib/modules/chat/types";
import {
  browseChannels,
  createChannel,
  forwardMessage,
  joinChannel,
  leaveChannel,
  searchMessages,
  setNotify,
  startConversation,
  updateChannel,
} from "@/app/(app)/chat/actions";
import s from "./chat.module.css";

type Base = { onClose: () => void };

function PeoplePick({ people, picked, max, onChange }: { people: Person[]; picked: string[]; max?: number; onChange: (ids: string[]) => void }) {
  return (
    <div className={s.pick}>
      {people.map((p) => {
        const on = picked.includes(p.id);
        const dis = !on && max != null && picked.length >= max;
        return (
          <label key={p.id} className={cn(dis && s.dis)}>
            <input type="checkbox" checked={on} disabled={dis} onChange={() => onChange(on ? picked.filter((x) => x !== p.id) : [...picked, p.id])} />
            <Avatar name={p.name} size={26} />
            <span>
              <b>{p.name}</b> <span className="small muted">{p.title ?? ""}</span>
            </span>
          </label>
        );
      })}
      {people.length ? null : <p className={cn(s.empty, "small muted")}>Nobody matches that name.</p>}
    </div>
  );
}

// ---------------------------------------------------------------- new DM / group
export function NewMessageDialog({ onClose, people, meId, onDone }: Base & { people: Person[]; meId: string; onDone: (id: string) => void }) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [busy, start] = useTransition();
  const team = people.filter((p) => p.kind === "staff" && p.id !== meId && p.name.toLowerCase().includes(q.trim().toLowerCase()));
  const submit = () =>
    start(async () => {
      const r = await startConversation({ memberIds: picked, text });
      if (!r.ok) return toast(r.error);
      onDone(r.id);
    });
  return (
    <Dialog
      open
      onClose={onClose}
      title="New message"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!picked.length || busy} onClick={submit}>
            Start conversation
          </Button>
        </>
      }
    >
      <p className="small muted">Pick 1 person for a direct message, or up to 8 for a group.</p>
      <Field label="Find people" htmlFor="chat-nm-q">
        <Input id="chat-nm-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a name" />
      </Field>
      <PeoplePick people={team} picked={picked} max={8} onChange={setPicked} />
      <p className="small">
        <b className="num">{picked.length}</b> of 8 selected
      </p>
      <Field label="First message" htmlFor="chat-nm-text">
        <Textarea id="chat-nm-text" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Say hello" />
      </Field>
    </Dialog>
  );
}

// ---------------------------------------------------------------- new channel
export function NewChannelDialog({
  onClose,
  people,
  meId,
  clients,
  initialKind,
  onDone,
}: Base & { people: Person[]; meId: string; clients: ClientOption[]; initialKind: "public" | "private" | "client"; onDone: (id: string) => void }) {
  const toast = useToast();
  const [kind, setKind] = useState(initialKind);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [adminsOnly, setAdminsOnly] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, start] = useTransition();
  const team = people.filter((p) => p.kind === "staff" && p.id !== meId);
  const submit = () =>
    start(async () => {
      const r = await createChannel({ kind, name, topic, clientId: kind === "client" ? clientId || null : null, adminsOnly, memberIds: picked });
      if (!r.ok) return toast(r.error);
      onDone(r.id);
    });
  return (
    <Dialog
      open
      onClose={onClose}
      title="New channel"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!slugChannel(name) || busy || (kind === "client" && !clientId)} onClick={submit}>
            Create channel
          </Button>
        </>
      }
    >
      <Field label="Type">
        <Seg
          label="Channel type"
          value={kind}
          onChange={(v) => setKind(v as typeof kind)}
          items={[
            { value: "public", label: "Public" },
            { value: "private", label: "Private" },
            { value: "client", label: "Client" },
          ]}
        />
      </Field>
      <FormGrid>
        <Field label="Name" htmlFor="chat-nc-name" hint={name && slugChannel(name) !== name ? `Saved as #${slugChannel(name)}` : undefined}>
          <Input id="chat-nc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. harbor-legal" required />
        </Field>
        {kind === "client" ? (
          <Field label="Client" htmlFor="chat-nc-client">
            {clients.length ? (
              <Select id="chat-nc-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            ) : (
              <p className="small muted">No clients yet.</p>
            )}
          </Field>
        ) : null}
        <Field label="Topic" htmlFor="chat-nc-topic" full>
          <Input id="chat-nc-topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What is this channel for?" />
        </Field>
        <Field label="Posting" full>
          <Checkbox label="Only admins can post" checked={adminsOnly} onChange={(e) => setAdminsOnly(e.target.checked)} />
        </Field>
      </FormGrid>
      <Field label="Members">
        <PeoplePick people={team} picked={picked} onChange={setPicked} />
      </Field>
      {kind === "client" ? <p className="small muted">The client&apos;s portal logins join automatically.</p> : null}
    </Dialog>
  );
}

// ---------------------------------------------------------------- browse public channels
export function BrowseDialog({ onClose, onOpen }: Base & { onOpen: (id: string) => void }) {
  const toast = useToast();
  const [rows, setRows] = useState<BrowseRow[] | null>(null);
  const [q, setQ] = useState("");
  const [busy, start] = useTransition();
  useEffect(() => {
    browseChannels().then((r) => setRows(r.ok ? r.rows : []));
  }, []);
  const list = (rows ?? []).filter((r) => r.name.includes(q.trim().toLowerCase()));
  return (
    <Dialog
      open
      onClose={onClose}
      title="Browse channels"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      <Field label="Search channels" htmlFor="chat-br-q">
        <Input id="chat-br-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Channel name" />
      </Field>
      <div className="list">
        {rows == null ? (
          <p className="small muted">Loading channels…</p>
        ) : list.length ? (
          list.map((r) => (
            <div key={r.id} className="item row between">
              <div>
                <b>#{r.name}</b>
                <div className="small muted">
                  {r.topic ? `${r.topic} · ` : ""}
                  <span className="num">{r.members}</span> members
                </div>
              </div>
              <Button
                size="sm"
                variant="primary"
                disabled={busy}
                onClick={() =>
                  start(async () => {
                    const res = await joinChannel(r.id);
                    if (!res.ok) return toast(res.error);
                    onOpen(r.id);
                  })
                }
              >
                Join
              </Button>
            </div>
          ))
        ) : (
          <p className="small muted">{rows.length ? "No channel matches that search." : "You're in every public channel."}</p>
        )}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- search
function Highlight({ text, q }: { text: string; q: string }) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0 || !q) return <>{text}</>;
  const from = Math.max(0, i - 60);
  return (
    <>
      {from > 0 ? "…" : ""}
      {text.slice(from, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length, i + q.length + 120)}
    </>
  );
}

export function SearchDialog({
  onClose,
  currentId,
  convs,
  people,
  meId,
  today,
  onGoto,
}: Base & { currentId: string | null; convs: Conversation[]; people: Map<string, Person>; meId: string; today: string; onGoto: (channelId: string, messageId: number) => void }) {
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"all" | "here">("all");
  const [hits, setHits] = useState<Message[] | null>(null);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const t = setTimeout(async () => {
      const r = await searchMessages({ q: term, channelId: scope === "here" ? currentId : null });
      setHits(r.ok ? r.messages : []);
    }, 300);
    return () => clearTimeout(t);
  }, [q, scope, currentId]);
  const byId = new Map(convs.map((c) => [c.id, c]));
  const term = q.trim();
  return (
    <Dialog open onClose={onClose} title="Search messages" wide>
      <div className="row">
        <input className={s.grow} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search messages and files" aria-label="Search messages" autoFocus />
        <Seg
          label="Search scope"
          value={scope}
          onChange={(v) => setScope(v as "all" | "here")}
          items={[
            { value: "all", label: "All" },
            { value: "here", label: "This conversation" },
          ]}
        />
      </div>
      <div className={s.srList}>
        {term.length < 2 ? (
          <p className="small muted">Type at least 2 letters.</p>
        ) : hits == null ? null : hits.length ? (
          hits.map((m) => {
            const c = byId.get(m.channelId);
            const who = m.authorId ? people.get(m.authorId)?.name ?? "Someone" : "Someone";
            const d = dubai(m.createdAt);
            const hay = [m.body, ...m.files.map((f) => f.name)].join(" ").trim();
            return (
              <button key={m.id} type="button" className={s.srItem} onClick={() => onGoto(m.channelId, m.id)}>
                <Avatar name={who} size={28} />
                <span>
                  <span className="small">
                    <b>{who}</b>{" "}
                    <span className="muted">
                      in {c ? convLabel(c, people, meId) : "a conversation"} · {d.day === today ? "Today" : d.day} {d.time}
                    </span>
                  </span>
                  <span style={{ display: "block" }}>
                    <Highlight text={hay} q={term} />
                  </span>
                </span>
              </button>
            );
          })
        ) : (
          <p className="small muted">No messages match. Try a client or file name.</p>
        )}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- create ticket (hands off to the Tickets module)
export function TicketDialog({ onClose, message, people, link }: Base & { message: Message; people: Person[]; link: string }) {
  const router = useRouter();
  const firstLine = (message.body || message.files[0]?.name || "Follow up").split("\n")[0];
  const [title, setTitle] = useState(firstLine.slice(0, 120));
  const [assignee, setAssignee] = useState(message.authorId ?? "");
  const [priority, setPriority] = useState("normal");
  const [due, setDue] = useState(() => dubai(new Date(Date.now() + 3 * 86400000).toISOString()).day);
  const [desc, setDesc] = useState(`${message.body}\n\nFrom chat: ${link}`.trim());
  const submit = () => {
    const qs = new URLSearchParams({ new: "1", title, assignee, priority, due, description: desc, from_message: String(message.id) });
    router.push(`/tickets?${qs}`);
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title="Create ticket from message"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!title.trim()} onClick={submit}>
            Create ticket
          </Button>
        </>
      }
    >
      {message.body ? <blockquote className={s.fwd}>{message.body}</blockquote> : null}
      <FormGrid>
        <Field label="Title" htmlFor="chat-tk-title" full>
          <Input id="chat-tk-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </Field>
        <Field label="Assignee" htmlFor="chat-tk-who">
          <Select id="chat-tk-who" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            {people
              .filter((p) => p.kind === "staff")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Priority" htmlFor="chat-tk-pri">
          <Select id="chat-tk-pri" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </Select>
        </Field>
        <Field label="Due date" htmlFor="chat-tk-due">
          <Input id="chat-tk-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <Field label="Description" htmlFor="chat-tk-desc" full>
          <Textarea id="chat-tk-desc" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </Field>
      </FormGrid>
    </Dialog>
  );
}

// ---------------------------------------------------------------- forward
export function ForwardDialog({
  onClose,
  message,
  convs,
  people,
  meId,
}: Base & { message: Message; convs: Conversation[]; people: Map<string, Person>; meId: string }) {
  const toast = useToast();
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, start] = useTransition();
  const submit = () =>
    start(async () => {
      const r = await forwardMessage({ messageId: message.id, targetIds: picked, note });
      if (!r.ok) return toast(r.error);
      toast(picked.length === 1 ? "Forwarded" : `Forwarded to ${picked.length} conversations`);
      onClose();
    });
  return (
    <Dialog
      open
      onClose={onClose}
      title="Forward message"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!picked.length || busy} onClick={submit}>
            Forward
          </Button>
        </>
      }
    >
      {message.body ? <blockquote className={s.fwd}>{message.body}</blockquote> : null}
      <p className="small">
        <b className="num">{picked.length}</b> of 10 selected
      </p>
      <div className={s.pick}>
        {convs.map((c) => {
          const on = picked.includes(c.id);
          const dis = !on && picked.length >= 10;
          return (
            <label key={c.id} className={cn(dis && s.dis)}>
              <input type="checkbox" checked={on} disabled={dis} onChange={() => setPicked(on ? picked.filter((x) => x !== c.id) : [...picked, c.id])} />
              <span>{convLabel(c, people, meId)}</span>
            </label>
          );
        })}
      </div>
      <Field label="Add a note" htmlFor="chat-fw-note">
        <Textarea id="chat-fw-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
      </Field>
    </Dialog>
  );
}

// ---------------------------------------------------------------- settings
export function SettingsDialog({
  onClose,
  conv,
  canAdmin,
  onNotify,
  onSaved,
  onLeft,
}: Base & { conv: Conversation; canAdmin: boolean; onNotify: (n: Notify) => void; onSaved: (topic: string, adminsOnly: boolean) => void; onLeft: () => void }) {
  const toast = useToast();
  const [topic, setTopic] = useState(conv.topic ?? "");
  const [notify, setN] = useState<Notify>(conv.notify);
  const [adminsOnly, setAdminsOnly] = useState(conv.adminsOnly);
  const [busy, start] = useTransition();
  const isChannel = conv.kind !== "dm" && conv.kind !== "group";
  const save = () =>
    start(async () => {
      if (notify !== conv.notify) {
        const r = await setNotify({ channelId: conv.id, notify });
        if (!r.ok) return toast(r.error);
        onNotify(notify);
      }
      if (canAdmin && isChannel && (topic !== (conv.topic ?? "") || adminsOnly !== conv.adminsOnly)) {
        const r = await updateChannel({ channelId: conv.id, topic, adminsOnly });
        if (!r.ok) return toast(r.error);
        onSaved(topic, adminsOnly);
      }
      toast("Saved");
      onClose();
    });
  const leave = () =>
    start(async () => {
      const r = await leaveChannel(conv.id);
      if (!r.ok) return toast(r.error);
      onLeft();
    });
  return (
    <Dialog
      open
      onClose={onClose}
      title="Conversation settings"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy} onClick={save}>
            Save changes
          </Button>
        </>
      }
    >
      <FormGrid>
        {isChannel ? (
          <Field label="Topic" htmlFor="chat-st-topic" full>
            <Input id="chat-st-topic" value={topic} disabled={!canAdmin} onChange={(e) => setTopic(e.target.value)} />
          </Field>
        ) : null}
        <Field label="Notifications" htmlFor="chat-st-notify">
          <Select id="chat-st-notify" value={notify} onChange={(e) => setN(e.target.value as Notify)}>
            <option value="all">All messages</option>
            <option value="mentions">Mentions only</option>
            <option value="mute">Mute</option>
          </Select>
        </Field>
        {isChannel && canAdmin ? (
          <Field label="Posting">
            <Checkbox label="Only admins can post" checked={adminsOnly} onChange={(e) => setAdminsOnly(e.target.checked)} />
          </Field>
        ) : null}
      </FormGrid>
      <div className={cn("row between", s.danger)}>
        <div>
          <b>Archive this conversation</b> <PhaseTwo />
          <div className="small muted">Hides it for everyone. History stays searchable.</div>
        </div>
        <Button size="sm" variant="danger" disabled>
          Archive
        </Button>
      </div>
      <div className={cn("row between", s.danger)}>
        <div>
          <b>Leave conversation</b>
          <div className="small muted">You stop getting messages from it.</div>
        </div>
        <Button size="sm" variant="ghost" disabled={busy} onClick={leave}>
          Leave
        </Button>
      </div>
    </Dialog>
  );
}
