import { describe, expect, it } from "vitest";
import { DEFAULT_WORK_CONFIG as W, TASK_TYPES, effectiveConfig, suggestKey } from "../space-logic";

describe("effectiveConfig", () => {
  it("uses only RACI types even when stored workspace types are legacy or custom", () => {
    const legacy = { ...W, taskTypes: [{ id: "operational", name: "Operational", color: "#000000" }] };
    expect(TASK_TYPES.map((t) => t.name)).toEqual(["Responsible", "Accountable", "Consulted", "Informed"]);
    expect(effectiveConfig(legacy, "inherit", null).taskTypes).toBe(TASK_TYPES);
    expect(effectiveConfig(legacy, "custom", { taskTypes: [] }).taskTypes).toBe(TASK_TYPES);
  });
  it("inherit mode returns the workspace config, ignoring the project's", () => {
    expect(effectiveConfig(W, "inherit", { taskTypes: [] })).toBe(W);
  });

  it("custom mode merges statuses but keeps the fixed RACI types", () => {
    const c = effectiveConfig(W, "custom", {
      statuses: { todo: { label: "Inbox" }, done: { emoji: "🎉" } },
      taskTypes: [{ id: "x", name: "X", color: "#000000" }],
    });
    expect(c.statuses.todo).toEqual({ label: "Inbox", emoji: "✉️" });
    expect(c.statuses.done).toEqual({ label: "Completed", emoji: "🎉" });
    expect(c.statuses.blocked).toEqual(W.statuses.blocked);
    expect(c.taskTypes).toBe(TASK_TYPES);
    expect(c.eventTypes).toBe(W.eventTypes);
  });

  it("custom mode falls back on empty or malformed values", () => {
    const c = effectiveConfig(W, "custom", { statuses: { todo: { label: " " } }, eventTypes: "nope", taskTypes: [{ id: 1 }] });
    expect(c.statuses.todo.label).toBe("New task");
    expect(c.eventTypes).toBe(W.eventTypes);
    expect(c.taskTypes).toBe(TASK_TYPES);
    expect(effectiveConfig(W, "custom", null)).toBe(W);
  });
});

describe("suggestKey", () => {
  it("uses initials of several words, else the first letters", () => {
    expect(suggestKey("Client Portal Design", [])).toBe("CPD");
    expect(suggestKey("marketing", [])).toBe("MARK");
    expect(suggestKey("Café", [])).toBe("CAFE");
  });

  it("always gives 2 to 8 upper-case letters", () => {
    for (const n of ["x", "42", "!!", "A b c d e f g h i j", "Ünïcødé ★ thing"]) {
      expect(suggestKey(n, [])).toMatch(/^[A-Z]{2,8}$/);
    }
  });

  it("avoids taken keys (case-insensitive)", () => {
    expect(suggestKey("marketing", ["mark"])).toBe("MARKE");
    expect(suggestKey("Client Portal Design", ["CPD"])).toBe("CLIE");
    const taken = ["SE", "SEA", "SEAA"];
    const k = suggestKey("Se", taken);
    expect(taken).not.toContain(k);
    expect(k).toMatch(/^[A-Z]{2,8}$/);
  });
});
