import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("server-only", () => ({}));
import { newTicketAssignee } from "../assignment";

function database(project: Record<string, unknown> | null, creator: { id: string } | null = null) {
  const queried = vi.fn();
  const eq = vi.fn();
  const db = {
    from(table: string) {
      queried(table);
      const query = {
        select: () => query,
        eq: (...args: unknown[]) => { eq(...args); return query; },
        maybeSingle: async () => ({ data: table === "projects" ? project : creator }),
      };
      return query;
    },
  } as unknown as SupabaseClient;
  return { db, queried, eq };
}

describe("default new task assignee", () => {
  it("uses the selected project's active, visible staff originator", async () => {
    const { db, eq } = database({ created_by: "originator" }, { id: "originator" });
    expect(await newTicketAssignee(db, "project", undefined)).toBe("originator");
    expect(eq).toHaveBeenCalledWith("id", "project");
    expect(eq).toHaveBeenCalledWith("kind", "staff");
    expect(eq).toHaveBeenCalledWith("status", "active");
  });

  it("preserves a manually selected assignee without reading a default", async () => {
    const { db, queried } = database({ created_by: "originator" });
    expect(await newTicketAssignee(db, "project", "chosen-person")).toBe("chosen-person");
    expect(queried).not.toHaveBeenCalled();
  });

  it("preserves an explicit Unassigned choice", async () => {
    const { db, queried } = database({ created_by: "originator" });
    expect(await newTicketAssignee(db, "project", null)).toBeNull();
    expect(queried).not.toHaveBeenCalled();
  });

  it("leaves unknown historical creators and pre-migration projects unassigned", async () => {
    for (const project of [{ created_by: null }, {}, null]) {
      const { db, queried } = database(project);
      expect(await newTicketAssignee(db, "project", undefined)).toBeNull();
      expect(queried).not.toHaveBeenCalledWith("members");
    }
  });

  it("does not assign an inaccessible, inactive, or deleted creator", async () => {
    const { db } = database({ created_by: "originator" });
    expect(await newTicketAssignee(db, "project", undefined)).toBeNull();
  });

  it("leaves tasks without a project unassigned", async () => {
    const { db, queried } = database(null);
    expect(await newTicketAssignee(db, null, undefined)).toBeNull();
    expect(queried).not.toHaveBeenCalled();
  });
});
