import { describe, expect, it } from "vitest";
import { fmt12, time12 } from "../format-time";

describe("12-hour times", () => {
  it("fmt12 turns HH:MM into h:mm AM/PM", () => {
    expect(fmt12("20:06")).toBe("8:06 PM");
    expect(fmt12("08:06:00")).toBe("8:06 AM");
    expect(fmt12("00:15")).toBe("12:15 AM");
    expect(fmt12("12:00")).toBe("12:00 PM");
    expect(fmt12("Late")).toBe("Late");
  });

  it("time12 formats an instant in a time zone with a plain space", () => {
    expect(time12("2026-11-04T16:06:00Z", "Asia/Dubai")).toBe("8:06 PM");
    expect(time12("2026-11-04T20:30:00Z", "Asia/Dubai")).toBe("12:30 AM");
  });
});
