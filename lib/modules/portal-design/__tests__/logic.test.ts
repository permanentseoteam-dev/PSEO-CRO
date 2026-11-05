import { describe, expect, it } from "vitest";
import { ACCENT_CHOICES, DEFAULT_DESIGN, accentProblem, contrastRatio, defaultsFromRow, logoExt, mergeDesign } from "../logic";

describe("contrastRatio", () => {
  it("matches the WCAG extremes", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });
  it("is symmetric and matches known values", () => {
    expect(contrastRatio("#0d9488", "#ffffff")).toBeCloseTo(contrastRatio("#ffffff", "#0d9488"), 10);
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
  });
});

describe("accentProblem", () => {
  it("accepts colours at 4.5:1 or more on white", () => {
    expect(accentProblem("#767676")).toBeNull();
    expect(accentProblem("#0F766E")).toBeNull();
  });
  it("rejects colours below 4.5:1", () => {
    expect(accentProblem("#777777")).toMatch(/Too light on white \(4\.4:1\)/);
    expect(accentProblem("#0d9488")).toMatch(/3\.7:1/);
    expect(accentProblem("#ffff00")).not.toBeNull();
  });
  it("rejects anything that isn't #rrggbb", () => {
    for (const v of ["", "0f766e", "#0f766", "#0f766g", "red", "#0f766e00"]) expect(accentProblem(v)).not.toBeNull();
  });
  it("only offers accessible one-click colours, and the default is one", () => {
    for (const c of ACCENT_CHOICES) expect(accentProblem(c)).toBeNull();
    expect(accentProblem(DEFAULT_DESIGN.accent)).toBeNull();
  });
});

describe("mergeDesign", () => {
  const defaults = { accent: "#1d4ed8", logoUrl: "https://x/default.png", theme: "dark" as const, density: "compact" as const };

  it("uses the defaults when there is no client branding", () => {
    expect(mergeDesign(defaults, null)).toEqual(defaults);
    expect(mergeDesign(defaults, { portal_color: null, portal_logo_url: null })).toEqual(defaults);
    expect(mergeDesign(defaults, { portal_color: "", portal_logo_url: "" })).toEqual(defaults);
  });
  it("lets client colour and logo win, keeping theme and density", () => {
    expect(mergeDesign(defaults, { portal_color: "#BE123C", portal_logo_url: "https://x/client.png" })).toEqual({
      accent: "#be123c",
      logoUrl: "https://x/client.png",
      theme: "dark",
      density: "compact",
    });
  });
  it("overrides each field on its own", () => {
    expect(mergeDesign(defaults, { portal_color: "#be123c" }).logoUrl).toBe(defaults.logoUrl);
    expect(mergeDesign(defaults, { portal_logo_url: "https://x/c.png" }).accent).toBe(defaults.accent);
  });
  it("ignores a malformed client colour", () => {
    expect(mergeDesign(defaults, { portal_color: "teal" }).accent).toBe(defaults.accent);
  });
});

describe("defaultsFromRow", () => {
  it("falls back to built-in defaults for a missing or bad row", () => {
    expect(defaultsFromRow(null, null)).toEqual(DEFAULT_DESIGN);
    expect(defaultsFromRow({ accent: "nope", theme: "neon", density: "tight" }, null)).toEqual(DEFAULT_DESIGN);
  });
  it("reads a saved row", () => {
    expect(defaultsFromRow({ accent: "#334155", theme: "light", density: "compact" }, "u")).toEqual({
      accent: "#334155",
      logoUrl: "u",
      theme: "light",
      density: "compact",
    });
  });
});

describe("logoExt", () => {
  it("allows PNG, JPG and WebP only", () => {
    expect(logoExt("image/png")).toBe("png");
    expect(logoExt("image/jpeg")).toBe("jpg");
    expect(logoExt("image/webp")).toBe("webp");
    expect(logoExt("image/svg+xml")).toBeNull();
    expect(logoExt("image/gif")).toBeNull();
  });
});
