// AI email drafting adapter. No provider is configured yet: getEmailDrafter() returns the not-configured drafter,
// which makes no API calls. When an AI provider key is added, implement EmailDrafter server-side (key in env or
// Supabase Vault, never in the browser) and return it from getEmailDrafter().
import "server-only";

export type DraftResult = { ok: true; body: string } | { ok: false; reason: "not_configured" | "failed"; message: string };

export type EmailDrafter = {
  configured: boolean;
  draft(prompt: { system: string; user: string }): Promise<DraftResult>;
};

const notConfigured: EmailDrafter = {
  configured: false,
  draft: async () => ({
    ok: false,
    reason: "not_configured",
    message: "AI drafting isn't connected yet. Write the email yourself or ask an admin to add an AI provider.",
  }),
};

export function getEmailDrafter(): EmailDrafter {
  return notConfigured;
}
