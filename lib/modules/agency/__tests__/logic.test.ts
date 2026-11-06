import { describe, expect, it } from "vitest";
import { AgencyInput, DEFAULT_AGENCY, agencyFromRow, suggestInitials, toRow } from "../logic";

const ok = { name: "Acme Growth", subtitle: "Agency portal", initials: "", logoUrl: "", workdayHours: 8 };

describe("suggestInitials", () => {
  it("takes the first letter of the first two words", () => {
    expect(suggestInitials("Permanent SEO")).toBe("PS");
    expect(suggestInitials("  acme   growth labs ")).toBe("AG");
    expect(suggestInitials("Solo")).toBe("S");
    expect(suggestInitials("   ")).toBe("");
  });
});

describe("AgencyInput", () => {
  it("accepts a valid form", () => {
    expect(AgencyInput.safeParse(ok).success).toBe(true);
    expect(AgencyInput.safeParse({ ...ok, logoUrl: "https://cdn.example.com/logo.png", initials: "AGL" }).success).toBe(true);
  });
  it("rejects a blank name", () => {
    expect(AgencyInput.safeParse({ ...ok, name: "   " }).success).toBe(false);
  });
  it("only allows https logo URLs", () => {
    for (const logoUrl of ["http://x.com/a.png", "javascript:alert(1)", "data:image/png;base64,AA", "ftp://x/a.png", "https://"]) {
      const r = AgencyInput.safeParse({ ...ok, logoUrl });
      expect(r.success, logoUrl).toBe(false);
    }
  });
  it("limits initials to 3 characters", () => {
    expect(AgencyInput.safeParse({ ...ok, initials: "ABCD" }).success).toBe(false);
  });
  it("keeps the workday between 1 and 16 hours", () => {
    expect(AgencyInput.safeParse({ ...ok, workdayHours: 0.5 }).success).toBe(false);
    expect(AgencyInput.safeParse({ ...ok, workdayHours: 17 }).success).toBe(false);
    expect(AgencyInput.safeParse({ ...ok, workdayHours: Number.NaN }).success).toBe(false);
    expect(AgencyInput.safeParse({ ...ok, workdayHours: 1 }).success).toBe(true);
    expect(AgencyInput.safeParse({ ...ok, workdayHours: 16 }).success).toBe(true);
  });
});

describe("toRow", () => {
  it("stores hours as minutes and fills blank initials from the name", () => {
    const p = AgencyInput.parse({ ...ok, workdayHours: 7.5 });
    expect(toRow(p)).toEqual({ name: "Acme Growth", subtitle: "Agency portal", initials: "AG", logo_url: null, workday_minutes: 450 });
  });
  it("keeps typed initials (upper case) and the logo", () => {
    const p = AgencyInput.parse({ ...ok, initials: "ag", logoUrl: " https://x.com/l.png " });
    expect(toRow(p)).toMatchObject({ initials: "AG", logo_url: "https://x.com/l.png" });
  });
});

describe("agencyFromRow", () => {
  it("falls back to the defaults with no row", () => {
    expect(agencyFromRow(null)).toEqual(DEFAULT_AGENCY);
    expect(agencyFromRow(undefined)).toEqual(DEFAULT_AGENCY);
  });
  it("uses stored values", () => {
    expect(
      agencyFromRow({ name: "Acme", subtitle: "Team", initials: "AC", logo_url: "https://x.com/l.png", workday_minutes: 420 }),
    ).toEqual({ name: "Acme", subtitle: "Team", initials: "AC", logoUrl: "https://x.com/l.png", workdayMinutes: 420 });
  });
  it("replaces bad values", () => {
    const a = agencyFromRow({ name: " ", initials: null, logo_url: "http://x.com/l.png", workday_minutes: 5000 });
    expect(a).toEqual({ ...DEFAULT_AGENCY });
    expect(agencyFromRow({ name: "Acme Growth", initials: "" }).initials).toBe("AG");
  });
});
