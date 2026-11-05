import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getEmailSender, type EmailAttachment, type SendResult } from "./email";

export type LoggedEmail = {
  kind: "invoice" | "reminder" | "receipt" | "statement" | "other";
  to: string;
  cc?: string;
  subject: string;
  /** Plain text; turned into simple HTML. */
  text: string;
  invoiceId?: string | null;
  createdBy: string;
  attachments?: EmailAttachment[];
};

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const toHtml = (text: string) => text.split(/\n{2,}/).map((p) => `<p>${escape(p).replace(/\n/g, "<br>")}</p>`).join("");

/**
 * Sends through the provider chosen in Finance settings and writes an email_log row.
 * With no provider connected nothing is attempted or logged: it returns the not-configured result.
 */
export async function sendLoggedEmail(m: LoggedEmail): Promise<SendResult> {
  const supabase = await createClient();
  const { data } = await supabase.from("email_settings").select("provider").maybeSingle();
  const provider = (data?.provider as "resend" | "brevo" | "smtp" | "none" | undefined) ?? "none";
  const sender = getEmailSender(provider);
  if (!sender.configured) return sender.send(m.to, m.subject, "");
  const to = [m.to, ...(m.cc ?? "").split(",")].map((s) => s.trim()).filter(Boolean);
  const res = await sender.send(to, m.subject, toHtml(m.text), m.attachments);
  await supabase.from("email_log").insert({
    kind: m.kind,
    to_email: m.to,
    subject: m.subject,
    provider,
    status: res.ok ? "sent" : "failed",
    error: res.ok ? null : res.error,
    invoice_id: m.invoiceId ?? null,
    created_by: m.createdBy,
  });
  return res;
}
