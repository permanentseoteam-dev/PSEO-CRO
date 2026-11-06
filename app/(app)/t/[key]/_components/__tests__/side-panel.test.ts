import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { TicketDetail } from "@/lib/modules/tickets/types";
import { SidePanel } from "../side-panel";
import { Description } from "../description";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/modules/tickets/actions", () => ({ logTime: vi.fn(), startTimer: vi.fn(), stopTimer: vi.fn(), updateTicket: vi.fn() }));
vi.mock("@/components/ui", async (original) => ({ ...(await original<typeof import("@/components/ui")>()), useToast: () => vi.fn() }));

const ticket = {
  id: "task-1", status: "todo", priority: "medium", assigneeId: "person-1", due: null,
  estimateMin: 90, checklist: [], timer: null, canEdit: true,
} as unknown as TicketDetail;

describe("task detail property contract", () => {
  it("renders only the reference properties in order, with one timer/log action", () => {
    const html = renderToStaticMarkup(
      createElement(SidePanel, { t: ticket, people: [{ id: "person-1", name: "Project creator" }], today: "2026-11-06",
        typeField: createElement(Fragment, null, createElement("dt", null, "Type"), createElement("dd", null, "Responsible")) }),
    );
    expect([...html.matchAll(/<dt>(.*?)<\/dt>/g)].map((match) => match[1])).toEqual([
      "Status", "Type", "Due date", "Assignee", "Estimated time", "Priority",
    ]);
    expect(html.match(/>Start timer<\/button>/g)).toHaveLength(1);
    expect(html.match(/>Log time<\/button>/g)).toHaveLength(1);
    expect(html).toContain('value="person-1" selected=""');
    expect(html).not.toMatch(/Co-assignees|Watchers|Reporter|Time logged|Source/);
  });

  it("keeps read-only properties disabled", () => {
    const html = renderToStaticMarkup(createElement(SidePanel, { t: { ...ticket, canEdit: false }, people: [], today: "2026-11-06" }));
    expect((html.match(/<select[^>]*disabled=""/g) ?? []).length).toBe(3);
    expect((html.match(/<input[^>]*disabled=""/g) ?? []).length).toBe(2);
  });

  it("shows description without exposing the removed completion field", () => {
    const html = renderToStaticMarkup(createElement(Description, { id: "task-1", description: "Keep this description", doneWhen: "Saved hidden completion notes", canEdit: false }));
    expect(html).toContain("Keep this description");
    expect(html).not.toContain("Done when");
    expect(html).not.toContain("Saved hidden completion notes");
  });
});
