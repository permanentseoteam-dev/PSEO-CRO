import { describe, expect, it } from "vitest";
import { daysLeft } from "../logic";

describe("daysLeft", () => {
  it("labels today, future and past due dates", () => {
    expect(daysLeft("2026-11-04", "2026-11-04")).toEqual({ label: "Due today", overdue: false });
    expect(daysLeft("2026-11-05", "2026-11-04")).toEqual({ label: "1 day left", overdue: false });
    expect(daysLeft("2026-11-08", "2026-11-04")).toEqual({ label: "4 days left", overdue: false });
    expect(daysLeft("2026-11-03", "2026-11-04")).toEqual({ label: "1 day overdue", overdue: true });
    expect(daysLeft("2026-10-30", "2026-11-04")).toEqual({ label: "5 days overdue", overdue: true });
  });
  it("counts across a month and DST boundary by calendar days", () => {
    expect(daysLeft("2026-04-01", "2026-03-28")).toEqual({ label: "4 days left", overdue: false });
  });
});
