import { describe, expect, it } from "vitest";
import { REQUEST_ACTION, accessMessage, accessNotice, alreadyAsked, pageTitleFrom, pickAdmins } from "../request-logic";

describe("accessNotice / accessMessage", () => {
  it("builds the bell row", () => {
    expect(accessNotice({ requesterId: "u1", title: "Clients", path: "/clients" })).toEqual({
      kind: "system",
      action: "asked for access to",
      subject: "Clients",
      detail: "(/clients)",
      href: "/admin/people/u1",
    });
  });
  it("reads as one line", () => expect(accessMessage("Sara Khan", "Clients", "/clients")).toBe("Sara Khan asked for access to Clients (/clients)"));
});

describe("alreadyAsked", () => {
  const now = new Date("2026-11-06T12:00:00Z");
  const row = (detail: string, created_at: string, action = REQUEST_ACTION) => ({ action, detail, created_at });
  it("blocks a repeat for the same path within 24h", () => {
    expect(alreadyAsked([row("(/clients)", "2026-11-05T13:00:00Z")], "/clients", now)).toBe(true);
  });
  it("allows a request after 24h", () => {
    expect(alreadyAsked([row("(/clients)", "2026-11-05T11:59:00Z")], "/clients", now)).toBe(false);
  });
  it("allows a different path", () => {
    expect(alreadyAsked([row("(/clients)", "2026-11-06T11:00:00Z")], "/finance", now)).toBe(false);
  });
  it("ignores other notifications", () => {
    expect(alreadyAsked([row("(/clients)", "2026-11-06T11:00:00Z", "mentioned you on")], "/clients", now)).toBe(false);
    expect(alreadyAsked([], "/clients", now)).toBe(false);
  });
});

describe("pageTitleFrom", () => {
  it("drops the site suffix", () => expect(pageTitleFrom("Person · Admin · Permanent SEO", "/admin/people/x")).toBe("Person · Admin"));
  it("falls back to the path", () => {
    expect(pageTitleFrom("Permanent SEO", "/finance")).toBe("/finance");
    expect(pageTitleFrom("", "/finance")).toBe("/finance");
  });
  it("works after the agency is renamed", () => {
    expect(pageTitleFrom("Clients · Acme Digital", "/clients")).toBe("Clients");
    expect(pageTitleFrom("Acme Digital", "/clients")).toBe("/clients");
  });
});

describe("pickAdmins", () => {
  const m = (name: string, status = "active", kind = "staff") => ({ name, status, kind });
  it("keeps active staff once, without me, sorted", () => {
    const rows = [
      { member_id: "b", member: m("Zed") },
      { member_id: "a", member: m("Amy") },
      { member_id: "a", member: [m("Amy")] },
      { member_id: "me", member: m("Me") },
      { member_id: "c", member: m("Off", "disabled") },
      { member_id: "d", member: null },
    ];
    expect(pickAdmins(rows, "me")).toEqual([
      { id: "a", name: "Amy" },
      { id: "b", name: "Zed" },
    ]);
  });
});
