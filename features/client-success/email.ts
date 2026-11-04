// Email adapter for sending monthly reports and rating requests.
// The provider (Resend, Brevo, Mailjet or Google Workspace SMTP) is not chosen yet, so the only
// implementation says "not connected". A real adapter implements Mailer and is returned by getMailer().

export type MailInput = { to: string; subject: string; text: string };
export type MailResult = { ok: true } | { ok: false; error: string };

export interface Mailer {
  readonly configured: boolean;
  send(input: MailInput): Promise<MailResult>;
}

export const NOT_CONNECTED = "Email sending isn't connected yet. Ask an admin to connect an email provider.";

export const notConfiguredMailer: Mailer = {
  configured: false,
  async send() {
    return { ok: false, error: NOT_CONNECTED };
  },
};

export function getMailer(): Mailer {
  return notConfiguredMailer;
}
