import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MyWork } from "@/app/(app)/my/_components/my-work";
import type { MyTicket } from "../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/modules/tickets/actions", () => ({ updateTicket: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
vi.mock("@/components/ui", async (original) => ({ ...(await original<typeof import("@/components/ui")>()), useToast: () => vi.fn() }));

const task = (id: string, patch: Partial<MyTicket> = {}): MyTicket => ({
  id, key: id, title: id + " title", status: "todo", priority: "normal", assigneeId: "me", assigneeName: "Me",
  reporterId: "other", watching: false, due: null, doneOn: null, projectName: null, subtasks: 0,
  checklistDone: 1, checklistTotal: 3, comments: 0, ...patch,
});
const tickets = [task("MY-1"), task("MY-2", { status: "done", doneOn: "2026-11-06" }), task("MY-3", { assigneeId: "other", watching: true })];

describe("My work shared board", () => {
  it("keeps the assigned subset and hides done tasks by default", () => {
    const html = renderToStaticMarkup(createElement(MyWork, { tickets, meId: "me", today: "2026-11-06", initialView: "assigned", initialLayout: "board" }));
    expect(html).toContain('class="board"');
    expect(html).toContain("MY-1 title");
    expect(html).not.toContain("MY-2 title");
    expect(html).not.toContain("MY-3 title");
    expect(html).not.toContain('aria-label="Move MY-1 to"');
  });

  it("reuses watcher filters and enables movement only with edit permission", () => {
    const html = renderToStaticMarkup(createElement(MyWork, { tickets, meId: "me", today: "2026-11-06", initialView: "watching", initialLayout: "board", canEdit: true }));
    expect(html).toContain("MY-3 title");
    expect(html).not.toContain("MY-1 title");
    expect(html).toContain('aria-label="Move MY-3 to"');
  });

  it("opens the board by default", () => {
    const html = renderToStaticMarkup(createElement(MyWork, { tickets, meId: "me", today: "2026-11-06", initialView: "assigned" }));
    expect(html).toContain('class="board"');
    expect(html).toContain("MY-1 title");
    expect(html).toContain('aria-label="My work layout"');
  });

  it("still offers the grouped list when chosen", () => {
    const html = renderToStaticMarkup(createElement(MyWork, { tickets, meId: "me", today: "2026-11-06", initialView: "assigned", initialLayout: "list" }));
    expect(html).not.toContain('class="board"');
    expect(html).toContain("No due date");
  });
});
