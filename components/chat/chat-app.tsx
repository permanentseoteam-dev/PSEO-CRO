"use client";

import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { BellOff, ChevronLeft, FileText, Hash, Lock, MessagesSquare, Pencil, Pin, Plus, Search, Settings, Users } from "lucide-react";
import { Avatar, Avatars, Button, EmptyState, IconButton, Seg, StatusDot, useToast } from "@/components/ui";
import { can, type Scope } from "@/lib/auth/perms";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  buildRows,
  bumpUnread,
  convLabel,
  firstUnreadId,
  inChannel,
  safeFileName,
  seenByAll,
  toMessage,
  upsertMessage,
} from "@/lib/modules/chat/logic";
import type { ClientOption, Conversation, LiveState, Message, MessageRow, Notify, Person, Reaction } from "@/lib/modules/chat/types";
import {
  catchUp,
  deleteMessage,
  editMessage,
  loadConversation,
  markRead,
  refreshConversations,
  sendMessage,
  setNotify,
  setPinned,
  setReaction,
} from "@/app/(app)/chat/actions";
import { getLiveHuddle } from "@/features/chat-p2/actions";
import { Huddle } from "@/features/chat-p2/components/huddle";
import { ScheduleMeeting } from "@/features/chat-p2/components/schedule-meeting";
import type { Huddle as LiveHuddle } from "@/features/chat-p2/types";
import { Composer, type ComposerHandle } from "./composer";
import { ChatContext, type ChatCtx } from "./context";
import { BrowseDialog, ForwardDialog, NewChannelDialog, NewMessageDialog, SearchDialog, SettingsDialog, TicketDialog } from "./dialogs";
import { MessageItem } from "./message";
import { Pane, type PaneState } from "./pane";
import s from "./chat.module.css";

type Props = {
  me: { id: string; name: string; kind: "staff" | "client"; perms: Record<string, Scope> };
  conversations: Conversation[];
  people: Person[];
  clients: ClientOption[];
  currentId: string | null;
  initialMessages: Message[];
  initialReactions: Reaction[];
  maxId: number;
  today: string;
  focusId: number | null;
  /** Sidebar "Slack import" (chat-p2 SlackImportButton, rendered on the server). */
  slackImport?: ReactNode;
};

type DialogState =
  | null
  | { t: "new-msg" }
  | { t: "new-channel"; kind: "public" | "client" }
  | { t: "browse" }
  | { t: "search" }
  | { t: "settings" }
  | { t: "ticket"; m: Message }
  | { t: "forward"; m: Message };

type RxRow = { message_id: number; member_id: string; emoji: string; channel_id?: string };
type MemberRow = { channel_id: string; member_id: string; role?: "member" | "admin"; notify?: Notify; last_read_id?: number };
type Pending = { body: string; files: File[]; parentId: number | null; also: boolean };

const isDirect = (c: Pick<Conversation, "kind">) => c.kind === "dm" || c.kind === "group";
const sameRx = (a: Reaction, b: Reaction) => a.messageId === b.messageId && a.memberId === b.memberId && a.emoji === b.emoji;
const POLL_MS = 12000;
const TYPING_MS = 6000;
let tempSeq = 0;

export function ChatApp(props: Props) {
  const { me, today } = props;
  const toast = useToast();
  const sb = useMemo(() => createClient(), []);
  const people = useMemo(() => new Map(props.people.map((p) => [p.id, p])), [props.people]);

  const [convs, setConvs] = useState(props.conversations);
  const [currentId, setCurrentId] = useState(props.currentId);
  const [messages, setMessages] = useState(props.initialMessages);
  const [reactions, setReactions] = useState(props.initialReactions);
  const [newFromId, setNewFromId] = useState<number | null>(() => {
    const c = props.conversations.find((x) => x.id === props.currentId);
    return c ? firstUnreadId(props.initialMessages, c.lastReadId, me.id) : null;
  });
  const [pane, setPane] = useState<PaneState>(null);
  const [live, setLive] = useState<LiveState>("live");
  const [online, setOnline] = useState<Set<string>>(() => new Set());
  const [typing, setTyping] = useState<Record<string, number>>({});
  const [mobileMain, setMobileMain] = useState(!!props.focusId);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [jump, setJump] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [menuId, setMenuId] = useState<number | null>(null);
  const [flashId, setFlashId] = useState<number | null>(props.focusId);
  const [drafts, setDrafts] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(true);
  const [liveHuddle, setLiveHuddle] = useState<{ channelId: string; huddle: LiveHuddle | null } | null>(null);

  const currentRef = useRef(props.currentId);
  const maxIdRef = useRef(props.maxId);
  const msgsEl = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const scrollMode = useRef<"new" | "bottom" | "keep" | number>(props.focusId ?? "new");
  const composer = useRef<ComposerHandle>(null);
  const pendingSends = useRef(new Map<string, Pending>());
  const typingCh = useRef<RealtimeChannel | null>(null);
  const lastTypingSent = useRef(0);

  const conv = convs.find((c) => c.id === currentId) ?? null;
  const label = conv ? convLabel(conv, people, me.id) : "";
  const isStaff = me.kind === "staff";
  const canModerate = !!conv && isStaff && (can(me, "admin.access.manage", "all") || conv.createdBy === me.id || conv.members.some((m) => m.memberId === me.id && m.role === "admin"));
  const archived = !!conv?.archivedAt;
  const canPost = !!conv && !archived && (!conv.adminsOnly || canModerate);
  const memberPeople = conv ? conv.members.map((m) => people.get(m.memberId)).filter((p): p is Person => !!p && p.id !== me.id) : [];

  // ---------------------------------------------------------------- loading conversations
  async function reloadConvs() {
    const r = await refreshConversations();
    if (!r.ok) return null;
    setConvs(r.conversations.map((c) => (c.id === currentRef.current ? { ...c, unread: 0, mentions: 0 } : c)));
    return r.conversations;
  }

  function flash(id: number) {
    setFlashId(id);
    setTimeout(() => setFlashId((f) => (f === id ? null : f)), 2000);
  }

  function jumpTo(id: number) {
    const el = document.getElementById(`m-${id}`);
    if (!el) return toast("That message is older than what's loaded here.");
    if (window.matchMedia("(max-width: 760px)").matches) setPane(null);
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    flash(id);
  }

  async function open(id: string, focus?: number, known?: Conversation[]) {
    setMobileMain(true);
    setMenuId(null);
    setEditingId(null);
    if (id === currentRef.current) {
      if (focus) jumpTo(focus);
      return;
    }
    const c = (known ?? convs).find((x) => x.id === id);
    currentRef.current = id;
    setCurrentId(id);
    setPane(null);
    setMessages([]);
    setReactions([]);
    setNewFromId(null);
    setLoading(true);
    window.history.replaceState(null, "", `/chat?c=${id}`);
    const r = await loadConversation(id);
    if (currentRef.current !== id) return;
    setLoading(false);
    if (!r.ok) return toast(r.error);
    setNewFromId(c ? firstUnreadId(r.messages, c.lastReadId, me.id) : null);
    scrollMode.current = focus ?? "new";
    if (focus) flash(focus);
    setMessages(r.messages);
    setReactions(r.reactions);
    setConvs((cs) => cs.map((x) => (x.id === id ? { ...x, unread: 0, mentions: 0 } : x)));
  }

  async function openNew(id: string) {
    setDialog(null);
    const list = await reloadConvs();
    await open(id, undefined, list ?? undefined);
  }

  // ---------------------------------------------------------------- realtime
  const onMessage = useEffectEvent((row: MessageRow, isInsert: boolean) => {
    const m = toMessage(row);
    maxIdRef.current = Math.max(maxIdRef.current, m.id);
    if (isInsert) {
      const who = m.authorId ? people.get(m.authorId)?.name : undefined;
      if (who) setTyping((t) => (who in t ? Object.fromEntries(Object.entries(t).filter(([n]) => n !== who)) : t));
    }
    if (m.channelId === currentRef.current) {
      setMessages((l) => upsertMessage(l, m));
      if (isInsert) setConvs((cs) => cs.map((c) => (c.id === m.channelId ? { ...c, lastMessageAt: m.createdAt } : c)));
      return;
    }
    if (!isInsert) return;
    if (!convs.some((c) => c.id === m.channelId)) {
      void reloadConvs();
      return;
    }
    setConvs((cs) => cs.map((c) => (c.id === m.channelId ? bumpUnread({ ...c, lastMessageAt: m.createdAt }, m, me.id) : c)));
  });

  const onReaction = useEffectEvent((row: RxRow, isDelete: boolean) => {
    const r = { messageId: Number(row.message_id), memberId: row.member_id, emoji: row.emoji };
    if (isDelete) setReactions((l) => l.filter((x) => !sameRx(x, r)));
    else if (row.channel_id === currentRef.current) setReactions((l) => (l.some((x) => sameRx(x, r)) ? l : [...l, r]));
  });

  const onMember = useEffectEvent((row: MemberRow, ev: string) => {
    if (row.member_id === me.id && ev !== "UPDATE") {
      void reloadConvs().then((list) => {
        if (list && currentRef.current && !list.some((c) => c.id === currentRef.current)) {
          currentRef.current = null;
          setCurrentId(null);
          setMessages([]);
        }
      });
      return;
    }
    setConvs((cs) =>
      cs.map((c) => {
        if (c.id !== row.channel_id) return c;
        if (ev === "DELETE") return { ...c, members: c.members.filter((m) => m.memberId !== row.member_id) };
        const cm = { memberId: row.member_id, role: row.role ?? "member", lastReadId: Number(row.last_read_id ?? 0) };
        const members = c.members.some((m) => m.memberId === cm.memberId) ? c.members.map((m) => (m.memberId === cm.memberId ? cm : m)) : [...c.members, cm];
        if (cm.memberId !== me.id) return { ...c, members };
        const readMore = cm.lastReadId > c.lastReadId;
        return {
          ...c,
          members,
          notify: row.notify ?? c.notify,
          lastReadId: Math.max(c.lastReadId, cm.lastReadId),
          unread: readMore ? 0 : c.unread,
          mentions: readMore ? 0 : c.mentions,
        };
      }),
    );
  });

  /** Reconnect catch-up and the offline poll: messages after the newest id we have, and fresh sidebar counts. */
  async function catchUpNow(full: boolean) {
    const cur = currentRef.current;
    const r = await catchUp(maxIdRef.current);
    if (!r.ok) return;
    for (const m of r.messages) maxIdRef.current = Math.max(maxIdRef.current, m.id);
    setMessages((l) => r.messages.filter((m) => m.channelId === cur).reduce(upsertMessage, l));
    setConvs(r.conversations.map((c) => (c.id === cur ? { ...c, unread: 0, mentions: 0 } : c)));
    if (!full || !cur) return;
    // Edits, deletes and reactions made while we were away.
    const x = await loadConversation(cur);
    if (!x.ok || currentRef.current !== cur) return;
    setMessages((l) => l.filter((m) => m.id < 0).reduce(upsertMessage, x.messages));
    setReactions(x.reactions);
  }
  const doCatchUp = useEffectEvent((full: boolean) => catchUpNow(full));

  useEffect(() => {
    let down = false;
    const db = sb
      .channel(`chat:${me.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (p) => {
        if (p.eventType !== "DELETE") onMessage(p.new as MessageRow, p.eventType === "INSERT");
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, (p) => {
        onReaction((p.eventType === "DELETE" ? p.old : p.new) as RxRow, p.eventType === "DELETE");
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "channel_members" }, (p) => {
        onMember((p.eventType === "DELETE" ? p.old : p.new) as MemberRow, p.eventType);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setLive("live");
          if (down) {
            down = false;
            void doCatchUp(true);
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          down = true;
          setLive(navigator.onLine ? "reconnecting" : "offline");
        }
      });

    const presence = sb.channel("chat-presence", { config: { presence: { key: me.id } } });
    presence
      .on("presence", { event: "sync" }, () => setOnline(new Set(Object.keys(presence.presenceState()))))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void presence.track({ at: Date.now() });
      });

    const goOffline = () => setLive("offline");
    const goOnline = () => {
      setLive(db.state === "joined" ? "live" : "reconnecting");
      void doCatchUp(true);
    };
    const onVisible = () => setVisible(document.visibilityState === "visible");
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      document.removeEventListener("visibilitychange", onVisible);
      void sb.removeChannel(db);
      void sb.removeChannel(presence);
    };
  }, [sb, me.id]);

  // Safety net: while the socket is down, poll every 12 seconds.
  useEffect(() => {
    if (live === "live") return;
    const t = setInterval(() => void doCatchUp(false), POLL_MS);
    return () => clearInterval(t);
  }, [live]);

  // Typing: Broadcast on a per-conversation channel; each signal lasts 6 seconds.
  useEffect(() => {
    if (!currentId) return;
    const ch = sb.channel(`chat-typing:${currentId}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "typing" }, ({ payload }) => {
      const p = payload as { id: string; name: string };
      if (p.id !== me.id) setTyping((t) => ({ ...t, [p.name]: Date.now() + TYPING_MS }));
    }).subscribe();
    typingCh.current = ch;
    return () => {
      typingCh.current = null;
      setTyping({});
      void sb.removeChannel(ch);
    };
  }, [sb, currentId, me.id]);

  useEffect(() => {
    if (!Object.keys(typing).length) return;
    const t = setTimeout(() => setTyping((cur) => Object.fromEntries(Object.entries(cur).filter(([, exp]) => exp > Date.now()))), 1000);
    return () => clearTimeout(t);
  }, [typing]);

  // Live huddle of the open conversation (chat-p2). Reloaded on switch and after I start, join or leave one.
  async function loadHuddle() {
    const id = currentRef.current;
    if (!id) return;
    const r = await getLiveHuddle(id);
    if (r.ok && currentRef.current === id) setLiveHuddle({ channelId: id, huddle: r.data?.huddle ?? null });
  }
  const doLoadHuddle = useEffectEvent(() => loadHuddle());
  useEffect(() => {
    if (currentId) void doLoadHuddle();
  }, [currentId]);

  function sendTyping() {
    const now = Date.now();
    if (now - lastTypingSent.current < 3000) return;
    lastTypingSent.current = now;
    void typingCh.current?.send({ type: "broadcast", event: "typing", payload: { id: me.id, name: me.name } });
  }

  // ---------------------------------------------------------------- reads, drafts, scrolling
  const convId = conv?.id;
  const convLastRead = conv?.lastReadId ?? 0;
  useEffect(() => {
    if (!convId || !visible) return;
    const last = messages.findLast((m) => m.id > 0);
    if (!last || last.id <= convLastRead) return;
    const t = setTimeout(() => {
      void markRead({ channelId: convId, lastId: last.id });
      setConvs((cs) => cs.map((c) => (c.id === convId ? { ...c, lastReadId: Math.max(c.lastReadId, last.id), unread: 0, mentions: 0 } : c)));
    }, 600);
    return () => clearTimeout(t);
  }, [messages, convId, convLastRead, visible]);

  // Drafts live in localStorage (browser-only), so the sidebar reads them after render.
  useEffect(() => {
    const has = convs.filter((c) => localStorage.getItem("chat-draft:" + c.id)).map((c) => c.id);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDrafts((cur) => (has.length === cur.size && has.every((id) => cur.has(id)) ? cur : new Set(has)));
  }, [currentId, convs]);

  useLayoutEffect(() => {
    const el = msgsEl.current;
    if (!el) return;
    const mode = scrollMode.current;
    if (mode === "new") {
      const n = el.querySelector<HTMLElement>("[data-new]");
      el.scrollTop = n ? n.offsetTop - 60 : el.scrollHeight;
    } else if (typeof mode === "number") {
      const n = document.getElementById(`m-${mode}`);
      if (n) el.scrollTop = n.offsetTop - el.clientHeight / 2;
      else el.scrollTop = el.scrollHeight;
    } else if (mode === "bottom" || nearBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
    if (messages.length) scrollMode.current = "keep";
  }, [messages]);

  // ---------------------------------------------------------------- writes
  async function send(body: string, files: File[], parentId: number | null = null, also = false, key?: string) {
    if (!conv) return;
    const channelId = conv.id;
    const clientKey = key ?? crypto.randomUUID();
    pendingSends.current.set(clientKey, { body, files, parentId, also });
    const temp: Message = {
      id: -++tempSeq, // negative until the server assigns the real id
      clientKey,
      channelId,
      authorId: me.id,
      parentId,
      body,
      mentions: [],
      alsoInChannel: also,
      forward: null,
      files: files.map((f) => ({ path: "", name: f.name, mime: f.type, size: f.size })),
      pinnedAt: null,
      editedAt: null,
      deletedAt: null,
      ticketKey: null,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    if (parentId == null || also) scrollMode.current = "bottom";
    setMessages((l) => upsertMessage(l.filter((m) => m.clientKey !== clientKey), temp));
    try {
      const refs = await Promise.all(
        files.map(async (f) => {
          const path = `${channelId}/${crypto.randomUUID()}-${safeFileName(f.name)}`;
          const { error } = await sb.storage.from("chat-files").upload(path, f, { contentType: f.type || undefined });
          if (error) throw new Error(`Couldn't upload ${f.name}.`);
          return { path, name: f.name, mime: f.type || "application/octet-stream", size: f.size };
        }),
      );
      const r = await sendMessage({ channelId, clientKey, body, parentId, alsoInChannel: also, files: refs });
      if (!r.ok) throw new Error(r.error);
      pendingSends.current.delete(clientKey);
      maxIdRef.current = Math.max(maxIdRef.current, r.message.id);
      if (currentRef.current === channelId) setMessages((l) => upsertMessage(l, r.message));
    } catch (e) {
      setMessages((l) => l.map((m) => (m.clientKey === clientKey ? { ...m, pending: false, failed: true } : m)));
      toast(e instanceof Error && e.message ? e.message : "Message not sent.");
    }
  }

  async function react(m: Message, emoji: string) {
    const r = { messageId: m.id, memberId: me.id, emoji };
    const on = !reactions.some((x) => sameRx(x, r));
    setReactions((l) => (on ? [...l, r] : l.filter((x) => !sameRx(x, r))));
    const res = await setReaction({ messageId: m.id, channelId: m.channelId, emoji, on });
    if (!res.ok) {
      setReactions((l) => (on ? l.filter((x) => !sameRx(x, r)) : [...l, r]));
      toast(res.error);
    }
  }

  async function saveEdit(m: Message, body: string) {
    const v = body.trim();
    if (!v) return;
    setEditingId(null);
    if (v === m.body) return;
    setMessages((l) => upsertMessage(l, { ...m, body: v, editedAt: new Date().toISOString() }));
    const r = await editMessage({ id: m.id, body: v });
    if (!r.ok) {
      setMessages((l) => upsertMessage(l, m));
      return toast(r.error);
    }
    setMessages((l) => upsertMessage(l, r.message));
  }

  async function togglePin(m: Message) {
    const r = await setPinned({ id: m.id, pinned: !m.pinnedAt });
    if (!r.ok) return toast(r.error);
    setMessages((l) => upsertMessage(l, r.message));
    toast(r.message.pinnedAt ? "Pinned to the conversation" : "Unpinned");
  }

  async function remove(m: Message) {
    if (!window.confirm("Delete this message? This can't be undone.")) return;
    const r = await deleteMessage(m.id);
    if (!r.ok) return toast(r.error);
    setMessages((l) => upsertMessage(l, r.message));
  }

  function retry(m: Message) {
    const p = m.clientKey ? pendingSends.current.get(m.clientKey) : undefined;
    if (p && m.clientKey) void send(p.body, p.files, p.parentId, p.also, m.clientKey);
  }

  async function changeNotify(n: Notify) {
    if (!conv) return;
    const prev = conv.notify;
    const id = conv.id;
    setConvs((cs) => cs.map((c) => (c.id === id ? { ...c, notify: n } : c)));
    const r = await setNotify({ channelId: id, notify: n });
    if (!r.ok) {
      setConvs((cs) => cs.map((c) => (c.id === id ? { ...c, notify: prev } : c)));
      toast(r.error);
    }
  }

  const ctx: ChatCtx | null = conv
    ? {
        me: { id: me.id, name: me.name },
        people,
        conv,
        messages,
        reactions,
        canModerate,
        editingId,
        menuId,
        setMenuId,
        react,
        openThread: (id) => setPane({ mode: "thread", id }),
        setEditingId,
        saveEdit,
        togglePin,
        remove,
        forward: (m) => setDialog({ t: "forward", m }),
        ticket: (m) => setDialog({ t: "ticket", m }),
        copyLink: (m) => {
          void navigator.clipboard.writeText(`${location.origin}/chat?c=${m.channelId}&m=${m.id}`);
          toast("Link copied");
        },
        retry,
        jumpTo,
      }
    : null;

  // ---------------------------------------------------------------- render pieces
  const q = jump.trim().toLowerCase();
  const sections: { title: string; kinds: string[]; add?: () => void; addLabel: string }[] = [
    { title: "Channels", kinds: ["public", "private"], add: isStaff ? () => setDialog({ t: "new-channel", kind: "public" }) : undefined, addLabel: "New channel" },
    { title: "Clients", kinds: ["client"], add: isStaff ? () => setDialog({ t: "new-channel", kind: "client" }) : undefined, addLabel: "New client channel" },
    { title: "Direct messages", kinds: ["dm", "group"], add: isStaff ? () => setDialog({ t: "new-msg" }) : undefined, addLabel: "New message" },
  ];

  function presenceOf(id: string): { tone: "ok" | "warn" | "muted"; label: string; cls: string } {
    if (!online.has(id)) return { tone: "muted", label: "Offline", cls: s.offline };
    const p = people.get(id)?.presence;
    if (p && p !== "available") return { tone: "warn", label: p === "away" ? "Away" : p[0].toUpperCase() + p.slice(1), cls: s.away };
    return { tone: "ok", label: "Online", cls: s.online };
  }

  function chIcon(c: Conversation) {
    if (c.kind === "dm") {
      const other = c.members.find((m) => m.memberId !== me.id)?.memberId ?? me.id;
      const pr = presenceOf(other);
      return (
        <span className={s.chIc}>
          <Avatar name={people.get(other)?.name ?? "?"} size={22} />
          <i className={cn(s.pres, pr.cls)} title={pr.label} />
        </span>
      );
    }
    if (c.kind === "group")
      return (
        <span className={s.chIc} title={`${c.members.length} people`}>
          <Users size={15} />
        </span>
      );
    return <span className={s.chIc}>{c.kind === "private" ? <Lock size={15} /> : <Hash size={15} />}</span>;
  }

  function sideItem(c: Conversation) {
    const on = c.id === currentId;
    const muted = c.notify === "mute";
    const count = on || muted ? 0 : c.notify === "mentions" ? c.mentions : c.unread || c.mentions;
    const bold = !on && !muted && (c.unread > 0 || c.mentions > 0);
    const name = isDirect(c) ? convLabel(c, people, me.id) : c.name ?? "";
    return (
      <button
        key={c.id}
        type="button"
        className={cn(s.item, on && s.on, muted && s.muted, bold && s.unread)}
        aria-current={on || undefined}
        onClick={() => void open(c.id)}
      >
        {chIcon(c)}
        <span className={s.name}>{name}</span>
        {drafts.has(c.id) && !on ? (
          <span className={s.flag} title="Draft">
            <Pencil size={13} aria-label="Draft" />
          </span>
        ) : null}
        {muted ? (
          <span className={s.flag} title="Muted">
            <BellOff size={13} aria-label="Muted" />
          </span>
        ) : null}
        {count ? (
          <b key={c.mentions} className={cn(s.unr, c.mentions > 0 && s.mentionAlert)} aria-label={`${count} unread${c.mentions ? ", mentions you" : ""}`}>
            {c.mentions ? "@ " : ""}
            {count}
          </b>
        ) : null}
      </button>
    );
  }

  const sorted = (kinds: string[]) => {
    const list = convs.filter(
      (c) => kinds.includes(c.kind) && (!c.archivedAt || c.id === currentId) && (!q || convLabel(c, people, me.id).toLowerCase().includes(q)),
    );
    return kinds.includes("dm")
      ? list.sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""))
      : list.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  };

  const rows = conv ? buildRows(messages, { today, newFromId }) : [];
  const lastMine = conv && isDirect(conv) ? messages.findLast((m) => m.authorId === me.id && m.id > 0 && !m.deletedAt && inChannel(m)) : undefined;
  const lastMineStatus = lastMine && conv ? (seenByAll(lastMine.id, conv.members.filter((m) => m.memberId !== me.id)) ? "seen" : "sent") : null;
  const pins = messages.filter((m) => m.pinnedAt && !m.deletedAt).length;
  const fileCount = messages.filter((m) => !m.deletedAt && m.id > 0).reduce((n, m) => n + m.files.length, 0);
  const typers = Object.keys(typing);
  const other = conv?.kind === "dm" ? conv.members.find((m) => m.memberId !== me.id)?.memberId : undefined;
  const liveDot = { live: ["Live", "ok"], reconnecting: ["Reconnecting…", "warn"], offline: ["Offline", "danger"] } as const;

  return (
    <div className={cn("page", s.root)}>
      <div className={cn(s.app, pane && s.paneOpen, mobileMain && s.showMain)}>
        <aside className={s.side} aria-label="Conversations">
          <div className={s.sideTop}>
            <input type="search" value={jump} onChange={(e) => setJump(e.target.value)} placeholder="Jump to a conversation" aria-label="Jump to a conversation" />
          </div>
          <nav className={s.list}>
            {sections.map((sec) => {
              const items = sorted(sec.kinds);
              if (!items.length && (q || !sec.add)) return null;
              return (
                <div key={sec.title}>
                  <div className={s.sec}>
                    <h2>{sec.title}</h2>
                    {sec.add ? (
                      <IconButton label={sec.addLabel} className={s.sm} onClick={sec.add}>
                        <Plus size={14} />
                      </IconButton>
                    ) : null}
                  </div>
                  {items.map(sideItem)}
                </div>
              );
            })}
            {q && !convs.some((c) => convLabel(c, people, me.id).toLowerCase().includes(q)) ? (
              <p className={cn(s.empty, "small muted")}>No conversation matches &ldquo;{jump.trim()}&rdquo;.</p>
            ) : null}
          </nav>
          <div className={s.sideFoot}>
            {isStaff ? (
              <div className="row">
                <Button size="sm" variant="primary" onClick={() => setDialog({ t: "new-msg" })}>
                  <Pencil size={14} /> New message
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDialog({ t: "browse" })}>
                  Browse channels
                </Button>
              </div>
            ) : null}
            {props.slackImport}
            <div className={s.liveRow}>
              <StatusDot tone={liveDot[live][1]}>{liveDot[live][0]}</StatusDot>
            </div>
          </div>
        </aside>

        <section className={s.main} aria-label="Messages">
          {conv ? (
            <ChatContext.Provider value={ctx!}>
              <header className={s.head}>
                <IconButton label="Back to conversations" className={s.back} onClick={() => setMobileMain(false)}>
                  <ChevronLeft size={16} />
                </IconButton>
                <div className={s.title}>
                  <h2>
                    {other ? <Avatar name={people.get(other)?.name ?? "?"} size={24} /> : null}
                    {label}
                    {conv.kind === "private" ? (
                      <span className="muted" title="Private">
                        <Lock size={14} aria-label="Private" />
                      </span>
                    ) : null}
                  </h2>
                  <p>
                    {other ? (
                      <>
                        <StatusDot tone={presenceOf(other).tone}>{presenceOf(other).label}</StatusDot>
                        <span className="muted small">{people.get(other)?.title ?? ""}</span>
                      </>
                    ) : (
                      <span className="muted small">{conv.topic ?? (conv.kind === "group" ? "Group message" : "")}</span>
                    )}
                  </p>
                </div>
                <div className={s.tools}>
                  <span className={s.hideXs} title={`${conv.members.length} members`}>
                    <Avatars>
                      {conv.members.slice(0, 4).map((m) => (
                        <Avatar key={m.memberId} name={people.get(m.memberId)?.name ?? "?"} size={24} />
                      ))}
                    </Avatars>
                  </span>
                  <span className={cn("small muted num", s.hideXs)}>{conv.members.length} members</span>
                  <Huddle
                    channelId={conv.id}
                    me={{ id: me.id, name: me.name }}
                    huddle={!archived && liveHuddle?.channelId === conv.id ? liveHuddle.huddle : null}
                    canStart={canPost}
                    onChange={() => void loadHuddle()}
                  />
                  {isStaff && can(me, "calendar.use") && !archived ? (
                    <ScheduleMeeting
                      channelId={conv.id}
                      meId={me.id}
                      people={conv.members.flatMap((m) => {
                        const p = people.get(m.memberId);
                        return p && p.kind === "staff" ? [{ id: p.id, name: p.name }] : [];
                      })}
                      defaultDate={new Date(Date.parse(today) + 86_400_000).toISOString().slice(0, 10)}
                    />
                  ) : null}
                  <IconButton
                    label={`Pinned messages (${pins})`}
                    className={cn(pane?.mode === "pins" && "on")}
                    onClick={() => setPane(pane?.mode === "pins" ? null : { mode: "pins" })}
                  >
                    <Pin size={16} />
                    <span className="small num">{pins || ""}</span>
                  </IconButton>
                  <IconButton
                    label={`Files (${fileCount})`}
                    className={cn(pane?.mode === "files" && "on")}
                    onClick={() => setPane(pane?.mode === "files" ? null : { mode: "files" })}
                  >
                    <FileText size={16} />
                    <span className="small num">{fileCount || ""}</span>
                  </IconButton>
                  <IconButton label="Search messages" onClick={() => setDialog({ t: "search" })}>
                    <Search size={16} />
                  </IconButton>
                  <Seg
                    label="Notifications"
                    value={conv.notify}
                    onChange={(v) => void changeNotify(v as Notify)}
                    items={[
                      { value: "all", label: "All" },
                      { value: "mentions", label: "Mentions" },
                      { value: "mute", label: "Mute" },
                    ]}
                  />
                  <IconButton label="Conversation settings" onClick={() => setDialog({ t: "settings" })}>
                    <Settings size={16} />
                  </IconButton>
                </div>
              </header>

              {live !== "live" ? (
                <div className={cn(s.off, live === "reconnecting" && s.rec)} role="status">
                  {live === "offline" ? (
                    <>
                      <span>You&apos;re offline. Messages you send now will offer Retry until you reconnect.</span>
                      <Button
                        size="sm"
                        onClick={() => {
                          sb.realtime.connect();
                          void catchUpNow(true);
                        }}
                      >
                        Reconnect now
                      </Button>
                    </>
                  ) : (
                    <span>Reconnecting… checking for new messages every 12 seconds.</span>
                  )}
                </div>
              ) : null}

              <div
                className={s.msgs}
                ref={msgsEl}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
                }}
                onDragOver={(e) => canPost && e.preventDefault()}
                onDrop={(e) => {
                  if (!canPost || !e.dataTransfer.files.length) return;
                  e.preventDefault();
                  composer.current?.addFiles(e.dataTransfer.files);
                }}
              >
                <div className={s.intro}>
                  {other ? (
                    <Avatar name={people.get(other)?.name ?? "?"} size={44} />
                  ) : (
                    <span className={s.introIc}>{conv.kind === "private" ? <Lock size={22} /> : conv.kind === "group" ? <Users size={22} /> : <Hash size={22} />}</span>
                  )}
                  <div>
                    <h3>{label}</h3>
                    <p className="muted small">
                      {conv.kind === "dm"
                        ? `Your direct messages with ${label}.`
                        : conv.kind === "group"
                          ? `Group message with ${label}.`
                          : `This is the start of ${label}. ${conv.topic ?? ""}`}
                    </p>
                  </div>
                </div>
                {loading ? <p className={cn(s.empty, "small muted")}>Loading messages…</p> : null}
                {rows.map((r) =>
                  r.type === "day" ? (
                    <div key={r.key} className={s.day}>
                      {r.label}
                    </div>
                  ) : r.type === "new" ? (
                    <div key={r.key} className={s.newDiv} role="separator" data-new>
                      New messages
                    </div>
                  ) : (
                    <MessageItem
                      key={r.key}
                      m={r.msg}
                      grouped={r.grouped}
                      flash={flashId === r.msg.id}
                      status={lastMine && r.msg.id === lastMine.id ? lastMineStatus : null}
                    />
                  ),
                )}
              </div>

              <div className={s.typing} aria-live="polite">
                {typers.length ? (
                  <>
                    <span className={s.dots} aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                    <span>
                      {typers.map((n) => n.split(" ")[0]).join(" and ")} {typers.length === 1 ? "is" : "are"} typing…
                    </span>
                  </>
                ) : null}
              </div>

              {canPost ? (
                <Composer
                  ref={composer}
                  draftKey={conv.id}
                  placeholder={`Message ${label}${conv.adminsOnly ? " (admins only)" : ""}`}
                  label="Write a message"
                  people={memberPeople}
                  onSend={(body, files) => void send(body, files)}
                  onTyping={sendTyping}
                  voiceChannelId={conv.id}
                />
              ) : (
                <div className={s.readonly}>{archived ? `${label} is archived. Its history stays searchable.` : `Only admins can post in ${label}.`}</div>
              )}
            </ChatContext.Provider>
          ) : (
            <EmptyState
              icon={<MessagesSquare size={28} aria-hidden />}
              title="No conversation open"
              action={
                isStaff ? (
                  <Button variant="primary" onClick={() => setDialog({ t: "new-msg" })}>
                    New message
                  </Button>
                ) : undefined
              }
            >
              Pick a conversation on the left, or start a new one.
            </EmptyState>
          )}
        </section>

        <aside className={s.pane} aria-label="Details">
          {pane && conv ? (
            <ChatContext.Provider value={ctx!}>
              <Pane
                pane={pane}
                label={label}
                mentionPeople={memberPeople}
                canPost={canPost}
                onClose={() => setPane(null)}
                onReply={(body, files, parentId, also) => void send(body, files, parentId, also)}
              />
            </ChatContext.Provider>
          ) : null}
        </aside>
      </div>

      {dialog?.t === "new-msg" ? <NewMessageDialog onClose={() => setDialog(null)} people={props.people} meId={me.id} onDone={(id) => void openNew(id)} /> : null}
      {dialog?.t === "new-channel" ? (
        <NewChannelDialog
          onClose={() => setDialog(null)}
          people={props.people}
          meId={me.id}
          clients={props.clients}
          initialKind={dialog.kind}
          onDone={(id) => void openNew(id)}
        />
      ) : null}
      {dialog?.t === "browse" ? <BrowseDialog onClose={() => setDialog(null)} onOpen={(id) => void openNew(id)} /> : null}
      {dialog?.t === "search" ? (
        <SearchDialog
          onClose={() => setDialog(null)}
          currentId={currentId}
          convs={convs}
          people={people}
          meId={me.id}
          today={today}
          onGoto={(channelId, messageId) => {
            setDialog(null);
            void open(channelId, messageId);
          }}
        />
      ) : null}
      {dialog?.t === "ticket" ? (
        <TicketDialog
          onClose={() => setDialog(null)}
          message={dialog.m}
          people={props.people}
          link={`${typeof window === "undefined" ? "" : location.origin}/chat?c=${dialog.m.channelId}&m=${dialog.m.id}`}
        />
      ) : null}
      {dialog?.t === "forward" ? <ForwardDialog onClose={() => setDialog(null)} message={dialog.m} convs={convs} people={people} meId={me.id} /> : null}
      {dialog?.t === "settings" && conv ? (
        <SettingsDialog
          onClose={() => setDialog(null)}
          conv={conv}
          canAdmin={canModerate}
          onNotify={(n) => setConvs((cs) => cs.map((c) => (c.id === conv.id ? { ...c, notify: n } : c)))}
          onSaved={(topic, adminsOnly) => setConvs((cs) => cs.map((c) => (c.id === conv.id ? { ...c, topic: topic || null, adminsOnly } : c)))}
          onExtras={(patch) => setConvs((cs) => cs.map((c) => (c.id === conv.id ? { ...c, ...patch } : c)))}
          onLeft={() => {
            setDialog(null);
            const left = conv.id;
            const rest = convs.filter((c) => c.id !== left);
            setConvs(rest);
            currentRef.current = null;
            setCurrentId(null);
            setMessages([]);
            setPane(null);
            setMobileMain(false);
            window.history.replaceState(null, "", "/chat");
            toast(`You left ${label}`);
          }}
        />
      ) : null}
    </div>
  );
}
