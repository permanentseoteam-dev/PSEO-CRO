import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { buildPreviewCards } from "../preview-cards";

const clients = [
  { id: "a", name: "Acme", status: "active", services: ["SEO"] },
  { id: "b", name: "Beta", status: null, services: null },
];

describe("buildPreviewCards", () => {
  it("counts per client and takes the first meeting and activity row", () => {
    const [a, b] = buildPreviewCards(
      clients,
      [{ client_id: "a" }, { client_id: "a" }, { client_id: "b" }],
      [{ client_id: "a" }],
      [{ client_id: "a", at: "2026-11-10T09:00:00Z" }, { client_id: "a", at: "2026-11-20T09:00:00Z" }],
      [{ client_id: "b", at: "2026-11-05T09:00:00Z" }, { client_id: "b", at: "2026-11-01T09:00:00Z" }],
    );
    expect(a).toMatchObject({ openWork: 2, waiting: 1, nextMeeting: "2026-11-10T09:00:00Z", lastActivity: null, services: ["SEO"] });
    expect(b).toMatchObject({ openWork: 1, waiting: 0, nextMeeting: null, lastActivity: "2026-11-05T09:00:00Z", status: null, services: [] });
  });

  it("leaves a fact empty when its read failed", () => {
    const [a] = buildPreviewCards(clients, null, null, null, null);
    expect(a).toMatchObject({ openWork: null, waiting: null, nextMeeting: undefined, lastActivity: undefined });
  });
});
