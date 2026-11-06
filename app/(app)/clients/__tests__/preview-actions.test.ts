import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMe: vi.fn(), can: vi.fn(), createClient: vi.fn(), maybeSingle: vi.fn(),
  setCookie: vi.fn(), logAudit: vi.fn(), redirect: vi.fn(),
}));

vi.mock("@/lib/auth/can", () => ({ getMe: mocks.getMe, can: mocks.can }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/modules/access/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mocks.setCookie }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { startClientPreview } from "../preview-actions";
import { PREVIEW_COOKIE, verifyPreview } from "@/lib/modules/portal/preview";

const CLIENT = "c0000000-0000-4000-8000-000000000002";
const STAFF = "00000000-0000-4000-8000-000000000001";

describe("client view preview entry", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("SUPABASE_SECRET_KEY", "preview-test-secret");
    mocks.getMe.mockResolvedValue({ id: STAFF, kind: "staff" });
    mocks.can.mockReturnValue(true);
    mocks.createClient.mockResolvedValue({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }),
    });
    mocks.maybeSingle.mockResolvedValue({ data: { id: CLIENT, name: "Example client" } });
    mocks.redirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT"); });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("rejects an invalid client id before accessing data", async () => {
    expect(await startClientPreview("invalid")).toMatchObject({ ok: false });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });

  it("requires a staff member with clients.view", async () => {
    mocks.can.mockReturnValue(false);
    expect(await startClientPreview(CLIENT)).toMatchObject({ ok: false });
    mocks.can.mockReturnValue(true);
    mocks.getMe.mockResolvedValue({ id: STAFF, kind: "client" });
    expect(await startClientPreview(CLIENT)).toMatchObject({ ok: false });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("rejects a client outside the staff member's RLS scope", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null });
    expect(await startClientPreview(CLIENT)).toMatchObject({ ok: false });
    expect(mocks.setCookie).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("reports missing preview configuration", async () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    expect(await startClientPreview(CLIENT)).toEqual({ ok: false, error: "Preview is not set up on this server." });
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });

  it("signs a scoped cookie before redirecting to the selected client's portal", async () => {
    await expect(startClientPreview(CLIENT)).rejects.toThrow("NEXT_REDIRECT");
    const [name, token, options] = mocks.setCookie.mock.calls[0];
    expect(name).toBe(PREVIEW_COOKIE);
    expect(verifyPreview(token, "preview-test-secret")).toMatchObject({ clientId: CLIENT, staffId: STAFF });
    expect(options).toMatchObject({ path: "/", httpOnly: true, sameSite: "lax", maxAge: 1800 });
    expect(mocks.logAudit).toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith("/portal/home");
  });
});
