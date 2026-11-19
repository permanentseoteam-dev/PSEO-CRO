import { describe, expect, it } from "vitest";
import { dueCountdown } from "../space-logic";

describe("dueCountdown", () => {
  const today = "2026-11-20";
  it("counts days left, today and overdue", () => {
    expect(dueCountdown("2026-11-23", today)).toEqual({ text: "3 days left", overdue: false });
    expect(dueCountdown("2026-11-21", today)).toEqual({ text: "1 day left", overdue: false });
    expect(dueCountdown("2026-11-20", today)).toEqual({ text: "Due today", overdue: false });
    expect(dueCountdown("2026-11-19", today)).toEqual({ text: "1 day overdue", overdue: true });
    expect(dueCountdown("2026-10-31", today)).toEqual({ text: "20 days overdue", overdue: true });
  });
  it("crosses month and year ends", () => {
    expect(dueCountdown("2027-01-01", "2026-12-31")).toEqual({ text: "1 day left", overdue: false });
  });
  it("is null with no due date, a done task or a bad date", () => {
    expect(dueCountdown(null, today)).toBeNull();
    expect(dueCountdown("2026-11-01", today, true)).toBeNull();
    expect(dueCountdown("soon", today)).toBeNull();
  });
});
