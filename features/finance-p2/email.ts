// Email provider adapter. Every provider is "not configured" until the lead adds an API key on the server
// and replaces the matching implementation below. No real API calls, no secrets in the database.

export type EmailProvider = "resend" | "brevo" | "smtp";

export type EmailAttachment = { filename: string; content: Uint8Array | string; contentType?: string };

export type SendResult = { ok: true; id: string } | { ok: false; error: string; notConfigured?: true };

export interface EmailSender {
  provider: EmailProvider | "none";
  configured: boolean;
  send(to: string | string[], subject: string, html: string, attachments?: EmailAttachment[]): Promise<SendResult>;
}

const LABEL: Record<EmailProvider | "none", string> = { none: "No provider", resend: "Resend", brevo: "Brevo", smtp: "SMTP" };
export const providerLabel = (p: EmailProvider | "none") => LABEL[p];

function notConfigured(provider: EmailProvider | "none"): EmailSender {
  return {
    provider,
    configured: false,
    async send() {
      return {
        ok: false,
        notConfigured: true,
        error: provider === "none" ? "Email sending isn't set up yet. Pick a provider in Finance settings." : `${LABEL[provider]} isn't connected yet.`,
      };
    },
  };
}

/** The sender for the chosen provider. All return the not-configured sender for now. */
export function getEmailSender(provider: EmailProvider | "none"): EmailSender {
  switch (provider) {
    case "resend": // later: POST https://api.resend.com/emails with RESEND_API_KEY
    case "brevo": // later: POST https://api.brevo.com/v3/smtp/email with BREVO_API_KEY
    case "smtp": // later: SMTP_HOST / SMTP_USER / SMTP_PASS
    default:
      return notConfigured(provider);
  }
}
