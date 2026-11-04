import { describe, expect, it } from "vitest";
import { authErrorMessage, formatDay, formatWhen, inviteState, matrixChanges, roleDiff, safeNext } from "../logic";
import { hashInviteToken, newInviteToken } from "../token";

describe("safeNext", () => {
  it("keeps same-site paths", () => expect(safeNext("/tickets?view=board")).toBe("/tickets?view=board"));
  it("rejects other sites and empty values", () => {
    expect(safeNext("https://evil.test")).toBe("/home");
    expect(safeNext("//evil.test")).toBe("/home");
    expect(safeNext("/\\evil.test")).toBe("/home");
    expect(safeNext(null, "/portal")).toBe("/portal");
  });
});

describe("inviteState", () => {
  const now = new Date("2026-11-04T08:00:00Z");
  it("waiting until it expires", () => {
    expect(inviteState({ status: "pending", expires_at: "2026-11-10T06:00:00Z" }, now)).toBe("waiting");
    expect(inviteState({ status: "pending", expires_at: "2026-11-01T06:00:00Z" }, now)).toBe("expired");
  });
  it("accepted and revoked win over dates", () => {
    expect(inviteState({ status: "accepted", expires_at: "2026-11-01T06:00:00Z" }, now)).toBe("accepted");
    expect(inviteState({ status: "revoked", expires_at: "2026-12-01T06:00:00Z" }, now)).toBe("revoked");
  });
});

describe("matrixChanges", () => {
  it("returns only changed cells, treating missing as none", () => {
    const saved = { "member|time.view": "own", "dept_head|time.approve": "team" } as const;
    const edited = { "member|time.view": "own", "dept_head|time.approve": "all", "member|chat.use": "none", "member|calendar.use": "own" } as const;
    expect(matrixChanges(saved, edited)).toEqual([
      { role: "dept_head", perm: "time.approve", scope: "all" },
      { role: "member", perm: "calendar.use", scope: "own" },
    ]);
  });
});

describe("roleDiff", () => {
  it("adds and removes", () => expect(roleDiff(["member", "dept_head"], ["member", "admin"])).toEqual({ add: ["admin"], remove: ["dept_head"] }));
});

describe("formatWhen (Dubai time)", () => {
  const now = new Date("2026-11-04T10:00:00Z"); // 14:00 in Dubai
  it("today", () => expect(formatWhen("2026-11-04T05:14:00Z", now)).toBe("Today 09:14"));
  it("earlier this year", () => expect(formatWhen("2026-11-03T13:40:00Z", now)).toBe("3 Nov 17:40"));
  it("another year", () => expect(formatWhen("2025-12-31T06:00:00Z", now)).toBe("31 Dec 2025 10:00"));
  it("uses Dubai date, not UTC date", () => expect(formatWhen("2026-11-03T21:30:00Z", now)).toBe("Today 01:30"));
  it("formatDay", () => expect(formatDay("2026-11-02T04:30:00Z")).toBe("2 Nov 2026"));
});

describe("authErrorMessage", () => {
  it("maps common Supabase errors", () => {
    expect(authErrorMessage("Invalid login credentials")).toBe("Wrong email or password.");
    expect(authErrorMessage("Token has expired or is invalid")).toMatch(/code is wrong/);
    expect(authErrorMessage("Email rate limit exceeded")).toMatch(/Too many tries/);
    expect(authErrorMessage(undefined)).toMatch(/Something went wrong/);
  });
});

describe("invite tokens", () => {
  it("hash matches Postgres encode(sha256('seed-faisal'), 'hex')", () => {
    expect(hashInviteToken("seed-faisal")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashInviteToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("new tokens are long and unique", () => {
    const a = newInviteToken();
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(newInviteToken()).not.toBe(a);
  });
});
