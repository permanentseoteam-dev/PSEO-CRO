import { describe, expect, it } from "vitest";
import { ServiceName, deleteWarning, duplicateError, isDuplicateName, withCurrent } from "../logic";

describe("ServiceName", () => {
  it("trims and accepts 2 to 40 characters", () => {
    expect(ServiceName.parse("  SEO  ")).toBe("SEO");
    expect(ServiceName.safeParse("x".repeat(40)).success).toBe(true);
  });
  it("rejects too short or too long names", () => {
    for (const n of ["", "   ", " a ", "x".repeat(41)]) expect(ServiceName.safeParse(n).success, n).toBe(false);
  });
});

describe("isDuplicateName", () => {
  const list = [
    { id: "a", name: "SEO" },
    { id: "b", name: "Social" },
  ];
  it("ignores case and outer spaces", () => {
    expect(isDuplicateName(" seo ", list)).toBe(true);
    expect(isDuplicateName("SOCIAL", list)).toBe(true);
    expect(isDuplicateName("PPC", list)).toBe(false);
  });
  it("lets a service keep or recase its own name", () => {
    expect(isDuplicateName("seo", list, "a")).toBe(false);
    expect(isDuplicateName("seo", list, "b")).toBe(true);
  });
  it("names the clash", () => {
    expect(duplicateError(" SEO ")).toBe('A service called "SEO" already exists.');
  });
});

describe("deleteWarning", () => {
  it("says when nothing uses it", () => {
    expect(deleteWarning("Web", { templates: 0, clients: 0 })).toBe('Delete "Web"? No templates or clients use it. This can\'t be undone.');
  });
  it("counts templates and clients that keep the old name", () => {
    expect(deleteWarning("SEO", { templates: 1, clients: 3 })).toContain('1 template and 3 clients use it and will keep "SEO" as their service.');
    expect(deleteWarning("SEO", { templates: 0, clients: 1 })).toContain("1 client uses it");
  });
});

describe("withCurrent", () => {
  it("keeps list order and appends unknown current values once", () => {
    expect(withCurrent(["SEO", "PPC"], ["PPC", "Video", "Video", ""])).toEqual(["SEO", "PPC", "Video"]);
  });
  it("returns the list when nothing is unknown", () => {
    expect(withCurrent(["SEO"], [])).toEqual(["SEO"]);
  });
});
