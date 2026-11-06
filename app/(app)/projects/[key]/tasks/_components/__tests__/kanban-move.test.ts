import { describe, expect, it } from "vitest";
import { landingIndex, moveTask } from "../kanban-move";

const tasks = [
  { id: "a", status: "todo" },
  { id: "b", status: "in_progress" },
  { id: "c", status: "todo" },
  { id: "d", status: "in_progress" },
];

describe("moveTask", () => {
  it("changes only the moved task's status", () => {
    const next = moveTask(tasks, "c", "in_progress");
    expect(next.map((t) => t.status)).toEqual(["todo", "in_progress", "in_progress", "in_progress"]);
    expect(tasks[2].status).toBe("todo");
  });
  it("returns the same list for a no-op or unknown id", () => {
    expect(moveTask(tasks, "a", "todo")).toBe(tasks);
    expect(moveTask(tasks, "zz", "done")).toBe(tasks);
  });
});

describe("landingIndex", () => {
  it("counts the target column's cards that come before the dragged one", () => {
    expect(landingIndex(tasks, "a", "in_progress")).toBe(0);
    expect(landingIndex(tasks, "c", "in_progress")).toBe(1);
    expect(landingIndex(tasks, "d", "todo")).toBe(2);
  });
  it("lands at the end of the column for an unknown id", () => {
    expect(landingIndex(tasks, "zz", "todo")).toBe(2);
  });
});
