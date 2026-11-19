import { describe, expect, it } from "vitest";
import { DepartmentInput, DepartmentName, deleteWarning, departmentStats, isDuplicateName } from "../logic";

const none = { members: 0, projects: 0, kpis: 0, announcements: 0, deliveryRatings: 0 };

describe("DepartmentName", () => {
  it("trims and accepts 2 to 60 characters", () => {
    expect(DepartmentName.parse("  SEO  ")).toBe("SEO");
    expect(DepartmentName.safeParse("x".repeat(60)).success).toBe(true);
  });
  it("rejects too short or too long names", () => {
    for (const n of ["", "   ", " a ", "x".repeat(61)]) expect(DepartmentName.safeParse(n).success, n).toBe(false);
  });
});

describe("DepartmentInput", () => {
  it("takes an optional head id", () => {
    expect(DepartmentInput.safeParse({ name: "Ops", headId: null }).success).toBe(true);
    expect(DepartmentInput.safeParse({ name: "Ops", headId: "3f1c9a52-1b2c-4d5e-8f90-123456789abc" }).success).toBe(true);
    expect(DepartmentInput.safeParse({ name: "Ops", headId: "nope" }).success).toBe(false);
  });
});

describe("isDuplicateName", () => {
  const list = [
    { id: "a", name: "SEO" },
    { id: "b", name: "Client Success" },
  ];
  it("ignores case and outer spaces", () => {
    expect(isDuplicateName(" seo ", list)).toBe(true);
    expect(isDuplicateName("CLIENT SUCCESS", list)).toBe(true);
    expect(isDuplicateName("Ops", list)).toBe(false);
  });
  it("lets a department keep or recase its own name", () => {
    expect(isDuplicateName("seo", list, "a")).toBe(false);
    expect(isDuplicateName("seo", list, "b")).toBe(true);
  });
});

describe("deleteWarning", () => {
  it("says when nothing uses it", () => {
    expect(deleteWarning("Ops", none)).toBe('Delete "Ops"? No members or projects use it. This can\'t be undone.');
  });
  it("counts members and projects", () => {
    expect(deleteWarning("SEO", { ...none, members: 1, projects: 3 })).toContain("1 member and 3 projects will have no department.");
  });
  it("warns about announcements and delivery ratings that get deleted", () => {
    const t = deleteWarning("SEO", { ...none, announcements: 2, deliveryRatings: 1 });
    expect(t).toContain("2 announcements and 1 delivery rating for this department will be deleted.");
    expect(deleteWarning("SEO", none)).not.toContain("will be deleted");
    expect(deleteWarning("SEO", { ...none, kpis: 2 })).toContain("2 KPIs for this department will be switched off.");
  });
});

describe("departmentStats", () => {
  it("counts staff, active projects (join rows + primary) and open/overdue tasks of its staff", () => {
    const s = departmentStats(
      ["seo", "web"],
      [
        { id: "a", departmentId: "seo" },
        { id: "b", departmentId: "seo" },
        { id: "c", departmentId: "web" },
        { id: "x", departmentId: null },
      ],
      [
        { id: "p1", departmentId: "seo" },
        { id: "p2", departmentId: null },
      ],
      [
        { projectId: "p1", departmentId: "seo" },
        { projectId: "p1", departmentId: "web" },
        { projectId: "p2", departmentId: "web" },
        { projectId: "archived", departmentId: "seo" },
      ],
      [
        { assigneeId: "a", due: "2026-01-01" },
        { assigneeId: "b", due: "2026-01-05" },
        { assigneeId: "b", due: null },
        { assigneeId: "x", due: "2026-01-01" },
        { assigneeId: null, due: "2026-01-01" },
      ],
      "2026-01-05",
    );
    expect(s.seo).toEqual({ staff: 2, projects: 1, open: 3, overdue: 1 });
    expect(s.web).toEqual({ staff: 1, projects: 2, open: 0, overdue: 0 });
  });

  it("counts a task by its project's departments or its assignee's, once per department", () => {
    const s = departmentStats(
      ["seo", "web"],
      [{ id: "a", departmentId: "seo" }],
      [
        { id: "p1", departmentId: "seo" },
        { id: "p2", departmentId: null },
      ],
      [{ projectId: "p2", departmentId: "web" }],
      [
        { assigneeId: null, projectId: "p1", due: "2026-01-01" },
        { assigneeId: "a", projectId: "p1", due: null },
        { assigneeId: "a", projectId: "p2", due: "2026-01-01" },
        { assigneeId: null, projectId: "archived", due: null },
      ],
      "2026-01-05",
    );
    expect(s.seo).toEqual({ staff: 1, projects: 1, open: 3, overdue: 2 });
    expect(s.web).toEqual({ staff: 0, projects: 1, open: 1, overdue: 1 });
  });
});
