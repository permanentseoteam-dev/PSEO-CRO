import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { OrgChart } from "@/app/(app)/people/org/_components/org-chart";
import type { OrgNode } from "../logic";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(app)/people/actions", () => ({ placePerson: vi.fn() }));
vi.mock("@/components/ui", async (original) => ({ ...(await original<typeof import("@/components/ui")>()), useToast: () => vi.fn() }));

const person = (id: string, name: string) => ({ id, name, title: "Team member", department: "Operations", presence: "offline" }) as OrgNode["person"];
const roots: OrgNode[] = [{ person: person("manager", "Manager"), teamSize: 1, children: [{ person: person("report", "Direct report"), teamSize: 0, children: [] }] }];
const unplaced = [{ id: "new", name: "New member", title: null, reason: "Needs a manager" }];

describe("visual org chart", () => {
  it("renders reporting hierarchy, canvas controls, and permission-gated placement", () => {
    const view = (canPlace: boolean) => renderToStaticMarkup(createElement(OrgChart, { roots, unplaced, people: [], canPlace }));
    const html = view(false);
    expect(html).toContain('aria-label="Organization reporting chart"');
    expect(html).toContain('aria-label="Zoom in"');
    expect(html).toContain('aria-label="Zoom out"');
    expect(html).toContain('aria-label="Chart zoom"');
    expect(html).toContain('aria-label="Fold Manager&#x27;s team"');
    expect(html).toContain("Direct report");
    expect(html).toContain("New member");
    expect(html).not.toMatch(/>Place<\/button>/);
    expect(view(true)).toMatch(/>Place<\/button>/);
  });

  it("renders a useful empty state without dead canvas controls", () => {
    const html = renderToStaticMarkup(createElement(OrgChart, { roots: [], unplaced: [], people: [], canPlace: false }));
    expect(html).toContain("No reporting lines yet.");
    expect(html).not.toContain('aria-label="Zoom in"');
    expect(html).toContain("Everyone has a place.");
  });
});
