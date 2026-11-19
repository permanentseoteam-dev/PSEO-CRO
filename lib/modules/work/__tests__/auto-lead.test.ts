import { describe, expect, it } from "vitest";
import { autoLead } from "../space-logic";

describe("autoLead", () => {
  it("fills an empty lead with the first ticked department's head", () => {
    expect(autoLead([null, "h2", "h3"], "", "")).toBe("h2");
  });
  it("replaces the previous auto-filled lead", () => {
    expect(autoLead(["h2"], "h1", "h1")).toBe("h2");
  });
  it("keeps a lead picked by hand", () => {
    expect(autoLead(["h2"], "picked", "h1")).toBeNull();
  });
  it("does nothing when no ticked department has a head", () => {
    expect(autoLead([null], "", "")).toBeNull();
    expect(autoLead([], "h1", "h1")).toBeNull();
  });
});
