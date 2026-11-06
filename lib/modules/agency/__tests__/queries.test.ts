import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AGENCY } from "../logic";

const createClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => createClient() }));

// A fake Supabase client whose table read and rpc both resolve to `result`.
const fake = (result: { data: unknown; error: unknown }) => {
  const q = { select: () => q, maybeSingle: async () => result };
  return { from: () => q, rpc: () => q };
};

beforeEach(() => {
  vi.resetModules();
  createClient.mockReset();
});

const load = () => import("../queries");

describe("getAgencySettings", () => {
  it("falls back to the defaults when the table is missing", async () => {
    createClient.mockResolvedValue(fake({ data: null, error: { message: 'relation "agency_settings" does not exist' } }));
    expect(await (await load()).getAgencySettings()).toEqual(DEFAULT_AGENCY);
  });
  it("falls back to the defaults when the client throws", async () => {
    createClient.mockRejectedValue(new Error("no request scope"));
    expect(await (await load()).getAgencySettings()).toEqual(DEFAULT_AGENCY);
  });
  it("returns the stored row", async () => {
    createClient.mockResolvedValue(
      fake({ data: { name: "Acme", subtitle: "Team", initials: "AC", logo_url: null, workday_minutes: 420 }, error: null }),
    );
    expect(await (await load()).getAgencySettings()).toEqual({ name: "Acme", subtitle: "Team", initials: "AC", logoUrl: null, workdayMinutes: 420 });
  });
});

describe("getAgencyBrand", () => {
  it("falls back to the default brand when agency_brand() is missing", async () => {
    createClient.mockResolvedValue(fake({ data: null, error: { message: "function public.agency_brand() does not exist" } }));
    const { name, subtitle, initials, logoUrl } = DEFAULT_AGENCY;
    expect(await (await load()).getAgencyBrand()).toEqual({ name, subtitle, initials, logoUrl });
  });
  it("returns the brand fields only", async () => {
    createClient.mockResolvedValue(fake({ data: { name: "Acme", subtitle: "Team", initials: "AC", logo_url: "https://x.com/l.png" }, error: null }));
    expect(await (await load()).getAgencyBrand()).toEqual({ name: "Acme", subtitle: "Team", initials: "AC", logoUrl: "https://x.com/l.png" });
  });
});
