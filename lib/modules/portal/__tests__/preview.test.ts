import { describe, expect, it } from "vitest";
import { newPreview, PREVIEW_TTL_MS, resolvePortalScope, signPreview, verifyPreview } from "../preview";
import { mmss, portalAccentCss } from "../logic";

const SECRET = "test-secret";
const CLIENT = "c0000000-0000-4000-8000-000000000002";
const STAFF = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-000000000008";
const NOW = Date.parse("2026-11-04T10:00:00Z");

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");

describe("preview cookie", () => {
  it("round-trips a fresh preview", () => {
    const p = newPreview(CLIENT, STAFF, NOW);
    expect(p.exp).toBe(NOW + PREVIEW_TTL_MS);
    expect(verifyPreview(signPreview(p, SECRET), SECRET, NOW)).toEqual(p);
  });

  it("is valid until 30 minutes, then expires", () => {
    const token = signPreview(newPreview(CLIENT, STAFF, NOW), SECRET);
    expect(verifyPreview(token, SECRET, NOW + PREVIEW_TTL_MS - 1)).not.toBeNull();
    expect(verifyPreview(token, SECRET, NOW + PREVIEW_TTL_MS)).toBeNull();
    expect(verifyPreview(token, SECRET, NOW + PREVIEW_TTL_MS + 60_000)).toBeNull();
  });

  it("rejects another secret", () => {
    const token = signPreview(newPreview(CLIENT, STAFF, NOW), SECRET);
    expect(verifyPreview(token, "other-secret", NOW)).toBeNull();
  });

  it("rejects a tampered payload (other client, longer expiry)", () => {
    const token = signPreview(newPreview(CLIENT, STAFF, NOW), SECRET);
    const sig = token.split(".")[1];
    const forged = `${b64({ clientId: "c0000000-0000-4000-8000-000000000003", staffId: STAFF, exp: NOW + PREVIEW_TTL_MS })}.${sig}`;
    expect(verifyPreview(forged, SECRET, NOW)).toBeNull();
  });

  it("rejects an expiry further out than 30 minutes even when signed", () => {
    const token = signPreview({ clientId: CLIENT, staffId: STAFF, exp: NOW + 24 * 3600_000 }, SECRET);
    expect(verifyPreview(token, SECRET, NOW)).toBeNull();
  });

  it("rejects junk, empty values and a missing secret", () => {
    const good = signPreview(newPreview(CLIENT, STAFF, NOW), SECRET);
    for (const t of [undefined, null, "", "abc", "a.b.c", `${good}.x`, `.${good.split(".")[1]}`]) {
      expect(verifyPreview(t, SECRET, NOW)).toBeNull();
    }
    expect(verifyPreview(good, undefined, NOW)).toBeNull();
    expect(verifyPreview(good, "", NOW)).toBeNull();
    expect(() => signPreview(newPreview(CLIENT, STAFF, NOW), "")).toThrow();
  });

  it("rejects a signed payload with bad fields", () => {
    const bad = [
      { clientId: "not-a-uuid", staffId: STAFF, exp: NOW + 1000 },
      { clientId: CLIENT, staffId: 7, exp: NOW + 1000 },
      { clientId: CLIENT, staffId: STAFF, exp: "soon" },
    ];
    for (const p of bad) expect(verifyPreview(signPreview(p as never, SECRET), SECRET, NOW)).toBeNull();
  });
});

describe("resolvePortalScope", () => {
  const staff = { id: STAFF, kind: "staff" as const, clientId: null, perms: { "clients.view": "team" as const } };
  const client = { id: "00000000-0000-4000-8000-000000000101", kind: "client" as const, clientId: CLIENT, perms: {} };
  const preview = newPreview(CLIENT, STAFF, NOW);

  it("gives a client login its own client and ignores any preview", () => {
    expect(resolvePortalScope(client, null)).toEqual({ mode: "client", clientId: CLIENT });
    expect(resolvePortalScope(client, { ...preview, clientId: "c0000000-0000-4000-8000-000000000005" })).toEqual({ mode: "client", clientId: CLIENT });
  });

  it("gives staff with their own valid preview the cookie's client", () => {
    expect(resolvePortalScope(staff, preview)).toEqual({ mode: "preview", clientId: CLIENT, staffId: STAFF, exp: preview.exp });
  });

  it("sends staff without a preview away", () => {
    expect(resolvePortalScope(staff, null)).toEqual({ mode: "none" });
  });

  it("ignores another staff member's preview", () => {
    expect(resolvePortalScope({ ...staff, id: OTHER }, preview)).toEqual({ mode: "none" });
  });

  it("ignores the preview once clients.view is gone", () => {
    expect(resolvePortalScope({ ...staff, perms: {} }, preview)).toEqual({ mode: "none" });
  });
});

describe("mmss", () => {
  it("formats the countdown and never goes negative", () => {
    expect(mmss(PREVIEW_TTL_MS)).toBe("30:00");
    expect(mmss(65_000)).toBe("01:05");
    expect(mmss(500)).toBe("00:01");
    expect(mmss(0)).toBe("00:00");
    expect(mmss(-5000)).toBe("00:00");
  });
});

describe("portalAccentCss", () => {
  it("accepts hex colours only", () => {
    expect(portalAccentCss("#1d4ed8")).toContain("--accent:#1d4ed8");
    expect(portalAccentCss("#abc")).toContain("--accent:#abc");
    expect(portalAccentCss("red;}body{display:none")).toBeNull();
    expect(portalAccentCss(null)).toBeNull();
  });
});
