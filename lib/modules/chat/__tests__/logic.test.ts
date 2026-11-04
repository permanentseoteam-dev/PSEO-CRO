import { describe, expect, it } from "vitest";
import {
  buildRows,
  bumpUnread,
  convLabel,
  countUnread,
  dayLabel,
  dubai,
  fileProblem,
  firstUnreadId,
  mentionMatches,
  mentionQuery,
  parseMentions,
  reactionSummary,
  seenByAll,
  slugChannel,
  threadInfo,
  tokenize,
  upsertMessage,
} from "../logic";
import type { Conversation, Message } from "../types";

const ME = "me";
let n = 0;
function msg(p: Partial<Message> & { at: string }): Message {
  const id = p.id ?? ++n;
  return {
    id,
    clientKey: null,
    channelId: "c1",
    authorId: "a",
    parentId: null,
    body: "hi",
    mentions: [],
    alsoInChannel: false,
    forward: null,
    files: [],
    pinnedAt: null,
    editedAt: null,
    deletedAt: null,
    ticketKey: null,
    createdAt: p.at,
    ...p,
  };
}

describe("time and day labels", () => {
  it("converts to Dubai time", () => {
    expect(dubai("2026-11-04T05:14:00Z")).toEqual({ day: "2026-11-04", time: "09:14" });
    expect(dubai("2026-11-03T21:30:00Z")).toEqual({ day: "2026-11-04", time: "01:30" });
  });
  it("labels today, yesterday and older days", () => {
    expect(dayLabel("2026-11-04", "2026-11-04")).toBe("Today, Wednesday 4 November");
    expect(dayLabel("2026-11-03", "2026-11-04")).toBe("Yesterday, Tuesday 3 November");
    expect(dayLabel("2026-11-02", "2026-11-04")).toBe("Monday 2 November");
    expect(dayLabel("2025-12-31", "2026-11-04")).toBe("Wednesday 31 December 2025");
  });
});

describe("unread counting", () => {
  const list = [
    msg({ id: 1, at: "2026-11-04T05:00:00Z" }),
    msg({ id: 2, at: "2026-11-04T05:01:00Z", authorId: ME }),
    msg({ id: 3, at: "2026-11-04T05:02:00Z", mentions: [ME] }),
    msg({ id: 4, at: "2026-11-04T05:03:00Z", parentId: 1 }), // thread reply only
    msg({ id: 5, at: "2026-11-04T05:04:00Z", parentId: 1, alsoInChannel: true }),
    msg({ id: 6, at: "2026-11-04T05:05:00Z", deletedAt: "2026-11-04T05:06:00Z" }),
    msg({ id: 7, at: "2026-11-04T05:07:00Z", parentId: 1, mentions: [ME] }), // mention inside a thread
  ];
  it("counts others' channel messages after last read, and mentions anywhere", () => {
    expect(countUnread(list, 0, ME)).toEqual({ unread: 3, mentions: 2 });
    expect(countUnread(list, 3, ME)).toEqual({ unread: 1, mentions: 1 });
    expect(countUnread(list, 7, ME)).toEqual({ unread: 0, mentions: 0 });
  });
  it("finds the first unread message for the New divider", () => {
    expect(firstUnreadId(list, 0, ME)).toBe(1);
    expect(firstUnreadId(list, 1, ME)).toBe(3);
    expect(firstUnreadId(list, 5, ME)).toBeNull();
  });
  it("bumps sidebar counts for a live message", () => {
    const c = { lastReadId: 10, unread: 2, mentions: 0 } as Conversation;
    expect(bumpUnread(c, msg({ id: 11, at: "2026-11-04T05:00:00Z", mentions: [ME] }), ME)).toMatchObject({ unread: 3, mentions: 1 });
    expect(bumpUnread(c, msg({ id: 12, at: "2026-11-04T05:00:00Z", authorId: ME }), ME)).toBe(c);
    expect(bumpUnread(c, msg({ id: 9, at: "2026-11-04T05:00:00Z" }), ME)).toBe(c);
  });
});

describe("message grouping", () => {
  const today = "2026-11-04";
  it("adds day dividers, the New divider and groups runs by the same person within 5 minutes", () => {
    const rows = buildRows(
      [
        msg({ id: 1, at: "2026-11-03T12:00:00Z", authorId: "a" }),
        msg({ id: 2, at: "2026-11-04T05:00:00Z", authorId: "a" }), // new day: not grouped
        msg({ id: 3, at: "2026-11-04T05:04:00Z", authorId: "a" }), // grouped
        msg({ id: 4, at: "2026-11-04T05:10:00Z", authorId: "a" }), // 6 min gap
        msg({ id: 5, at: "2026-11-04T05:11:00Z", authorId: "b" }), // other person
        msg({ id: 6, at: "2026-11-04T05:12:00Z", authorId: "b" }), // after New divider
        msg({ id: 7, at: "2026-11-04T05:13:00Z", authorId: "b", pinnedAt: "x" }), // pinned
        msg({ id: 8, at: "2026-11-04T05:13:30Z", authorId: "b", parentId: 7 }), // thread reply: hidden
      ],
      { today, newFromId: 6 },
    );
    expect(rows.map((r) => (r.type === "msg" ? `${r.msg.id}${r.grouped ? "g" : ""}` : r.type))).toEqual([
      "day", "1", "day", "2", "3g", "4", "5", "new", "6", "7",
    ]);
    expect(rows[2]).toMatchObject({ label: "Today, Wednesday 4 November" });
  });
  it("does not group under a deleted message", () => {
    const rows = buildRows(
      [msg({ id: 1, at: "2026-11-04T05:00:00Z", deletedAt: "y" }), msg({ id: 2, at: "2026-11-04T05:01:00Z" })],
      { today, newFromId: null },
    );
    expect(rows[2]).toMatchObject({ type: "msg", grouped: false });
  });
  it("summarises threads", () => {
    const list = [
      msg({ id: 1, at: "2026-11-04T05:00:00Z" }),
      msg({ id: 2, at: "2026-11-04T05:01:00Z", parentId: 1, authorId: "b" }),
      msg({ id: 3, at: "2026-11-04T05:02:00Z", parentId: 1, authorId: "c" }),
      msg({ id: 4, at: "2026-11-04T05:03:00Z", parentId: 1, authorId: "b" }),
    ];
    expect(threadInfo(list, 1)).toEqual({ count: 3, authors: ["b", "c"], last: "2026-11-04T05:03:00Z" });
  });
});

describe("optimistic upsert", () => {
  it("replaces the pending copy by client key and keeps id order", () => {
    const a = msg({ id: 5, at: "2026-11-04T05:00:00Z" });
    const pending = msg({ id: -1, clientKey: "k1", at: "2026-11-04T05:01:00Z", pending: true });
    let list = upsertMessage([a], pending);
    expect(list.map((m) => m.id)).toEqual([5, -1]);
    list = upsertMessage(list, msg({ id: 7, at: "2026-11-04T05:02:00Z" }));
    expect(list.map((m) => m.id)).toEqual([5, 7, -1]);
    list = upsertMessage(list, msg({ id: 8, clientKey: "k1", at: "2026-11-04T05:01:00Z" }));
    expect(list.map((m) => m.id)).toEqual([5, 7, 8]);
    expect(list.some((m) => m.pending)).toBe(false);
    expect(upsertMessage(list, msg({ id: 8, clientKey: "k1", at: "x", body: "edited" })).length).toBe(3);
  });
  it("keeps several pending messages in the order they were sent", () => {
    let list = upsertMessage([], msg({ id: -1, clientKey: "a", at: "x", pending: true }));
    list = upsertMessage(list, msg({ id: -2, clientKey: "b", at: "x", pending: true }));
    list = upsertMessage(list, msg({ id: 3, at: "x" }));
    expect(list.map((m) => m.id)).toEqual([3, -1, -2]);
  });
});

describe("reactions and seen", () => {
  it("groups reactions by emoji", () => {
    const rx = [
      { messageId: 1, memberId: "a", emoji: "👍" },
      { messageId: 1, memberId: ME, emoji: "👍" },
      { messageId: 1, memberId: "b", emoji: "🔥" },
      { messageId: 2, memberId: "a", emoji: "👍" },
    ];
    expect(reactionSummary(rx, 1, ME)).toEqual([
      { emoji: "👍", count: 2, mine: true, memberIds: ["a", ME] },
      { emoji: "🔥", count: 1, mine: false, memberIds: ["b"] },
    ]);
  });
  it("is seen only when everyone else has read it", () => {
    expect(seenByAll(10, [{ lastReadId: 10 }, { lastReadId: 12 }])).toBe(true);
    expect(seenByAll(10, [{ lastReadId: 10 }, { lastReadId: 9 }])).toBe(false);
    expect(seenByAll(10, [])).toBe(false);
  });
});

describe("mentions and formatting", () => {
  const people = [
    { id: "1", name: "Sara Malik" },
    { id: "10", name: "Yusuf Ali" },
    { id: "x", name: "Ali" },
  ];
  it("parses @mentions by full name", () => {
    expect(parseMentions("@Sara Malik can you check?", people)).toEqual(["1"]);
    expect(parseMentions("cc @Yusuf Ali and @Ali", people).sort()).toEqual(["10", "x"]);
    expect(parseMentions("email sara@Sara Malik", people)).toEqual([]);
    expect(parseMentions("no mention", people)).toEqual([]);
  });
  it("tokenizes markdown basics and mentions", () => {
    expect(tokenize("Hi @Sara Malik, see **this** and _that_ in `code` https://x.com/a.", ["Sara Malik"], "Sara Malik")).toEqual([
      { t: "text", v: "Hi " },
      { t: "mention", v: "Sara Malik", me: true },
      { t: "text", v: ", see " },
      { t: "b", v: "this" },
      { t: "text", v: " and " },
      { t: "i", v: "that" },
      { t: "text", v: " in " },
      { t: "code", v: "code" },
      { t: "text", v: " " },
      { t: "link", v: "https://x.com/a" },
      { t: "text", v: "." },
    ]);
    expect(tokenize("file_name_here", [], "x")).toEqual([{ t: "text", v: "file_name_here" }]);
  });
  it("finds the mention being typed", () => {
    expect(mentionQuery("hello @Sa", 9)).toEqual({ start: 6, q: "Sa" });
    expect(mentionQuery("@", 1)).toEqual({ start: 0, q: "" });
    expect(mentionQuery("@Sara Ma", 8)).toEqual({ start: 0, q: "Sara Ma" });
    expect(mentionQuery("mail@x", 6)).toBeNull();
    expect(mentionQuery("hello", 5)).toBeNull();
  });
  it("matches people by name or surname start", () => {
    expect(mentionMatches(people, "ma").map((p) => p.name)).toEqual(["Sara Malik"]);
    expect(mentionMatches(people, "ali").map((p) => p.name)).toEqual(["Yusuf Ali", "Ali"]);
  });
});

describe("labels and files", () => {
  it("labels channels and DMs", () => {
    const people = new Map([["me", { name: "Sara Malik" }], ["o", { name: "Omar Haddad" }]]);
    const members = [{ memberId: "me", role: "admin" as const, lastReadId: 0 }, { memberId: "o", role: "member" as const, lastReadId: 0 }];
    expect(convLabel({ kind: "public", name: "general", members }, people, "me")).toBe("#general");
    expect(convLabel({ kind: "dm", name: null, members }, people, "me")).toBe("Omar Haddad");
  });
  it("blocks dangerous and oversized files", () => {
    expect(fileProblem({ name: "a.pdf", size: 1000 })).toBeNull();
    expect(fileProblem({ name: "setup.EXE", size: 10 })).toMatch(/blocked/);
    expect(fileProblem({ name: "big.mov", size: 30 * 1024 * 1024 })).toMatch(/25 MB/);
  });
  it("slugs channel names", () => {
    expect(slugChannel("  Harbor Legal!! ")).toBe("harbor-legal");
  });
});
